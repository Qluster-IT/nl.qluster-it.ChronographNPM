class CG {


    static async init({ homey } = {}) {
        if (CG.Current) CG.destroy();
        let cg = new CG({ homey });

        homey.once('unload', CG.destroy);
        await cg.init();
        return cg;
    }
    constructor({ homey }) {
        CG.Current = this;
        this.homey = CG.homey = homey;
        CG.isReady = this.isReady = false;
        this._destroyed = false;
        this._uninstallGeneration = 0;
        this._installListener = () => {
            const pending = this._initializing || Promise.resolve();
            pending.then(() => this.init()).catch(error => this.homey.error('CG.init', error));
        };
        this._uninstallListener = () => {
            this._uninstallGeneration++;
            this.isReady = false;
            if (CG.Current === this) CG.isReady = false;
            if (this.api) {
                this.api.off('realtime', this.realtimeFunction);
                this.api = null;
            }
        };

        this._defer = CG._defer = new Defer();

        this.ready = CG.ready = this._defer.promise;
    }

    /** @returns {Promise<CG>} */
    async init({ } = {}) {
        if (this._destroyed || this.api) return this;
        if (this._initializing) return this._initializing;
        this._initializing = Promise.resolve().then(async () => {
            try {
                if (this._destroyed) return this;
                const generation = this._uninstallGeneration;
                const api = await this.getAppApi();
                if (this._destroyed || generation !== this._uninstallGeneration) return this;
                api.on('realtime', this.realtimeFunction);
                this.api = api;
                this.isReady = true;
                if (CG.Current === this) CG.isReady = true;
                this._defer.resolve();
            } catch (error) {
                this.homey.error('CG.init', error);
            }
            return this;
        }).finally(() => { this._initializing = null; });
        return this._initializing;
    }



    /**
     * Removes the install, uninstall, realtime and unload listeners. Called automatically when Homey emits unload.
     */
    static destroy() {
        try {
            if (!CG.Current) return;
            CG.Current._destroyed = true;
            CG.Current.homey.removeListener('unload', CG.destroy);
            if (CG.Current._appApi) {
                CG.Current._appApi.off('install', CG.Current._installListener);
                CG.Current._appApi.off('uninstall', CG.Current._uninstallListener);
            }
            if (CG.Current.api) {
                CG.Current.api.off('realtime', CG.Current.realtimeFunction);
            }

        } catch (error) { console.log(error); }
    }


    async realtimeFunction(event, data) {
        if (event === 'chronograph_event') {
            if (data && data.now) data.now = new Date(data.now);
            CG.onChronographUpdate({ chronograph: data });
        } else if (event === 'chronograph_event_multi') {
            if (data && data.length) for (let i = 0; i < data.length; i++) {
                const chronograph = data[i];
                if (chronograph && chronograph.now) chronograph.now = new Date(chronograph.now);
                CG.onChronographUpdate({ chronograph });
            }

        }
    }


    /** @private */
    async getAppApi() {
        if (!this._appApi) {
            const api = this.homey.api.getApiApp('nl.fellownet.chronograph');
            if (!api) throw new Error('Chronograph is not installed.');
            api.on('install', this._installListener);
            api.on('uninstall', this._uninstallListener);
            this._appApi = api;
        }
        const api = this._appApi;
        if (!await api.getInstalled()) throw new Error('Chronograph is not installed.');
        return api;
    }


    static async getAllChronographs() {
        if (CG && CG.Current && CG.Current.api) return await CG.Current.api.get('/allchronographs')
    }

    static async getChronographs() {
        if (CG && CG.Current && CG.Current.api) return await CG.Current.api.get('/chronographs')
    }




    /**
     * Handles a realtime update from the Chronograph app. Override this method
     * to receive updated chronograph data.
     * @param {Object} param0 Update payload.
     * @param {Object} param0.chronograph Realtime state snapshot, not a Chronograph class instance.
     * @param {string} [param0.chronograph.id] Generated identifier; omitted from single-event updates.
     * @param {string} param0.chronograph.name Configured chronograph name.
     * @param {number} param0.chronograph.duration Elapsed duration in milliseconds, also exposed as elapsed.
     * @param {number} param0.chronograph.elapsed Elapsed duration in milliseconds.
     * @param {number|null} param0.chronograph.targetDuration Target duration in milliseconds.
     * Stopwatches have no target (NaN before serialization, normally null over the API).
     * @param {number|null} param0.chronograph.remaining Target duration minus elapsed duration, in milliseconds.
     * Not meaningful for stopwatches; may be NaN or null after serialization.
     * @param {boolean} param0.chronograph.running Whether the chronograph is running.
     * @param {boolean} param0.chronograph.removed Whether this update reports removal of the chronograph.
     * @param {Date} param0.chronograph.now Snapshot timestamp, converted to a Date by this package.
     * @param {Object} param0.chronograph.data Chronograph metadata, excluding flowValues; may be incomplete during creation.
     * @param {'Timer'|'Stopwatch'|'Transition'} [param0.chronograph.data.type] Chronograph kind.
     * @param {number} [param0.chronograph.data.from] Transition starting value.
     * @param {number} [param0.chronograph.data.to] Transition ending value.
     * @param {number} [param0.chronograph.data.steps] Transition step count, limited by its duration.
     */
    static async onChronographUpdate({ chronograph }) {
        //BL.homey.log('onChronographUpdate: ', chronograph);

    }



}



class Defer {
    get isDefered() { return !!this._isDefered; }
    set isDefered(v) { this._isDefered = v; }

    get promise() { return this._promise; }
    set promise(v) { this._promise = v; }
    /** 
     * @param {Number} timeout 
     */
    constructor(timeout, originalPromise, onTimeout) {
        this._promise = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
        if (timeout) {
            this.timeout = BL.homey.setTimeout(function () {
                if (!this.isDefered && this.promise) {
                    this.reject();
                    //if (this.promise.resolve) this.promise.resolve();
                    if (onTimeout) onTimeout();
                }
            }.bind(this), timeout);
        }
        if (originalPromise && originalPromise.then) originalPromise.then((val1, val2, val3, val4) => this.resolve(val1, val2, val3, val4)).catch((val1, val2, val3, val4) => this.reject(val1, val2, val3, val4));
    }
    then(fun) { this._promise.then(fun); return this; }
    catch(fun) { this._promise.catch(fun); return this; }
    finally(fun) { this._promise.finally(fun); return this; }
    resolve(val1, val2, val3, val4) { if (this.timeout) clearTimeout(this.timeout); this.isDefered = true; this._resolve(val1, val2, val3, val4); return this.promise; }
    reject(val1, val2, val3, val4) { if (this.timeout) clearTimeout(this.timeout); this.isDefered = true; this._reject(val1, val2, val3, val4); return this.promise; }
}

module.exports = { CG };