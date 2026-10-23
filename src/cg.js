class CG {


    static async init({ homey } = {}) {
        let cg = new CG({ homey });

        if (!homey.app.__CG_OnUninit) {
            homey.app.__CG_OnUninit = homey.app.onUninit;
            homey.app.onUninit = async function (args) {

                try {
                    if (CG) await CG.destroy();
                } catch (error) {
                    console.log(error);
                }
                try {
                    if (args) await CG.homey.__CG_OnUninit(...args); else await CG.homey.__CG_OnUninit();
                } catch (error) {
                    let a = error;
                }
            };
        }
        try {
            await cg.init();
        } catch (error) {

        }
        return cg;
    }
    constructor({ homey }) {
        CG.Current = this;
        this.homey = CG.homey = homey;
        this.isReady = false;

        CG._defer = new Defer();

        this.ready = CG.ready = CG._defer.promise;
        CG.ready.then(() => {
            CG.isReady = this.isReady = true;
        });
    }

    async init({ } = {}) {
        if (!this.api) {
            try {
                this.api = await this.getAppApi(true);
                this.api.on('realtime', this.realtimeFunction);
                await this.api.get('/chronographs')
                if (!CG.isReady && CG._defer) CG._defer.resolve();
            } catch (error) {
                this.homey.error('CG.init', error);
                return this;
            }
        }
        return this;
    }



    static destroy() {
        try {
            if (!CG.Current) return;
            if (CG.Current.api) {
                CG.Current.api.off('realtime', CG.Current.realtimeFunction);
            }

        } catch (error) { console.log(error); }
    }


    async realtimeFunction(event, data) {
        if (!CG.isReady && CG._defer) CG._defer.resolve();

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
    async getAppApi(onlyApi) {
        try {
            if (!this.api) this.api = this.homey.api.getApiApp('nl.fellownet.chronograph');
        } catch (error) {
            throw new Error(error);
        }
        if (onlyApi === true) return this.api;
        if (!this.api) throw new Error('Chronograph is not installed.');
        else {
            try {
                BL._isLoaded = await this.api.getInstalled();
            } catch (error) { }
            if (!BL._isLoaded) throw new Error('Chronograph is not installed.');
        }
        return this.api;
    }


    static async getAllChronographs() {
        if (CG && CG.Current && CG.Current.api) return await CG.Current.api.get('/allchronographs')
    }

    static async getChronographs() {
        if (CG && CG.Current && CG.Current.api) return await CG.Current.api.get('/chronographs')
    }




    /**
     * @description Setable member, when set, will be activated on any variable update.
     * @param {Object} param0.variable 
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