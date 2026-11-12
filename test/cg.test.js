const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');
const { CG } = require('../src/cg');

function createHomey() {
    const homey = new EventEmitter();
    const api = new EventEmitter();
    homey.api = { getApiApp: () => api };
    homey.app = { onUninit() {} };
    homey.error = (...args) => assert.fail(args.join(' '));
    return { homey, api };
}

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
