import {BaseDriver, errors} from 'appium/driver';
import B from 'bluebird';
import _ from 'lodash';
import {
  closeApp,
  getDeviceInfo,
  installApp,
  launchApp,
  uninstallApp,
} from './cli/ares';
import {CAP_CONSTRAINTS, DEFAULT_CAPS} from './constraints';
import {AsyncScripts, SyncScripts} from './scripts';
import {Chromedriver} from 'appium-chromedriver';
import getPort from 'get-port';
import got from 'got';
import {KEYMAP} from './keys';
import log from './logger';
import {LGRemoteKeys} from './remote/lg-remote-client';
import {LGWSClient} from './remote/lg-socket-client';
// eslint-disable-next-line import/no-unresolved
import {ValueBox} from './remote/valuebox';
export {KEYS} from './keys';

// this is the ID for the 'Developer' application, which we launch after a session ends to ensure
// some app stays running (otherwise the TV might shut off)
const DEV_MODE_ID = 'com.palmdts.devmode';


/**
 * To get chrome driver version in the UA
 */
const REGEXP_CHROME_VERSION_IN_UA = new RegExp('Chrome\\/(\\S+)');

/**
 * To get chrome version from the browser info.
 */
const VERSION_PATTERN = /([\d.]+)/;

/**
 * Minimal chrome browser for autodownload.
 * Chromedriver for older than this chrome version could have an issue
 * to raise no chrome binary error.
 */
const MIN_CHROME_MAJOR_VERSION = 63;
const MIN_CHROME_VERSION = 'Chrome/63.0.3239.0';

// don't proxy any 'appium' routes
/** @type {RouteMatcher[]} */
const NO_PROXY = [
  ['POST', new RegExp('^/session/[^/]+/appium')],
  ['GET', new RegExp('^/session/[^/]+/appium')],
  ['GET', new RegExp('^/session/[^/]+/context')],
  ['POST', new RegExp('^/session/[^/]+/execute/sync')],
  // Element finding routes - intercept to fix invalid locator strategies
  ['POST', new RegExp('^/session/[^/]+/element$')],
  ['POST', new RegExp('^/session/[^/]+/elements$')],
  // Source route - intercept to inject synthetic attributes
  ['GET', new RegExp('^/session/[^/]+/source')],
  // Window routes - override unsupported commands
  ['GET', new RegExp('^/session/[^/]+/window/rect')],
  // Element property routes - override Chromedriver to use JS execution
  ['GET', new RegExp('^/session/[^/]+/element/[^/]+/text')],
  ['GET', new RegExp('^/session/[^/]+/element/[^/]+/size')],
  ['GET', new RegExp('^/session/[^/]+/element/[^/]+/location')],
  ['GET', new RegExp('^/session/[^/]+/element/[^/]+/rect')],
  ['GET', new RegExp('^/session/[^/]+/element/[^/]+/displayed')],
  ['GET', new RegExp('^/session/[^/]+/element/[^/]+/enabled')],
  ['GET', new RegExp('^/session/[^/]+/element/[^/]+/selected')],
  ['GET', new RegExp('^/session/[^/]+/element/[^/]+/attribute/[^/]+')],
  ['GET', new RegExp('^/session/[^/]+/element/[^/]+/property/[^/]+')],
  ['GET', new RegExp('^/session/[^/]+/element/[^/]+/css/[^/]+')],
  ['GET', new RegExp('^/session/[^/]+/element/[^/]+/name')],
  // Element interaction routes - override Chromedriver for better compatibility
  ['POST', new RegExp('^/session/[^/]+/element/[^/]+/click')],
];

export const DEFAULT_PRESS_DURATION_MS = 100;

/**
 * @extends {BaseDriver<WebOsConstraints>}
 */
export class WebOSDriver extends BaseDriver {
  /** @type {RouteMatcher[]} */
  jwpProxyAvoid = _.clone(NO_PROXY); // why clone?

  /** @type {boolean} */
  jwpProxyActive = false;

  /** @type {LGWSClient|undefined} */
  socketClient;

  /** @type {import('./remote/lg-remote-client').LGRemoteClient|undefined} */
  remoteClient;

  desiredCapConstraints = CAP_CONSTRAINTS;

  /** @type {Chromedriver|undefined} */
  #chromedriver;

  static executeMethodMap = {
    'webos: pressKey': Object.freeze({
      command: 'pressKey',
      params: {required: ['key'], optional: ['duration']},
    }),
    'webos: listApps': Object.freeze({
      command: 'listApps',
    }),
    'webos: activeAppInfo': Object.freeze({
      command: 'getCurrentForegroundAppInfo',
    }),
    'webos: activateApp': Object.freeze({
      command: 'activateApp',
      params: {required: ['appPackage'], optional: ['launchParams']},
    }),
    'webos: getElementInfo': Object.freeze({
      command: 'getElementInfo',
      params: {required: ['elementId']},
    }),
    'webos: getFocusedElement': Object.freeze({
      command: 'getFocusedElement',
    }),
  };

  /**
   *
   * @param {any} name
   * @returns {name is ScriptId}
   */
  static isExecuteScript(name) {
    return name in WebOSDriver.executeMethodMap;
  }

