import {JsonPrimitive, Writable} from 'type-fest';

export interface ExtraWebOsCaps {
  deviceInfo: Record<string, string>;
}

export interface Message<P extends SerializableObject = any> {
  id: string;
  type: string;
  uri?: string;
  error?: string;
  payload?: P;
}

export type SerializableObject = {
  -readonly [K in string]?: Writable<Serializable>;
};

export type Serializable = SerializableObject | SerializableArray | JsonPrimitive;

export type SerializableArray = Array<Serializable>;
