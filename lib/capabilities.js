export const CAP_CONSTRAINTS = {
  platformName: {
    isString: true,
    inclusionCaseInsensitive: ['LGTV'],
    presence: true
  },
  deviceName: {
    isString: true,
    presence: true
  },
  deviceHost: {
    isString: true,
    presence: true
  },
  app: {
    isString: true
  },
  appId: {
    isString: true,
    presence: true,
  },
  debuggerPort: {
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
};

export const DEFAULT_CAPS = {
  'appium:debuggerPort': 9998,
  'appium:autoExtendDevMode': true,
  'appium:appLaunchCooldown': 3000,
};