  /**
   * @param {W3CWebOsCaps} w3cCaps1
   * @param {W3CWebOsCaps} w3cCaps2
   * @param {W3CWebOsCaps} w3cCaps3
   * @returns {Promise<[string,WebOsCaps]>}
   */
  async createSession(w3cCaps1, w3cCaps2, w3cCaps3) {
    w3cCaps3.alwaysMatch = {...DEFAULT_CAPS, ...w3cCaps3.alwaysMatch};
    log.info(`w3cCaps3.alwaysMatch: ${JSON.stringify(w3cCaps3.alwaysMatch)}`);

    let [sessionId, caps] = await super.createSession(w3cCaps1, w3cCaps2, w3cCaps3);
    log.info(`Super createSession returned: ${sessionId}, ${JSON.stringify(caps)}`);

    const {
      deviceName,
      app,
      appId,
      appLaunchParams,
      noReset,
      fullReset,
      deviceHost,
      debuggerPort,
      showChromedriverLog,
      chromedriverExecutable,
      chromedriverExecutableDir,
      autodownloadEnabled,
      appLaunchCooldown,
      remoteOnly,
      websocketPort,
      websocketPortSecure,
      useSecureWebsocket,
      keyCooldown,
    } = caps;

    if (noReset && fullReset) {
      throw new Error(`Cannot use both noReset and fullReset`);
    }

    // Note: autoExtendDevMode capability is deprecated as ares-extend-dev no longer exists in webOS CLI.
    // Developer mode must be managed manually through the Developer Mode app on the TV.

    try {
      caps.deviceInfo = await getDeviceInfo(deviceName);
    } catch (error) {
      throw new Error(
        `Could not retrieve device info for device with ` +
          `name '${deviceName}'. Are you sure the device is ` +
          `connected? (Original error: ${error})`
      );
    }

    if (fullReset) {
      try {
        await uninstallApp(appId, deviceName);
      } catch (err) {
        // if the app is not installed, we expect the following error message, so if we get any
        // message other than that one, bubble the error up. Otherwise, just ignore!
        if (!/FAILED_REMOVE/.test(/** @type {Error} */ (err).message)) {
          throw err;
        }
      }
    }

    if (app) {
      await installApp(app, appId, deviceName);
    }

    const skipRemoteControl = caps.skipRemoteControl ?? false;

    if (!skipRemoteControl) {
      this.valueBox = ValueBox.create('appium-lg-webos-driver');
      this.socketClient = new LGWSClient({
        valueBox: this.valueBox,
        deviceName,
        url: `ws://${deviceHost}:${websocketPort}`,
        urlSecure: `wss://${deviceHost}:${websocketPortSecure}`,
        useSecureWebsocket,
        remoteKeyCooldown: keyCooldown,
      });
      log.info(`Connecting remote; address any prompts on screen now!`);
      await this.socketClient.initialize();
      this.remoteClient = await this.socketClient.getRemoteClient();
    } else {
      log.info(
        `Skipping remote control connection (skipRemoteControl=true). Remote control features will not be available.`
      );
    }

    await launchApp(appId, deviceName, appLaunchParams);

    const waitMsgInterval = setInterval(() => {
      log.info('Waiting for app launch to take effect');
    }, 1000);
    await B.delay(appLaunchCooldown);
    clearInterval(waitMsgInterval);

    if (remoteOnly) {
      log.info(`Remote-only mode requested, not starting chromedriver`);
      // in remote-only mode, we force rcMode to 'rc' instead of 'js'
      this.opts.rcMode = caps.rcMode = 'rc';
      return [sessionId, caps];
    }

    await this.startChromedriver({
      debuggerHost: deviceHost,
      debuggerPort,
      executable: /** @type {string} */ (chromedriverExecutable),
      executableDir: /** @type {string} */ (chromedriverExecutableDir),
      isAutodownloadEnabled: /** @type {Boolean} */ (autodownloadEnabled),
      verbose: /** @type {Boolean | undefined} */ (showChromedriverLog),
    });

    log.info('Waiting for app launch to take effect');
    await B.delay(appLaunchCooldown);

    if (!noReset) {
      log.info('Clearing app local storage & reloading');
      await this.executeChromedriverScript(SyncScripts.reset);

      // Wait for page to fully load after reload before injecting attributes
      log.info('Waiting for page to load after reload');
      await B.delay(3000);
    }

    // Inject custom attributes for mobile-style element location
    log.info('Injecting custom element attributes for XPath support');
    try {
      await this.injectElementAttributes();
    } catch (err) {
      log.warn(`Failed to inject element attributes: ${err.message}`);
    }

    return [sessionId, caps];
  }

  /**
   * Get active sessions - required for Appium Inspector to list sessions
   * @returns {Promise<Array>}
   */
  async getSessions() {
    const sessions = await super.getSessions();
    return sessions;
  }


  /**
   * @typedef BrowserVersionInfo
   * @property {string} Browser
   * @property {string} Protocol-Version
   * @property {string} User-Agent
   * @property {string} [V8-Version]
   * @property {string} WebKit-Version
   * @property {string} [webSocketDebuggerUrl]
   */

