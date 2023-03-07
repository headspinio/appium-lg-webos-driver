'use strict';

module.exports = {
  require: ['ts-node/register', "test/setup.js"],
  timeout: '2s',
  slow: '1s',
  'forbid-only': Boolean(process.env.CI),
};
