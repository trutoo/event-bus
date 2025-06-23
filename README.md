# Event Bus

![Continuous Delivery](https://github.com/trutoo/event-bus/workflows/Continuous%20Delivery/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/trutoo/event-bus/badge.svg?branch=main)](https://coveralls.io/github/trutoo/event-bus?branch=main) ![GitHub release (latest by date)](https://img.shields.io/github/v/release/trutoo/event-bus) [![[npm downloads]](https://img.shields.io/npm/dt/@trutoo/event-bus)](https://www.npmjs.com/package/@trutoo/event-bus) ![npm bundle size](https://img.shields.io/bundlephobia/minzip/@trutoo/event-bus/latest) ![License](https://img.shields.io/github/license/trutoo/event-bus?kill_cache=0)

Simple typesafe cross-platform pubsub communication between different single page applications, web components, fragments, or services. Purposefully built for a micro frontend architecture with a distributed responsibility for deployment. Allowing for framework agnostic and safe communication between different implementations and version. Catch those pesky event errors early :heart:.

---

## Table of Contents

- [Event Bus](#event-bus)
  - [Table of Contents](#table-of-contents)
  - [Purpose](#purpose)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Advanced Schema](#advanced-schema)
  - [API](#api)
    - [Constructor Options](#constructor-options)
    - [Register](#register)
      - [Parameters](#parameters)
    - [Unregister](#unregister)
      - [Parameters](#parameters-1)
    - [Subscribe](#subscribe)
      - [Parameters](#parameters-2)
    - [Publish](#publish)
      - [Parameters](#parameters-3)
    - [Get Latest](#get-latest)
      - [Parameters](#parameters-4)
    - [Get Schema](#get-schema)
      - [Parameters](#parameters-5)
    - [Clear Replay](#clear-replay)
      - [Parameters](#parameters-6)

---

## Purpose

This project was created to improve upon some of the deficits CustomEvents has in relation to event communication between separate web components or fragments, which often is the preferred way of communication. Below points are some of the benefits of using this pub-sub solution over the native solution.

1. Each fragment can register on a custom named event channel with an optional [JSON schema draft-04](https://tools.ietf.org/html/draft-zyp-json-schema-04) to ensure all future traffic on that channel follows the specification. This means incompatibilities are reported before any payload is sent and every payload will be typesafe.

2. The individual event channels stores the last payload allowing new fragments or asynchronous subscriptions to ask for a replay of the last payloads data as a first callback.

3. CustomEvents require a polyfill to work in older browsers, while this project works out of the box with Internet Explorer 11.

## Installation

Install the package from the [npm registry @trutoo/event-bus](https://www.npmjs.com/package/@trutoo/event-bus) as a production/runtime dependency.

```bash
npm install @trutoo/event-bus
```

or

```bash
yarn add @trutoo/event-bus
```

_**Note: dropped publishing to GitHub packages to simplify releases.**_

Then either import the side effects only exposing a `eventBus` global instance.

```javascript
import '@trutoo/event-bus';
// or
require('@trutoo/event-bus');

eventBus.register(/*...*/);
```

or import the `EventBus` class to create your own instance.

```javascript
import { EventBus } from '@trutoo/event-bus';
// or
const { EventBus } = require('@trutoo/event-bus');

const myEventBus = new EventBus();
myEventBus.register(/*...*/);
```

or using the UMD module and instance.

```html
<script src="https://unpkg.com/@trutoo/event-bus@latest/dist/index.umd.min.js"></script>
<script>
  eventBus.register(/*...*/);
  // or
  const myEventBus = new EventBus.EventBus();
  myEventBus.register(/*...*/);
</script>
```

## Usage

Simple event bus registration with communication between a standard web component and a React component, as the event bus is framework agnostic. In addition a basic [JSON schema draft-04](https://tools.ietf.org/html/draft-zyp-json-schema-04) is used to restrict communication to a single boolean. Below outlines the basic usage, but can also be seen under [`/docs`](https://github.com/trutoo/event-bus/tree/main/docs) folder.

`JSON Schema`

```json
{
  "type": "boolean"
}
```

`Fragment One - Web Component`

```typescript
class PublisherElement extends HTMLElement {
  connectedCallback() {
    eventBus.register('namespace:eventName', { type: 'boolean' });
    this.render();
    this.firstChild && this.firstChild.addEventListener('click', this.send);
  }
  async send() {
    await eventBus.publish('namespace:eventName', true);
  }
  render() {
    this.innerHTML = `<button type="button">send</button>`;
  }
  disconnectedCallback() {
    this.firstChild && this.firstChild.removeEventListener('click', this.send);
  }
}
```

`Fragment Two - React Component`

```typescript
import React from 'react';

// Custom hook for event bus subscriptions
function useEventSubscription<T>(eventName: string, schema: object) {
  const [value, setValue] = React.useState<T>();

  React.useEffect(() => {
    let sub: { unsubscribe(): void };

    async function init() {
      try {
        eventBus.register(eventName, schema);
        sub = await eventBus.subscribe<T>(eventName, (event) => setValue(event.payload));
      } catch (e) {
        console.error(`Failed to subscribe to ${eventName}:`, e);
      }
    }

    init();
    return () => {
      if (sub) sub.unsubscribe();
    };
  }, [eventName, schema]);

  return value;
}

function SubscriberComponent() {
  const isFavorite = useEventSubscription<boolean>('namespace:eventName', { type: 'boolean' });
  return isFavorite ? 'This is a favorite' : 'This is not interesting';
}
```

### Advanced Schema

Following is an example of a more a more complex use-case with a larger [JSON schema draft-04](https://tools.ietf.org/html/draft-zyp-json-schema-04) and registration on multiple channels.

`JSON Schema`

```json
{
  "type": "object",
  "required": ["name", "amount", "price"],
  "properties": {
    "name": {
      "type": "string"
    },
    "amount": {
      "type": "string"
    },
    "price": {
      "type": "number"
    },
    "organic": {
      "type": "boolean"
    },
    "stores": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [],
        "properties": {
          "name": {
            "type": "string"
          },
          "url": {
            "type": "string"
          }
        }
      }
    }
  }
}
```

`Fragment - Angular Component`

```typescript
import { Component } from '@angular/core';
import eventSchema from './event-schema.json';

@Component({
  selector: 'app-store',
  template: '<button (onClick)="onSend()">Add to cart</button>',
})
export class StoreComponent implements OnInit, OnDestroy {
  private subs: { unsubscribe(): void }[] = [];

  ngOnInit() {
    // Register on add to cart channel
    eventBus.register('store:addToCart', eventSchema);

    // No need to register if no schema is required
    this.sub.push(eventBus.subscribe<boolean>('store:newDeals', this.onNewDeals));
  }

  onNewDeals() {
    /* handle new deals ... */
  }

  async onSend() {
    await eventBus.publish('store:addToCart', {
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
    });
  }

  ngOnDestroy() {
    this.subs.forEach((sub) => sub.unsubscribe());
  }
}
```

## API

### Constructor Options

The EventBus constructor accepts an options object with the following properties:

```typescript
interface EventBusOptions {
  /**
   * The logging level for the event bus
   * - 'none': No logging
   * - 'error': Only log errors (default)
   * - 'warn': Log warnings and errors
   * - 'info': Log everything
   */
  logLevel?: 'none' | 'error' | 'warn' | 'info';
}
```

### Register

Register a schema for the specified event type and equality checking on subsequent registers. Subsequent registers must use an equal schema or an error will be thrown.

```typescript
register(channel: string, schema: Record<string, unknown>): boolean;
```

#### Parameters

| Name    | Type                      | Description                                          |
| ------- | ------------------------- | ---------------------------------------------------- |
| channel | `string`                  | name of event channel to register schema to          |
| schema  | `Record<string, unknown>` | all communication on channel must follow this schema |

**Returns** - returns true if event channel already existed of false if a new one was created.

---

### Unregister

Unregister the schema for the specified event type if channel exists.

```typescript
unregister(channel: string): boolean;
```

#### Parameters

| Name    | Type     | Description                                     |
| ------- | -------- | ----------------------------------------------- |
| channel | `string` | name of event channel to unregister schema from |

**Returns** - returns true if event channel existed and an existing schema was removed.

---

### Subscribe

Subscribe to an event channel triggering callback on received event matching type,
with an optional replay of last event at initial subscription.
The channel may be the wildcard `'*'` to subscribe to all channels.

```typescript
async subscribe<T>(channel: string, callback: Callback<T>): Promise<{ unsubscribe(): void }>;

async subscribe<T>(channel: string, replay: boolean, callback: Callback<T>): Promise<{ unsubscribe(): void }>;
```

Note: Subscribe is an async function that returns a Promise with the subscription.

Callbacks will be fired when event is published on a subscribed channel with the argument:

```typescript
{
  channel: string,
  payload: T,
}
```

#### Parameters

| Name     | Type            | Description                                                     |
| -------- | --------------- | --------------------------------------------------------------- |
| channel  | `string`        | name of event channel to receive data from                      |
| replay   | `boolean=false` | flag indicating if initial description should return last event |
| callback | `function`      | function executed on when event channel receives new data       |

**Returns** - object containing an unsubscribe method

---

### Publish

Publish to event channel with an optional payload triggering all subscription callbacks. Returns a Promise that resolves when all callbacks have completed.

```typescript
async publish<T>(channel: string, payload?: T): Promise<void>;
```

#### Parameters

| Name    | Type     | Description                              |
| ------- | -------- | ---------------------------------------- |
| channel | `string` | name of event channel to send payload on |
| payload | `any`    | payload to be sent                       |

**Returns** - Promise that resolves when all callbacks have completed

---

### Get Latest

Get the latest published payload on the specified event channel.

```typescript
getLatest<T>(channel: string): T | undefined;
```

#### Parameters

| Name    | Type     | Description                                                |
| ------- | -------- | ---------------------------------------------------------- |
| channel | `string` | name of the event channel to fetch the latest payload from |

**Returns** - the latest payload or `undefined`

---

### Get Schema

Get the schema registered on the specified event channel.

```typescript
getSchema<T>(channel: string): any | undefined;
```

#### Parameters

| Name    | Type     | Description                                        |
| ------- | -------- | -------------------------------------------------- |
| channel | `string` | name of the event channel to fetch the schema from |

**Returns** - the schema or `undefined`

---

### Clear Replay

Clears the replay event for the specified channel.

```typescript
clearReplay(channel: string): boolean;
```

#### Parameters

| Name    | Type     | Description                                        |
| ------- | -------- | -------------------------------------------------- |
| channel | `string` | name of the event channel to clear the replay from |

**Returns** - returns true if the replay event was cleared, false otherwise.
