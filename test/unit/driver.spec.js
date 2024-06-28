import rewiremock from 'rewiremock/node';
import {createSandbox} from 'sinon';

describe('WebOSDriver', function () {
  /** @type {typeof import('../../lib/driver').WebOSDriver} */
  let WebOSDriver;

  /** @type {sinon.SinonSandbox} */
  let sandbox;

  /** @type {{Env: sinon.SinonStub<void[], {require: sinon.SinonStub<[string],string>}>}} */
  let MockEnv;

  beforeEach(function () {
    sandbox = createSandbox();

    MockEnv = {
      Env: sandbox.stub().returns({
        require: sandbox.stub().returns('/some/path'),
      }),
    };

    ({WebOSDriver} = rewiremock.proxy(() => require('../../lib/driver'), {
      '@humanwhocodes/env': MockEnv,
    }));
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('should be importable and instantiable', function () {
    should.exist(new WebOSDriver());
  });


  describe('useUAForBrowserIfNotPresent', function () {
    it('should use Browser as-is if the given value had the exact value', function () {
      const driver = new WebOSDriver();
      const jsonResponse = {
        'Browser': 'Chrome/87.0.4280.88',
        'Protocol-Version': '1.3',
        'User-Agent': 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36',
        'V8-Version': '8.7.220.(29*1000 + 2)',
        'WebKit-Version': '537.36 (@cec52f3dd4465dd7389298b97ab723856c556bd)',
        'webSocketDebuggerUrl': 'ws://192.168.0.1:9998/devtools/browser/a4b3786c-2d2f-4751-9e05-aee2023bc226'
      };
      driver.useUAForBrowserIfNotPresent(jsonResponse).should.eql({
        'Browser': 'Chrome/87.0.4280.88',
        'Protocol-Version': '1.3',
        'User-Agent': 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36',
        'V8-Version': '8.7.220.(29*1000 + 2)',
        'WebKit-Version': '537.36 (@cec52f3dd4465dd7389298b97ab723856c556bd)',
        'webSocketDebuggerUrl': 'ws://192.168.0.1:9998/devtools/browser/a4b3786c-2d2f-4751-9e05-aee2023bc226'
      });
    }),

    it('should use UA for the Browser if the Browser was an empty string', function () {
      const driver = new WebOSDriver();
      const jsonResponse = {
        'Browser': '',
        'Protocol-Version': '1.3',
        'User-Agent': 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36',
        'V8-Version': '8.7.220.(29*1000 + 2)',
        'WebKit-Version': '537.36 (@cec52f3dd4465dd7389298b97ab723856c556bd)',
        'webSocketDebuggerUrl': 'ws://192.168.0.1:9998/devtools/browser/a4b3786c-2d2f-4751-9e05-aee2023bc226'
      };
      driver.useUAForBrowserIfNotPresent(jsonResponse).should.eql({
        'Browser': 'Chrome/87.0.4280.88',
        'Protocol-Version': '1.3',
        'User-Agent': 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36',
        'V8-Version': '8.7.220.(29*1000 + 2)',
        'WebKit-Version': '537.36 (@cec52f3dd4465dd7389298b97ab723856c556bd)',
        'webSocketDebuggerUrl': 'ws://192.168.0.1:9998/devtools/browser/a4b3786c-2d2f-4751-9e05-aee2023bc226'
      });
    }),

    it('should use Browser as-is if the Browser was an empty string AND the UA did not exist', function () {
      const driver = new WebOSDriver();
      const jsonResponse = {
        'Browser': '',
        'Protocol-Version': '1.3',
        'User-Agent': '',
        'V8-Version': '8.7.220.(29*1000 + 2)',
        'WebKit-Version': '537.36 (@cec52f3dd4465dd7389298b97ab723856c556bd)',
        'webSocketDebuggerUrl': 'ws://192.168.0.1:9998/devtools/browser/a4b3786c-2d2f-4751-9e05-aee2023bc226'
      };
      driver.useUAForBrowserIfNotPresent(jsonResponse).should.eql({
        'Browser': '',
        'Protocol-Version': '1.3',
        'User-Agent': '',
        'V8-Version': '8.7.220.(29*1000 + 2)',
        'WebKit-Version': '537.36 (@cec52f3dd4465dd7389298b97ab723856c556bd)',
        'webSocketDebuggerUrl': 'ws://192.168.0.1:9998/devtools/browser/a4b3786c-2d2f-4751-9e05-aee2023bc226'
      });
    }),

    it('should use Browser as-is if the Browser was an empty string AND the UA did not have chrome', function () {
      const driver = new WebOSDriver();
      const jsonResponse = {
        'Browser': '',
        'Protocol-Version': '1.3',
        'User-Agent': 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36',
        'V8-Version': '8.7.220.(29*1000 + 2)',
        'WebKit-Version': '537.36 (@cec52f3dd4465dd7389298b97ab723856c556bd)',
        'webSocketDebuggerUrl': 'ws://192.168.0.1:9998/devtools/browser/a4b3786c-2d2f-4751-9e05-aee2023bc226'
      };
      driver.useUAForBrowserIfNotPresent(jsonResponse).should.eql({
        'Browser': '',
        'Protocol-Version': '1.3',
        'User-Agent': 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36',
        'V8-Version': '8.7.220.(29*1000 + 2)',
        'WebKit-Version': '537.36 (@cec52f3dd4465dd7389298b97ab723856c556bd)',
        'webSocketDebuggerUrl': 'ws://192.168.0.1:9998/devtools/browser/a4b3786c-2d2f-4751-9e05-aee2023bc226'
      });
    });
  });

  describe('fixChromeVersionForAutodownload', function () {
    it('Set minimal chrome version', function () {
      const driver = new WebOSDriver();
      const browserInfo = {
        'Browser': 'Chrome/62.0.4280.88',
        'Protocol-Version': '1.3',
        'User-Agent': 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.4280.88 Safari/537.36',
        'WebKit-Version': '537.36 (@cec52f3dd4465dd7389298b97ab723856c556bd)',
      };
      driver.fixChromeVersionForAutodownload(browserInfo).should.eql(
        {
          'Browser': 'Chrome/63.0.3239.0',
          'Protocol-Version': '1.3',
          'User-Agent': 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.4280.88 Safari/537.36',
          'WebKit-Version': '537.36 (@cec52f3dd4465dd7389298b97ab723856c556bd)',
        }
      );
    });

    it('Do nothing if the given browser was empty', function () {
      const driver = new WebOSDriver();
      const browserInfo = {
        'Browser': '',
        'Protocol-Version': '1.1',
        'User-Agent': '',
        'WebKit-Version': '537.36 (@fa89da905405aab455e0f0d4ec7f49631c7ca70b)'
      };
      driver.fixChromeVersionForAutodownload(browserInfo).should.eql({
        'Browser': 'Chrome/63.0.3239.0',
        'Protocol-Version': '1.1',
        'User-Agent': '',
        'WebKit-Version': '537.36 (@fa89da905405aab455e0f0d4ec7f49631c7ca70b)'
      });
    });

    it('Use the given chrome version', function () {
      const driver = new WebOSDriver();
      const browserInfo = {
        'Browser': 'Chrome/87.0.4280.88',
        'Protocol-Version': '1.3',
        'User-Agent': 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36',
        'V8-Version': '8.7.220.(29*1000 + 2)',
        'WebKit-Version': '537.36 (@cec52f3dd4465dd7389298b97ab723856c556bd)',
        'webSocketDebuggerUrl': 'ws://192.168.0.1:9998/devtools/browser/a4b3786c-2d2f-4751-9e05-aee2023bc226'
      };
      driver.fixChromeVersionForAutodownload(browserInfo).should.eql(browserInfo);
    });
  });
});
