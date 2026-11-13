const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');
const { CG } = require('../src/cg');

function createHomey() {
    const homey = new EventEmitter();
    const api = new EventEmitter();
    api.getInstalled = async () => true;
    api.get = async () => [];
    homey.api = { getApiApp: () => api };
    homey.app = { onUninit() {} };
    homey.error = (...args) => assert.fail(args.join(' '));
    return { homey, api };
}

test('readiness requires Chronograph to be installed and supports retry', async (t) => {
    const { homey, api } = createHomey();
    const errors = [];
    homey.error = (...args) => errors.push(args);
    let installed = false;
    api.getInstalled = async () => installed;
    t.after(() => CG.destroy());

    const cg = await CG.init({ homey });
    let resolved = false;
    cg.ready.then(() => { resolved = true; });
    await cg.realtimeFunction('other');

    assert.equal(cg.isReady, false);
    assert.equal(CG.isReady, false);
    assert.equal(resolved, false);
    assert.equal(api.listenerCount('realtime'), 0);
    assert.match(errors[0][1].message, /not installed/);

    installed = true;
    await cg.init();
    await cg.ready;
    assert.equal(cg.isReady, true);
    assert.equal(CG.isReady, true);
    assert.equal(api.listenerCount('realtime'), 1);
});

test('install events retry the installation check without calling the app API', async (t) => {
    const { homey, api } = createHomey();
    homey.error = () => {};
    let installed = false;
    api.getInstalled = async () => installed;
    api.get = async () => { throw new Error('App Not Ready'); };
    t.after(() => CG.destroy());

    const cg = await CG.init({ homey });
    assert.equal(api.listenerCount('install'), 1);
    installed = true;
    api.emit('install');
    api.emit('install');
    await cg.ready;
    assert.equal(cg.isReady, true);
    assert.equal(CG.isReady, true);
    assert.equal(api.listenerCount('install'), 1);
    assert.equal(api.listenerCount('realtime'), 1);
    await assert.rejects(CG.getChronographs(), /App Not Ready/);
});

test('an install event during an unsuccessful check triggers another check', async (t) => {
    const { homey, api } = createHomey();
    homey.error = () => {};
    let finishCheck;
    let checkStarted;
    const started = new Promise(resolve => { checkStarted = resolve; });
    let checks = 0;
    api.getInstalled = () => {
        checks++;
        if (checks > 1) return Promise.resolve(true);
        checkStarted();
        return new Promise(resolve => { finishCheck = resolve; });
    };
    t.after(() => CG.destroy());

    const initializing = CG.init({ homey });
    await started;
    const cg = CG.Current;
    api.emit('install');
    finishCheck(false);
    await initializing;
    await cg.ready;
    assert.equal(checks, 2);
    assert.equal(cg.isReady, true);
    assert.equal(api.listenerCount('realtime'), 1);
});

test('uninstall clears readiness and reinstall restores it after successful checks', async (t) => {
    const { homey, api } = createHomey();
    t.after(() => CG.destroy());
    const cg = await CG.init({ homey });
    const ready = cg.ready;
    assert.equal(cg.isReady, true);

    api.emit('uninstall');
    assert.equal(cg.isReady, false);
    assert.equal(CG.isReady, false);
    assert.equal(api.listenerCount('realtime'), 0);
    assert.equal(api.listenerCount('install'), 1);
    assert.equal(await ready, undefined);
    assert.equal(cg.ready, ready);

    api.emit('install');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(cg.isReady, true);
    assert.equal(CG.isReady, true);
    assert.equal(api.listenerCount('realtime'), 1);
});

test('uninstall during a check prevents a stale success from setting readiness', async (t) => {
    const { homey, api } = createHomey();
    let finishRequest;
    let requestStarted;
    const started = new Promise(resolve => { requestStarted = resolve; });
    api.getInstalled = () => {
        requestStarted();
        return new Promise(resolve => { finishRequest = resolve; });
    };
    t.after(() => CG.destroy());

    const initializing = CG.init({ homey });
    await started;
    const cg = CG.Current;
    api.emit('uninstall');
    finishRequest(true);
    await initializing;
    assert.equal(cg.isReady, false);
    assert.equal(CG.isReady, false);
    assert.equal(api.listenerCount('realtime'), 0);
});

