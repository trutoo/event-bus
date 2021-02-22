# Event Bus

![Continuous Delivery](https://github.com/trutoo/event-bus/workflows/Continuous%20Delivery/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/trutoo/event-bus/badge.svg?branch=master)](https://coveralls.io/github/trutoo/event-bus?branch=master) ![GitHub release (latest by date)](https://img.shields.io/github/v/release/trutoo/event-bus) [![[npm downloads]](https://img.shields.io/npm/dt/@trutoo/event-bus)](https://www.npmjs.com/package/@trutoo/event-bus) ![npm bundle size](https://img.shields.io/bundlephobia/minzip/@trutoo/event-bus) ![License](https://img.shields.io/github/license/trutoo/event-bus?kill_cache=0)

Simple typesafe cross-platform pubsub communication between different single page applications, web components, fragments, or services. Purposefully built for a micro frontend architecture with a distributed responsibility for deployment. Allowing for framework agnostic and safe communication between different implementations and version. Catch those pesky event errors early :heart:.

---

## Table of Contents

* [Purpose](#purpose)
* [Installation](#installation)
* [Usage](#usage)
  + [Advanced Schema](#advanced-schema)
* [API](#api)
  + [Register](#register)
  + [Unregister](#unregister)
  + [Subscribe](#subscribe)
  + [Publish](#publish)

---

## Purpose

This project was created to improve upon some of the deficits CustomEvents has in relation to event communication between separate web components or fragments, which often is the preferred way of communication. Below points are some of the benefits of using this pub-sub solution over the native solution.

1. Each fragment can register on a custom named event channel with an optional [JSON schema draft-04](https://tools.ietf.org/html/draft-zyp-json-schema-04) to ensure all future traffic on that channel follows the specification. This means incompatibilities are reported before any payload is sent and every payload will be typesafe.

2. The individual event channels stores the last payload allowing new fragments or asynchronous subscriptions to ask for a replay of the last payloads data as a first callback.

3. CustomEvents require a polyfill to work in older browsers, while this project works out of the box with Internet Explorer 11.

## Installation

Either add the Trutoo GitHub Package registry to your `.npmrc`

```ini
@trutoo:registry=https://npm.pkg.github.com/trutoo
```

or install using the registry flag

```bash
npm install @trutoo/event-bus --registry=https://npm.pkg.github.com/trutoo
```

or install from the [npm registry @trutoo/event-bus](https://www.npmjs.com/package/@trutoo/event-bus)

```bash
npm install @trutoo/event-bus
```

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

Simple event bus registration with communication between a standard web component and a React component, as the event bus is framework agnostic. In addition a basic [JSON schema draft-04](https://tools.ietf.org/html/draft-zyp-json-schema-04) is used to restrict communication to a single boolean. Below outlines the basic usage, but can be can also be seen under [`/docs`](https://github.com/trutoo/event-bus/tree/master/docs) folder.

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
  send() {
    eventBus.publish('namespace:eventName', true);
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
import React, { useState, useEffect } from 'react';

function SubscriberComponent() {
  const [isFavorite, setFavorite] = useState(false);

  useEffect(() => {
    function handleSubscribe(favorite: boolean) {
      setFavorite(favorite);
    }
    eventBus.register('namespace:eventName', { type: 'boolean' });
    const sub = eventBus.subscribe<boolean>('namespace:eventName', handleSubscribe);
    return function cleanup() {
      sub.unsubscribe();
    };
  }, []);

  return isFavorite ? 'This is a favorite' : 'This is not interesting';
}
```

### Advanced Schema

Following is an example of a more a more complex use-case with a larger [JSON schema draft-04](https://tools.ietf.org/html/draft-zyp-json-schema-04) and registration on multiple channels.

`JSON Schema`
```json
{
  "type": "object",
  "required": [
    "name",
    "amount",
    "price"
  ],
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

  onSend() {
    eventBus.publish('store:addToCart', {
      name: 'Milk',
      amount: '1000 ml',
      price: 0.99,
      organic: true,
      stores: [
        {
          name: 'ACME Food AB',
          url: 'acme-food.com'
        }
      ]
    });
  }

  ngOnDestroy() {
    this.subs.forEach(sub => sub.unsubscribe());
  }
}
```

## API

### Register

Register a schema for the specified event type and equality checking on subsequent registers. Subsequent registers must use an equal schema or an error will be thrown.

```typescript
register(eventType: string, schema: object): boolean;
```

#### Parameters

| Name      | Type     | Description                                          |
| --------- | -------- | ---------------------------------------------------- |
| eventType | `string` | name of event channel to register schema to          |
| schema    | `object` | all communication on channel must follow this schema |

**Returns** - returns true if event channel already existed of false if a new one was created.

### Unregister

Unregister the schema for the specified event type if channel exists.

```typescript
unregister(eventType: string): boolean;
```

#### Parameters

| Name      | Type     | Description                                     |
| --------- | -------- | ----------------------------------------------- |
| eventType | `string` | name of event channel to unregister schema from |

**Returns** - returns true if event channel existed and an existing schema was removed.

### Subscribe

Subscribe to an event channel triggering callback on received event matching type, with an optional replay of last event at initial subscription.

```typescript
subscribe<T>(eventType: string, callback: Callback<T>): { unsubscribe(): void };

subscribe<T>(eventType: string, replay: boolean, callback: Callback<T>): { unsubscribe(): void };
```

#### Parameters

| Name      | Type            | Description                                                     |
| --------- | --------------- | --------------------------------------------------------------- |
| eventType | `string`        | name of event channel to receive data from                      |
| replay    | `boolean=false` | flag indicating if initial description should return last event |
| callback  | `function`      | function executed on when event channel receives new data       |

**Returns** - object containing an unsubscribe method

### Publish

Publish to event channel with an optional payload triggering all subscription callbacks.

```typescript
publish<T>(eventType: string, detail?: T): void;
```

#### Parameters

| Name      | Type     | Description                              |
| --------- | -------- | ---------------------------------------- |
| eventType | `string` | name of event channel to send payload on |
| detail    | `any`    | payload to be sent                       |

**Returns** - void
