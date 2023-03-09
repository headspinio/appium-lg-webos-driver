'use strict';

module.exports = (wallaby) => {
  return {
    compilers: {
      '**/*.js': wallaby.compilers.typeScript({
        allowJs: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        isolatedModules: true,
      }),
      '**/*.ts?(x)': wallaby.compilers.typeScript(),
    },
    debug: true,
    env: {
      type: 'node',
    },
    files: [
      './lib/**/*.{js,ts}'
    ],
    testFramework: 'mocha',
    tests: [
      './test/unit/**/*.spec.{js,ts}',
    ],
    runMode: 'onsave',
    workers: {recycle: true},
    setup() {
      // contents of `test/setup.js` w/o the `@babel/register` require

      const chai = require('chai');
      const chaiAsPromised = require('chai-as-promised');
      const sinonChai = require('sinon-chai');

      // The `chai` global is set if a test needs something special.
      // Most tests won't need this.
      global.chai = chai.use(chaiAsPromised).use(sinonChai);

      // `should()` is only necessary when working with some `null` or `undefined` values.
      global.should = chai.should();
    }
  }
};
