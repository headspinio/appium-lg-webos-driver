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
    // @ts-expect-error - no args
    should.exist(new WebOSDriver());
  });
});
