import {DeviceSettings, HomeyDevice} from "./types";

export interface SamsungConfig {
    getSetting(key: DeviceSettings): any;
    setSetting(key: DeviceSettings, value: any): any;
}

export class SamsungConfigImpl implements SamsungConfig {

    device?: HomeyDevice;
    logger: any;
    storage: Map<string, any> = new Map(); // when used in drivers

    constructor({device, logger}: {
        device?: HomeyDevice,
        logger: any
    }) {
        this.device = device;
        this.logger = logger;
    }

    getSetting(key: DeviceSettings): any {
        return this.device ? this.device.getSetting(key) : this.storage.get(key);
    }

    async setSetting(key: DeviceSettings, value: any): Promise<void> {
        // @ts-ignore
        return this.device ? this.device.setSettings({[key]: value}) : this.storage.set(key, value);
    }

}