test('an installation check failure leaves readiness false and logs the error', async (t) => {
    const { homey, api } = createHomey();
    const failure = new Error('installation check failed');
    const errors = [];
    homey.error = (...args) => errors.push(args);
    api.getInstalled = async () => { throw failure; };
    t.after(() => CG.destroy());

    const cg = await CG.init({ homey });
    assert.equal(cg.isReady, false);
    assert.equal(CG.isReady, false);
    assert.equal(api.listenerCount('realtime'), 0);
    assert.equal(errors[0][1], failure);
});

test('initial readiness does not require the app API to be ready', async (t) => {
    const { homey, api } = createHomey();
    let apiCalls = 0;
    api.get = async () => {
        apiCalls++;
        throw new Error('App Not Ready');
    };
    t.after(() => CG.destroy());

    const cg = await CG.init({ homey });
    assert.equal(cg.isReady, true);
    assert.equal(CG.isReady, true);
    assert.equal(apiCalls, 0);
    assert.equal(api.listenerCount('realtime'), 1);
});

test('readiness remains false while the installation check is pending', async (t) => {
    const { homey, api } = createHomey();
    let finishRequest;
    let requestStarted;
    const started = new Promise(resolve => { requestStarted = resolve; });
    api.getInstalled = () => {
        requestStarted();
        return new Promise(resolve => { finishRequest = resolve; });
    };
    t.after(() => CG.destroy());

    const initializing = CG.init({ homey });
    await started;
    assert.equal(CG.Current.isReady, false);
    assert.equal(CG.isReady, false);
    assert.equal(api.listenerCount('realtime'), 0);

    finishRequest(true);
    const cg = await initializing;
    assert.equal(cg.isReady, true);
    assert.equal(CG.isReady, true);
});

test('a replaced initialization cannot become ready after its check completes', async (t) => {
    const first = createHomey();
    const second = createHomey();
    let finishCheck;
    let checkStarted;
    const started = new Promise(resolve => { checkStarted = resolve; });
    first.api.getInstalled = () => {
        checkStarted();
        return new Promise(resolve => { finishCheck = resolve; });
    };
    second.api.getInstalled = async () => false;
    second.homey.error = () => {};
    t.after(() => CG.destroy());

    const firstInit = CG.init({ homey: first.homey });
    await started;
    const secondCg = await CG.init({ homey: second.homey });
    finishCheck(true);
    const firstCg = await firstInit;

    assert.equal(firstCg.isReady, false);
    assert.equal(secondCg.isReady, false);
    assert.equal(CG.isReady, false);
    assert.equal(first.api.listenerCount('realtime'), 0);
});

test('unload removes the realtime listener without replacing app lifecycle methods', async (t) => {
    const { homey, api } = createHomey();
    const onUninit = homey.app.onUninit;
    t.after(() => CG.destroy());
    await CG.init({ homey });

    assert.equal(homey.app.onUninit, onUninit);
    assert.equal(api.listenerCount('realtime'), 1);
    assert.equal(api.listenerCount('install'), 1);
    assert.equal(api.listenerCount('uninstall'), 1);
    assert.equal(homey.listenerCount('unload'), 1);

    homey.emit('unload');

    assert.equal(api.listenerCount('realtime'), 0);
    assert.equal(api.listenerCount('install'), 0);
    assert.equal(api.listenerCount('uninstall'), 0);
    assert.equal(homey.listenerCount('unload'), 0);
});

test('reinitialization and manual cleanup do not leave listeners behind', async (t) => {
    const first = createHomey();
    const second = createHomey();
    t.after(() => CG.destroy());
    await CG.init({ homey: first.homey });
    await CG.init({ homey: second.homey });

    assert.equal(first.api.listenerCount('realtime'), 0);
    assert.equal(first.api.listenerCount('install'), 0);
    assert.equal(first.api.listenerCount('uninstall'), 0);
    assert.equal(first.homey.listenerCount('unload'), 0);
    assert.equal(second.api.listenerCount('realtime'), 1);
    assert.equal(second.api.listenerCount('install'), 1);
    assert.equal(second.api.listenerCount('uninstall'), 1);
    assert.equal(second.homey.listenerCount('unload'), 1);

    first.homey.emit('unload');
    assert.equal(second.api.listenerCount('realtime'), 1);

    CG.destroy();
    CG.destroy();
    assert.equal(second.api.listenerCount('realtime'), 0);
    assert.equal(second.api.listenerCount('install'), 0);
    assert.equal(second.api.listenerCount('uninstall'), 0);
    assert.equal(second.homey.listenerCount('unload'), 0);
});
