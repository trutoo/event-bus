# Event Bus

Simple typesafe cross-platform communication between different fragments or services. Purposefully built for a micro architecture service using for example versioned microfrontends.

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

To communicate

## API
