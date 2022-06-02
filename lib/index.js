import B from 'bluebird';
import _ from 'lodash';
import {BaseDriver} from 'appium/driver';
import {extendDevMode, getDeviceInfo, launchApp, closeApp} from './cli/ares';
import {CAP_CONSTRAINTS, DEFAULT_CAPS} from './capabilities';
import Chromedriver from 'appium-chromedriver';
import getPort from 'get-port';
import log from './logger';

// don't proxy any 'appium' routes
const NO_PROXY = [
  ['POST', new RegExp('^/session/[^/]+/appium')],
  ['GET', new RegExp('^/session/[^/]+/appium')],
];

export class WebOSDriver extends BaseDriver {

  constructor(opts = {}, shouldValidateCaps = true) {
    super(opts, shouldValidateCaps);
    this.desiredCapConstraints = CAP_CONSTRAINTS;
    this.jwpProxyActive = false;
    this.jwpProxyAvoid = _.clone(NO_PROXY);
  }

  async createSession(_jwp, _jwp2, _caps) {
    _caps.alwaysMatch = {...DEFAULT_CAPS, ..._caps.alwaysMatch};
    let [sessionId, caps] = await super.createSession(null, null, _caps);

    if (!caps.app && !caps.appId) {
      throw new Error(`You must include either an 'app' or 'appId' capability`);
    }

    if (caps.app && caps.appId) {
      throw new Error(`Don't use both the 'app' and 'appId' ` +
        `capabilities simultaneously. Pick one or the other.`);
    }

    if (caps.autoExtendDevMode) {
      await extendDevMode(caps.deviceName);
    }

    try {
      caps.deviceInfo = await getDeviceInfo(caps.deviceName);
    } catch (error) {
      throw new Error(`Could not retrieve device info for device with ` +
        `name '${caps.deviceName}'. Are you sure the device is ` +
        `connected? (Original error: ${error})`);
    }

    let {appId} = caps;
    if (caps.app) {
      throw new Error('TODO: not yet implemented');
    }
    this.opts.appId = appId;
    await launchApp(appId, caps.deviceName, caps.appLaunchParams);

    await this.startChromedriver({
      debuggerHost: caps.deviceHost,
      debuggerPort: caps.debuggerPort,
      executable: caps.chromedriverExecutable,
    });

    // TODO get remote control connection working
    //await this.setupRCApi(caps);
    //
    if (!caps.noReset) {
      log.info('Waiting for app launch to take effect');
      await B.delay(caps.appLaunchCooldown);
      log.info('Clearing app local storage');
      await this.executeScript('window.localStorage.clear()');
      log.info('Reloading page');
      await this.executeScript('window.location.reload()');
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

  async executeScript (script) {
    return await this.chromedriver.sendCommand('/execute/sync', 'POST', {
      script,
      args: [],
    });
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
