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
      // Check if URL uses secure WebSocket (wss://) and add rejectUnauthorized option
      const isSecure = this.#url.startsWith('wss://');
      const wsOptions = isSecure ? {rejectUnauthorized: false} : undefined;
      ws = new WebSocket(this.#url, wsOptions)
        .once(WsEvent.OPEN, onOpen)
        .once(WsEvent.ERROR, onError);
      this.#ws = ws;
    });

    // Add persistent error handler for connection issues during operation
    this.#ws?.on(WsEvent.ERROR, (err) => {
      this.#log.error(`Remote WebSocket error: ${err.message}`);
      if (err.message?.includes('ECONNRESET')) {
        this.#log.warn(
          'Remote connection was reset by the TV. The TV may have been turned off, restarted, or the network connection was interrupted.'
        );
      }
    });

    // Add close handler to log unexpected disconnections
    this.#ws?.on(WsEvent.CLOSE, (code, reason) => {
      this.#log.info(`Remote WebSocket closed with code ${code}${reason ? `: ${reason}` : ''}`);
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
   * Reconnect the WebSocket if it's closed
   */
  async reconnect() {
    this.#log.info('Reconnecting remote WebSocket...');
    try {
      await this.disconnect();
    } catch (err) {
      // Ignore disconnect errors if already closed
    }
    await this.connect();
    this.#log.info('Remote WebSocket reconnected successfully');
  }

  /**
   * @param {any} data
   */
  #onMessage(data) {
    this.#log.info(data);
  }

  /**
   * Check if the WebSocket connection is open and ready
   * @returns {boolean}
   */
  isConnected() {
    return this.#ws?.readyState === WebSocket.OPEN;
  }

  /**
   *
   * @template {SerializableObject} [P=any]
   * @param {string} type
   * @param {P} payload
   */
  async command(type, payload = /** @type {P} */ ({})) {
    if (!this.isConnected()) {
      this.#log.warn('Remote WebSocket is closed, attempting to reconnect...');
      try {
        await this.reconnect();
      } catch (err) {
        throw new Error(
          'Failed to reconnect remote WebSocket: ' +
            err.message +
            '. ' +
            'The connection may have been closed by the TV. ' +
            'This can happen if the TV went to sleep, was restarted, or the network connection was interrupted.'
        );
      }
    }
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
   * @param {import('../types').Delta} delta
   */
  async movePointer({dx, dy}) {
    if (dx !== undefined && dy !== undefined) {
      await this.command('move', {dx, dy});
      await B.delay(this.#keyCooldown);
    } else {
      throw new TypeError(`Must include dx/dy params`);
    }
  }

  /**
   *
   * @param {import('type-fest').LiteralUnion<LGRemoteKey, string>} name
   */
  async pressKey(name) {
    await this.command('button', {name});
    await B.delay(this.#keyCooldown);
  }

}

/**
 * @see https://webostv.developer.lge.com/develop/guides/magic-remote
 */
export const LGRemoteKeys = Object.freeze(
  /** @type {const} */ ({
    HOME: 'HOME',
    LEFT: 'LEFT',
    RIGHT: 'RIGHT',
    UP: 'UP',
    DOWN: 'DOWN',
    ENTER: 'ENTER',
    BACK: 'BACK',
    MENU: 'MENU',
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
 * @typedef {import('../types').InboundMsg<P>} Message
 */