  /**
   * Use UserAgent info for "Browser" if the chrome response did not include
   * browser name properly.
   * @param {BrowserVersionInfo} browserVersionInfo
   * @return {BrowserVersionInfo}
   */
  useUAForBrowserIfNotPresent(browserVersionInfo) {
    if (!_.isEmpty(browserVersionInfo.Browser)) {
      return browserVersionInfo;
    }

    const ua = browserVersionInfo['User-Agent'];
    if (_.isEmpty(ua)) {
      return browserVersionInfo;
    }

    const chromeVersion = ua.match(REGEXP_CHROME_VERSION_IN_UA);
    if (_.isEmpty(chromeVersion)) {
      return browserVersionInfo;
    }

    log.info(
      `The response did not have Browser, thus set the Browser value from UA as ${JSON.stringify(
        browserVersionInfo
      )}`
    );
    // @ts-ignore isEmpty already checked as null.
    browserVersionInfo.Browser = chromeVersion[0];
    return browserVersionInfo;
  }

  /**
   * Set chrome version v63.0.3239.0 as the minimal version
   * for autodownload to use proper chromedriver version if
   *     - the 'Browser' info does not have proper chrome version, or
   *     - older than the chromedriver version could raise no Chrome binary found error,
   *       which no makes sense for TV automation usage.
   *
   * @param {BrowserVersionInfo} browserVersionInfo
   * @return {BrowserVersionInfo}
   */
  fixChromeVersionForAutodownload(browserVersionInfo) {
    const chromeVersion = VERSION_PATTERN.exec(browserVersionInfo.Browser ?? '');
    if (!chromeVersion) {
      browserVersionInfo.Browser = MIN_CHROME_VERSION;
      return browserVersionInfo;
    }

    const majorV = chromeVersion[1].split('.')[0];
    if (_.toInteger(majorV) < MIN_CHROME_MAJOR_VERSION) {
      log.info(`The device chrome version is ${chromeVersion[1]}, ` +
        `which could cause an issue for the matched chromedriver version. ` +
        `Setting ${MIN_CHROME_VERSION} as browser forcefully`);
      browserVersionInfo.Browser = MIN_CHROME_VERSION;
    }

    return browserVersionInfo;
  }


