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
  app: {
    isString: true
  },
  appId: {
    isString: true,
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
  }
};

export const DEFAULT_CAPS = {
  'appium:autoExtendDevMode': true,
};

