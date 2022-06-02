import _ from 'lodash';
import {BaseDriver, DeviceSettings} from 'appium/driver';
import {extendDevMode, getDeviceInfo, launchApp, closeApp} from './cli/ares';
import {CAP_CONSTRAINTS, DEFAULT_CAPS} from './capabilities';

// don't proxy any 'appium' routes
const NO_PROXY = [
  ['POST', new RegExp('^/session/[^/]+/appium')],
  ['GET', new RegExp('^/session/[^/]+/appium')],
];

export class WebOSDriver extends BaseDriver {

  constructor (opts = {}, shouldValidateCaps = true) {
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

    return [sessionId, caps];
  }

  async deleteSession(sessionId, driverData) {
    // TODO decide if we want to extend at the end of the session too
    //if (this.opts.autoExtendDevMode) {
      //await extendDevMode(this.opts.deviceName);
    //}
    await closeApp(this.opts.appId, this.opts.deviceName);
    await super.deleteSession(sessionId, driverData);
  }
}
