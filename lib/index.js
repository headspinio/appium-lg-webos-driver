import _ from 'lodash';
import {BaseDriver, DeviceSettings} from 'appium/driver';
import {extendDevMode} from './cli/ares';
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
    let [sessionId, caps] = await super.createSession(null, null, _caps);
    caps = {...DEFAULT_CAPS, ...caps};

    if (caps.autoExtendDevMode) {
      await extendDevMode(caps.deviceName);
    }

    return [sessionId, caps];
  }

  async deleteSession() {
    await super.deleteSession();
  }
}
