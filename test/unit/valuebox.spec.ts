import path from 'node:path';
import rewiremock from 'rewiremock/node';
import type {ValueBox} from '../../lib/remote/valuebox';
import {createSandbox, SinonSandbox, SinonStubbedMember} from 'sinon';
import type fs from 'node:fs/promises';

const {expect} = chai;
type MockFs = {
  [K in keyof typeof fs]: SinonStubbedMember<typeof fs[K]>;
};

describe('ValueBox', function () {
  let ValueBox: ValueBox;
  let sandbox: SinonSandbox;
  let DEFAULT_SUFFIX: string;
  const MockFs: MockFs = {} as any;

  const DATA_DIR = '/some/dir';

  beforeEach(function () {
    sandbox = createSandbox();
    ({ValueBox, DEFAULT_SUFFIX} = rewiremock.proxy(
      () => require('../../lib/remote/valuebox'),
      (r) => ({
        // all of these props are async functions
        'node:fs/promises': r
          .mockThrough((prop) => {
            MockFs[prop] = sandbox.stub().resolves();
            return MockFs[prop];
          })
          .dynamic(), // this allows us to change the mock behavior on-the-fly
        'env-paths': sandbox.stub().returns({data: DATA_DIR}),
      })
    ));
  });

  describe('static method', function () {
    describe('create()', function () {
      it('should return a new ValueBox', function () {
        const valueBox = ValueBox.create('test');
        expect(valueBox).to.be.an.instanceOf(ValueBox);
      });
    });
  });

  describe('instance method', function () {
    let valueBox: ValueBox;

    beforeEach(function () {
      valueBox = ValueBox.create('test');
    });

    describe('createWrapper()', function () {
      describe('when a ValueWrapper with the same id does not exist', function () {
        describe('when the file does not exist', function () {
          it('should create an empty ValueWrapper', async function () {
            const wrapper = await valueBox.createWrapper('SLUG test');
            expect(wrapper).to.eql({
              id: 'slug-test',
              name: 'SLUG test',
              encoding: 'utf8',
              value: undefined,
            });
          });
        });

        describe('when the file exists', function () {
          beforeEach(function () {
            MockFs.readFile.resolves('foo bar');
          });
          it('should read its value', async function () {
            const wrapper = await valueBox.createWrapper('SLUG test');
            expect(wrapper).to.eql({
              id: 'slug-test',
              name: 'SLUG test',
              encoding: 'utf8',
              value: 'foo bar',
            });
          });
        });

        describe('when a value is written to the ValueWrapper', function () {
          it('should write a string value to the underlying file', async function () {
            const wrapper = await valueBox.createWrapper('test');
            await wrapper.put('boo bah');

            expect(MockFs.writeFile).to.have.been.calledWith(
              path.join(DATA_DIR, DEFAULT_SUFFIX, 'test'),
              'boo bah',
              'utf8'
            );
          });

          it('should update the underlying value', async function () {
            const wrapper = await valueBox.createWrapper('test');
            await wrapper.put('boo bah');
            expect(wrapper.value).to.equal('boo bah');
          });
        });
      });

      describe('when a ValueWrapper with the same id already exists', function () {
        it('should throw an error', async function () {
          await valueBox.createWrapper('test');
          await expect(valueBox.createWrapper('test')).to.be.rejectedWith(
            Error,
            'ValueWrapper with id "test" already exists'
          );
        });
      });
    });

    describe('recycle()', function () {
      it('should attempt to unlink the underlying file', async function () {
        const wrapper = await valueBox.createWrapper('test');
        await valueBox.recycle(wrapper);
        expect(MockFs.unlink).to.have.been.calledWith(path.join(DATA_DIR, DEFAULT_SUFFIX, 'test'));
      });

      describe('when the underlying file does not exist', function () {
        beforeEach(function () {
          MockFs.unlink.rejects(Object.assign(new Error(), {code: 'ENOENT'}));
        });

        it('should not reject', async function () {
          const wrapper = await valueBox.createWrapper('test');
          await expect(valueBox.recycle(wrapper)).to.eventually.be.undefined;
        });

        it('should call unlink with the correct path', async function () {
          await valueBox.recycle(await valueBox.createWrapper('test'));
          expect(MockFs.unlink).to.have.been.calledOnceWith('/some/dir/valuebox/test');
        });
      });

      describe('when there is some other error', function () {
        beforeEach(function () {
          MockFs.unlink.rejects(Object.assign(new Error(), {code: 'ETOOMANYGOATS'}));
        });

        it('should reject', async function () {
          const wrapper = await valueBox.createWrapper('test');
          await expect(valueBox.recycle(wrapper)).to.be.rejected;
        });
      });
    });

    describe('recycleAll()', function () {
      describe('when the underlying dir does not exist', function () {
        beforeEach(function () {
          MockFs.rm.rejects(Object.assign(new Error(), {code: 'ENOENT'}));
        });

        it('should not reject', async function () {
          await expect(valueBox.recycleAll()).to.eventually.be.undefined;
        });

        it('should call rm with the correct path', async function () {
          await valueBox.recycleAll();
          expect(MockFs.rm).to.have.been.calledOnceWith('/some/dir/valuebox', {
            recursive: true,
            force: true,
          });
        });
      });

      describe('when there is some other error', function () {
        beforeEach(function () {
          MockFs.rm.rejects(Object.assign(new Error(), {code: 'ETOOMANYGOATS'}));
        });

        it('should reject', async function () {
          await expect(valueBox.recycleAll()).to.be.rejected;
        });
      });
    });

    describe('createWrapperWithValue()', function () {
      it('should create a ValueWrapper with the given value', async function () {
        const wrapper = await valueBox.createWrapperWithValue('test', 'value');
        expect(wrapper.value).to.equal('value');
      });

      it('should write the value to disk', async function () {
        await valueBox.createWrapperWithValue('test', 'value');
        expect(MockFs.writeFile).to.have.been.calledWith(
          path.join(DATA_DIR, DEFAULT_SUFFIX, 'test'),
          'value'
        );
      });
    });
  });

  afterEach(function () {
    sandbox.restore();
  });
});
