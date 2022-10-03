import { EventBus, PayloadMismatchError, SchemaMismatchError } from './event-bus';
import AdvancedSchema from './fixtures/advanced-schema.json';

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
    new PayloadMismatchError('channel', null, null);
    expect(Error.captureStackTrace).toBeFalsy();
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
    new SchemaMismatchError('channel', null, null);
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
    expect(register).toThrowError();
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
  it('should subscribe to a new channel', () => {
    const eventBus = new EventBus();
    eventBus.subscribe('test1', jest.fn());
  });

  it('should throw an error if subscribe is called without a callback', () => {
    const eventBus = new EventBus();
    const subscribe = () => {
      eventBus.subscribe('test1', undefined as any);
    };
    expect(subscribe).toThrowError();
  });

  it('should not trigger a callback with replay if no previous event was published', () => {
    const eventBus = new EventBus();
    const callback = jest.fn();
    eventBus.subscribe('test1', true, callback);
    expect(callback).not.toHaveBeenCalled();
  });

  it('should not trigger a callback if no replay is requested', () => {
    const eventBus = new EventBus();
    const callback = jest.fn();
    eventBus.subscribe('test1', false, callback);
    expect(callback).not.toHaveBeenCalled();
  });

  it('should unsubscribe to an existing channel', () => {
    const eventBus = new EventBus();
    const subscription = eventBus.subscribe('test1', jest.fn());
    subscription.unsubscribe();
  });
});

//------------------------------------------------------------------------------------
// publish
//------------------------------------------------------------------------------------

describe('[EventBus]: publish', () => {
  it('should publish event to a new channel', () => {
    const eventBus = new EventBus();
    eventBus.publish('test1', true);
  });

  it('should publish event to a registered channel matching schema', () => {
    const eventBus = new EventBus();
    eventBus.register('test1', { type: 'boolean' });
    eventBus.publish('test1', true);
  });

  it('should fail to publish incorrect event to a registered channel with schema', () => {
    const eventBus = new EventBus();
    const publish = () => {
      eventBus.register('test1', { type: 'boolean' });
      eventBus.publish('test1', 'hello');
    };
    expect(publish).toThrowError();
  });

  it("should skip calling registered callbacks that aren't functions in channel", () => {
    const eventBus = new EventBus();
    const callback = jest.fn();
    // Mutate function to include invalid types
    eventBus['_subscriptions'].test1 = [null, undefined, 1, 'hello', true, false, {}, [], callback] as any;
    eventBus['_subscriptions']['*'] = [null, undefined, 1, 'hello', true, false, {}, [], callback] as any;
    eventBus.publish('test1', true);
    expect(callback).toHaveBeenCalledTimes(2);
  });
});

//------------------------------------------------------------------------------------
// getLatest
//------------------------------------------------------------------------------------

describe('[EventBus]: getLatest', () => {
  it('should return the latest published event on channel', () => {
    const eventBus = new EventBus();
    eventBus.publish('test1', true);
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
  it('should receive same data as published', () => {
    const eventBus = new EventBus();
    const payload = { test1: true };
    const callback = jest.fn();
    eventBus.subscribe('test1', callback);
    expect(callback).not.toHaveBeenCalled();
    eventBus.publish('test1', payload);
    expect(callback).toBeCalledWith({ channel: 'test1', payload });
  });

  it('should receive events on wildcard channel * regardless of channel it was published on', () => {
    const eventBus = new EventBus();
    const payload = { test1: true };
    const callback = jest.fn();
    eventBus.subscribe('*', callback);
    eventBus.publish('test1', payload);
    expect(callback).toBeCalledWith({ channel: 'test1', payload: payload });
  });

  it('should handle more advanced schemas', () => {
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
    eventBus.subscribe('test1', callback);
    eventBus.publish('test1', payload);
    expect(callback).toBeCalledWith({ channel: 'test1', payload });
  });

  it('should subscribe to an existing channel with replay of last event', () => {
    const eventBus = new EventBus();
    const payload = { test1: true };
    const callback = jest.fn();
    eventBus.publish('test1', payload);
    eventBus.subscribe('test1', true, callback);
    expect(callback).toBeCalledWith({ channel: 'test1', payload });
  });

  it('should handle multiple subscriptions with correct channels', () => {
    const eventBus = new EventBus();
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    const callback3 = jest.fn();
    eventBus.subscribe('test1', callback1);
    eventBus.subscribe('test1', callback2);
    eventBus.subscribe('test2', callback3);
    eventBus.publish('test1', { test1: true });
    expect(callback1).toHaveBeenCalled();
    expect(callback2).toHaveBeenCalled();
    expect(callback3).not.toHaveBeenCalled();
  });

  it('should no longer receive data after unsubscribe', () => {
    const eventBus = new EventBus();
    const callback = jest.fn();
    const subscription = eventBus.subscribe('test1', callback);
    eventBus.publish('test1', { test1: true });
    expect(callback).toHaveBeenCalled();
    subscription.unsubscribe();
    eventBus.publish('test1', { test1: true });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
