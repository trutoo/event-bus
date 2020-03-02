import { validate } from 'jsonschema';
import deepEqual from 'deep-equal';
import globalThisShim from 'globalthis/shim';
globalThisShim();

type Callback<T> = (detail: T | undefined) => void;

export class EventBus {
  private _lastId = 0;
  private _subscriptions: {
    [eventType: string]: { __replay?: any; __schema?: any; [id: string]: (detail: any) => void };
  } = {};

  private _getNextId() {
    return this._lastId++;
  }

  /**
   * Register a schema for the specified event type and equallity checking on subsequent registers.
   * Subsequent registers must use an equal schema or an error will be thrown.
   * @param eventType - name of event channel to register schema to
   * @param schema - all communication on channel must follow this schema
   * @returns returns true if event channel already existed of false if a new one was created
   */
  register(eventType: string, schema: object) {
    let exists = true;
    if (!this._subscriptions[eventType]) {
      exists = false;
      this._subscriptions[eventType] = {};
    }
    const existingSchema = this._subscriptions[eventType].__schema;
    if (existingSchema && !deepEqual(existingSchema, schema)) {
      throw new Error(
        `Schema registration for [${eventType}] must match:\n\n${JSON.stringify(existingSchema, undefined, 2)}`,
      );
    }
    this._subscriptions[eventType].__schema = schema;
    return exists;
  }

  /**
   * Unregister the schema for the specified event type if channel exists.
   * @param eventType - name of event channel to unregister schema from
   * @returns returns true if event channel existed and an existing schema was removed
   */
  unregister(eventType: string) {
    const channel = this._subscriptions[eventType];
    let exists = false;
    if (channel && channel.__schema) {
      exists = true;
      delete channel.__schema;
    }
    return exists;
  }

  /**
   * Subscribe to an event channel triggering callback on received event matching type.
   * @param eventType - name of event channel to receive data from
   * @param callback - function executed on when event channel receives new data
   * @returns object containing an unsubscribe method
   */
  subscribe<T>(eventType: string, callback: Callback<T>): { unsubscribe(): void };
  /**
   * Subscribe to an event channel triggering callback on received event matching type,
   * with an optional replay of last event at initial subscription.
   * @param eventType - name of event channel to receive data from
   * @param replay - flag indicating if initial description should return last event
   * @param callback - function executed on when event channel receives new data
   * @returns object containing an unsubscribe method
   */
  subscribe<T>(eventType: string, replay: boolean, callback: Callback<T>): { unsubscribe(): void };
  subscribe<T>(eventType: string, param2: boolean | Callback<T>, param3?: Callback<T>) {
    const id = this._getNextId();
    const replay = typeof param2 === 'boolean' ? param2 : false;
    const callback = typeof param2 === 'function' ? param2 : param3;

    if (typeof callback !== 'function')
      throw new Error('Callback function must be supplied as either the second or third argument.');

    if (!this._subscriptions[eventType]) this._subscriptions[eventType] = {};
    else if (replay) callback(this._subscriptions[eventType].__replay);

    this._subscriptions[eventType][id] = callback;
    return {
      unsubscribe: () => delete this._subscriptions[eventType][id],
    };
  }

  /**
   * Publish to event channel with an optional payload triggering all subscription callbacks.
   * @param eventType - name of event channel to send payload on
   * @param detail - payload to be sent
   */
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
