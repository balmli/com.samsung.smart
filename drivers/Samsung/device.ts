import {DeviceSettings} from "../../lib/types";
import {BaseDevice} from "../../lib/BaseDevice";
import {SmartThingsClientImpl} from "../../lib/SmartThings";
import {SamsungClientImpl} from "./SamsungClient";

module.exports = class SamsungDevice extends BaseDevice {

    pairRetries: number = 3;
    lastAppsRefreshTs: number = 0;

    async onInit(): Promise<void> {
        await super.initDevice('Samsung');

        await this.initSettings();
        await this.migrate();
        await this.registerCapListeners();

        this.samsungClient = new SamsungClientImpl({
            device: this,
            config: this.config,
            port: 8001,
            homeyIpUtil: this.homeyIpUtil,
            logger: this.logger
        });
        this.smartThingsClient = new SmartThingsClientImpl({
            device: this,
            config: this.config,
            logger: this.logger
        });

        this.schedulePowerStatePolling(1);
        await this.initSmartThings();
        this.logger.verbose(`Device initialized`, this.getData());
    }

    async initSettings() {
        const settings = this.getSettings();
        if (settings.tokenAuthSupport === undefined || settings.tokenAuthSupport === null) {
            await this.config.setSetting(DeviceSettings.tokenAuthSupport, false).catch((err: any) => this.logger.error(err));
        }
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
            this.forceRefreshAppList();
        }
        if (changedKeys.includes('poll_interval')) {
            // @ts-ignore
            this.schedulePowerStatePolling(newSettings.poll_interval);
        }
        if (changedKeys.includes('tokenAuthSupport')) {
            // @ts-ignore
            if (newSettings.tokenAuthSupport) {
                // Will pair if tokenAuthSupport is set to TRUE
                this.pairRetries = 3;
            } else {
                // Clear token
                this.homey.setTimeout(async () => {
                    await this.config.setSetting(DeviceSettings.token, undefined).catch((err: any) => this.logger.error(err));
                }, 1000);
            }
        }
        if (changedKeys.includes('smartthings') || changedKeys.includes('smartthings_token')) {
            this.homey.setTimeout(() => {
                this.initSmartThings();
            }, 1000);
        }
    }

    async onDeviceOnline() {
        await this.shouldFetchPowerState();
        await this.shouldFetchModelName();
        await this.pairDevice();
        await this.shouldRefreshAppList();
        await this.fetchState();
    }

    async pairDevice(delay = 5000) {
        // Skip is token is not required, or already paired, or no more pair retries
        if (!this.getSetting(DeviceSettings.tokenAuthSupport) ||
            this.getSetting(DeviceSettings.token) ||
            this.pairRetries <= 0) {
            return;
        }

        await this._delay(delay);

        this.logger.info(`Pairing started, retry #${this.pairRetries}`);
        try {
            const token = await this.samsungClient.pair();
            await this.config.setSetting(DeviceSettings.token, token).catch((err: any) => this.logger.error(err));
            this.logger.info(`Pairing: got a new token: ${token}`);
        } catch (err) {
            this.pairRetries--;
            if (this.pairRetries > 0) {
                this.pairDevice(1000);
            } else {
                this.logger.info('Pairing failed');
            }
        }
    }

    private forceRefreshAppList() {
        this.lastAppsRefreshTs = 0;
    }

    private async shouldRefreshAppList() {
        const now = new Date().getTime();
        if ((now - this.lastAppsRefreshTs) > 300000) {
            await this.refreshAppList();
        }
    }

    private async refreshAppList() {
        try {
            await this.samsungClient.getListOfApps()
            this.lastAppsRefreshTs = Date.now();
        } catch (err) {
            this.logger.info('refreshAppList ERROR', err);
        }
    }

    // SmartThings

    isSmartThingsEnabled() {
        const settings = this.getSettings();
        return settings.smartthings && settings.smartthings_token && settings.smartthings_token.length > 0;
    }

};
