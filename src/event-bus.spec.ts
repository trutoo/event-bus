import AdvancedSchema from './fixtures/advanced-schema.json';
import { EventBus, PayloadMismatchError, SchemaMismatchError } from './event-bus';

//------------------------------------------------------------------------------------
// PayloadMismatchError
//------------------------------------------------------------------------------------

describe('[PayloadMismatchError]', () => {
  const captureStackTrace = Error.captureStackTrace;

  afterEach(() => {
    Error.captureStackTrace = captureStackTrace;
  });

  it('should create detailed errors', () => {
    const schema = { type: 'boolean' };
    const payload = true;
    Error.captureStackTrace = jest.fn();
    const error = new PayloadMismatchError('channel', schema, payload);
    expect(Error.captureStackTrace).toHaveBeenCalledWith(error, PayloadMismatchError);
    expect(error).toBeInstanceOf(Error);
    expect(error.channel).toBe('channel');
    expect(error.schema).toStrictEqual(schema);
    expect(error.payload).toStrictEqual(payload);
  });

  it('should not call captureStackTrace if it is not defined', () => {
    (Error as any).captureStackTrace = undefined;
    const emptySchema = { type: 'null' };
    new PayloadMismatchError('channel', emptySchema, null);
    expect(Error.captureStackTrace).toBeFalsy();
  });

  it('should handle undefined or null values in error message', () => {
    const schema = undefined;
    const payload = null;
    const error = new PayloadMismatchError('channel', schema as any, payload);
    expect(error.message).toContain('undefined');
    expect(error.message).toContain('null');
  });
});

//------------------------------------------------------------------------------------
// SchemaMismatchError
//------------------------------------------------------------------------------------

describe('[SchemaMismatchError]', () => {
  const captureStackTrace = Error.captureStackTrace;

  afterEach(() => {
    Error.captureStackTrace = captureStackTrace;
  });

  it('should create detailed errors', () => {
    const schema = { type: 'boolean' };
    const newSchema = { type: 'string' };
    Error.captureStackTrace = jest.fn();
    const error = new SchemaMismatchError('channel', schema, newSchema);
    expect(Error.captureStackTrace).toHaveBeenCalledWith(error, SchemaMismatchError);
    expect(error).toBeInstanceOf(Error);
    expect(error.channel).toBe('channel');
    expect(error.schema).toStrictEqual(schema);
    expect(error.newSchema).toStrictEqual(newSchema);
  });

  it('should not call captureStackTrace if it is not defined', () => {
    (Error as any).captureStackTrace = undefined;
    const emptySchema = { type: 'null' };
    new SchemaMismatchError('channel', emptySchema, emptySchema);
    expect(Error.captureStackTrace).toBeFalsy();
  });
});

//------------------------------------------------------------------------------------
// register
//------------------------------------------------------------------------------------

describe('[EventBus]: register', () => {
  it('should register schemas on new channels', () => {
    const eventBus = new EventBus();
    let exists = eventBus.register('test1', { type: 'boolean' });
    expect(exists).toBeFalsy();
    exists = eventBus.register('test2', { type: 'string' });
    expect(exists).toBeFalsy();
  });

  it('should re-register an equal schema on an existing channel', () => {
    const eventBus = new EventBus();
    let exists = eventBus.register('test1', { type: 'object', properties: { test: { type: 'boolean' } } });
    expect(exists).toBeFalsy();
    exists = eventBus.register('test1', { properties: { test: { type: 'boolean' } }, type: 'object' });
    expect(exists).toBeTruthy();
  });

  it('should be fail to register a differentiating schema on an existing channel', () => {
    const eventBus = new EventBus();
    const register = () => {
      eventBus.register('test1', { type: 'boolean' });
      eventBus.register('test1', { type: 'string' });
    };
    expect(register).toThrow();
  });
});

//------------------------------------------------------------------------------------
// unregister
//------------------------------------------------------------------------------------

describe('[EventBus]: unregister', () => {
  it('should unregister the schema from channel', () => {
    const eventBus = new EventBus();
    let exists = eventBus.unregister('test1');
    expect(exists).toBeFalsy();
    eventBus.register('test1', { type: 'boolean' });
    exists = eventBus.unregister('test1');
    expect(exists).toBeTruthy();
  });
});

