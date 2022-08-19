import WebSocket from 'ws';
import B from 'bluebird';
import {AUTH_PAYLOAD} from './constants';
import {logger} from 'appium/support';
import path from 'path';
import fs from 'fs/promises';
import {LGRemoteClient} from './lg-remote-client';

export const WsEvent = /** @type {const} */ ({
  CONNECT: 'connect',
  CLOSE: 'close',
  ERROR: 'error',
  OPEN: 'open',
  MESSAGE: 'message',
});

// TODO: come up with better key storage idea
const DEFAULT_CLIENT_KEY_FILE = path.resolve(__dirname, 'client-key.txt');

export class LGWSClient {
  #url;
  #ws;
  #clientKey;
  #clientKeyFile;
  #saveClientKey;
  #cmdNum = 0;
  #log;
  #remoteClient = null;
  #remoteKeyCooldown;

  constructor({
    url,
    clientKey,
    log = logger.getLogger('LGWsClient'),
    clientKeyFile = DEFAULT_CLIENT_KEY_FILE,
    saveClientKey = true,
    remoteKeyCooldown,
  }) {
    this.#url = url;
    this.#clientKey = clientKey;
    this.#log = log;
    this.#clientKeyFile = clientKeyFile;
    this.#saveClientKey = saveClientKey;
    this.#remoteKeyCooldown = remoteKeyCooldown;
  }

  async connect() {
    await new B((res, rej) => {
      let ws;
      const onOpen = () => {
        ws.removeListener(WsEvent.ERROR, onError);
        res(ws);
      };
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
    await new B(async (res, rej) => {
      const onClose = () => {
        this.#ws.removeListener(WsEvent.ERROR, onError);
        res();
      };
      const onError = (err) => {
        this.#ws.removeListener(WsEvent.CLOSE, onClose);
        rej(err);
      };
      this.#ws.once(WsEvent.CLOSE, onClose);
      this.#ws.once(WsEvent.ERROR, onError);
      if (this.#remoteClient) {
        try {
          await this.#remoteClient.disconnect();
        } catch (err) {
          this.#log.warn(`Could not cleanly shut down remote client; err was: ${err}`);
        } finally {
          this.#remoteClient = null;
        }
      }
      this.#ws.close();
    });
  }

  async #receiveResponse() {
    return await new B((res, rej) => {
      const onMsg = (data) => {
        this.#log.debug(`Got response: ${data}`);
        res(JSON.parse(data));
      };
      const onError = (err) => {
        this.#ws.removeListener(WsEvent.MESSAGE, onMsg);
        rej(err);
      };
      this.#ws.once(WsEvent.MESSAGE, onMsg);
      this.#ws.once(WsEvent.ERROR, onError);
    });
  }

  async #sendMessage(msgObj) {
    const msg = JSON.stringify(msgObj);
    this.#log.debug(`Sending message: ${JSON.stringify(msg)}`);
    this.#ws.send(msg);
    return await this.#receiveResponse();
  }

  get #authPayload() {
    const payload = {...AUTH_PAYLOAD};
    if (this.#clientKey) {
      payload['client-key'] = this.#clientKey;
    }
    return payload;
  }

  async authenticate() {
    if (this.#saveClientKey) {
      this.#log.info(`Trying to read key from file on disk at ${this.#clientKeyFile}`);
      try {
        this.#clientKey = await fs.readFile(this.#clientKeyFile, 'utf8');
        this.#log.info(`Success: key is '${this.#clientKey}'`);
      } catch (ign) {
        this.#log.info(`Could not read key from disk`);
      }
    }
    const origClientKey = this.#clientKey;
    if (!await this.#updateAuthStatus()) {
      const {type, payload} = await this.#receiveResponse();
      if (type === 'registered') {
        this.#clientKey = payload['client-key'];
      }
      if (!await this.#updateAuthStatus()) {
        throw new Error('Could not authenticate, please accept prompt');
      }
    }
    if (this.#saveClientKey && this.#clientKey !== origClientKey) {
      this.#log.info(`Client key changed, writing it to disk`);
      await fs.writeFile(this.#clientKeyFile, this.#clientKey, 'utf8');
    }
    return this.#clientKey;
  }

  async #updateAuthStatus() {
    const {payload, type} = await this.command('register', null, this.#authPayload);
    if (type === 'registered') {
      this.#clientKey = payload['client-key'];
      return true;
    } else if (payload?.pairingType === 'PROMPT') {
      return false;
    }
    throw new Error(`Could not determine auth status; client is not registered, but no ` +
                    `prompt is available`);
  }

  async initialize() {
    await this.connect();
    return await this.authenticate();
  }

  async command(type, uri = null, payload = {}) {
    const msg = {
      id: `${type}_${this.#cmdNum++}`,
      type,
      payload,
    };
    if (uri) {
      msg.uri = uri;
    }
    const res = await this.#sendMessage(msg);
    if (res?.type === 'error') {
      throw new Error(res?.error);
    }
    return res;
  }

  async request(uri, payload = {}) {
    if (!this.#clientKey) {
      throw new Error(`Can't send request without client key set`);
    }
    const res = await this.command('request', uri, payload);
    return res?.payload;
  }

  // API commands

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
        keyCooldown: this.#remoteKeyCooldown
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

