import _ from 'lodash';
import B from 'bluebird';
import {errors} from 'appium/driver';
import {LGRemoteKeys} from './remote/lg-remote-client';
import {logger} from 'appium/support';

const log = logger.getLogger('WebOSDriver');

const DEFAULT_PRESS_DURATION_MS = 100;

const ENTER = 'enter';
const RIGHT = 'right';
const LEFT = 'left';
const UP = 'up';
const DOWN = 'down';
const BACK = 'back';
const PLAYPAUSE = 'playpause';
const FWD = 'fwd';
const REV = 'rev';

export const KEYS = Object.freeze(
  /** @type {const} */ ({
    ENTER,
    RIGHT,
    LEFT,
    UP,
    DOWN,
    BACK,
    PLAYPAUSE,
    FWD,
    REV,
  }),
);

/**
 * @see https://webostv.developer.lge.com/design/webos-tv-system-ui/remote-control/
 */
export const KEYMAP = Object.freeze(/** @type {const} */({
  [ENTER]: [0x0d, 'Enter'],
  [RIGHT]: [0x27, 'ArrowRight'],
  [LEFT]: [0x25, 'ArrowLeft'],
  [UP]: [0x26, 'ArrowUp'],
  [DOWN]: [0x28, 'ArrowDown'],
  [BACK]: [0x1cd, 'Back'],
  [PLAYPAUSE]: [0x9f, '\x85'],
  [FWD]: [0xa9, 'Unidentified'],
  [REV]: [0xa8, 'Unidentified'],
}));

/**
 *
 * @param {string} event
 * @param {KeyboardEventInit} params
 * @returns {string}
 */
function getKeyboardScript (event, params) {
  log.info(`Generating keyboard script for event: ${event} with data: ${JSON.stringify(params)}`);
  return `document.dispatchEvent(new KeyboardEvent('${event}', ${JSON.stringify(params)}));`;
}

/**
 * Automates a keypress
 * @param {WebOSPressKeyOptions} opts
 * @this {import('.').WebOSDriver}
 */
export async function webos_pressKey({key, duration}) {
  if (this.opts.rcMode === 'js') {
    return await this.pressKeyViaJs(key, duration);
  } else {
    if (duration) {
      this.log.warn(`Attempted to send a duration for a remote-based ` +
                    `key press; duration will be ignored`);
    }
    return await this.pressKeyViaRemote(key);
  }
}


/**
 * Automates a press of a button on a remote control.
 * @param {string} key
 * @this {import('.').WebOSDriver}
 */
export async function pressKeyViaRemote(key) {
  const sc = /** @type {import('./remote/lg-socket-client').LGWSClient} */(this.socketClient);
  const rc = /** @type {import('./remote/lg-remote-client').LGRemoteClient} */(this.remoteClient);

  const keyMap = Object.freeze(/** @type {const} */({
    VOL_UP: sc.volumeUp,
    VOL_DOWN: sc.volumeDown,
    MUTE: sc.mute,
    UNMUTE: sc.unmute,
    PLAY: sc.play,
    STOP: sc.stop,
    REWIND: sc.rewind,
    FF: sc.fastForward,
    CHAN_UP: sc.channelUp,
    CHAN_DOWN: sc.channelDown
  }));

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
 *
 * @param {KnownKey} key
 * @param {number} [duration]
 * @this {import('.').WebOSDriver}
 */
export async function pressKeyViaJs(key, duration = DEFAULT_PRESS_DURATION_MS) {
  key = /** @type {typeof key} */(key.toLowerCase());
  const [keyCode, keyName] = KEYMAP[key];
  if (!keyCode) {
    throw new errors.InvalidArgumentError(`Key name '${key}' is not supported`);
  }
  const params = {
    key: keyName,
    code: keyName,
    keyCode,
    which: keyCode,
  };
  await this.executeInChrome(getKeyboardScript('keydown', params));
  await B.delay(duration);
  await this.executeInChrome(getKeyboardScript('keyup', {}));
}

/**
 * @typedef WebOSPressKeyOptions
 * @property {KnownKey} key
 * @property {number} [duration]
 */

/**
 * @typedef {keyof KEYMAP} KnownKey
 */
