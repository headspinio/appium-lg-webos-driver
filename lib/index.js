import _ from 'lodash';
import {BaseDriver, DeviceSettings} from 'appium/driver';
import {extendDevMode, getDeviceInfo} from './cli/ares';
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

    if (caps.autoExtendDevMode) {
      await extendDevMode(caps.deviceName);
    }

    caps.deviceInfo = await getDeviceInfo(caps.deviceName);

    return [sessionId, caps];
  }

  async deleteSession(sessionId, driverData) {
    // TODO decide if we want to extend at the end of the session too
    //if (this.opts.autoExtendDevMode) {
      //await extendDevMode(this.opts.deviceName);
    //}
    await super.deleteSession(sessionId, driverData);
  }
}
