export class CG {
    static init({ homey }?: {
        homey: any;
    }): Promise<CG>;
    static destroy(): void;
    static getAllChronographs(): Promise<any>;
    static getChronographs(): Promise<any>;
    /**
     * @description Setable member, when set, will be activated on any variable update.
     * @param {Object} param0.variable
     */
    static onChronographUpdate({ chronograph }: any): Promise<void>;
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