//------------------------------------------------------------------------------------
// subscribe
//------------------------------------------------------------------------------------

describe('[EventBus]: subscribe', () => {
  it('should subscribe to a new channel', async () => {
    const eventBus = new EventBus();
    await eventBus.subscribe('test1', jest.fn());
  });

  it('should throw an error if subscribe is called without a callback', async () => {
    const eventBus = new EventBus();
    await expect(eventBus.subscribe('test1', undefined as any)).rejects.toThrow();
  });

  it('should not trigger a callback with replay if no previous event was published', async () => {
    const eventBus = new EventBus();
    const callback = jest.fn();
    await eventBus.subscribe('test1', true, callback);
    expect(callback).not.toHaveBeenCalled();
  });

  it('should not trigger a callback if no replay is requested', async () => {
    const eventBus = new EventBus();
    const callback = jest.fn();
    await eventBus.subscribe('test1', false, callback);
    expect(callback).not.toHaveBeenCalled();
  });

  it('should unsubscribe to an existing channel', async () => {
    const eventBus = new EventBus();
    const subscription = await eventBus.subscribe('test1', jest.fn());
    subscription.unsubscribe();
  });
});

//------------------------------------------------------------------------------------
// publish
//------------------------------------------------------------------------------------

describe('[EventBus]: publish', () => {
  it('should publish event to a new channel', async () => {
    const eventBus = new EventBus();
    await eventBus.publish('test1', true);
  });

  it('should publish event to a registered channel matching schema', async () => {
    const eventBus = new EventBus();
    eventBus.register('test1', { type: 'boolean' });
    await eventBus.publish('test1', true);
  });

  it('should fail to publish incorrect event to a registered channel with schema', async () => {
    const eventBus = new EventBus();
    const publish = async () => {
      eventBus.register('test1', { type: 'boolean' });
      await eventBus.publish('test1', 'hello');
    };
    await expect(publish()).rejects.toThrow();
  });

  it("should skip calling registered callbacks that aren't functions in channel", async () => {
    const eventBus = new EventBus({ logLevel: 'none' });
    const callback = jest.fn();
    // Mutate subscriptions to include invalid types
    const invalidCallbacks = {
      invalid1: null,
      invalid2: undefined,
      invalid3: 1,
      invalid4: 'hello',
      valid: callback,
    };
    (eventBus as any)._subscriptions.set('test1', { callbacks: invalidCallbacks });
    (eventBus as any)._subscriptions.set('*', { callbacks: invalidCallbacks });

    await eventBus.publish('test1', true);
    expect(callback).toHaveBeenCalledTimes(2);
  });
});

describe('[EventBus]: subscription structure', () => {
  it('should maintain separate schema, replay and callbacks in channel subscription', () => {
    const eventBus = new EventBus();
    const callback = jest.fn();
    const schema = { type: 'boolean' };
    const payload = true;

    eventBus.register('test1', schema);
    eventBus.subscribe('test1', callback);
    eventBus.publish('test1', payload);

    const sub = (eventBus as any)._subscriptions.get('test1');
    expect(sub.schema).toEqual(schema);
    expect(sub.replay).toBe(payload);
    expect(typeof Object.values(sub.callbacks)[0]).toBe('function');
  });

  it('should properly clean up subscription on unsubscribe', async () => {
    const eventBus = new EventBus();
    const callback = jest.fn();
    const subscription = await eventBus.subscribe('test1', callback);

    const sub = (eventBus as any)._subscriptions.get('test1');
    const callbackId = Object.keys(sub.callbacks)[0];
    expect(sub.callbacks[callbackId]).toBe(callback);

    subscription.unsubscribe();
    expect(sub.callbacks[callbackId]).toBeUndefined();
  });
});

//------------------------------------------------------------------------------------
// getLatest
//------------------------------------------------------------------------------------

