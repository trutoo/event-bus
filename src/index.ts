import { EventBus } from './event-bus';

declare global {
  const eventBus: EventBus;
}

(globalThis as any).eventBus = new EventBus();

export { EventBus };
