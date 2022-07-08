import B from 'bluebird';
import _ from 'lodash';
import {BaseDriver, errors} from 'appium/driver';
import {extendDevMode, getDeviceInfo, launchApp, closeApp,
        installApp, uninstallApp} from './cli/ares';
import {CAP_CONSTRAINTS, DEFAULT_CAPS} from './capabilities';
// @ts-ignore
import Chromedriver from 'appium-chromedriver';
import getPort from 'get-port';
import log from './logger';
import {webos_pressKey} from './keys';

// don't proxy any 'appium' routes
/** @type {[import('@appium/types').HTTPMethod, RegExp][]} */
const NO_PROXY = [
  ['POST', new RegExp('^/session/[^/]+/appium')],
  ['GET', new RegExp('^/session/[^/]+/appium')],
  ['POST', new RegExp('^/session/[^/]+/execute/sync')],
];

const KNOWN_WEBOS_SCRIPTS = /** @type {const} */({
  pressKey: webos_pressKey
});

/**
 *
 * @param {string} script
 * @returns {script is KnownScriptString}
 */
function isKnownScript(script) {
  script = script.replace(/^webos:/, '').trim();
  return _.has(KNOWN_WEBOS_SCRIPTS, script);
}

export class WebOSDriver extends BaseDriver {

  /** @type {[import('@appium/types').HTTPMethod, RegExp][]} */
  jwpProxyAvoid = _.clone(NO_PROXY);

  /** @type {boolean} */
  jwpProxyActive = false;

  constructor(opts = {}, shouldValidateCaps = true) {
    super(opts, shouldValidateCaps);
    this.desiredCapConstraints = CAP_CONSTRAINTS;
  }

  /**
   *
   * @param {import('@appium/types').W3CCapabilities} _caps
   * @returns {Promise<[string,W3CCapabilities]>}
   */
  async createSession(_caps) {
    _caps.alwaysMatch = {...DEFAULT_CAPS, ..._caps.alwaysMatch};
    let [sessionId, caps] = await super.createSession(_caps);
    const {autoExtendDevMode, deviceName, app, appId, appLaunchParams,
           noReset, fullReset, deviceHost, debuggerPort,
           chromedriverExecutable, appLaunchCooldown} = caps;

    if (noReset && fullReset) {
      throw new Error(`Cannot use both noReset and fullReset`);
    }

    if (autoExtendDevMode) {
      await extendDevMode(deviceName);
    }

    try {
      caps.deviceInfo = await getDeviceInfo(deviceName);
    } catch (error) {
      throw new Error(`Could not retrieve device info for device with ` +
        `name '${caps.deviceName}'. Are you sure the device is ` +
        `connected? (Original error: ${error})`);
    }

    if (fullReset) {
      try {
        await uninstallApp(appId, deviceName);
      } catch (err) {
        // if the app is not installed, we expect the following error message, so if we get any
        // message other than that one, bubble the error up. Otherwise, just ignore!
        if (!/FAILED_REMOVE/.test(/** @type {Error} */(err).message)) {
          throw err;
        }
      }
    }

    if (app) {
      await installApp(app, appId, deviceName);
    }

    await launchApp(appId, deviceName, appLaunchParams);

    await this.startChromedriver({
      debuggerHost: deviceHost,
      debuggerPort,
      executable: chromedriverExecutable,
    });

    log.info('Waiting for app launch to take effect');
    await B.delay(appLaunchCooldown);

    if (!noReset) {
      log.info('Clearing app local storage');
      await this.executeScript('window.localStorage.clear()');
      log.info('Reloading page');
      await this.executeScript('window.location.reload()');
    }

    return [sessionId, caps];
  }

  /**
   * @param {StartChromedriverOptions} opts
   */
  async startChromedriver ({debuggerHost, debuggerPort, executable}) {
    this.chromedriver = new Chromedriver({
      port: await getPort(),
      executable
    });

    const debuggerAddress = `${debuggerHost}:${debuggerPort}`;

    await this.chromedriver.start({'goog:chromeOptions': {
      debuggerAddress
    }});
    this.proxyReqRes = this.chromedriver.proxyReq.bind(this.chromedriver);
    this.jwpProxyActive = true;
  }

  /**
   *
   * @param {string} script
   * @param {string[]} [args]
   * @returns {Promise<any>}
   */
  async executeScript(script, args = []) {
    return await this.chromedriver.sendCommand('/execute/sync', 'POST', {script, args});
  }

  /**
   * @template {string} ScriptName
   * @template {ScriptName extends KnownScriptString ? KnownScriptOpts<ScriptName> : string} ScriptOpts
   * @param {ScriptName} script
   * @param {ScriptOpts[]} args
   */
  async execute(script, args = []) {
    if (script.match(/^webos:/)) {
      log.info(`Executing webOS command '${script}'`);

      if (isKnownScript(script)) {
        const scriptName = /** @type {KnownScriptName} */(script.replace(/^webos:/, '').trim());
        const opts = /** @type {KnownScriptOpts<typeof script>} */(args[0]);
        return await KNOWN_WEBOS_SCRIPTS[scriptName].call(this, opts);
      }
      throw new errors.NotImplementedError(`No such script "${script}"`);
    }

    return await this.executeScript(script, args);
  }

  /**
   *
   * @param {string} sessionId
   * @param {import('@appium/types').DriverData[]} [driverData]
   */
  async deleteSession(sessionId, driverData) {
    // TODO decide if we want to extend at the end of the session too
    //if (this.opts.autoExtendDevMode) {
      //await extendDevMode(this.opts.deviceName);
    //}
    if (this.chromedriver) {
      log.debug(`Stopping chromedriver`);
      // stop listening for the stopped state event
      this.chromedriver.removeAllListeners(Chromedriver.EVENT_CHANGED);
      try {
        await this.chromedriver.stop();
      } catch (err) {
        log.warn(`Error stopping Chromedriver: ${/** @type {Error} */(err).message}`);
      }
      this.chromedriver = null;
    }
    await closeApp(this.opts.appId, this.opts.deviceName);
    await super.deleteSession(sessionId, driverData);
  }

  proxyActive () {
    return this.jwpProxyActive;
  }

  getProxyAvoidList () {
    return this.jwpProxyAvoid;
  }

  canProxy () {
    return true;
  }
}

/**
 * @typedef {import('@appium/types').W3CCapabilities} W3CCapabilities
 * @typedef {import('./types').WebOSCapabilities} WebOSCapabilities
 */

/**
 * @typedef StartChromedriverOptions
 * @property {string} debuggerHost
 * @property {number} debuggerPort
 * @property {string} executable
 */

/**
 * @typedef {`webos:${KnownScriptName}` | `webos: ${KnownScriptName}`} KnownScriptString
 */

/**
 * @template {KnownScriptString} S
 * @typedef {typeof KNOWN_WEBOS_SCRIPTS[import('type-fest').Trim<import('type-fest').Replace<S, 'webos: ' | 'webos:', ''>>]} KnownScript
 */

/**
 * @typedef {keyof typeof KNOWN_WEBOS_SCRIPTS} KnownScriptName
 */

/**
 * @template {KnownScriptString} S
 * @typedef {Parameters<KnownScript<S>>[0]} KnownScriptOpts
 */
