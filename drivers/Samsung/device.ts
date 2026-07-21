import {DeviceSettings} from '../../lib/types';
import {BaseDevice} from '../../lib/BaseDevice';
import {SmartThingsClientImpl} from '../../lib/SmartThings';
import {SamsungClientImpl} from './SamsungClient';
import {SamsungOperations} from './SamsungOperations';

module.exports = class SamsungDevice extends BaseDevice {
    pairRetries: number = 3;
    lastAppsRefreshTs: number = 0;
    private onlineRefreshPromise?: Promise<void>;
    operations!: SamsungOperations;

    async onInit(): Promise<void> {
        this.deleted = false;
        this.finishPowerTransition();
        await super.initDevice('Samsung');

        await this.initSettings();
        await this.migrate();
        this.samsungClient = new SamsungClientImpl({
            device: this,
            config: this.config,
            port: 8001,
            homeyIpUtil: this.homeyIpUtil,
            logger: this.logger,
        });
        this.smartThingsClient = new SmartThingsClientImpl({
            device: this,
            config: this.config,
            logger: this.logger,
        });
        this.operations = new SamsungOperations(this.samsungClient as SamsungClientImpl, this.upnpClient);

        await this.registerCapListeners();

        this.schedulePowerStatePolling(1);
        await this.initSmartThings();
        this.logger.verbose(`Device initialized`, this.getData());
    }

    async initSettings() {
        const settings = this.getSettings();
        if (settings.tokenAuthSupport === undefined || settings.tokenAuthSupport === null) {
            await this.config
                .setSetting(DeviceSettings.tokenAuthSupport, false)
                .catch((err: any) => this.logger.error(err));
        }
    }

    async setPowerState(powerState: boolean): Promise<void> {
        try {
            await this.setCapabilityValue('onoff', powerState).catch((err: any) => this.logger.error(err));
            this.logger.info('setPowerState', powerState);
        } catch (err) {
            this.logger.info('setPowerState ERROR', err);
        }
    }

    async registerCapListeners() {
        this.registerCapabilityListener('onoff', async value => this.turnOnOff(value));
        this.registerCapabilityListener('volume_set', async value =>
            this.operations.setVolume(Math.round(value * this.getSetting(DeviceSettings.max_volume))),
        );
        this.registerCapabilityListener('volume_mute', async () => this.operations.toggleMute());
        this.registerCapabilityListener('volume_up', async () => this.operations.volumeUp());
        this.registerCapabilityListener('volume_down', async () => this.operations.volumeDown());
        this.registerCapabilityListener('channel_up', async () => this.operations.channelUp());
        this.registerCapabilityListener('channel_down', async () => this.operations.channelDown());
    }

    async turnOnOff(onOff: boolean): Promise<void> {
        if (this.turning_onoff_process !== undefined) {
            throw new Error(
                this.homey.__(
                    this.turning_onoff_process ? 'errors.onoff.on_in_progress' : 'errors.onoff.off_in_progress',
                ),
            );
        }

        if (!onOff && !this.getSetting(DeviceSettings.frameTVSupport) && this.getCapabilityValue('onoff') === false) {
            this.logger.info('turnOnOff: TV is already off');
            return;
        }

        try {
            this.turning_onoff_process = onOff;
            this.scheduleOnOffPolling();
            this.scheduleOnOffTimeout();

            if (onOff) {
                this.wakeRetries = 5;
            }
            const operations = this.operations || this.samsungClient;
            const command = onOff ? operations.wake() : operations.turnOff();
            this.logger.info('turnOnOff: in progress: ' + (onOff ? 'on' : 'off'));
            await command;
        } catch (err) {
            this.finishPowerTransition();
            this.logger.info('turnOnOff: failed: ', err);
            throw err;
        }
    }

    async doOnOffPollDevice() {
        if (this.deleted || this.turning_onoff_process === undefined) {
            return;
        }

        try {
            const onOff = await this.isDeviceOnline(500);
            if (this.turning_onoff_process === onOff) {
                this.logger.info('doOnOffPollDevice: finished');
                this.finishPowerTransition();
                return;
            }
            if (this.turning_onoff_process && !onOff && this.wakeRetries > 0) {
                this.wakeRetries--;
                await (this.operations || this.samsungClient).wake();
            }
        } catch (err) {
            this.logger.info(err);
        } finally {
            if (!this.deleted && this.turning_onoff_process !== undefined) {
                this.scheduleOnOffPolling();
            }
        }
    }

    onOnOffTimeout() {
        if (this.turning_onoff_process === undefined) {
            this.clearOnOffTimeout();
            return;
        }

        this.logger.info('turnOnOff: transition timed out');
        this.finishPowerTransition();
    }

    onDeleted() {
        this.finishPowerTransition();
        super.onDeleted();
    }

    private finishPowerTransition() {
        this.turning_onoff_process = undefined;
        this.wakeRetries = 0;
        this.clearOnOffPolling();
        this.clearOnOffTimeout();
    }

    async onSettings({
        oldSettings,
        newSettings,
        changedKeys,
    }: {
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
                    await this.config
                        .setSetting(DeviceSettings.token, undefined)
                        .catch((err: any) => this.logger.error(err));
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
        if (this.onlineRefreshPromise) {
            return;
        }

        const refreshPromise = this.refreshOnlineState()
            .catch(err => this.logger.info('onDeviceOnline ERROR', err))
            .finally(() => {
                if (this.onlineRefreshPromise === refreshPromise) {
                    this.onlineRefreshPromise = undefined;
                }
            });
        this.onlineRefreshPromise = refreshPromise;
    }

    private async refreshOnlineState() {
        await this.shouldFetchPowerState();
        await this.shouldFetchModelName();
        await this.pairDevice();
        await this.shouldRefreshAppList();
        await this.fetchState();
    }

    async pairDevice(delay = 5000) {
        // Skip is token is not required, or already paired, or no more pair retries
        if (
            !this.getSetting(DeviceSettings.tokenAuthSupport) ||
            this.getSetting(DeviceSettings.token) ||
            this.pairRetries <= 0
        ) {
            return;
        }

        await this._delay(delay);

        this.logger.info(`Pairing started, retry #${this.pairRetries}`);
        try {
            const token = await this.samsungClient.pair();
            await this.config.setSetting(DeviceSettings.token, token).catch((err: any) => this.logger.error(err));
            this.logger.info('Pairing: received a new token');
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
        if (now - this.lastAppsRefreshTs > 300000) {
            await this.refreshAppList();
        }
    }

    private async refreshAppList() {
        try {
            await this.samsungClient.getListOfApps();
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
