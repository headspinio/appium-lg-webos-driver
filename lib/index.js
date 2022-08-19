import B from 'bluebird';
import _ from 'lodash';
import {BaseDriver, errors} from 'appium/driver';
import {extendDevMode, getDeviceInfo, launchApp, closeApp,
        installApp, uninstallApp} from './cli/ares';
import {CAP_CONSTRAINTS, DEFAULT_CAPS} from './capabilities';
import Chromedriver from 'appium-chromedriver';
import getPort from 'get-port';
import log from './logger';
import {webos_pressKey} from './keys';

// don't proxy any 'appium' routes
const NO_PROXY = [
  ['POST', new RegExp('^/session/[^/]+/appium')],
  ['GET', new RegExp('^/session/[^/]+/appium')],
  ['POST', new RegExp('^/session/[^/]+/execute/sync')],
];

export class WebOSDriver extends BaseDriver {

  static executeMethodMap = {
    'webos: pressKey': {
      command: webos_pressKey,
      params: {required: ['key'], optional: ['duration']},
    }
  }

  constructor(opts = {}, shouldValidateCaps = true) {
    super(opts, shouldValidateCaps);
    this.desiredCapConstraints = CAP_CONSTRAINTS;
    this.jwpProxyActive = false;
    this.jwpProxyAvoid = _.clone(NO_PROXY);
  }

  async createSession(_jwp, _jwp2, _caps) {
    _caps.alwaysMatch = {...DEFAULT_CAPS, ..._caps.alwaysMatch};
    let [sessionId, caps] = await super.createSession(null, null, _caps);
    const {autoExtendDevMode, deviceName, app, appId, appLaunchParams,
           noReset, fullReset, deviceHost, debuggerPort,
           chromedriverExecutable, appLaunchCooldown, remoteOnly} = caps;

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
        `name '${deviceName}'. Are you sure the device is ` +
        `connected? (Original error: ${error})`);
    }

    if (fullReset) {
      try {
        await uninstallApp(appId, deviceName);
      } catch (err) {
        // if the app is not installed, we expect the following error message, so if we get any
        // message other than that one, bubble the error up. Otherwise, just ignore!
        if (!/FAILED_REMOVE/.test(err.message)) {
          throw err;
        }
      }
    }

    if (app) {
      await installApp(app, appId, deviceName);
    }

    await launchApp(appId, deviceName, appLaunchParams);

    log.info('Waiting for app launch to take effect');
    await B.delay(appLaunchCooldown);

    if (remoteOnly) {
      log.info(`Remote-only mode requested, not starting chromedriver`);
      return [sessionId, caps];
    }

    await this.startChromedriver({
      debuggerHost: deviceHost,
      debuggerPort,
      executable: chromedriverExecutable,
    });

    if (!noReset) {
      log.info('Clearing app local storage');
      await this.executeInChrome('window.localStorage.clear()');
      log.info('Reloading page');
      await this.executeInChrome('window.location.reload()');
    }

    return [sessionId, caps];
  }

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

  async executeInChrome(script, args = []) {
    return await this.chromedriver.sendCommand('/execute/sync', 'POST', {script, args});
  }

  async execute(script, args) {
    if (script.match(/^webos:/)) {
      return await this.executeMethod(script, args)
    } else if (this.chromedriver) {
      return await this.executeInChrome(script, args);
    }

    throw new errors.NotImplementedError();
  }

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
        log.warn(`Error stopping Chromedriver: ${err.message}`);
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
