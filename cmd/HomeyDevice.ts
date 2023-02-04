import {HomeyDevice} from "../lib/types";

export class HomeyMock {
    "__" = (key: string) => key;

    setTimeout = (callback: Function, ms: number, ...args: any[]): NodeJS.Timeout => {
        // @ts-ignore
        return setTimeout(callback, ms);
    };

    clearTimeout = (timeoutId: NodeJS.Timeout) => {
        clearTimeout(timeoutId);
    }

}

export class HomeyDeviceMock implements HomeyDevice {

    logger: any;

    // @ts-ignore
    homey: HomeyMock = new HomeyMock();

    storage: Map<string, any> = new Map();

    constructor({logger}: {
        logger: any
    }) {
        this.logger = logger;
    }

    getSetting(key: string): any {
        return this.storage.get(key);
    }

    async setSettings(settings: any): Promise<void> {
        for (const key in Object.keys(settings)) {
            const value = settings[key];
            this.storage.set(key, value);
        }
    }
}
