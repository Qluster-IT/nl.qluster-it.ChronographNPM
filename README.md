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

`CG.init` accepts one option, `homey`, which must be the Homey instance. It checks that Chronograph is installed before registering a realtime listener. It does not check whether the app's API has finished starting, so API calls may fail with `App Not Ready` even when `isReady` is true. Homey's `getInstalled()` reports installation, not running status; changes in availability depend on Homey emitting install and uninstall events. If the check fails, the error is logged, `isReady` remains false, and `ready` remains pending until the first successful check. An uninstall event sets `isReady` to false; the already-resolved `ready` promise does not reset. The check is retried when Homey emits an install event for Chronograph, or you can call `instance.init()` to retry manually. When Homey emits `unload` as the consuming app stops, `CG.destroy()` is called automatically to remove the listeners, without replacing your app's lifecycle methods. Cleanup cannot be guaranteed if the process is forcibly terminated.

## Available API

The package exports the `CG` class:

| Method or property | Description |
| --- | --- |
| `CG.init({ homey })` | Initializes the integration and returns a `CG` instance. |
| `CG.getChronographs()` | Returns the current active chronographs as an array. Each snapshot contains `name`, `data`, `duration`, `targetDuration`, and `running`. |
| `CG.getAllChronographs()` | Returns configured chronograph names grouped by type, such as `timer`, `stopwatch`, and `transition`. |
| `CG.onChronographUpdate({ chronograph })` | Update hook. Override it to handle realtime updates; the default implementation does nothing. |
| `CG.destroy()` | Removes the install, uninstall, realtime and unload listeners. Called automatically on Homey's `unload` event; can also be called manually. |
| `instance.ready` / `CG.ready` | Promise that resolves after the first successful installation check and realtime-listener registration. |
| `instance.isReady` / `CG.isReady` | Indicates that installation was confirmed; becomes false on an uninstall event. It does not guarantee API availability. |

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
- Initialization checks installation and registers for realtime updates; fetch chronograph data explicitly using the retrieval methods.
