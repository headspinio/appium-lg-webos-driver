import { AppiumLogger } from '@appium/types';
import {JsonPrimitive, SetRequired, Writable} from 'type-fest';
import { KnownKey } from './keys';
import { AuthPayload, MessageType } from './remote/constants';

/**
 * Extra caps that cannot be inferred from constraints.
 */
export interface ExtraWebOsCaps {
  deviceInfo: Record<string, string>;
}

/**
 * The message format sent between the WebOS websocket server and client.
 */
export interface InboundMsg<P extends SerializableObject = any> extends OutboundMsg<P> {
  error?: string;
}

export interface OutboundMsg<P extends SerializableObject|void = void> {
  id: `${MessageType}_${number}`;
  type: MessageType;
  uri?: string;
  payload: P;
}

export interface PromptMsg extends InboundMsg<{pairingType: 'PROMPT'}> {
  type: 'response'
}

export interface RegisteredMsg extends InboundMsg<SetRequired<AuthPayload, 'client-key'>> {
  type: 'registered'
}

/**
 * A plain object which can be serialized to JSON.
 * 
 * Makes readonly types writable.
 */
export type SerializableObject = {
  -readonly [K in string]?: Writable<Serializable>;
};

/**
 * Represents a value which is serializable to JSON.
 */
export type Serializable = SerializableObject | Serializable[] | JsonPrimitive;

export interface StartChromedriverOptions {
  debuggerHost: string;
  debuggerPort: number;
  executable: string;
}

/**
 * The callback function passed to the script executed via `execute/async`.
 *
 * If this function was called without a parameter, it would respond still with `null` to the requester,
 * so we demand `null` at minimum here for consistency.
 *
 * @template [T=null]
 * @callback AsyncCallback
 * @param {T extends undefined ? never : T} result
 * @returns {void}
 */
export type AsyncCallback<T = null> = (result: T extends undefined ? never : T) => void;

export interface PressKeyOptions {
  key: KnownKey;
  duration?: number;
}

export interface LGSocketClientOpts {
  url: string;
  clientKey?: string;
  log?: AppiumLogger;
  clientKeyFile?: string;
  saveClientKey?: boolean;
  remoteKeyCooldown?: number;
}
