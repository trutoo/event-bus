import { validate } from 'jsonschema';
import deepEqual from 'deep-equal';

type Callback<T> = (detail: T | undefined) => void;

export class EventBus {
  private _lastId = 0;
  private _subscriptions: {
    [eventType: string]: { __replay?: any; __schema?: any; [id: string]: (detail: any) => void };
  } = {};

  private _getNextId() {
    return this._lastId++;
  }

  register(eventType: string, schema: any) {
    if (!this._subscriptions[eventType]) this._subscriptions[eventType] = {};
    const existingSchema = this._subscriptions[eventType].__schema;
    if (existingSchema && !deepEqual(existingSchema, schema)) {
      throw new Error(
        `Schema registration for [${eventType}] must match:\n\n${JSON.stringify(existingSchema, undefined, 2)}`,
      );
    }
    this._subscriptions[eventType].__schema = schema;
    return true;
  }

  subscribe<T>(eventType: string, callback: Callback<T>): { unsubscribe(): void };
  subscribe<T>(eventType: string, replay: boolean, callback: Callback<T>): { unsubscribe(): void };
  subscribe<T>(eventType: string, param2: boolean | Callback<T>, param3?: Callback<T>) {
    const id = this._getNextId();
    const replay = typeof param2 === 'boolean' ? param2 : false;
    const callback = typeof param2 === 'function' ? param2 : param3 || (Function.prototype as Callback<T>);

    if (!this._subscriptions[eventType]) this._subscriptions[eventType] = {};
    else if (replay) callback(this._subscriptions[eventType].__replay);

    this._subscriptions[eventType][id] = callback;
    return {
      unsubscribe: () => delete this._subscriptions[eventType][id],
    };
  }

  publish<T>(eventType: string, detail?: T) {
    if (!this._subscriptions[eventType]) this._subscriptions[eventType] = {};
    const schema = this._subscriptions[eventType].__schema;
    if (typeof detail !== 'undefined' && schema && !validate(detail, schema).valid) {
      throw new Error(
        `Detail does not match the specified schema for event type [${eventType}]. Expected detail to follow schema:\n\n${JSON.stringify(
          schema,
          undefined,
          2,
        )}`,
      );
    }
    this._subscriptions[eventType].__replay = detail;
    Object.keys(this._subscriptions[eventType])
      .filter(key => !key.startsWith('__'))
      .forEach(id => this._subscriptions[eventType][id](detail));
  }
}

declare global {
  interface Window {
    eventBus: EventBus;
  }
}

window.eventBus = new EventBus();
