import WebSocket from 'ws';
import B from 'bluebird';
import {AUTH_PAYLOAD, MsgType} from './constants';
import {logger} from 'appium/support';
import path from 'path';
import {LGRemoteClient} from './lg-remote-client';

export const WsEvent = /** @type {const} */ ({
  CONNECT: 'connect',
  CLOSE: 'close',
  ERROR: 'error',
  OPEN: 'open',
  MESSAGE: 'message',
});

export class LGWSClient {
  /** @type {string} */
  #url;

  /** @type {string} */
  #urlSecure;

  /** @type {WebSocket|undefined} */
  #ws;

  /** @type {boolean} */
  #saveClientKey;

  /** @type {boolean} */
  #useSecureWebsocket;

  #cmdNum = 0;

  /** @type {import('@appium/types').AppiumLogger} */
  #log;

  /** @type {LGRemoteClient|undefined} */
  #remoteClient;

  /** @type {number|undefined} */
  #remoteKeyCooldown;

  /**
   * @type {import('./valuebox').ValueWrapper<string>}
   */
  #keystore;

  /** @type {import('./valuebox').ValueBox} */
  #valueBox;

  /**
   * Unique identifier for key based on device name.
   * Also doubles as a filename.
   * @type {string}
   */
  #keystoreId;

  /** @type {string|undefined} */
  #clientKey;

  /**
   *
   * @param {import('../types').LGSocketClientOpts} opts
   */
  constructor({
    url,
    urlSecure,
    useSecureWebsocket,
    valueBox,
    deviceName,
    log = logger.getLogger('LGWsClient'),
    saveClientKey = true,
    remoteKeyCooldown,
  }) {
    this.#valueBox = valueBox;
    this.#url = url;
    this.#urlSecure = urlSecure;
    this.#useSecureWebsocket = useSecureWebsocket;
    this.#log = log;
    this.#saveClientKey = saveClientKey;
    this.#remoteKeyCooldown = remoteKeyCooldown;
    this.#keystoreId = `clientKey-${deviceName}.txt`;
  }

  /**
   * @returns {Promise<void>}
   */
  async connect() {
    await new B((res, rej) => {
      /** @type {WebSocket} */
      let ws;
      const onOpen = () => {
        ws.removeListener(WsEvent.ERROR, onError);
        res(ws);
      };
      /** @param {Error} err */
      const onError = (err) => {
        ws.removeListener(WsEvent.OPEN, onOpen);
        rej(err);
      };
      if (this.#useSecureWebsocket) {
        ws = new WebSocket(this.#urlSecure, {rejectUnauthorized: false}).once(WsEvent.OPEN, onOpen).once(WsEvent.ERROR, onError);
      } else {
        ws = new WebSocket(this.#url).once(WsEvent.OPEN, onOpen).once(WsEvent.ERROR, onError);
      }
      this.#ws = ws;
    });
  }

  /**
   * @returns {Promise<void>}
   */
  async disconnect() {
    await new B(async (res, rej) => {
      const onClose = () => {
        this.#ws?.removeListener(WsEvent.ERROR, onError);
        res();
      };
      /** @param {Error} err */
      const onError = (err) => {
        this.#ws?.removeListener(WsEvent.CLOSE, onClose);
        rej(err);
      };
      this.#ws?.once(WsEvent.CLOSE, onClose);
      this.#ws?.once(WsEvent.ERROR, onError);
      if (this.#remoteClient) {
        try {
          await this.#remoteClient.disconnect();
        } catch (err) {
          this.#log.warn(`Could not cleanly shut down remote client; err was: ${err}`);
        } finally {
          this.#remoteClient = undefined;
        }
      }
      this.#ws?.close();
    });
  }

  /**
   * @template {SerializableObject} [R=any]
   * @returns {Promise<InboundMsg<R>>}
   */
  async #receiveResponse() {
    return await new B((res, rej) => {
      /** @param {string} msg */
      const onMsg = (msg) => {
        this.#log.debug(`Got response: ${msg}`);
        try {
          res(JSON.parse(msg));
        } catch (err) {
          onError(/** @type {Error} */ (err));
        }
      };
      /** @param {Error} err */
      const onError = (err) => {
        this.#ws?.removeListener(WsEvent.MESSAGE, onMsg);
        rej(err);
      };
      this.#ws?.once(WsEvent.MESSAGE, onMsg);
      this.#ws?.once(WsEvent.ERROR, onError);
    });
  }

  /**
   * @template {SerializableObject|void} [P=void]
   * @template {SerializableObject} [R=any]
   * @param {OutboundMsg<P>} msgObj
   * @returns {Promise<InboundMsg<R>>}
   */
  async #sendMessage(msgObj) {
    const msg = JSON.stringify(msgObj);
    this.#log.debug(`Sending message: ${msg}`);
    this.#ws?.send(msg);
    return await this.#receiveResponse();
  }

