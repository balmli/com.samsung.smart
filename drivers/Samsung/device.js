'use strict';

const BaseDevice = require('../../lib/BaseDevice');
const UPnPClient = require('../../lib/UPnPClient');
const Samsung = require('./Samsung');
const ip = require('ip');

module.exports = class SamsungDevice extends BaseDevice {

    async onInit() {
        await super.onInit('Samsung');

        let settings = this.getSettings();
        if (settings.tokenAuthSupport === undefined || settings.tokenAuthSupport === null) {
            await this.setSettings({"tokenAuthSupport": false}).catch(err => this.logger.error(err));
            settings.tokenAuthSupport = false;
        }

        await this.updateMacAddress(settings.ipaddress);
        settings = this.getSettings();

        this._samsung = new Samsung({
            device: this,
            homey: this.homey,
            name: "homey",
            ip_address: settings.ipaddress,
            mac_address: settings.mac_address,
            port: 8001,
            api_timeout: 2000,
            delay_keys: settings.delay_keys || 100,
            delay_channel_keys: settings.delay_channel_keys || 1250,
            ip_address_homey: ip.address(),
            tokenAuthSupport: settings.tokenAuthSupport,
            frameTVSupport: settings.frameTVSupport,
            token: settings.token,
            logger: this.logger
        });

        await this.migrate();
        await this.registerCapListeners();
        this.addPollDevice();

        this._upnpClient = new UPnPClient({
            ip_address: settings.ipaddress,
            logger: this.logger
        });
        this._upnpClient.on('available', this._onUPnPAvailable.bind(this));

        this._pairRetries = 3;
        this._lastAppsRefresh = undefined;
        await this.initSmartThings();

        this.logger.verbose(`Device initialized`, this.getData());
    }

    async onSettings({ oldSettings, newSettings, changedKeys }) {
        if (changedKeys.includes('ipaddress')) {
            this.updateIPAddress(newSettings.ipaddress);
            this._lastAppsRefresh = undefined; // Force app list refresh
        }
        if (changedKeys.includes('poll_interval')) {
            this.addPollDevice(newSettings.poll_interval);
        }
        if (changedKeys.includes('delay_keys')) {
            this._samsung.config()["delay_keys"] = newSettings.delay_keys;
        }
        if (changedKeys.includes('delay_channel_keys')) {
            this._samsung.config()["delay_channel_keys"] = newSettings.delay_channel_keys;
        }
        if (changedKeys.includes('tokenAuthSupport')) {
            this._samsung.config()["tokenAuthSupport"] = newSettings.tokenAuthSupport;
            if (newSettings.tokenAuthSupport) {
                // Will pair if tokenAuthSupport is set to TRUE
                this._pairRetries = 3;
            } else {
                // Clear token
                this._samsung.config()["token"] = undefined;
                this.homey.setTimeout(() => {
                    this.setSettings({ "token": undefined }).catch(err => this.logger.error(err));
                }, 1000);
            }
        }
        if (changedKeys.includes('frameTVSupport')) {
            this._samsung.config()["frameTVSupport"] = newSettings.frameTVSupport;
        }
        if (changedKeys.includes('smartthings') || changedKeys.includes('smartthings_token')) {
            this.initSmartThings();
        }
    }

    isSmartThingsEnabled() {
        let settings = this.getSettings();
        return settings.smartthings && settings.smartthings_token && settings.smartthings_token.length > 0;
    }

    async initSmartThings() {
        this.homey.setTimeout(async () => {
            this._samsung.clearStClient();
            const stEnabled = this.isSmartThingsEnabled();
            if (stEnabled) {
                try {
                    await this._samsung.getStInputSources();
                } catch (err) {
                    this.logger.info('Fetching ST input sources failed', err);
                }
            }
        }, 2000);
    }

    async onDeviceOnline() {
        await this.shouldFetchPowerState();
        await this.shouldFetchModelName();
        await this.pairDevice();
        await this.shouldRefreshAppList();
        await this.fetchState();
    }

    async shouldFetchPowerState() {
        if (this.getSetting('power_state') === null) {
            try {
                const info = await this._samsung.getInfo();
                const hasPowerState = !!(info.device && info.device.PowerState);
                await this.setSettings({ power_state: hasPowerState }).catch(err => this.logger.error(err));
                this.logger.info(`Has PowerState set to: ${hasPowerState}`);
            } catch (err) {
                this.logger.info('Fetching PowerState failed', err);
            }
        }
    }

    async shouldFetchModelName() {
        if (!this.getSetting('modelName')) {
            let modelName = 'unknown';
            try {
                const info = await this._samsung.getInfo();
                this.logger.verbose('shouldFetchModelName', info);
                if (info) {
                    modelName = info.device.modelName;
                }
            } catch (err) {
                this.logger.info('Fetching modelName failed', err);
            } finally {
                await this.setSettings({ modelName: modelName }).catch(err => this.logger.error(err));
                this.logger.setTags({ modelName });
                this.logger.info(`Modelname set to: ${modelName}`);
            }
        }
    }

    async pairDevice(delay = 5000) {
        let config = this._samsung.config();
        if (config.tokenAuthSupport !== true || config.token || this._pairRetries <= 0) {
            return;
        }

        await this._delay(delay);

        this.logger.info(`Pairing started, retry #${this._pairRetries}`);
        this._samsung.pair()
            .then(token => {
                this._samsung.config()["token"] = token;
                this.setSettings({"token": token}).catch(err => this.logger.error(err));
                this.logger.info(`Pairing: got a new token: ${token}`);
            })
            .catch(error => {
                this._pairRetries--;
                if (this._pairRetries > 0) {
                    this.pairDevice(1000);
                } else {
                    this.logger.info('Pairing failed');
                }
            });
    }

    async refreshAppList() {
        try {
            await this._samsung.getListOfApps()
            this._lastAppsRefresh = new Date().getTime();
        } catch (err) {
            this.logger.info('refreshAppList ERROR', err);
        }
    }

    async shouldRefreshAppList() {
        let now = new Date().getTime();
        if (!this._lastAppsRefresh || (now - this._lastAppsRefresh) > 300000) {
            await this.refreshAppList();
        }
    }

    async setPowerState(powerState) {
        try {
            const power_state_polling = false;
            await this.setSettings({ power_state_polling }).catch(err => this.logger.error(err));
            await this.setCapabilityValue('onoff', powerState).catch(err => this.logger.error(err));
            this.logger.info('setPowerState', powerState);
        } catch (err) {
            this.logger.info('setPowerState ERROR', err);
        }
    }

    async onInputSourceAutocomplete(query, args) {
        let inputSources = await this._samsung.getStInputSources();
        return Promise.resolve((inputSources === undefined ? [] : inputSources).map(is => {
            return {
                id: is,
                name: is
            };
        }).filter(result => {
            return result.name.toLowerCase().indexOf(query.toLowerCase()) > -1;
        }).sort((a, b) => {
            if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
            if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
            return 0;
        }));
    }

};
