import {main as startAppium} from 'appium';
import {remote} from 'webdriverio';
import {Env} from '@humanwhocodes/env';
import getPort from 'get-port';
import { KEYS } from '../../lib/keys';

const env = new Env();

let TEST_APP, TEST_DEVICE, TEST_DEVICE_HOST;
try {
  ({TEST_APP, TEST_DEVICE, TEST_DEVICE_HOST} = env.required);
} catch {
  throw new Error(`
    The following env vars must be set for E2E tests to work:
    - TEST_APP: path to the suitest watchme .ipk file
    - TEST_DEVICE: the name/id of a connected tv device, as shown in
      ares-setup-device
    - TEST_DEVICE_HOST: the IP address of the connected TV
`);
}

const TEST_APP_ID = 'com.suitest.watchme.app';

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
  hostname: '0.0.0.0',
  path: '/',
  connectionRetryCount: 0,
  capabilities: TEST_CAPS,
};

describe('WebOSDriver - E2E', function() {
  /** @type {import('@appium/types').AppiumServer} */
  let server;
  /** @type {number} */
  let port;

  before(async function() {
    port = await getPort();
    server = /** @type {import('@appium/types').AppiumServer} */(await startAppium({port, loglevel: 'debug'}));
  });

  after(async function() {
    await server.close();
  });

  describe('session with pre-installed app id', function() {
    /** @type {WebdriverIO.Browser} */
    let driver;

    /**
     * Convenience function
     * @param {import('../../lib/driver').Key} key
     */
    async function pressKey(key) {
      await driver.executeScript('webos: pressKey', [{key}]);
    }

    before(async function() {
      driver = await remote({...WDIO_OPTS, port});
    });

    after(async function() {
      await driver.deleteSession();
    });

    it('should start and stop a session via pre-installed app id', function() {
      should.exist(/** @type {import('../../lib/driver').WebOSCapabilities} */(driver.capabilities).deviceInfo);
    });

    it('should get the page source', async function() {
      await driver.getPageSource().should.eventually.contain('WatchMe Demo');
    });

    it('should send remote keys', async function() {
      await pressKey(KEYS.RIGHT);
      await pressKey(KEYS.RIGHT);
      await pressKey(KEYS.ENTER);
      await driver.$('//video[contains(@src, "llamigos")]').waitForExist({timeout: 10000});
      await driver.waitUntil(async () => {
        const script = 'return document.querySelector("video").currentTime';
        const curPlayingTime = await driver.executeScript(script, []);
        return curPlayingTime > 1;
      }, {timeout: 8000});
      await pressKey(KEYS.BACK);
      await driver.$('//div[@data-testid="video3"]').waitForExist({timeout: 5000});
    });
  });
});
