import _ from 'lodash';
import WebSocket from 'ws';
import B from 'bluebird';
import {logger} from 'appium/support';
import {WsEvent} from './lg-socket-client';

const DEFAULT_KEY_COOLDOWN = 750;

export class LGRemoteClient {
  /**
   * @type {string}
   */
  #url;

  /**
   * @type {import('@appium/types').AppiumLogger}
   */
  #log;

  /**
   * @type {WebSocket|undefined}
   */
  #ws;

  /**
   * @type {number}
   */
  #keyCooldown;

  /**
   *
   * @param {LGRemoteClientOpts} opts
   */
  constructor({
    url,
    log = logger.getLogger('LGRemoteClient'),
    keyCooldown = DEFAULT_KEY_COOLDOWN,
  }) {
    this.#url = url;
    this.#log = log;
    this.#keyCooldown = keyCooldown;
  }

  async connect() {
    await new B((res, rej) => {
      /** @type {WebSocket} */
      let ws;
      const onOpen = () => {
        ws.removeListener(WsEvent.ERROR, onError);
        ws.on(WsEvent.MESSAGE, this.#onMessage.bind(this));
        res(ws);
      };
      /** @param {Error} err */
      const onError = (err) => {
        ws.removeListener(WsEvent.OPEN, onOpen);
        rej(err);
      };
      ws = new WebSocket(this.#url)
        .once(WsEvent.OPEN, onOpen)
        .once(WsEvent.ERROR, onError);
      this.#ws = ws;
    });
  }

  async disconnect() {
    await new B((res, rej) => {
      const onClose = () => {
        this.#ws?.removeListener(WsEvent.ERROR, onError);
        this.#ws?.removeListener(WsEvent.MESSAGE, this.#onMessage);
        res();
      };
      /** @param {Error} err */
      const onError = (err) => {
        this.#ws?.removeListener(WsEvent.CLOSE, onClose);
        rej(err);
      };
      this.#ws?.once(WsEvent.CLOSE, onClose);
      this.#ws?.once(WsEvent.ERROR, onError);
      this.#ws?.close();
    });
  }

  /**
   * @param {any} data
   */
  #onMessage(data) {
    this.#log.info(data);
  }

  /**
   *
   * @template {SerializableObject} [P=any]
   * @param {string} type
   * @param {P} payload
   */
  command(type, payload = /** @type {P} */({})) {
    const cmdLines = [];
    cmdLines.push(`type:${type}`);
    for (const key of _.keys(payload)) {
      cmdLines.push(`${key}:${payload[key]}`);
    }
    const msg = cmdLines.join('\n') + '\n\n';
    this.#log.debug(`Sending ${type} command: ${msg.replaceAll('\n', '\\n')}`);
    this.#ws?.send(msg);
  }

  /**
   *
   * @param {*} param0
   */
  async movePointer({dx, dy}) {
    if (dx !== undefined && dy !== undefined) {
      this.command('move', {dx, dy});
      await B.delay(this.#keyCooldown);
    } else {
      throw new Error(`Must include either x/y or dx/dy params`);
    }
  }

  /**
   *
   * @param {import('type-fest').LiteralUnion<LGRemoteKey, string>} name
   */
  async pressKey(name) {
    this.command('button', {name});
    await B.delay(this.#keyCooldown);
  }

}

export const LGRemoteKeys = Object.freeze(
  /** @type {const} */ ({
    HOME: 'HOME',
    LEFT: 'LEFT',
    RIGHT: 'RIGHT',
    UP: 'UP',
    DOWN: 'DOWN',
    ENTER: 'ENTER',
    BACK: 'BACK',
  })
);

/**
 * @typedef {import('type-fest').ValueOf<typeof LGRemoteKeys>} LGRemoteKey
 */

/**
 * @typedef LGRemoteClientOpts
 * @property {string} url
 * @property {import('@appium/types').AppiumLogger} [log]
 * @property {number} [keyCooldown]
 */

/**
 * @typedef {import('../types').SerializableObject} SerializableObject
 */

/**
 * @template {SerializableObject} [P=any]
 * @typedef {import('../types').Message<P>} Message
 */
