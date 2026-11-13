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

test('readiness requires the installed app to respond to its API', async (t) => {
    const { homey, api } = createHomey();
    const failure = new Error('app is not running');
    const errors = [];
    homey.error = (...args) => errors.push(args);
    let running = false;
    const paths = [];
    api.get = async (path) => {
        paths.push(path);
        if (!running) throw failure;
        return [];
    };
    t.after(() => CG.destroy());

    const cg = await CG.init({ homey });
    assert.equal(cg.isReady, false);
    assert.equal(CG.isReady, false);
    assert.equal(api.listenerCount('realtime'), 0);
    assert.equal(errors[0][1], failure);
    assert.deepEqual(paths, ['/chronographs']);

    running = true;
    await cg.init();
    await cg.ready;
    assert.equal(cg.isReady, true);
    assert.equal(CG.isReady, true);
    assert.deepEqual(paths, ['/chronographs', '/chronographs']);
    assert.equal(api.listenerCount('realtime'), 1);
});

test('readiness remains false while the running check is pending', async (t) => {
    const { homey, api } = createHomey();
    let finishRequest;
    let requestStarted;
    const started = new Promise(resolve => { requestStarted = resolve; });
    api.get = () => {
        requestStarted();
        return new Promise(resolve => { finishRequest = resolve; });
    };
    t.after(() => CG.destroy());

    const initializing = CG.init({ homey });
    await started;
    assert.equal(CG.Current.isReady, false);
    assert.equal(CG.isReady, false);
    assert.equal(api.listenerCount('realtime'), 0);

    finishRequest([]);
    const cg = await initializing;
    assert.equal(cg.isReady, true);
    assert.equal(CG.isReady, true);
});

test('a replaced initialization cannot become ready after its check completes', async (t) => {
    const first = createHomey();
    const second = createHomey();
    let finishCheck;
    first.api.getInstalled = () => new Promise(resolve => { finishCheck = resolve; });
    second.api.getInstalled = async () => false;
    second.homey.error = () => {};
    t.after(() => CG.destroy());

    const firstInit = CG.init({ homey: first.homey });
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
    assert.equal(homey.listenerCount('unload'), 1);

    homey.emit('unload');

    assert.equal(api.listenerCount('realtime'), 0);
    assert.equal(homey.listenerCount('unload'), 0);
});

test('reinitialization and manual cleanup do not leave listeners behind', async (t) => {
    const first = createHomey();
    const second = createHomey();
    t.after(() => CG.destroy());
    await CG.init({ homey: first.homey });
    await CG.init({ homey: second.homey });

    assert.equal(first.api.listenerCount('realtime'), 0);
    assert.equal(first.homey.listenerCount('unload'), 0);
    assert.equal(second.api.listenerCount('realtime'), 1);
    assert.equal(second.homey.listenerCount('unload'), 1);

    first.homey.emit('unload');
    assert.equal(second.api.listenerCount('realtime'), 1);

    CG.destroy();
    CG.destroy();
    assert.equal(second.api.listenerCount('realtime'), 0);
    assert.equal(second.homey.listenerCount('unload'), 0);
});
