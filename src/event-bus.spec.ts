import { EventBus } from './event-bus';

//------------------------------------------------------------------------------------
// _getNextId
//------------------------------------------------------------------------------------

describe('[EventBus]: _getNextId', () => {
  it('should get an incrementally increasing id', () => {
    const eventBus = new EventBus();
    expect(eventBus._getNextId()).toBe(1);
    expect(eventBus._getNextId()).toBe(2);
  });
});

//------------------------------------------------------------------------------------
// register
//------------------------------------------------------------------------------------

describe('[EventBus]: register', () => {
  it('should register a schema on new channels', () => {
    const eventBus = new EventBus();
    eventBus.register('test1', { test: 'boolean' });
    eventBus.register('test2', { test: 'boolean' });
  });

  it('should re-register an equal schema on an existing channel', () => {
    const eventBus = new EventBus();
    eventBus.register('test1', { test1: 'boolean', test2: 'string' });
    eventBus.register('test1', { test2: 'string', test1: 'boolean' });
  });

  it('should be fail to register a differentiating schema on an existing channel', () => {
    const eventBus = new EventBus();
    const register = () => {
      eventBus.register('test1', { test1: 'boolean', test2: 'string' });
      eventBus.register('test1', { test1: 'boolean', test2: 'boolean' });
    };
    expect(register).toThrowError();
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

  it('should subscribe to an existing channel with replay of last event', () => {
    const eventBus = new EventBus();
    eventBus.subscribe('test1', true, replay => {
      expect(replay).toBeFalsy();
    });
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
    eventBus.publish('test1', { test1: true });
  });

  it('should publish event to a registered channel matching schema', () => {
    const eventBus = new EventBus();
    eventBus.register('test1', { test1: 'boolean' });
    eventBus.publish('test1', { test1: true });
  });

  it('should fail to publish incorrect event to a registered channel with schema', () => {
    const eventBus = new EventBus();
    const publish = () => {
      eventBus.register('test1', { test1: 'boolean' });
      eventBus.publish('test1', { test1: 'hello' });
    };
    expect(publish).toThrowError();
  });
});

//------------------------------------------------------------------------------------
// subscribe and publish
//------------------------------------------------------------------------------------

describe('[EventBus]: subscribe and publish', () => {
  it('should receive same data as published', done => {
    const eventBus = new EventBus();
    const sent = { test1: true };
    eventBus.subscribe('test1', received => {
      expect(received).toEqual(sent);
      done();
    });
    eventBus.publish('test1', sent);
  });

  it('should no longer receive data after unsubscription', () => {
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