describe('[EventBus]: getLatest', () => {
  it('should return the latest published event on channel', async () => {
    const eventBus = new EventBus();
    await eventBus.publish('test1', true);
    expect(eventBus.getLatest('test1')).toBe(true);
    expect(eventBus.getLatest('test2')).toBeUndefined();
  });
});

//------------------------------------------------------------------------------------
// getSchema
//------------------------------------------------------------------------------------

describe('[EventBus]: getSchema', () => {
  it('should return the schema registered on channel', () => {
    const eventBus = new EventBus();
    eventBus.register('test1', { type: 'boolean' });
    expect(eventBus.getSchema('test1')).toStrictEqual({ type: 'boolean' });
    expect(eventBus.getSchema('test2')).toBeUndefined();
  });
});

//------------------------------------------------------------------------------------
// subscribe and publish
//------------------------------------------------------------------------------------

describe('[EventBus]: subscribe and publish', () => {
  it('should receive same data as published', async () => {
    const eventBus = new EventBus();
    const payload = { test1: true };
    const callback = jest.fn();
    await eventBus.subscribe('test1', callback);
    expect(callback).not.toHaveBeenCalled();
    await eventBus.publish('test1', payload);
    expect(callback).toHaveBeenCalledWith({ channel: 'test1', payload });
  });

  it('should receive events on wildcard channel * regardless of channel it was published on', async () => {
    const eventBus = new EventBus();
    const payload = { test1: true };
    const callback = jest.fn();
    await eventBus.subscribe('*', callback);
    await eventBus.publish('test1', payload);
    expect(callback).toHaveBeenCalledWith({ channel: 'test1', payload });
  });

  it('should handle more advanced schemas', async () => {
    const eventBus = new EventBus();
    const payload = {
      name: 'Milk',
      amount: '1000 ml',
      price: 0.99,
      organic: true,
      stores: [
        {
          name: 'ACME Food AB',
          url: 'acme-food.com',
        },
      ],
    };
    const callback = jest.fn();
    eventBus.register('test1', AdvancedSchema);
    await eventBus.subscribe('test1', callback);
    await eventBus.publish('test1', payload);
    expect(callback).toHaveBeenCalledWith({ channel: 'test1', payload });
  });

  it('should subscribe to an existing channel with replay of last event', async () => {
    const eventBus = new EventBus();
    const payload = { test1: true };
    const callback = jest.fn();
    await eventBus.publish('test1', payload);
    await eventBus.subscribe('test1', true, callback);
    expect(callback).toHaveBeenCalledWith({ channel: 'test1', payload });
  });

  it('should handle multiple subscriptions with correct channels', async () => {
    const eventBus = new EventBus();
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    const callback3 = jest.fn();
    await eventBus.subscribe('test1', callback1);
    await eventBus.subscribe('test1', callback2);
    await eventBus.subscribe('test2', callback3);
    await eventBus.publish('test1', { test1: true });
    expect(callback1).toHaveBeenCalled();
    expect(callback2).toHaveBeenCalled();
    expect(callback3).not.toHaveBeenCalled();
  });

  it('should no longer receive data after unsubscribe', async () => {
    const eventBus = new EventBus();
    const callback = jest.fn();
    const subscription = await eventBus.subscribe('test1', callback);
    await eventBus.publish('test1', { test1: true });
    expect(callback).toHaveBeenCalled();
    subscription.unsubscribe();
    await eventBus.publish('test1', { test1: true });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

//------------------------------------------------------------------------------------
// logging
//------------------------------------------------------------------------------------

describe('[EventBus]: logging', () => {
  const originalConsole = { ...console };

  beforeEach(() => {
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    Object.assign(console, originalConsole);
  });

  it('should not log anything when log level is none', () => {
    const eventBus = new EventBus({ logLevel: 'none' });
    (eventBus as any)._log('test message', 'info');
    (eventBus as any)._log('test message', 'warn');
    (eventBus as any)._log('test message', 'error');
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should only log errors when log level is error', () => {
    const eventBus = new EventBus({ logLevel: 'error' });
    (eventBus as any)._log('test message', 'info');
    (eventBus as any)._log('test message', 'warn');
    (eventBus as any)._log('test message', 'error');
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('[EventBus] test message');
  });

  it('should log warnings and errors when log level is warn', () => {
    const eventBus = new EventBus({ logLevel: 'warn' });
    (eventBus as any)._log('test message', 'info');
    (eventBus as any)._log('test message', 'warn');
    (eventBus as any)._log('test message', 'error');
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith('[EventBus] test message');
    expect(console.error).toHaveBeenCalledWith('[EventBus] test message');
  });

  it('should log all messages when log level is info', () => {
    const eventBus = new EventBus({ logLevel: 'info' });
    (eventBus as any)._log('test message', 'info');
    (eventBus as any)._log('test message', 'warn');
    (eventBus as any)._log('test message', 'error');
    expect(console.info).toHaveBeenCalledWith('[EventBus] test message');
    expect(console.warn).toHaveBeenCalledWith('[EventBus] test message');
    expect(console.error).toHaveBeenCalledWith('[EventBus] test message');
  });

  it('should default to info level if no level is provided', () => {
    const eventBus = new EventBus({ logLevel: 'info' });
    (eventBus as any)._log('test message');
    expect(console.info).toHaveBeenCalledWith('[EventBus] test message');
  });
});

//------------------------------------------------------------------------------------
// clearReplay
//------------------------------------------------------------------------------------

describe('[EventBus]: clearReplay', () => {
  it('should clear replay data for existing channel', async () => {
    const eventBus = new EventBus();
    await eventBus.publish('test', true);
    expect(eventBus.getLatest('test')).toBe(true);

    const cleared = eventBus.clearReplay('test');
    expect(cleared).toBe(true);
    expect(eventBus.getLatest('test')).toBeUndefined();
  });

  it('should return false when clearing non-existent channel', () => {
    const eventBus = new EventBus();
    const cleared = eventBus.clearReplay('nonexistent');
    expect(cleared).toBe(false);
  });

  it('should return false when clearing channel with no replay data', async () => {
    const eventBus = new EventBus();
    await eventBus.subscribe('test', () => {});
    const cleared = eventBus.clearReplay('test');
    expect(cleared).toBe(false);
  });
});

//------------------------------------------------------------------------------------
// callback error handling
//------------------------------------------------------------------------------------

describe('[EventBus]: callback error handling', () => {
  const originalConsole = { ...console };

  beforeEach(() => {
    console.error = jest.fn();
  });

  afterEach(() => {
    Object.assign(console, originalConsole);
  });

  it('should handle Error instances in callbacks', async () => {
    const eventBus = new EventBus();
    const errorMessage = 'Test error message';
    const callback = () => {
      throw new Error(errorMessage);
    };

    await eventBus.subscribe('test', callback);
    await eventBus.publish('test', true);

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(errorMessage));
  });

  it('should handle non-Error objects in callbacks', async () => {
    const eventBus = new EventBus();
    const errorObj = { custom: 'error' };
    const callback = () => {
      throw errorObj;
    };

    await eventBus.subscribe('test', callback);
    await eventBus.publish('test', true);

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(String(errorObj)));
  });

  it('should continue execution when one callback fails among multiple subscribers', async () => {
    const eventBus = new EventBus();
    const errorMessage = 'Test error message';
    const failingCallback = jest.fn().mockImplementation(() => {
      throw new Error(errorMessage);
    });
    const successCallback1 = jest.fn();
    const successCallback2 = jest.fn();

    await eventBus.subscribe('test', successCallback1);
    await eventBus.subscribe('test', failingCallback);
    await eventBus.subscribe('test', successCallback2);

    const payload = { data: 'test' };
    await eventBus.publish('test', payload);

    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(errorMessage));

    // Verify all callbacks were attempted
    expect(successCallback1).toHaveBeenCalledWith(expect.objectContaining({ payload }));
    expect(failingCallback).toHaveBeenCalledWith(expect.objectContaining({ payload }));
    expect(successCallback2).toHaveBeenCalledWith(expect.objectContaining({ payload }));

    // Verify successful callbacks completed
    expect(successCallback1).toHaveBeenCalledTimes(1);
    expect(successCallback2).toHaveBeenCalledTimes(1);
  });
});
