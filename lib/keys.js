import B from 'bluebird';
import {errors} from 'appium/driver';

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

export async function webos_pressKey({key, duration}) {
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
  await this.executeScript(getKeyboardScript('keydown', params));
  await B.delay(duration);
  await this.executeScript(getKeyboardScript('keyup', {}));
}