  /**
   * @type {AuthPayload}
   */
  get #authPayload() {
    /** @type {AuthPayload} */
    const payload = {...AUTH_PAYLOAD};
    if (this.#clientKey) {
      payload['client-key'] = this.#clientKey;
    }
    return payload;
  }

  /**
   * Gets / initializes the keystore based on the keystore ID
   * @see {@linkcode #keystoreId}
   * @returns {Promise<import('./valuebox').ValueWrapper<string>>}
   */
  async #getKeystore() {
    return (
      this.#keystore ?? (this.#keystore = await this.#valueBox.createWrapper(this.#keystoreId))
    );
  }

  /**
   *
   * @returns {Promise<string>}
   */
  async authenticate() {
    if (this.#saveClientKey) {
      try {
        const keystore = await this.#getKeystore();
        this.#log.info(
          `Trying to read key from file on disk at ${path.join(this.#valueBox.dir, keystore.id)}`
        );
        this.#clientKey = keystore.value;
        this.#log.info(`Success: key is '${this.#clientKey}'`);
      } catch (ign) {
        this.#log.info(`Could not read key from disk`);
      }
    }
    const origClientKey = this.#clientKey;
    if (!(await this.#updateAuthStatus())) {
      const {type, payload} = /** @type {InboundMsg<AuthPayload>} */ (
        await this.#receiveResponse()
      );
      if (type === MsgType.REGISTERED) {
        this.#clientKey = payload['client-key'];
      }
      if (!(await this.#updateAuthStatus())) {
        throw new Error('Could not authenticate, please accept prompt');
      }
    }
    if (this.#saveClientKey && this.#clientKey !== undefined && this.#clientKey !== origClientKey) {
      this.#log.info(`Client key changed, writing it to disk`);
      const keystore = await this.#getKeystore();
      await keystore.put(this.#clientKey);
    }
    return /** @type {string} */ (this.#clientKey);
  }

  /**
   *
   * @param {any} msg
   * @returns {msg is import('../types').RegisteredMsg}
   */
  static isRegisteredMsg(msg) {
    return msg.type === MsgType.REGISTERED;
  }

  /**
   *
   * @param {any} msg
   * @returns {msg is import('../types').PromptMsg}
   */
  static isPromptMsg(msg) {
    return msg.type === MsgType.RESPONSE && msg.payload?.pairingType === 'PROMPT';
  }

  /**
   * Resolver `true` if registered, `false` if not.
   * @returns {Promise<boolean>}
   */
  async #updateAuthStatus() {
    const msg = await this.command(MsgType.REGISTER, undefined, this.#authPayload);
    if (LGWSClient.isRegisteredMsg(msg)) {
      this.#clientKey = msg.payload['client-key'];
      return true;
    } else if (LGWSClient.isPromptMsg(msg)) {
      return false;
    }
    throw new Error(
      `Could not determine auth status; client is not registered, but no prompt is available`
    );
  }

  /**
   *
   * @returns {Promise<string>}
   */
  async initialize() {
    await this.connect();
    return await this.authenticate();
  }

  /**
   * @template {import('./constants').MessageType} T
   * @template {SerializableObject|void} [P=void]
   * @template {SerializableObject} [R=any]
   * @param {T} type
   * @param {string} [uri]
   * @param {T extends 'register' ? AuthPayload : P} [payload]
   * @returns {Promise<InboundMsg<R>>}
   */
  async command(type, uri, payload = /** @type {T extends 'register' ? AuthPayload : P} */ ({})) {
    /** @type {OutboundMsg<T extends 'register' ? AuthPayload : P>} */
    const msg = {
      id: `${type}_${this.#cmdNum++}`,
      type,
      payload,
    };
    if (uri) {
      msg.uri = uri;
    }
    const res = /** @type {InboundMsg<R>} */ (await this.#sendMessage(msg));
    if (res?.type === MsgType.ERROR) {
      throw new Error(res?.error);
    }
    return res;
  }

  /**
   * @template {SerializableObject|void} [P=void]
   * @template {SerializableObject} [R=any]
   * @param {string} uri
   * @param {P} [payload]
   * @returns {Promise<R|undefined>}
   */
  async request(uri, payload = /** @type {P} */ ({})) {
    if (!this.#clientKey) {
      throw new Error(`Can't send request without client key set`);
    }
    const res = await this.command(MsgType.REQUEST, uri, payload);
    return res?.payload;
  }

  // API commands

  async getListApps() {
    const uri = 'ssap://com.webos.applicationManager/listApps';
    return await this.request(uri);
  }

  async getForegroundAppInfo() {
    const uri = 'ssap://com.webos.applicationManager/getForegroundAppInfo';
    return await this.request(uri);
  }

  async getRemoteClient() {
    if (!this.#remoteClient) {
      const uri = 'ssap://com.webos.service.networkinput/getPointerInputSocket';
      const {socketPath} = await this.request(uri);
      this.#remoteClient = new LGRemoteClient({
        url: socketPath,
        log: this.#log,
        keyCooldown: this.#remoteKeyCooldown,
      });
      await this.#remoteClient.connect();
    }
    return this.#remoteClient;
  }

  async getServiceList() {
    const res = await this.request('ssap://api/getServiceList');
    return res?.services;
  }

  async getVolume() {
    const res = await this.request('ssap://audio/getVolume');
    return res?.volumeStatus;
  }

  async volumeUp() {
    return await this.request('ssap://audio/volumeUp');
  }

  async volumeDown() {
    return await this.request('ssap://audio/volumeDown');
  }

  async mute() {
    return await this.request('ssap://audio/setMute', {mute: true});
  }

  async unmute() {
    return await this.request('ssap://audio/setMute', {mute: false});
  }

  async play() {
    return await this.request('ssap://media.controls/play');
  }

  async stop() {
    return await this.request('ssap://media.controls/stop');
  }

  async rewind() {
    return await this.request('ssap://media.controls/rewind');
  }

  async fastForward() {
    return await this.request('ssap://media.controls/fastForward');
  }

  async channelDown() {
    return await this.request('ssap://tv/channelDown');
  }

  async channelUp() {
    return await this.request('ssap://tv/channelUp');
  }
}

/**
 * @typedef {import('./constants').AuthPayload} AuthPayload
 * @typedef {import('../types').SerializableObject} SerializableObject
 */

/**
 * @template {SerializableObject} [P=any]
 * @typedef {import('../types').InboundMsg<P>} InboundMsg
 */

/**
 * @template {SerializableObject|void} [P=void]
 * @typedef {import('../types').OutboundMsg<P>} OutboundMsg
 */
