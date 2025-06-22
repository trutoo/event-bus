import { strictDeepEqual } from 'fast-equals';
import { Validator } from 'jsonschema';

export type Schema = Record<string, unknown>;
export type Payload = any;

export type ChannelEvent<T> = { channel: string; payload: T | undefined };

export type Callback<T> = (event: ChannelEvent<T>) => void;

export type Subscription = { unsubscribe(): void };

export type LogLevel = 'none' | 'error' | 'warn' | 'info';

type ChannelSubscription = {
  schema?: Schema;
  replay?: Payload;
  callbacks: Record<string, Callback<any>>;
};

export interface EventBusOptions {
  /**
   * The logging level for the event bus
   * - 'none': No logging
   * - 'error': Only log errors
   * - 'warn': Log warnings and errors
   * - 'info': Log everything (default)
   */
  logLevel?: LogLevel;
}

export class PayloadMismatchError extends Error {
  /**
   * Creates a new PayloadMismatchError error
   * @param channel - name of event channel
   * @param schema - registered schema on event channel
   * @param payload - payload detail sent
   */
  constructor(
    public channel: string,
    public schema: Schema,
    public payload: Payload,
  ) {
    super(`Payload does not match the specified schema for channel [${channel}]. 
           Schema: ${JSON.stringify(schema)}, Payload: ${JSON.stringify(payload)}`);
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
  constructor(
    public channel: string,
    public schema: Schema,
    public newSchema: Schema,
  ) {
    super(`Schema registration for [${channel}] must match already registered schema.`);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SchemaMismatchError);
    }
    this.name = 'SchemaMismatchError';
  }
}
export class EventBus {
  private _lastId = 0;
  private _subscriptions = new Map<string, ChannelSubscription>();
  private readonly _options: Required<EventBusOptions>;
  private readonly _validator: Validator;

  constructor(options: EventBusOptions = {}) {
    this._options = {
      logLevel: 'error',
      ...options,
    };
    this._validator = new Validator();
  }

  /**
   * Generates and returns the next available sequential identifier.
   * Increments the internal counter after returning the current value.
   * @returns The next sequential identifier
   */
  private _getNextId() {
    return this._lastId++;
  }

  /**
   * Logs messages for debugging and monitoring.
   * @param message - The message to log.
   * @param level - The log level (info, warn, error).
   */
  private _log(message: string, level: Exclude<LogLevel, 'none'> = 'info') {
    const logLevels: Record<LogLevel, number> = {
      none: 0,
      error: 1,
      warn: 2,
      info: 3,
    };

    if (logLevels[this._options.logLevel] >= logLevels[level]) {
      console[level](`[EventBus] ${message}`);
    }
  }

