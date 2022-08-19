import _ from 'lodash';
import B from 'bluebird';
import {errors} from 'appium/driver';
import {LGRemoteKeys} from './remote/lg-remote-client';

const DEFAULT_PRESS_DURATION_MS = 100;

export const KEYS = {
  enter: [13, 'Enter'],
  right: [39, 'ArrowRight'],
  left: [37, 'ArrowLeft'],
  up: [38, 'ArrowUp'],
  down: [40, 'ArrowDown'],
  back: [461, 'GoBack'],
  playPause: [415, '\x85'],
  fwd: [425, 'Unidentified'],
  rev: [424, 'Unidentified'],
};

function getKeyboardScript (event, params) {
  return `document.dispatchEvent(new KeyboardEvent('${event}', ${JSON.stringify(params)}));`;
}

export async function webos_pressKey(key, duration) {
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

export async function pressKeyViaRemote(key) {
  const sc = this.socketClient;
  const rc = this.remoteClient;
  const keyMap = {
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
  };

  const knownKeys = [...Object.keys(keyMap), ...Object.keys(LGRemoteKeys)];

  if (!knownKeys.includes(_.upperCase(key))) {
    this.log.warn(`Unknown key '${key}'; will send to remote as-is`);
    return await rc.pressKey(key);
  }

  key = _.upperCase(key);

  if (keyMap[key]) {
    this.log.info(`Found virtual 'key' to be sent as socket command`);
    return await keyMap[key].bind(sc);
  }

  return await rc.pressKey(key);
}

export async function pressKeyViaJs(key, duration) {
  if (duration !== 0 && !duration) {
    duration = DEFAULT_PRESS_DURATION_MS;
  }
  key = key.toLowerCase();
  const [keyCode, keyName] = KEYS[key];
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
