import {main as startAppium} from 'appium';
import {remote} from 'webdriverio';
import getPort from 'get-port';

const TEST_APP = process.env.TEST_APP;

const TEST_CAPS = {
  platformName: 'LGTV',
  'appium:automationName': 'WebOS',
  'appium:deviceName': 'LGTV',
  'appium:app': TEST_APP,
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

  it('should start and stop a session', async function() {
    /** @type WDBrowser */
    const driver = await remote({...WDIO_OPTS, port});
    await driver.deleteSession();
  });
});

/** @typedef {import('webdriverio').Browser<'async'>} WDBrowser */
