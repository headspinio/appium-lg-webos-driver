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
  appPackage: {
    isString: true,
  },
  chromedriverExecutable: {
    isString: true,
    //presence: true
  },
  autoExtendDevMode: {
    isBoolean: true,
  }
};

export const DEFAULT_CAPS = {
  'appium:autoExtendDevMode': true,
};

