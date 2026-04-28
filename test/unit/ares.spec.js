import rewiremock from 'rewiremock/node';
import {createSandbox} from 'sinon';

describe('ares CLI', function () {
  /** @type {sinon.SinonSandbox} */
  let sandbox;

  /** @type {sinon.SinonStub} */
  let execStub;

  /** @type {typeof import('../../lib/cli/ares')} */
  let aresModule;

  beforeEach(function () {
    sandbox = createSandbox();
    execStub = sandbox.stub();

    aresModule = rewiremock.proxy(() => require('../../lib/cli/ares'), {
      teen_process: {exec: execStub},
    });
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('getDeviceInfo', function () {
    it('should parse ares-device -i output into a key/value map', async function () {
      execStub.resolves({
        stdout: 'modelName : OLED55C2\nwebOSVersion : 22\nsdkVersion : 6.0.0\n',
        stderr: '',
      });

      const result = await aresModule.getDeviceInfo('my-tv');
      result.should.eql({
        modelName: 'OLED55C2',
        webOSVersion: '22',
        sdkVersion: '6.0.0',
      });
    });

    it('should trim whitespace from keys and values', async function () {
      execStub.resolves({
        stdout: '  modelName   :   OLED55C2  \n  ip   :   192.168.1.100  \n',
        stderr: '',
      });

      const result = await aresModule.getDeviceInfo('my-tv');
      result.should.have.property('modelName', 'OLED55C2');
      result.should.have.property('ip', '192.168.1.100');
    });

    it('should skip bracket log lines from ares-device output', async function () {
      execStub.resolves({
        stdout: [
          '[info] Connecting to device...',
          '[warn] Some warning message',
          'modelName : OLED55C2',
          'ip : 192.168.1.100',
        ].join('\n'),
        stderr: '',
      });

      const result = await aresModule.getDeviceInfo('my-tv');
      result.should.not.have.property('[info] Connecting to device...');
      result.should.have.property('modelName', 'OLED55C2');
      result.should.have.property('ip', '192.168.1.100');
    });

    it('should pass --device flag when deviceName is provided', async function () {
      execStub.resolves({stdout: 'modelName : OLED55C2\n', stderr: ''});

      await aresModule.getDeviceInfo('my-tv');

      execStub.calledOnce.should.be.true;
      const args = execStub.firstCall.args;
      args[0].should.equal('ares-device');
      args[1].should.include('-i');
      args[1].should.include('--device');
      args[1].should.include('my-tv');
    });

    it('should rethrow errors from exec', async function () {
      const error = new Error('Command failed');
      error.stdout = '';
      error.stderr = 'device not found';
      execStub.rejects(error);

      await aresModule.getDeviceInfo('my-tv').should.be.rejectedWith('Command failed');
    });
  });

  describe('launchApp', function () {
    it('should call ares-launch with the app id', async function () {
      execStub.resolves({stdout: '', stderr: ''});

      await aresModule.launchApp('com.example.app', 'my-tv');

      const args = execStub.firstCall.args;
      args[0].should.equal('ares-launch');
      args[1].should.include('com.example.app');
    });

    it('should pass --params when launchParams provided', async function () {
      execStub.resolves({stdout: '', stderr: ''});

      await aresModule.launchApp('com.example.app', 'my-tv', {key: 'val'});

      const args = execStub.firstCall.args[1];
      args.should.include('--params');
      args.should.include(JSON.stringify({key: 'val'}));
    });
  });

  describe('closeApp', function () {
    it('should call ares-launch with -c flag', async function () {
      execStub.resolves({stdout: '', stderr: ''});

      await aresModule.closeApp('com.example.app', 'my-tv');

      const args = execStub.firstCall.args;
      args[0].should.equal('ares-launch');
      args[1].should.include('-c');
      args[1].should.include('com.example.app');
    });
  });
});

