export declare type ChannelEvent<T> = {
    channel: string;
    payload: T | undefined;
};
export declare type Callback<T> = (event: ChannelEvent<T>) => void;
export declare type Subscription = {
    unsubscribe(): void;
};
export declare class PayloadMismatchError extends Error {
    channel: string;
    schema: any;
    payload: any;
    /**
     * Creates a new PayloadMismatchError error
     * @param channel - name of event channel
     * @param schema - registered schema on event channel
     * @param payload - payload detail sent
     */
    constructor(channel: string, schema: any, payload: any);
}
export declare class SchemaMismatchError extends Error {
    channel: string;
    schema: any;
    newSchema: any;
    /**
     * Creates a new SchemaMismatchError error
     * @param channel - name of event channel
     * @param schema - registered schema on event channel
     * @param newSchema - new schema attempting to be registered on event channel
     */
    constructor(channel: string, schema: any, newSchema: any);
}
export declare class EventBus {
    private _lastId;
    private _subscriptions;
    private _getNextId;
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
    register(channel: string, schema: object): boolean;
    /**
     * Unregister the schema for the specified channel if channel exists.
     * @param channel - name of event channel to unregister schema from
     * @returns returns true if event channel existed and an existing schema was removed
     */
    unregister(channel: string): boolean;
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
    /**
     * Publish to event channel with an optional payload triggering all subscription callbacks.
     * @param channel - name of event channel to send payload on
     * @param payload - payload to be sent
     *
     * @throws {@link PayloadMismatchError}
     * This exception is thrown if payload does is not valid against registered schema.
     */
    publish<T>(channel: string, payload?: T): void;
    /**
     * Get the latest published payload on the specified event channel.
     * @param channel - name of the event channel to fetch the latest payload from
     * @returns the latest payload or `undefined`
     */
    getLatest<T>(channel: string): T | undefined;
    /**
     * Get the schema registered on the specified event channel.
     * @param channel - name of the event channel to fetch the schema from
     * @returns the schema or `undefined`
     */
    getSchema(channel: string): any | undefined;
}
