export class CG {
    static init({ homey }?: {
        homey: any;
    }): Promise<CG>;
    /**
     * Removes the realtime and unload listeners. Called automatically when Homey emits unload.
     */
    static destroy(): void;
    static getAllChronographs(): Promise<any>;
    static getChronographs(): Promise<any>;
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
    static onChronographUpdate({ chronograph }: {
        chronograph: {
            id?: string;
            name: string;
            duration: number;
            elapsed: number;
            targetDuration: number | null;
            remaining: number | null;
            running: boolean;
            removed: boolean;
            now: Date;
            data: {
                type?: 'Timer' | 'Stopwatch' | 'Transition';
                from?: number;
                to?: number;
                steps?: number;
            };
        };
    }): Promise<void>;
    constructor({ homey }: {
        homey: any;
    });
    homey: any;
    isReady: boolean;
    ready: any;
    init({}?: {}): Promise<CG>;
    api: any;
    realtimeFunction(event: any, data: any): Promise<void>;
    /** @private */
    private getAppApi;
}
//# sourceMappingURL=cg.d.ts.map