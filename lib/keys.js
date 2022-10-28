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
 * This is a mapping of some keys which are understood by a JS-based WebOS app
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
 * @typedef {keyof typeof KEYMAP} KnownKey
 */
