/// <reference types="node" />
import { EventBus } from './event-bus';
declare global {
    const eventBus: EventBus;
}
export declare const getGlobal: () => (Window & typeof globalThis) | NodeJS.Global;
export { EventBus };
