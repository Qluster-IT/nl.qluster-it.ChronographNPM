# Chronograph for Homey

`chronograph-npm` lets a Homey app access chronographs provided by the [Chronograph app](https://homey.app/a/nl.fellownet.chronograph/). It provides helpers for retrieving chronographs and receiving realtime updates.

## Installation

Install the package in your Homey app project:

```sh
npm install chronograph-npm
```

Add Chronograph to the permissions in your app's `app.json`:

```json
{
  "permissions": [
    "homey:app:nl.fellownet.chronograph"
  ]
}
```

## Initialize

Import `CG` and initialize it from your app's `onInit` method:

```js
const { CG } = require('chronograph-npm');

class MyApp extends Homey.App {
  async onInit() {
    this.chronograph = await CG.init({ homey: this.homey });
  }
}

module.exports = MyApp;
```

`CG.init` accepts one option, `homey`, which must be the Homey instance. It returns a `CG` instance and registers a realtime listener. It does not fetch chronographs during initialization; call `CG.getChronographs()` or `CG.getAllChronographs()` when you need that data. When Homey emits `unload` as the consuming app stops, `CG.destroy()` is called automatically to remove the listeners, without replacing your app's lifecycle methods. Cleanup cannot be guaranteed if the process is forcibly terminated.

## Available API

The package exports the `CG` class:

| Method or property | Description |
| --- | --- |
| `CG.init({ homey })` | Initializes the integration and returns a `CG` instance. |
| `CG.getChronographs()` | Returns the current active chronographs as an array. Each snapshot contains `name`, `data`, `duration`, `targetDuration`, and `running`. |
| `CG.getAllChronographs()` | Returns configured chronograph names grouped by type, such as `timer`, `stopwatch`, and `transition`. |
| `CG.onChronographUpdate({ chronograph })` | Update hook. Override it to handle realtime updates; the default implementation does nothing. |
| `CG.destroy()` | Removes the realtime and unload listeners. Called automatically on Homey's `unload` event; can also be called manually. |
| `instance.ready` / `CG.ready` | Promise that resolves after successful initialization and realtime-listener registration. |
| `instance.isReady` / `CG.isReady` | Indicates whether the integration has become ready. |

For example, retrieve active chronographs after initialization:

```js
const chronographs = await CG.getChronographs();
for (const chronograph of chronographs) {
  this.log(chronograph.name, chronograph.running, chronograph.duration);
}
```

Use `getAllChronographs()` when you need the configured names (including chronographs that are not currently active):

```js
const configured = await CG.getAllChronographs();
this.log(configured.timer);
```

## Realtime updates

Override the update hook before initializing `CG`. The hook is called with `{ chronograph }` for each realtime update. If an update contains a `now` value, the package converts it to a JavaScript `Date`.

```js
const { CG } = require('chronograph-npm');

class MyApp extends Homey.App {
  async onInit() {
    CG.onChronographUpdate = async ({ chronograph }) => {
      this.log('Chronograph updated:', chronograph.name, chronograph.now);
    };

    this.chronograph = await CG.init({ homey: this.homey });
  }
}

module.exports = MyApp;
```

## Requirements

- The Chronograph app must be installed on the same Homey.
- Your app must declare the Chronograph permission in `app.json`.
- Initialize the package with your app's Homey instance before calling the retrieval methods.
- Initialization only registers for realtime updates; fetch chronograph data explicitly using the retrieval methods.
