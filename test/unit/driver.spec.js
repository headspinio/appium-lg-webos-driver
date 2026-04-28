import rewiremock from 'rewiremock/node';
import {createSandbox} from 'sinon';

describe('WebOSDriver', function () {
  /** @type {typeof import('../../lib/driver').WebOSDriver} */
  let WebOSDriver;

  /** @type {sinon.SinonSandbox} */
  let sandbox;

  beforeEach(function () {
    sandbox = createSandbox();
    ({WebOSDriver} = rewiremock.proxy(() => require('../../lib/driver'), {}));
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

  describe('executeMethodMap', function () {
    it('should contain the new activateApp command', function () {
      WebOSDriver.executeMethodMap.should.have.property('webos: activateApp');
      WebOSDriver.executeMethodMap['webos: activateApp'].command.should.equal('activateApp');
      WebOSDriver.executeMethodMap['webos: activateApp'].params.required.should.include('appPackage');
      WebOSDriver.executeMethodMap['webos: activateApp'].params.optional.should.include('launchParams');
    });

    it('should contain the new getElementInfo command', function () {
      WebOSDriver.executeMethodMap.should.have.property('webos: getElementInfo');
      WebOSDriver.executeMethodMap['webos: getElementInfo'].command.should.equal('getElementInfo');
      WebOSDriver.executeMethodMap['webos: getElementInfo'].params.required.should.include('elementId');
    });

    it('should contain the new getFocusedElement command', function () {
      WebOSDriver.executeMethodMap.should.have.property('webos: getFocusedElement');
      WebOSDriver.executeMethodMap['webos: getFocusedElement'].command.should.equal('getFocusedElement');
    });
  });

  describe('isExecuteScript', function () {
    it('should identify original script names', function () {
      WebOSDriver.isExecuteScript('webos: pressKey').should.be.true;
      WebOSDriver.isExecuteScript('webos: listApps').should.be.true;
      WebOSDriver.isExecuteScript('webos: activeAppInfo').should.be.true;
    });

    it('should identify new script names', function () {
      WebOSDriver.isExecuteScript('webos: activateApp').should.be.true;
      WebOSDriver.isExecuteScript('webos: getElementInfo').should.be.true;
      WebOSDriver.isExecuteScript('webos: getFocusedElement').should.be.true;
    });

    it('should reject unknown script names', function () {
      WebOSDriver.isExecuteScript('webos: invalidCommand').should.be.false;
      WebOSDriver.isExecuteScript('randomScript').should.be.false;
      WebOSDriver.isExecuteScript('').should.be.false;
    });
  });

  describe('activateApp', function () {
    it('should throw InvalidArgumentError when appPackage is not provided', async function () {
      const driver = new WebOSDriver();
      await driver.activateApp('').should.be.rejectedWith('appPackage parameter is required');
    });

    it('should throw InvalidArgumentError when appPackage is null', async function () {
      const driver = new WebOSDriver();
      await driver.activateApp(null).should.be.rejectedWith('appPackage parameter is required');
    });
  });

  describe('pressKeyViaRemote', function () {
    it('should throw when socketClient and remoteClient are not set', async function () {
      const driver = new WebOSDriver();
      await driver.pressKeyViaRemote('HOME').should.be.rejectedWith('Remote control is not available');
    });
  });
});
