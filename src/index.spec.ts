import { EventBus } from './index';

//------------------------------------------------------------------------------------
// global
//------------------------------------------------------------------------------------

describe('[EventBus]: global', () => {
  it('should exist in the global scope', () => {
    expect(eventBus).toBeInstanceOf(EventBus);
  });
});
