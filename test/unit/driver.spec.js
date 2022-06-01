import { WebOSDriver } from '../../lib';

describe('WebOSDriver', function () {
  it('should be importable and instantiable', function () {
    should.exist(new WebOSDriver());
  });
});