  /**
   * Safely executes a callback asynchronously with error handling.
   * @param callback - The callback to execute.
   * @param event - The event to pass to the callback.
   */
  private async _asyncCallback<T>(callback: Callback<T>, event: ChannelEvent<T>): Promise<void> {
    try {
      await callback(event);
    } catch (error) {
      this._log(`Error in callback execution: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }

  /**
   * Gets an existing channel subscription or creates a new one if it doesn't exist.
   * @param channel - The channel identifier to get or create a subscription for
   * @returns The channel subscription object containing registered callbacks
   */
  private _getOrCreateChannel(channel: string): ChannelSubscription {
    let sub = this._subscriptions.get(channel);
    if (!sub) {
      sub = { callbacks: {} };
      this._subscriptions.set(channel, sub);
    }
    return sub;
  }

  /**
   * Register a schema for the specified channel and equality checking on subsequent registers.
   * Subsequent registers must use an equal schema or an error will be thrown.
   * @param channel - name of event channel to register schema to
   * @param schema - all communication on channel must follow this schema
   * @returns returns true if event channel already existed of false if a new one was created
   *
   * @throws {SchemaMismatchError}
   * This exception is thrown if new schema does not match already registered schema.
   */
  register(channel: string, schema: Schema): boolean {
    this._log(`Registering schema for channel [${channel}]`);
    const sub = this._getOrCreateChannel(channel);
    const exists = !!sub.schema;

    if (exists && !strictDeepEqual(sub.schema, schema)) {
      throw new SchemaMismatchError(channel, sub.schema!, schema);
    }
    sub.schema = schema;
    return exists;
  }

  /**
   * Unregister the schema for the specified channel if channel exists.
   * @param channel - name of event channel to unregister schema from
   * @returns returns true if event channel existed and an existing schema was removed
   */
  unregister(channel: string): boolean {
    const sub = this._subscriptions.get(channel);
    if (sub?.schema) {
      delete sub.schema;
      this._log(`Unregistered schema for channel [${channel}]`);
      return true;
    }
    return false;
  }

  /**
   * Subscribe to an event channel triggering callback on received event matching type.
   * @param channel - name of event channel to receive data from
   * @param callback - function executed on when event channel receives new data
   * @returns object containing an unsubscribe method and initial subscription promise
   */
  async subscribe<T>(channel: string, callback: Callback<T>): Promise<Subscription>;
  /**
   * Subscribe to an event channel triggering callback on received event matching type,
   * with an optional replay of last event at initial subscription.
   * @param channel - name of event channel to receive data from
   * @param replay - flag indicating if initial description should return last event
   * @param callback - function executed on when event channel receives new data
   * @returns object containing an unsubscribe method and initial subscription promise
   */
  async subscribe<T>(channel: string, replay: boolean, callback: Callback<T>): Promise<Subscription>;

  async subscribe<T>(channel: string, param2: boolean | Callback<T>, param3?: Callback<T>): Promise<Subscription> {
    const id = this._getNextId().toString();
    const replay = typeof param2 === 'boolean' ? param2 : false;
    const callback = typeof param2 === 'function' ? param2 : param3;

    if (typeof callback !== 'function') {
      throw new Error('Callback function must be supplied as either the second or third argument.');
    }

    const sub = this._getOrCreateChannel(channel);
    if (replay && sub.replay !== undefined) {
      await this._asyncCallback(callback, {
        channel,
        payload: sub.replay,
      });
    }

    sub.callbacks[id] = callback;
    return {
      unsubscribe: () => {
        delete sub.callbacks[id];
        this._log(`Unsubscribed from channel [${channel}]`);
      },
    };
  }

  /**
   * Helper method to publish an event to a specific channel.
   * @param channel - The channel to publish to.
   * @param payload - The payload to send.
   */
  private async _publishToChannel<T>(channel: string, payload?: T): Promise<void> {
    const sub = this._subscriptions.get(channel);
    if (!sub) return;

    const event: ChannelEvent<T> = { channel, payload };
    await Promise.all(Object.values(sub.callbacks).map((callback) => this._asyncCallback(callback, event)));
  }

  /**
   * Publishes a payload to the specified channel and triggers all subscription callbacks.
   * If a schema is registered for the channel, the payload will be validated against it.
   * @param channel - The name of the event channel to send the payload on.
   * @param payload - The payload to be sent.
   * @returns Promise that resolves when all callbacks have completed
   * @throws {PayloadMismatchError} If the payload does not match the registered schema.
   */
  async publish<T>(channel: string, payload?: T): Promise<void> {
    const sub = this._getOrCreateChannel(channel);

    if (typeof payload !== 'undefined' && sub.schema && !this._validator.validate(payload, sub.schema).valid) {
      throw new PayloadMismatchError(channel, sub.schema, payload);
    }
    sub.replay = payload;

    await Promise.all([this._publishToChannel(channel, payload), this._publishToChannel('*', payload)]);
  }

  /**
   * Get the latest published payload on the specified event channel.
   * @param channel - name of the event channel to fetch the latest payload from
   * @returns the latest payload or `undefined`
   */
  getLatest<T>(channel: string): T | undefined {
    return this._subscriptions.get(channel)?.replay;
  }

  /**
   * Get the schema registered on the specified event channel.
   * @param channel - name of the event channel to fetch the schema from
   * @returns the schema or `undefined`
   */
  getSchema(channel: string): Schema | undefined {
    return this._subscriptions.get(channel)?.schema;
  }

  /**
   * Clears the replay event for the specified channel.
   * @param channel - The name of the event channel to clear the replay event from.
   * @returns Returns true if the replay event was cleared, false otherwise.
   */
  clearReplay(channel: string): boolean {
    const sub = this._subscriptions.get(channel);
    if (sub?.replay !== undefined) {
      delete sub.replay;
      this._log(`Cleared replay event for channel [${channel}]`);
      return true;
    }
    return false;
  }
}
