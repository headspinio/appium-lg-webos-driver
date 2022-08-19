import WebSocket from 'ws';
import B from 'bluebird';
import {AUTH_PAYLOAD} from './constants';

export const WsEvent = /** @type {const} */ ({
  CONNECT: 'connect',
  CLOSE: 'close',
  ERROR: 'error',
  OPEN: 'open',
  MESSAGE: 'message',
});

export class LGWsClient {
  #url;
  #ws;
  #clientKey;
  #cmdNum = 0;

  constructor({url, clientKey}) {
    this.#url = url;
    this.#clientKey = clientKey;
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
    await new B((res, rej) => {
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
      this.#ws.close();
    });
  }

  async #receiveResponse() {
    return await new B((res, rej) => {
      const onMsg = (data) => {
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
    if (!await this.#updateAuthStatus()) {
      const {type, payload} = await this.#receiveResponse();
      if (type === 'registered') {
        this.#clientKey = payload['client-key'];
      }
      if (!await this.#updateAuthStatus()) {
        throw new Error('Could not authenticate, please accept prompt');
      }
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

  async command(type, uri = null, payload = {}) {
    const msg = {
      id: `${type}_${this.#cmdNum++}`,
      type,
      payload: {},
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
    return await this.command('request', uri, payload);
  }

  async pointerInput() {
    const uri = 'ssap://com.webos.service.networkinput/getPointerInputSocket';
    return await this.request(uri);
  }
}

