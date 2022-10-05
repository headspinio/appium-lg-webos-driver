import B from 'bluebird';
import _ from 'lodash';
import {BaseDriver, errors} from 'appium/driver';
import {extendDevMode, getDeviceInfo, launchApp, closeApp,
        installApp, uninstallApp} from './cli/ares';
import {CAP_CONSTRAINTS, DEFAULT_CAPS} from './constraints';
// @ts-ignore
import Chromedriver from 'appium-chromedriver';
import getPort from 'get-port';
import log from './logger';
import {webos_pressKey, pressKeyViaJs, pressKeyViaRemote} from './keys';
import {LGWSClient} from './remote/lg-socket-client';
export {KEYS} from './keys';

// don't proxy any 'appium' routes
/** @type {RouteMatcher[]} */
const NO_PROXY = [
  ['POST', new RegExp('^/session/[^/]+/appium')],
  ['GET', new RegExp('^/session/[^/]+/appium')],
  ['POST', new RegExp('^/session/[^/]+/execute/sync')],
];

const KNOWN_WEBOS_SCRIPTS = Object.freeze(/** @type {const} */({
  pressKey: webos_pressKey
}));

/**
 *
 * @param {string} script
 * @returns {script is KnownScriptString}
 */
function isKnownScript(script) {
  script = script.replace(/^webos:/, '').trim();
  return _.has(KNOWN_WEBOS_SCRIPTS, script);
}

/**
 * @extends {BaseDriver<WebOsConstraints>}
 */
export class WebOSDriver extends BaseDriver {
  /** @type {RouteMatcher[]} */
  jwpProxyAvoid = _.clone(NO_PROXY);

  /** @type {boolean} */
  jwpProxyActive = false;

  webos_pressKey = webos_pressKey;
  pressKeyViaRemote = pressKeyViaRemote;
  pressKeyViaJs = pressKeyViaJs;

  /** @type {LGWSClient?} */
  socketClient;

  /** @type {import('./remote/lg-remote-client').LGRemoteClient?} */
  remoteClient;

  desiredCapConstraints = CAP_CONSTRAINTS;

  static executeMethodMap = {
    'webos: pressKey': {
      command: 'webos_pressKey',
      params: {required: ['key'], optional: ['duration']},
    },
  };

  constructor(opts = {}, shouldValidateCaps = true) {
    super(opts, shouldValidateCaps);
    this.jwpProxyActive = false;
    this.jwpProxyAvoid = _.clone(NO_PROXY);
    this.socketClient = null;
    this.remoteClient = null;
  }

  /**
   * @param {W3CWebOsCaps} w3cCaps1
   * @param {W3CWebOsCaps} w3cCaps2
   * @param {W3CWebOsCaps} w3cCaps3
   * @returns {Promise<[string,WebOsCaps]>}
   */
  async createSession(w3cCaps1, w3cCaps2, w3cCaps3) {
    w3cCaps3.alwaysMatch = {...DEFAULT_CAPS, ...w3cCaps3.alwaysMatch};
    let [sessionId, caps] = await super.createSession(w3cCaps1, w3cCaps2, w3cCaps3);
    const {
      autoExtendDevMode,
      deviceName,
      app,
      appId,
      appLaunchParams,
      noReset,
      fullReset,
      deviceHost,
      debuggerPort,
      chromedriverExecutable,
      appLaunchCooldown,
      remoteOnly,
      websocketPort,
      keyCooldown,
    } = caps;

    if (noReset && fullReset) {
      throw new Error(`Cannot use both noReset and fullReset`);
    }

    if (autoExtendDevMode) {
      await extendDevMode(deviceName);
    }

    try {
      caps.deviceInfo = await getDeviceInfo(deviceName);
    } catch (error) {
      throw new Error(
        `Could not retrieve device info for device with ` +
          `name '${deviceName}'. Are you sure the device is ` +
          `connected? (Original error: ${error})`
      );
    }

    if (fullReset) {
      try {
        await uninstallApp(appId, deviceName);
      } catch (err) {
        // if the app is not installed, we expect the following error message, so if we get any
        // message other than that one, bubble the error up. Otherwise, just ignore!
        if (!/FAILED_REMOVE/.test(/** @type {Error} */ (err).message)) {
          throw err;
        }
      }
    }

    if (app) {
      await installApp(app, appId, deviceName);
    }

    this.socketClient = new LGWSClient({
      url: `ws://${deviceHost}:${websocketPort}`,
      remoteKeyCooldown: keyCooldown,
    });
    log.info(`Connecting remote; address any prompts on screen now!`);
    await this.socketClient.initialize();
    this.remoteClient = await this.socketClient.getRemoteClient();

    await launchApp(appId, deviceName, appLaunchParams);

    const waitMsgInterval = setInterval(() => {
      log.info('Waiting for app launch to take effect');
    }, 1000);
    await B.delay(appLaunchCooldown);
    clearInterval(waitMsgInterval);

    if (remoteOnly) {
      log.info(`Remote-only mode requested, not starting chromedriver`);
      // in remote-only mode, we force rcMode to 'rc' instead of 'js'
      this.opts.rcMode = caps.rcMode = 'rc';
      return [sessionId, caps];
    }

    await this.startChromedriver({
      debuggerHost: deviceHost,
      debuggerPort,
      executable: chromedriverExecutable,
    });

    log.info('Waiting for app launch to take effect');
    await B.delay(appLaunchCooldown);

    if (!noReset) {
      log.info('Clearing app local storage');
      await this.executeInChrome('window.localStorage.clear()');
      log.info('Reloading page');
      await this.executeInChrome('window.location.reload()');
    }

    return [sessionId, caps];
  }

