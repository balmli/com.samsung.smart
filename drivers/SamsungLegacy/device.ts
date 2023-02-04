import {BaseDevice} from "../../lib/BaseDevice";
import {SamsungLegacyClientImpl} from "./SamsungLegacyClient";

module.exports = class SamsungLegacyDevice extends BaseDevice {

    async onInit() {
        await this.initDevice('Samsung Legacy');

        await this.migrate();
        await this.registerCapListeners();

        this.samsungClient = new SamsungLegacyClientImpl({
            device: this,
            config: this.config,
            port: 55000,
            homeyIpUtil: this.homeyIpUtil,
            logger: this.logger
        });

        this.schedulePowerStatePolling(1);
        this.logger.verbose(`Device initialized`, this.getData());
    }

    async onSettings({oldSettings, newSettings, changedKeys}: {
        oldSettings: object;
        newSettings: object;
        changedKeys: string[];
    }): Promise<string | void> {
        if (changedKeys.includes('ipaddress')) {
            // @ts-ignore
            this.checkIPAddress(newSettings.ipaddress);
            // @ts-ignore
            this.updateMacAddress(newSettings.ipaddress);
        }
        if (changedKeys.includes('poll_interval')) {
            // @ts-ignore
            this.addPollDevice(newSettings.poll_interval);
        }
    }

    pollMethods(timeout: any): any[] {
        return [
            {id: 'ping', method: this.samsungClient.pingPort(undefined, undefined, timeout)},
            {id: 'upnp', method: this.upnpClient ? this.upnpClient.apiActive(timeout) : undefined}
        ];
    }

    async onDeviceOnline() {
        await this.fetchState();
    }

};
