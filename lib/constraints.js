export const CAP_CONSTRAINTS = Object.freeze(
  /** @type {const} */ ({
    platformName: {
      isString: true,
      inclusionCaseInsensitive: ['LGTV'],
      presence: true,
    },
    deviceName: {
      isString: true,
      presence: true,
    },
    deviceHost: {
      isString: true,
      presence: true,
    },
    app: {
      isString: true,
    },
    appId: {
      isString: true,
      presence: true,
    },
    debuggerPort: {
      isNumber: true,
    },
    websocketPort: {
      isNumber: true,
    },
    chromedriverExecutable: {
      isString: true,
      //presence: true
    },
    autoExtendDevMode: {
      isBoolean: true,
    },
    appLaunchParams: {
      isObject: true,
    },
    appLaunchCooldown: {
      isNumber: true,
    },
    remoteOnly: {
      isBoolean: true,
    },
    rcMode: {
      isString: true,
      inclusionCaseInsensitive: ['rc', 'js'],
    },
    keyCooldown: {
      isNumber: true,
    },
  })
);

export const DEFAULT_CAPS = Object.freeze(/** @type {const} */({
  'appium:debuggerPort': 9998,
  'appium:websocketPort': 3000,
  'appium:autoExtendDevMode': true,
  'appium:appLaunchCooldown': 3000,
  'appium:keyCooldown': 750,
  'appium:rcMode': 'js',
}));

/**
 * @typedef {typeof CAP_CONSTRAINTS} WebOsConstraints
 */

