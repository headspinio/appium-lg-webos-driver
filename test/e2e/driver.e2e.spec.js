import {main as startAppium} from 'appium';
import {remote} from 'webdriverio';
import getPort from 'get-port';

const TEST_APP = process.env.TEST_APP;
const TEST_DEVICE = process.env.TEST_DEVICE;
const TEST_DEVICE_HOST = process.env.TEST_DEVICE_HOST;
const TEST_APP_ID = 'com.suitest.watchme.app';

if (!TEST_APP || !TEST_DEVICE || !TEST_DEVICE_HOST) {
  throw new Error(`
    The following env vars must be set for E2E tests to work:
    - TEST_APP: path to the suitest watchme .ipk file
    - TEST_DEVICE: the name/id of a connected tv device, as shown in
      ares-setup-device
    - TEST_DEVICE_HOST: the IP address of the connected TV
  `);
}

const TEST_CAPS = {
  platformName: 'LGTV',
  'appium:automationName': 'WebOS',
  'appium:deviceName': TEST_DEVICE,
  'appium:deviceHost': TEST_DEVICE_HOST,
  'appium:appId': TEST_APP_ID,
  'appium:app': TEST_APP,
  'appium:fullReset': true,
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

  describe('session with pre-installed app id', function() {
    /** @type WDBrowser */
    let driver;

    before(async function() {
      driver = await remote({...WDIO_OPTS, port});
    });
    after(async function() {
      await driver.deleteSession();
    });

    it('should start and stop a session via pre-installed app id', function() {
      should.exist(driver.capabilities.deviceInfo);
    });

    it('should get the page source', async function() {
      await driver.getPageSource().should.eventually.contain('WatchMe Demo');
    });

    it('should send remote keys', async function() {
      await driver.executeScript('webos: pressKey', [{key: 'right'}]);
      await driver.executeScript('webos: pressKey', [{key: 'right'}]);
      await driver.executeScript('webos: pressKey', [{key: 'enter'}]);
      await driver.$('//video[contains(@src, "llamigos")]').waitForExist({timeout: 5000});
      await driver.waitUntil(async () => {
        const script = 'return document.querySelector("video").currentTime';
        const curPlayingTime = await driver.executeScript(script, []);
        return curPlayingTime > 1;
      }, {timeout: 8000});
      await driver.executeScript('webos: pressKey', [{key: 'back'}]);
      await driver.$('//div[@data-testid="video3"]').waitForExist({timeout: 5000});
    });
  });
});

/** @typedef {import('webdriverio').Browser<'async'>} WDBrowser */
