import rewiremock from 'rewiremock/node';
import {createSandbox} from 'sinon';

const {expect} = chai;

describe('module cli/ares', function () {
  /** @type {typeof import('../../../lib/cli/ares')} */
  let aresModule;

  /** @type {sinon.SinonSandbox} */
  let sandbox;

  /** @type {{Env: sinon.SinonStub<void[], typeof mockEnv>}} */
  let MockEnv;

  /** @type {{require: sinon.SinonStub<[string],string>}} */
  let mockEnv;

  beforeEach(function () {
    sandbox = createSandbox();

    mockEnv = {
      require: /** @type {typeof mockEnv.require} */ (sandbox.stub().returns('/some/path')),
    };
    MockEnv = {
      Env: sandbox.stub().returns(mockEnv),
    };

    aresModule = rewiremock.proxy(() => require('../../../lib/cli/ares'), {
      '@humanwhocodes/env': MockEnv,
    });
  });

  describe('preflightCheck()', function () {
    describe('when no LG_WEBOS_TV_SDK_HOME exists in the env', function () {
      beforeEach(function () {
        mockEnv.require.throws('some error');
      });

      it('should throw', function () {
        expect(() => aresModule.preflightCheck()).to.throw();
      });
    });

    describe('when LG_WEBOS_TV_SDK_HOME exists in the env', function () {
      beforeEach(function () {
        mockEnv.require.returns('/some/path');
      });

      it('should not throw', function () {
        expect(() => aresModule.preflightCheck()).not.to.throw();
      });
    });
  });
});
