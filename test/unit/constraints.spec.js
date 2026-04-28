import {DEFAULT_CAPS, CAP_CONSTRAINTS} from '../../lib/constraints';

describe('constraints', function () {
  describe('DEFAULT_CAPS', function () {
    it('should have useSecureWebsocket defaulting to true', function () {
      DEFAULT_CAPS['appium:useSecureWebsocket'].should.be.true;
    });

    it('should have autoExtendDevMode defaulting to false (deprecated)', function () {
      DEFAULT_CAPS['appium:autoExtendDevMode'].should.be.false;
    });

    it('should have skipRemoteControl defaulting to false', function () {
      DEFAULT_CAPS['appium:skipRemoteControl'].should.be.false;
    });

    it('should have autodownloadEnabled defaulting to true', function () {
      DEFAULT_CAPS['appium:autodownloadEnabled'].should.be.true;
    });

    it('should have a default chromedriverExecutableDir', function () {
      DEFAULT_CAPS.should.have.property('appium:chromedriverExecutableDir');
      DEFAULT_CAPS['appium:chromedriverExecutableDir'].should.be.a('string');
      DEFAULT_CAPS['appium:chromedriverExecutableDir'].should.include('chromedrivers');
    });
  });

  describe('CAP_CONSTRAINTS', function () {
    it('should define skipRemoteControl as a boolean cap', function () {
      CAP_CONSTRAINTS.should.have.property('skipRemoteControl');
      CAP_CONSTRAINTS.skipRemoteControl.should.have.property('isBoolean', true);
    });

    it('should define autodownloadEnabled as a boolean cap', function () {
      CAP_CONSTRAINTS.should.have.property('autodownloadEnabled');
      CAP_CONSTRAINTS.autodownloadEnabled.should.have.property('isBoolean', true);
    });

    it('should mark autoExtendDevMode as deprecated', function () {
      CAP_CONSTRAINTS.should.have.property('autoExtendDevMode');
      CAP_CONSTRAINTS.autoExtendDevMode.should.have.property('deprecated', true);
    });
  });
});

