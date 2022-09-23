import { validate } from 'jsonschema';
import { deepCompareStrict } from 'jsonschema/lib/helpers';

export type ChannelEvent<T> = { channel: string; payload: T | undefined };

export type Callback<T> = (event: ChannelEvent<T>) => void;

export type Subscription = { unsubscribe(): void };

export class PayloadMismatchError extends Error {
  /**
   * Creates a new PayloadMismatchError error
   * @param channel - name of event channel
   * @param schema - registered schema on event channel
   * @param payload - payload detail sent
   */
  constructor(public channel: string, public schema: any, public payload: any) {
    super(`payload does not match the specified schema for channel [${channel}].`);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PayloadMismatchError);
    }
    this.name = 'PayloadMismatchError';
  }
}

export class SchemaMismatchError extends Error {
  /**
   * Creates a new SchemaMismatchError error
   * @param channel - name of event channel
   * @param schema - registered schema on event channel
   * @param newSchema - new schema attempting to be registered on event channel
   */
  constructor(public channel: string, public schema: any, public newSchema: any) {
    super(`schema registration for [${channel}] must match already registered schema.`);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SchemaMismatchError);
    }
    this.name = 'SchemaMismatchError';
  }
}

export class EventBus {
  private _lastId = 0;
  private _subscriptions: {
    [channel: string]: { __replay?: any; __schema?: any; [id: string]: (payload: any) => void };
  } = {};

  private _getNextId() {
    return this._lastId++;
  }

  /**
   * Register a schema for the specified channel and equality checking on subsequent registers.
   * Subsequent registers must use an equal schema or an error will be thrown.
   * @param channel - name of event channel to register schema to
   * @param schema - all communication on channel must follow this schema
   * @returns returns true if event channel already existed of false if a new one was created
   *
   * @throws {@link SchemaMismatchError}
   * This exception is thrown if new schema does not match already registered schema.
   */
  register(channel: string, schema: object) {
    let exists = true;
    if (!this._subscriptions[channel]) {
      exists = false;
      this._subscriptions[channel] = {};
    }
    const registered = this._subscriptions[channel].__schema;
    if (registered && !deepCompareStrict(registered, schema)) {
      throw new SchemaMismatchError(channel, registered, schema);
    }
    this._subscriptions[channel].__schema = schema;
    return exists;
  }

  /**
   * Unregister the schema for the specified channel if channel exists.
   * @param channel - name of event channel to unregister schema from
   * @returns returns true if event channel existed and an existing schema was removed
   */
  unregister(channel: string) {
    const subscriptions = this._subscriptions[channel];
    let exists = false;
    if (subscriptions && subscriptions.__schema) {
      exists = true;
      delete subscriptions.__schema;
    }
    return exists;
  }

  /**
   * Subscribe to an event channel triggering callback on received event matching type.
   * @param channel - name of event channel to receive data from
   * @param callback - function executed on when event channel receives new data
   * @returns object containing an unsubscribe method
   */
  subscribe<T>(channel: string, callback: Callback<T>): Subscription;
  /**
   * Subscribe to an event channel triggering callback on received event matching type,
   * with an optional replay of last event at initial subscription.
   * @param channel - name of event channel to receive data from
   * @param replay - flag indicating if initial description should return last event
   * @param callback - function executed on when event channel receives new data
   * @returns object containing an unsubscribe method
   */
  subscribe<T>(channel: string, replay: boolean, callback: Callback<T>): Subscription;
  subscribe<T>(channel: string, param2: boolean | Callback<T>, param3?: Callback<T>): Subscription {
    const id = this._getNextId();
    const replay = typeof param2 === 'boolean' ? param2 : false;
    const callback = typeof param2 === 'function' ? param2 : param3;

    if (typeof callback !== 'function')
      throw new Error('Callback function must be supplied as either the second or third argument.');

    if (!this._subscriptions[channel]) this._subscriptions[channel] = {};
    else if (replay) callback({ channel, payload: this._subscriptions[channel].__replay });

    this._subscriptions[channel][id] = callback;
    return {
      unsubscribe: () => delete this._subscriptions[channel][id],
    };
  }

  /**
   * Publish to event channel with an optional payload triggering all subscription callbacks.
   * @param channel - name of event channel to send payload on
   * @param payload - payload to be sent
   *
   * @throws {@link PayloadMismatchError}
   * This exception is thrown if payload does is not valid against registered schema.
   */
  publish<T>(channel: string, payload?: T) {
    if (!this._subscriptions[channel]) this._subscriptions[channel] = {};
    const schema = this._subscriptions[channel].__schema;
    if (typeof payload !== 'undefined' && schema && !validate(payload, schema).valid) {
      throw new PayloadMismatchError(channel, schema, payload);
    }
    this._subscriptions[channel].__replay = payload;
    Object.keys(this._subscriptions[channel])
      .filter((key) => !key.startsWith('__'))
      .forEach((id) => {
        const callback = this._subscriptions[channel][id];
        if (!callback || typeof callback !== 'function') throw new Error(`Invalid callback for channel [${channel}]`);

        return callback({ channel, payload });
      });

    // Publish all events on the wildcard channel
    if (this._subscriptions['*']) {
      Object.keys(this._subscriptions['*'])
        .filter((key) => !key.startsWith('__'))
        .forEach((id) => {
          const callback = this._subscriptions['*'][id];
          if (!callback || typeof callback !== 'function') throw new Error(`Invalid callback for channel [${channel}]`);

          return callback({ channel, payload });
        });
    }
  }

  /**
   * Get the latest published payload on the specified event channel.
   * @param channel - name of the event channel to fetch the latest payload from
   * @returns the latest payload or `undefined`
   */
  getLatest<T>(channel: string): T | undefined {
    if (this._subscriptions[channel]) return this._subscriptions[channel].__replay;
  }

  /**
   * Get the schema registered on the specified event channel.
   * @param channel - name of the event channel to fetch the schema from
   * @returns the schema or `undefined`
   */
  getSchema(channel: string): any | undefined {
    if (this._subscriptions[channel]) return this._subscriptions[channel].__schema;
  }
}