  /**
   * @param {StartChromedriverOptions} opts
   */
  async startChromedriver({debuggerHost, debuggerPort, executable}) {
    this.chromedriver = new Chromedriver({
      port: await getPort(),
      executable,
    });

    const debuggerAddress = `${debuggerHost}:${debuggerPort}`;

    // XXX: goog:chromeOptions in newer versions, chromeOptions in older
    await this.chromedriver.start({
      chromeOptions: {
        debuggerAddress,
      },
    });
    this.proxyReqRes = this.chromedriver.proxyReq.bind(this.chromedriver);
    this.jwpProxyActive = true;
  }

  /**
   *
   * @param {string} script
   * @param {string[]} [args]
   * @returns {Promise<any>}
   */
  async executeInChrome(script, args = []) {
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
        const scriptName = /** @type {KnownScriptName} */ (script.replace(/^webos:/, '').trim());
        const opts = /** @type {KnownScriptOpts<typeof script>} */ (args[0]);
        return await KNOWN_WEBOS_SCRIPTS[scriptName].call(this, opts);
      }
      throw new errors.NotImplementedError(`No such script "${script}"`);
    }

    return await this.executeInChrome(script, args);
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
    if (this.socketClient) {
      log.debug(`Stopping socket clients`);
      try {
        await this.socketClient.disconnect();
      } catch (err) {
        log.warn(`Error stopping socket clients: ${err}`);
      }
      this.socketClient = null;
      this.remoteClient = null;
    }

    if (this.chromedriver) {
      log.debug(`Stopping chromedriver`);
      // stop listening for the stopped state event
      this.chromedriver.removeAllListeners(Chromedriver.EVENT_CHANGED);
      try {
        await this.chromedriver.stop();
      } catch (err) {
        log.warn(`Error stopping Chromedriver: ${/** @type {Error} */ (err).message}`);
      }
      this.chromedriver = null;
    }
    await closeApp(this.opts.appId, this.opts.deviceName);
    await super.deleteSession(sessionId, driverData);
  }

  proxyActive() {
    return this.jwpProxyActive;
  }

  getProxyAvoidList() {
    return this.jwpProxyAvoid;
  }

  canProxy() {
    return true;
  }
}

/**
 * @typedef {import('./types').ExtraWebOsCaps} WebOSCapabilities
 * @typedef {import('./constraints').WebOsConstraints} WebOsConstraints
 * @typedef {import('./keys').KnownKey} Key
 */

/**
 * @typedef {import('@appium/types').DriverCaps<WebOsConstraints, WebOSCapabilities>} WebOsCaps
 * @typedef {import('@appium/types').W3CDriverCaps<WebOsConstraints, WebOSCapabilities>} W3CWebOsCaps
 * @typedef {import('@appium/types').RouteMatcher} RouteMatcher
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

