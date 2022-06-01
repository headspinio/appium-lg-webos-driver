import {main as startAppium} from 'appium';
import {remote as wdio} from 'webdriverio';
import getPort from 'get-port';

const TEST_CAPS = {
  platformName: 'LGTV',
  'appium:automationName': 'WebOS',
  'appium:deviceName': 'LGTV',
  'appium:app': process.env.TEST_APP,
};
const WDIO_OPTS = {
  hostname: 'localhost',
  connectionRetryCount: 0,
  capabilities: TEST_CAPS,
};

describe('WebOSDriver - E2E', function () {
  /** @type {import('@appium/types').AppiumServer} */
  let server;
  let port;

  before(async function () {
    port = await getPort({port: 4723});
    server = await startAppium({port});
  });

  after(async function () {
    await server.close();
  });

  it('should start and stop a session', async function () {
    /** @type WDBrowser */
    const driver = await wdio({...WDIO_OPTS, port});
    await driver.deleteSession();
  });
});

/** @typedef {import('webdriverio').Browser<'async'>} WDBrowser */