  /**
   * @param {StartChromedriverOptions} opts
   */
  async startChromedriver({debuggerHost, debuggerPort, executable, executableDir, isAutodownloadEnabled, verbose}) {
    const debuggerAddress = `${debuggerHost}:${debuggerPort}`;

    let result;
    if (executableDir) {
      // get the result of chrome info to use auto detection.
      try {
        log.info(`Attempting to connect to Chrome debugger at http://${debuggerAddress}/json/version`);
        result = await got.get(`http://${debuggerAddress}/json/version`).json();
        log.info(`The response of http://${debuggerAddress}/json/version was ${JSON.stringify(result)}`);
        result = this.useUAForBrowserIfNotPresent(result);
        result = this.fixChromeVersionForAutodownload(result);
        log.info(`Fixed browser info is ${JSON.stringify(result)}`);

        // To respect the executableDir.
        executable = undefined;

        if (_.isEmpty(result.Browser)) {
          this.log.info(`No browser version info was available. If no proper chromedrivers exist in ${executableDir}, the session creation will fail.`);
        }
      } catch (err) {
        log.error(`Failed to connect to Chrome debugger at http://${debuggerAddress}/json/version`);
        log.error(`Error details: ${err.message}`);
        throw new errors.SessionNotCreatedError(
          `Could not get the chrome browser information to detect proper chromedriver version. ` +
            `Please verify:\n` +
            `1. The app is launched and running on the TV\n` +
            `2. The app is a web/Enact app with debugger enabled\n` +
            `3. The debugger port ${debuggerPort} is accessible\n` +
            `4. Try accessing http://${debuggerAddress}/json/version from your browser\n` +
            `Original error: ${err.message}`
        );
      }
    }

    this.#chromedriver = new Chromedriver({
      // @ts-ignore bad types
      port: await getPort(),
      executable,
      executableDir,
      isAutodownloadEnabled,
      // @ts-ignore
      details: {info: result},
      verbose,
    });

    // XXX: goog:chromeOptions in newer versions, chromeOptions in older
    try {
      log.info(`Starting Chromedriver with debuggerAddress: ${debuggerAddress}`);
      if (result?.Browser) {
        log.info(`TV Chrome version: ${result.Browser}`);
      }
      await this.#chromedriver.start({
        chromeOptions: {
          debuggerAddress,
        },
      });
      log.info(`Chromedriver started successfully`);
    } catch (err) {
      log.error(`Chromedriver failed to start: ${err.message}`);
      const chromeVersion = result?.Browser ? ` (TV Chrome version: ${result.Browser})` : '';
      if (err.message?.includes('ObjectId or executionContextId')) {
        throw new errors.SessionNotCreatedError(
          `Chromedriver could not connect to the app's debugger${chromeVersion}. This usually means:\n` +
            `1. The app hasn't fully loaded yet - try increasing 'appium:appLaunchCooldown' (currently waiting ${this.opts.appLaunchCooldown}ms)\n` +
            `2. The Chrome version on the TV doesn't match the Chromedriver version\n` +
            `3. The app's JavaScript context isn't ready\n` +
            `Verify Chrome version with: curl http://${debuggerAddress}/json/version\n` +
            `Original error: ${err.message}`
        );
      }
      throw new errors.SessionNotCreatedError(
        `Failed to start Chromedriver${chromeVersion}: ${err.message}`
      );
    }
    this.proxyReqRes = this.#chromedriver.proxyReq.bind(this.#chromedriver);
    this.jwpProxyActive = true;
  }

  /**
   * Execute some arbitrary JS via Chromedriver.
   * @template [TReturn=any]
   * @template [TArg=any]
   * @param {((...args: any[]) => TReturn)|string} script
   * @param {TArg[]} [args]
   * @returns {Promise<{value: TReturn}>}
   */
  async executeChromedriverScript(script, args = []) {
    const result = await this.#executeChromedriverScript('/execute/sync', script, args);
    // Wrap result in {value: ...} for backward compatibility
    // @ts-ignore - result type is compatible at runtime
    return {value: result};
  }

  /**
   * Given a script of {@linkcode ScriptId} or some arbitrary JS, figure out
   * which it is and run it.
   *
   * @template [TArg=any]
   * @template [TReturn=unknown]
   * @template {import('type-fest').LiteralUnion<ScriptId, string>} [S=string]
   * @param {S} script
   * @param {S extends ScriptId ? [Record<string,any>] : TArg[]} args
   * @returns {Promise<S extends ScriptId ? import('type-fest').AsyncReturnType<ExecuteMethod<S>> : {value: TReturn}>}
   */
  async execute(script, args) {
    if (WebOSDriver.isExecuteScript(script)) {
      log.debug(`Calling script "${script}" with arg ${JSON.stringify(args[0])}`);
      const methodArgs = /** @type {[Record<string,any>]} */ (args);
      return await this.executeMethod(script, [methodArgs[0]]);
    }
    return await /** @type {Promise<S extends ScriptId ? import('type-fest').AsyncReturnType<ExecuteMethod<S>> : {value: TReturn}>} */ (
      this.executeChromedriverScript(script, /** @type {TArg[]} */ (args))
    );
  }

  /**
   *
   * @param {string} sessionId
   * @param {import('@appium/types').DriverData[]} [driverData]
   */
  async deleteSession(sessionId, driverData) {
    // TODO decide if we want to extend at the end of the session too
    //if (this.opts.autoExtendDevMode) {
    //await extendDevMode(this.opts.deviceName);
    //}
    if (this.#chromedriver) {
      log.debug(`Stopping chromedriver`);
      // stop listening for the stopped state event
      // @ts-ignore
      this.#chromedriver.removeAllListeners(Chromedriver.EVENT_CHANGED);
      try {
        await this.#chromedriver.stop();
      } catch (err) {
        log.warn(`Error stopping Chromedriver: ${/** @type {Error} */ (err).message}`);
      }
      this.#chromedriver = undefined;
    }
    try {
      await closeApp(this.opts.appId, this.opts.deviceName);
    } catch (err) {
      log.warn(`Error in closing ${this.opts.appId}: ${/** @type {Error} */ (err).message}`);
    }

    if (this.remoteClient) {
      log.info(`Pressing HOME and launching dev app to prevent auto off`);
      await this.remoteClient.pressKey(LGRemoteKeys.HOME);
      await launchApp(DEV_MODE_ID, this.opts.deviceName);
    }

    if (this.socketClient) {
      log.debug(`Stopping socket clients`);
      try {
        await this.socketClient.disconnect();
      } catch (err) {
        log.warn(`Error stopping socket clients: ${err}`);
      }
      this.socketClient = undefined;
      this.remoteClient = undefined;
    }

    await super.deleteSession(sessionId, driverData);
  }

  proxyActive() {
    return this.jwpProxyActive;
  }

  getProxyAvoidList() {
    return this.jwpProxyAvoid;
  }

  canProxy() {
    return true;
  }

  /**
   * Execute some arbitrary JS via Chromedriver.
   * @template [TReturn=unknown]
   * @template [TArg=any]
   * @param {string} endpointPath - Relative path of the endpoint URL
   * @param {((...args: any[]) => TReturn)|string} script
   * @param {TArg[]} [args]
   * @returns {Promise<any>}
   */
  async #executeChromedriverScript(endpointPath, script, args = []) {
    const wrappedScript =
      typeof script === 'string' ? script : `return (${script}).apply(null, arguments)`;
    // @ts-ignore - sendCommand returns unwrapped value
    return await this.#chromedriver.sendCommand(endpointPath, 'POST', {
      script: wrappedScript,
      args,
    });
  }

  /**
   * Automates a keypress
   * @param {import('./keys').KnownKey} key
   * @param {number} [duration]
   */
  async pressKey(key, duration) {
    if (this.opts.rcMode === 'js') {
      return await this.#pressKeyViaJs(key, duration);
    } else {
      if (duration) {
        this.log.warn(
          `Attempted to send a duration for a remote-based ` + `key press; duration will be ignored`
        );
      }
      return await this.pressKeyViaRemote(key);
    }
  }

  /**
   * Automates a press of a button on a remote control.
   * @param {string} key
   */
  async pressKeyViaRemote(key) {
    const sc = /** @type {import('./remote/lg-socket-client').LGWSClient} */ (this.socketClient);
    const rc = /** @type {import('./remote/lg-remote-client').LGRemoteClient} */ (
      this.remoteClient
    );

    if (!rc || !sc) {
      throw new errors.InvalidArgumentError(
        'Remote control is not available. Either skipRemoteControl is enabled or the WebSocket connection failed.'
      );
    }

    // Check if WebSocket connections are still active
    if (!rc.isConnected() || !sc.isConnected()) {
      throw new errors.InvalidArgumentError(
        'Remote control WebSocket connection is closed. The TV may have gone to sleep, been restarted, ' +
          'or the network connection was interrupted. Please restart the Appium session.'
      );
    }

    const keyMap = Object.freeze(
      /** @type {const} */ ({
        VOL_UP: sc.volumeUp,
        VOL_DOWN: sc.volumeDown,
        MUTE: sc.mute,
        UNMUTE: sc.unmute,
        PLAY: sc.play,
        STOP: sc.stop,
        REWIND: sc.rewind,
        FF: sc.fastForward,
        CHAN_UP: sc.channelUp,
        CHAN_DOWN: sc.channelDown,
      })
    );

    /**
     *
     * @param {any} key
     * @returns {key is keyof typeof keyMap}
     */
    const isMappedKey = (key) => key in keyMap;

    const knownKeys = [...Object.keys(keyMap), ...Object.keys(LGRemoteKeys)];

    if (!knownKeys.includes(_.upperCase(key))) {
      this.log.warn(`Unknown key '${key}'; will send to remote as-is`);
      await rc.pressKey(key);
      await this.injectElementAttributes();
      return;
    }

    key = _.upperCase(key);

    if (isMappedKey(key)) {
      this.log.info(`Found virtual 'key' to be sent as socket command`);
      await keyMap[key].call(sc);
      await this.injectElementAttributes();
      return;
    }

    await rc.pressKey(key);
    await this.injectElementAttributes();
  }

  /**
   * Press key via Chromedriver.
   * @param {import('./keys').KnownKey} key
   * @param {number} [duration]
   */
  async #pressKeyViaJs(key, duration = DEFAULT_PRESS_DURATION_MS) {
    key = /** @type {typeof key} */ (key.toLowerCase());
    const [keyCode, keyName] = KEYMAP[key];
    if (!keyCode) {
      throw new errors.InvalidArgumentError(`Key name '${key}' is not supported`);
    }
    await this.#executeChromedriverScript('/execute/sync', AsyncScripts.pressKey, [
      keyCode,
      keyName,
      duration,
    ]);
    // Refresh element attributes after key press, as focus may have changed
    await this.injectElementAttributes();
  }

  /**
   *
   * @returns {Promise<[object]>} Return the list of installed applications
   */
  async listApps() {
    const sc = /** @type {import('./remote/lg-socket-client').LGWSClient} */ (this.socketClient);
    if (sc) {
      return (await sc.getListApps()).apps;
    }
    throw new errors.UnknownError('Socket connection to the device might be missed');
  }

  /**
   *
   * @returns {Promise<object>} Return current active application information.
   */
  async getCurrentForegroundAppInfo() {
    const sc = /** @type {import('./remote/lg-socket-client').LGWSClient} */ (this.socketClient);
    if (sc) {
      // {"returnValue"=>true, "appId"=>"com.your.app", "processId"=>"", "windowId"=>""}
      return await sc.getForegroundAppInfo();
    }
    throw new errors.UnknownError('Socket connection to the device might be missed');
  }

  /**
   * Activate (launch) an installed application on the TV.
   * @param {string} appPackage - The package/app ID to launch
   * @param {Record<string,any>} [launchParams] - Optional launch parameters
   * @returns {Promise<void>}
   */
  async activateApp(appPackage, launchParams) {
    if (!appPackage) {
      throw new errors.InvalidArgumentError('appPackage parameter is required');
    }
    log.info(`Activating app '${appPackage}'`);
    await launchApp(appPackage, this.opts.deviceName, launchParams);
  }

  /**
   * Get information about the currently focused element
   * @returns {Promise<object|null>}
   */
  async getFocusedElement() {
    await this.injectElementAttributes();
    const script = `
      var focused = document.activeElement;
      if (!focused) return null;
      var rect = focused.getBoundingClientRect();
      var left = Math.round(rect.left);
      var top = Math.round(rect.top);
      var right = Math.round(rect.right);
      var bottom = Math.round(rect.bottom);
      return {
        tag: focused.tagName,
        text: (focused.textContent || '').trim().substring(0, 100),
        x: left, y: top,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        bounds: '[' + left + ',' + top + '][' + right + ',' + bottom + ']',
        displayed: focused.offsetParent !== null,
        enabled: !focused.disabled,
        focused: true
      };
    `;
    try {
      return await this.#executeChromedriverScript('/execute/sync', script, []);
    } catch (error) {
      log.warn(`Failed to get focused element: ${error.message}`);
      return null;
    }
  }

  /**
   * Fix invalid locator strategy before passing to Chromedriver
   * @param {string} strategy
   * @param {string} selector
   * @returns {{strategy: string, selector: string}}
   */
  #fixLocatorStrategy(strategy, selector) {
    if (strategy === 'id') {
      log.info(`Converting "id" locator to CSS selector: #${selector}`);
      return {strategy: 'css selector', selector: `#${selector}`};
    }
    if (strategy === 'name') {
      log.info(`Converting "name" locator to CSS selector: [name="${selector}"]`);
      return {strategy: 'css selector', selector: `[name="${selector}"]`};
    }
    if (strategy === 'class name' && (selector.includes(' ') || selector.includes('-'))) {
      log.warn(`"class name" strategy only accepts a single class. Converting "${selector}" to CSS selector`);
      const classes = selector.split(/\s+/).filter((c) => c.length > 0);
      const cssSelector = classes.map((c) => `.${c.replace(/([[\](){}:.<>#@!%^&*+~=|\\/'",?])/g, '\\$1')}`).join('');
      return {strategy: 'css selector', selector: cssSelector};
    }
    return {strategy, selector};
  }

  /**
   * Find element - intercepts to fix invalid locator strategies and retry with attribute injection
   * @param {string} strategy
   * @param {string} selector
   * @returns {Promise<any>}
   */
  async findElement(strategy, selector) {
    const fixed = this.#fixLocatorStrategy(strategy, selector);
    if (fixed.strategy !== strategy) {
      log.info(`Converted locator: "${strategy}":"${selector}" -> "${fixed.strategy}":"${fixed.selector}"`);
    }
    try {
      // @ts-ignore
      return await this.#chromedriver.sendCommand('/element', 'POST', {using: fixed.strategy, value: fixed.selector});
    } catch (err) {
      if (
        err.message?.includes('no such element') &&
        fixed.strategy === 'xpath' &&
        /@(text|bounds|displayed|enabled|x|y|width|height)/.test(fixed.selector)
      ) {
        log.info('Element not found with custom attribute selector, re-injecting attributes and retrying');
        await this.injectElementAttributes();
        // @ts-ignore
        return await this.#chromedriver.sendCommand('/element', 'POST', {using: fixed.strategy, value: fixed.selector});
      }
      throw err;
    }
  }

  /**
   * Find elements - intercepts to fix invalid locator strategies
   * @param {string} strategy
   * @param {string} selector
   * @returns {Promise<any>}
   */
  async findElements(strategy, selector) {
    const fixed = this.#fixLocatorStrategy(strategy, selector);
    if (fixed.strategy !== strategy) {
      log.info(`Converted locator: "${strategy}":"${selector}" -> "${fixed.strategy}":"${fixed.selector}"`);
    }
    if (fixed.strategy === 'xpath' && /@(text|bounds|displayed|enabled|x|y|width|height)/.test(fixed.selector)) {
      await this.injectElementAttributes();
    }
    // @ts-ignore
    return await this.#chromedriver.sendCommand('/elements', 'POST', {using: fixed.strategy, value: fixed.selector});
  }

  /**
   * Injects custom attributes into all DOM elements for mobile-style XPath selectors
   * @returns {Promise<number>} Number of elements processed
   */
  async injectElementAttributes() {
    const script = `
      var allElements = document.body.getElementsByTagName('*');
      var count = 0;
      var focusedElement = document.activeElement;
      Array.from(allElements).forEach(function(el) {
        var rect = el.getBoundingClientRect();
        var left = Math.round(rect.left), top = Math.round(rect.top);
        var right = Math.round(rect.right), bottom = Math.round(rect.bottom);
        el.setAttribute('x', left);
        el.setAttribute('y', top);
        el.setAttribute('width', Math.round(rect.width));
        el.setAttribute('height', Math.round(rect.height));
        el.setAttribute('bounds', '[' + left + ',' + top + '][' + right + ',' + bottom + ']');
        el.setAttribute('displayed', el.offsetParent !== null ? 'true' : 'false');
        el.setAttribute('enabled', el.disabled ? 'false' : 'true');
        el.setAttribute('focused', el === focusedElement ? 'true' : 'false');
        var text = el.textContent ? el.textContent.trim() : '';
        if (text && text.length > 0 && text.length < 100) {
          el.setAttribute('text', text.substring(0, 100));
        }
        count++;
      });
      return count;
    `;
    try {
      const count = /** @type {number} */ (await this.#executeChromedriverScript('/execute/sync', script, []));
      log.debug(`Injected attributes into ${count} elements`);
      return count;
    } catch (error) {
      log.warn(`Failed to inject element attributes: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get page source with injected attributes for Appium Inspector
   * @returns {Promise<string>}
   */
  async getPageSource() {
    await this.injectElementAttributes();
    // @ts-ignore
    return /** @type {string} */ (await this.#chromedriver.sendCommand('/source', 'GET'));
  }

  /**
   * Get element text via JS
   * @param {string} elementId
   * @returns {Promise<string>}
   */
  async getText(elementId) {
    return /** @type {string} */ (
      await this.#executeChromedriverScript('/execute/sync',
        `var e = arguments[0]; return e.textContent || e.innerText || '';`,
        [this.#buildElementObject(elementId)])
    );
  }

  /**
   * Get element size via JS
   * @param {string} elementId
   * @returns {Promise<{width: number, height: number}>}
   */
  async getSize(elementId) {
    const script = `var e=arguments[0],r=e.getBoundingClientRect();return {width:r.width,height:r.height};`;
    return /** @type {{width: number, height: number}} */ (
      await this.#executeChromedriverScript('/execute/sync', script, [this.#buildElementObject(elementId)])
    );
  }

  /**
   * Get element location via JS
   * @param {string} elementId
   * @returns {Promise<{x: number, y: number}>}
   */
  async getLocation(elementId) {
    const script = `var e=arguments[0],r=e.getBoundingClientRect();return {x:r.left,y:r.top};`;
    return /** @type {{x: number, y: number}} */ (
      await this.#executeChromedriverScript('/execute/sync', script, [this.#buildElementObject(elementId)])
    );
  }

  /**
   * Get element rect via JS
   * @param {string} elementId
   * @returns {Promise<{x: number, y: number, width: number, height: number}>}
   */
  async getElementRect(elementId) {
    const script = `var e=arguments[0],r=e.getBoundingClientRect();return {x:r.left,y:r.top,width:r.width,height:r.height};`;
    return /** @type {{x: number, y: number, width: number, height: number}} */ (
      await this.#executeChromedriverScript('/execute/sync', script, [this.#buildElementObject(elementId)])
    );
  }

  /**
   * Check if element is displayed via JS
   * @param {string} elementId
   * @returns {Promise<boolean>}
   */
  async elementDisplayed(elementId) {
    const script = `
      var e=arguments[0],r=e.getBoundingClientRect(),s=window.getComputedStyle(e);
      return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0';
    `;
    return /** @type {boolean} */ (
      await this.#executeChromedriverScript('/execute/sync', script, [this.#buildElementObject(elementId)])
    );
  }

  /**
   * Click element via JS
   * @param {string} elementId
   * @returns {Promise<void>}
   */
  async click(elementId) {
    log.info(`[click] Clicking element ${elementId} via JS execution`);
    const script = `
      var e=arguments[0];
      if(typeof e.click==='function'){e.click();return true;}
      e.dispatchEvent(new MouseEvent('click',{view:window,bubbles:true,cancelable:true}));
      return true;
    `;
    await this.#executeChromedriverScript('/execute/sync', script, [this.#buildElementObject(elementId)]);
  }

  /**
   * Get comprehensive element info - custom webOS method
   * @param {string} elementId
   * @returns {Promise<object>}
   */
  async getElementInfo(elementId) {
    const script = `
      var el=arguments[0],rect=el.getBoundingClientRect(),style=window.getComputedStyle(el);
      var attrs={};
      for(var i=0;i<el.attributes.length;i++){attrs[el.attributes[i].name]=el.attributes[i].value;}
      return {
        text:el.textContent,tagName:el.tagName,
        attributes:attrs,
        properties:{id:el.id,className:el.className,disabled:el.disabled,hidden:el.hidden,type:el.type,value:el.value},
        state:{enabled:!el.disabled,displayed:el.offsetParent!==null,visible:style.visibility!=='hidden',selected:el.selected},
        dimensions:{width:rect.width,height:rect.height,x:rect.x,y:rect.y,top:rect.top,left:rect.left,right:rect.right,bottom:rect.bottom},
        style:{backgroundColor:style.backgroundColor,color:style.color,fontSize:style.fontSize,display:style.display,visibility:style.visibility,opacity:style.opacity}
      };
    `;
    return await this.#executeChromedriverScript('/execute/sync', script, [this.#buildElementObject(elementId)]);
  }

  /**
   * Get element attribute - required for Appium Inspector
   * @param {string} name
   * @param {string} elementId
   * @returns {Promise<string|number|null>}
   */
  async getAttribute(name, elementId) {
    const dimensionalAttrs = ['x', 'y', 'width', 'height'];
    if (dimensionalAttrs.includes(name.toLowerCase())) {
      const attrResult = await this.#executeChromedriverScript('/execute/sync',
        `var e=arguments[0];return e.getAttribute(arguments[1]);`,
        [this.#buildElementObject(elementId), name]);
      if (attrResult !== null && attrResult !== '') {
        return /** @type {string|null} */ (attrResult);
      }
      return /** @type {number|null} */ (await this.#executeChromedriverScript('/execute/sync', `
        var e=arguments[0],r=e.getBoundingClientRect(),n=arguments[1].toLowerCase();
        if(n==='x')return Math.round(r.left);
        if(n==='y')return Math.round(r.top);
        if(n==='width')return Math.round(r.width);
        if(n==='height')return Math.round(r.height);
        return null;
      `, [this.#buildElementObject(elementId), name]));
    }
    return /** @type {string|null} */ (await this.#executeChromedriverScript('/execute/sync',
      `return arguments[0].getAttribute(arguments[1]);`,
      [this.#buildElementObject(elementId), name]));
  }

  /**
   * Get element tag name - required for Appium Inspector
   * @param {string} elementId
   * @returns {Promise<string>}
   */
  async getName(elementId) {
    return /** @type {string} */ (await this.#executeChromedriverScript('/execute/sync',
      `return arguments[0].tagName.toLowerCase();`,
      [this.#buildElementObject(elementId)]));
  }

  /**
   * Get element JS property - required for Appium Inspector
   * @param {string} name
   * @param {string} elementId
   * @returns {Promise<any>}
   */
  async getProperty(name, elementId) {
    return await this.#executeChromedriverScript('/execute/sync',
      `var v=arguments[0][arguments[1]];return v===undefined?null:v;`,
      [this.#buildElementObject(elementId), name]);
  }

  /**
   * Check if element is enabled - required for Appium Inspector
   * @param {string} elementId
   * @returns {Promise<boolean>}
   */
  async elementEnabled(elementId) {
    const script = `
      var e=arguments[0];
      if(e.disabled===true||e.getAttribute('disabled')!==null)return false;
      var c=e;
      while(c&&c!==document.body){if(c.disabled===true||c.getAttribute('disabled')!==null)return false;c=c.parentElement;}
      return true;
    `;
    return /** @type {boolean} */ (await this.#executeChromedriverScript('/execute/sync', script, [this.#buildElementObject(elementId)]));
  }

  /**
   * Check if element is selected - required for Appium Inspector
   * @param {string} elementId
   * @returns {Promise<boolean>}
   */
  async elementSelected(elementId) {
    const script = `
      var e=arguments[0];
      if(e.tagName==='INPUT'&&(e.type==='checkbox'||e.type==='radio'))return e.checked===true;
      if(e.tagName==='OPTION')return e.selected===true;
      return e.getAttribute('selected')!==null;
    `;
    return /** @type {boolean} */ (await this.#executeChromedriverScript('/execute/sync', script, [this.#buildElementObject(elementId)]));
  }

  /**
   * Get element CSS value - required for Appium Inspector
   * @param {string} propertyName
   * @param {string} elementId
   * @returns {Promise<string>}
   */
  async getCssProperty(propertyName, elementId) {
    return /** @type {string} */ (await this.#executeChromedriverScript('/execute/sync',
      `return window.getComputedStyle(arguments[0]).getPropertyValue(arguments[1])||'';`,
      [this.#buildElementObject(elementId), propertyName]));
  }

  /**
   * Hide keyboard by blurring the active element
   * @returns {Promise<void>}
   */
  async hideKeyboard() {
    log.info('[hideKeyboard] Hiding keyboard by blurring active element');
    try {
      await this.#executeChromedriverScript('/execute/sync',
        `if(document.activeElement&&document.activeElement.blur){document.activeElement.blur();return true;}return false;`, []);
    } catch (error) {
      log.warn(`[hideKeyboard] Failed to hide keyboard: ${error.message}`);
    }
  }

  /**
   * Helper to build element object for Chromedriver script arguments
   * @param {string} elementId
   * @returns {any}
   */
  #buildElementObject(elementId) {
    return {
      ELEMENT: elementId,
      'element-6066-11e4-a52e-4f735466cecf': elementId,
    };
  }

  /**
   * Get window rect - uses document body size as fallback for webOS
   * @returns {Promise<{width: number, height: number, x: number, y: number}>}
   */
  async getWindowRect() {
    log.info(`[getWindowRect] Getting window dimensions via document element size`);
    try {
      // @ts-ignore
      const elementResult = await this.#chromedriver.sendCommand('/element', 'POST', {using: 'css selector', value: 'body'});
      // @ts-ignore
      const elementId = elementResult['element-6066-11e4-a52e-4f735466cecf'] || elementResult.ELEMENT;
      // @ts-ignore
      const sizeResult = await this.#chromedriver.sendCommand(`/element/${elementId}/rect`, 'GET', {});
      // @ts-ignore
      return {width: sizeResult.width || 1920, height: sizeResult.height || 1080, x: 0, y: 0};
    } catch (error) {
      log.warn(`[getWindowRect] Using fallback resolution 1920x1080`);
      return {width: 1920, height: 1080, x: 0, y: 0};
    }
  }

  /**
   * A dummy implementation to return 200 ok with NATIVE_APP context for
   * webdriverio compatibility.
   *
   * @returns {Promise<string>}
   */
  // eslint-disable-next-line require-await
  async getCurrentContext() {
    return 'NATIVE_APP';
  }
}

/**
 * @typedef {import('./types').ExtraWebOsCaps} WebOSCapabilities
 * @typedef {import('./constraints').WebOsConstraints} WebOsConstraints
 * @typedef {import('./keys').KnownKey} Key
 * @typedef {import('./types').StartChromedriverOptions} StartChromedriverOptions
 */

/**
 * @typedef {import('@appium/types').DriverCaps<WebOsConstraints, WebOSCapabilities>} WebOsCaps
 * @typedef {import('@appium/types').W3CDriverCaps<WebOsConstraints, WebOSCapabilities>} W3CWebOsCaps
 * @typedef {import('@appium/types').RouteMatcher} RouteMatcher
 */

/**
 * @typedef {typeof WebOSDriver.executeMethodMap} WebOSDriverExecuteMethodMap
 */

/**
 * A known script identifier (e.g., `tizen: pressKey`)
 * @typedef {keyof WebOSDriverExecuteMethodMap} ScriptId
 */

/**
 * Lookup a method by its script ID.
 * @template {ScriptId} S
 * @typedef {WebOSDriver[WebOSDriverExecuteMethodMap[S]['command']]} ExecuteMethod
 */
