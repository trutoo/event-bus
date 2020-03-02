# Event Bus

![Continuous Delivery](https://github.com/trutoo/event-bus/workflows/Continuous%20Delivery/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/trutoo/event-bus/badge.svg?branch=master)](https://coveralls.io/github/trutoo/event-bus?branch=master) ![GitHub release (latest by date)](https://img.shields.io/github/v/release/trutoo/event-bus)

Simple typesafe cross-platform pubsub communication between different fragments or services. Purposefully built for a micro architecture service using for example versioned microfrontends.

## Purpose

This project was created to improve upon some of the deficits CustomEvents has in relation to event communication between separate fragments, which often is the preferred way of communication. Below points are some of the benefits of using this pubsub package.

1. Each fragment can register on an event channel name to ensure all traffic on that channel follow a specified schema. This means incompatibilities are reported before any payload is sent and every payload will be typesafe.

2. The individual event channels stores the last payload allowing new fragments or asynchronous subscriptions to ask for a replay of the last payloads data as a first callback.

3. CustomEvents require a polyfill to work in older browsers.

## Installation

Either add trutoo github package registry to your `.npmrc`

```bash
@trutoo:registry=https://npm.pkg.github.com/trutoo
```

or install using the registry flag

```bash
npm install @trutoo/event-bus --registry=https://npm.pkg.github.com/trutoo
```

Then either import the side effects only exposing a `eventBus` global instance.

```javascript
import '@trutoo/event-bus';
```

or import the `EventBus` class to create your own instance.

```javascript
// Global instance eventBus still created
import { EventBus } from '@trutoo/event-bus';

// No global instance created
import { EventBus } from '@trutoo/event-bus/dist/event-bus';
```

## Usage

`Fragment One`

```typescript
class PubElement extends HTMLElement {
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

`Fragment Two`

```typescript
import React, { useState, useEffect } from 'react';
type Props = {};

function SubComponent({}: Props) {
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
  });

  return isFavorite ? 'This is a favorite' : 'This is not interesting';
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
