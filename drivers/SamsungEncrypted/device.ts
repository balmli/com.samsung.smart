import {BaseDevice} from "../../lib/BaseDevice";
import {SamsungEncryptedClientImpl} from "./SamsungEncryptedClient";
import {DeviceSettings} from "../../lib/types";

module.exports = class SamsungEncryptedDevice extends BaseDevice {

    async onInit(): Promise<void> {
        await this.initDevice('Samsung Encrypted');

        // Check for necessary settings
        if (this.config.getSetting(DeviceSettings.duid) === null ||
            this.config.getSetting(DeviceSettings.identitySessionId) === null ||
            this.config.getSetting(DeviceSettings.identityAesKey) === null) {
            this.logger.error('Missing settings. The device needs to be re-paired.');
            this.setUnavailable(this.homey.__('errors.missing_settings'));
            return;
        }

        await this.migrate();
        await this.registerCapListeners();

        this.samsungClient = new SamsungEncryptedClientImpl({
            device: this,
            config: this.config,
            port: 8001,
            homeyIpUtil: this.homeyIpUtil,
            logger: this.logger
        });

        this.schedulePowerStatePolling(1);
        this.logger.verbose('onInit config:',
            this.config.getSetting(DeviceSettings.ipaddress),
            this.config.getSetting(DeviceSettings.identitySessionId),
            this.config.getSetting(DeviceSettings.identityAesKey)
        );
        this.logger.verbose(`Device initialized`, this.getData());
    }

    async onSettings({oldSettings, newSettings, changedKeys}: {
        oldSettings: object;
        newSettings: object;
        changedKeys: string[];
    }): Promise<string | void> {
        if (changedKeys.includes('poll_interval')) {
            // @ts-ignore
            this.addPollDevice(newSettings.poll_interval);
        }
    }

    async onDeviceOnline() {
        await this.shouldFetchModelName();
        await this.fetchState();
    }

};
