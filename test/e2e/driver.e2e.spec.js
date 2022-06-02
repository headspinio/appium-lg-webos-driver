import {main as startAppium} from 'appium';
import {remote} from 'webdriverio';
import getPort from 'get-port';

const TEST_APP = process.env.TEST_APP;
const TEST_DEVICE = process.env.TEST_DEVICE;
const TEST_APP_ID = 'com.suitest.watchme.app';

if (!TEST_APP || !TEST_DEVICE) {
  throw new Error(`
    The following env vars must be set for E2E tests to work:
    - TEST_APP: path to the suitest watchme .ipk file
    - TEST_DEVICE: the name/id of a connected tv device, as shown in
      ares-setup-device
  `);
}

const TEST_CAPS = {
  platformName: 'LGTV',
  'appium:automationName': 'WebOS',
  'appium:deviceName': TEST_DEVICE,
  'appium:appId': TEST_APP_ID,
};
const WDIO_OPTS = {
  hostname: 'localhost',
  path: '/',
  connectionRetryCount: 0,
  capabilities: TEST_CAPS,
};

describe('WebOSDriver - E2E', function() {
  /** @type {import('@appium/types').AppiumServer} */
  let server;
  let port;

  before(async function() {
    port = await getPort();
    server = await startAppium({port});
  });

  after(async function() {
    await server.close();
  });

  it('should start and stop a session via pre-installed app id', async function() {
    /** @type WDBrowser */
    const driver = await remote({...WDIO_OPTS, port});
    await driver.deleteSession();
  });
});

/** @typedef {import('webdriverio').Browser<'async'>} WDBrowser */
