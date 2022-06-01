import {BaseDriver} from 'appium/driver';

export class WebOSDriver extends BaseDriver {

  async createSession(_jwp, _jwp2, caps) {
    const [sessionId, finalCaps] = await super.createSession(null, null, caps);
    return [sessionId, finalCaps];
  }

  async deleteSession() {
    await super.deleteSession();
  }
}
