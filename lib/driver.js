import {BaseDriver, errors} from 'appium/driver';
import B from 'bluebird';
import _ from 'lodash';
import {
  closeApp,
  extendDevMode,
  getDeviceInfo,
  installApp,
  launchApp,
  uninstallApp,
} from './cli/ares';
import {CAP_CONSTRAINTS, DEFAULT_CAPS} from './constraints';
import {AsyncScripts, SyncScripts} from './scripts';
// @ts-ignore
import Chromedriver from 'appium-chromedriver';
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
 * A security flag to enable chromedriver auto download feature
 */
const CHROMEDRIVER_AUTODOWNLOAD_FEATURE = 'chromedriver_autodownload';

/**
 * To get chrome driver version in the UA
 */
const REGEXP_CHROME_VERSION_IN_UA = new RegExp('Chrome\\/(\\S+)');

// don't proxy any 'appium' routes
/** @type {RouteMatcher[]} */
const NO_PROXY = [
  ['POST', new RegExp('^/session/[^/]+/appium')],
  ['GET', new RegExp('^/session/[^/]+/appium')],
  ['POST', new RegExp('^/session/[^/]+/execute/sync')],
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
      command: 'listApps'
    }),
    'webos: activeAppInfo': Object.freeze({
      command: 'getCurrentForegroundAppInfo'
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
    let [sessionId, caps] = await super.createSession(w3cCaps1, w3cCaps2, w3cCaps3);
    const {
      autoExtendDevMode,
      deviceName,
      app,
      appId,
      appLaunchParams,
      noReset,
      fullReset,
      deviceHost,
      debuggerPort,
      chromedriverExecutable,
      chromedriverExecutableDir,
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

    if (autoExtendDevMode) {
      await extendDevMode(deviceName);
    }

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
      isAutodownloadEnabled: /** @type {Boolean} */ (this.#isChromedriverAutodownloadEnabled()),
    });

    log.info('Waiting for app launch to take effect');
    await B.delay(appLaunchCooldown);

    if (!noReset) {
      log.info('Clearing app local storage & reloading');
      await this.executeChromedriverScript(SyncScripts.reset);
    }

    return [sessionId, caps];
  }


  /**
   * Use UserAgent info for "Browser" if the chrome response did not include
   * browser name properly.
   * @param {object} browserVersionInfo
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

    log.info(`The response did not have Browser, thus set the Browser value from UA as ${JSON.stringify(browserVersionInfo)}`);
    browserVersionInfo.Browser = chromeVersion[0];
    return browserVersionInfo;
  }

  /**
   * Returns whether the session can enable autodownloadd feature.
   * @returns {boolean}
   */
  #isChromedriverAutodownloadEnabled() {
    if (this.isFeatureEnabled(CHROMEDRIVER_AUTODOWNLOAD_FEATURE)) {
      return true;
    }
    this.log.debug(
      `Automated Chromedriver download is disabled. ` +
        `Use '${CHROMEDRIVER_AUTODOWNLOAD_FEATURE}' server feature to enable it`,
    );
    return false;
  }

  /**
   * @param {StartChromedriverOptions} opts
   */
  async startChromedriver({debuggerHost, debuggerPort, executable, executableDir, isAutodownloadEnabled}) {
    const debuggerAddress = `${debuggerHost}:${debuggerPort}`;


    let result;
    if (executableDir) {
      // get the result of chrome info to use auto detection.
      try {
        result = await got.get(`http://${debuggerAddress}/json/version`).json();
        log.info(`The response of http://${debuggerAddress}/json/version was ${JSON.stringify(result)}`);
        result = this.useUAForBrowserIfNotPresent(result);

        // To respect the executableDir.
        executable = undefined;
      } catch (err) {
        throw new errors.SessionNotCreatedError(
          `Could not get the chrome browser information to detect proper chromedriver version. Is it a debiggable build? Error: ${err.message}`
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
      details: {info: result}
    });

    // XXX: goog:chromeOptions in newer versions, chromeOptions in older
    await this.#chromedriver.start({
      chromeOptions: {
        debuggerAddress,
      },
    });
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
    return await this.#executeChromedriverScript('/execute/sync', script, args);
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
   * @returns {Promise<{value: TReturn}>}
   */
  async #executeChromedriverScript(endpointPath, script, args = []) {
    const wrappedScript =
      typeof script === 'string' ? script : `return (${script}).apply(null, arguments)`;
    // @ts-ignore
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
      return await rc.pressKey(key);
    }

    key = _.upperCase(key);

    if (isMappedKey(key)) {
      this.log.info(`Found virtual 'key' to be sent as socket command`);
      return await keyMap[key].call(sc);
    }

    return await rc.pressKey(key);
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
  }

  /**
   *
   * @returns {Promise<[object]>} Return the list of installed applications
   */
  async listApps() {
    const sc = /** @type {import('./remote/lg-socket-client').LGWSClient} */ (this.socketClient);
    if (sc) {
      return (await sc.getListApps()).apps;
    };
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
    };
    throw new errors.UnknownError('Socket connection to the device might be missed');
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
