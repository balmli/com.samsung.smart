'use strict';

const Homey = require('homey');
const BaseDevice = require('../../lib/BaseDevice');
const UPnPClient = require('../../lib/UPnPClient');
const SamsungEncrypted = require('./SamsungEncrypted');

module.exports = class SamsungEncryptedDevice extends BaseDevice {

    async onInit() {
        await super.onInit('Samsung Encrypted');

        let identity = this.getDriver().getIdentity();

        let settings = await this.getSettings();
        this._samsung = new SamsungEncrypted({
            device: this,
            name: "homey",
            ip_address: settings.ipaddress,
            mac_address: settings.mac_address,
            port: 8001,
            api_timeout: 2000,
            delay_keys: settings.delay_keys || 100,
            delay_channel_keys: settings.delay_channel_keys || 1250,
            duid: settings.duid,
            modelName: settings.modelName,
            modelClass: settings.modelClass,
            identitySessionId: settings.identitySessionId || (identity ? identity.sessionId : undefined),
            identityAesKey: settings.identityAesKey || (identity ? identity.aesKey : undefined),
            logger: this.logger
        });

        this._upnpClient = new UPnPClient({
            ip_address: settings.ipaddress,
            logger: this.logger
        });
        this._upnpClient.on('available', this._onUPnPAvailable.bind(this));

        this.logger.verbose('onInit config:',
            this._samsung.config()['ip_address'],
            this._samsung.config()['identitySessionId'],
            this._samsung.config()['identityAesKey']
        );
    }

    async onAdded() {
        this.logger.info(`device added: ${this.getData().id}`);

        let identity = this.getDriver().getIdentity();
        if (!identity || !identity.sessionId || !identity.aesKey) {
            this.logger.info('TV set unavailable. Missing identity.');
            this.setUnavailable(Homey.__('errors.unavailable.pairing_failed'));

        } else {
            this.setSettings({
                identitySessionId: identity.sessionId,
                identityAesKey: identity.aesKey
            });

            let settings = await this.getSettings();
            if (settings.ipaddress) {
                await this.updateMacAddress(settings.ipaddress);
            } else {
                this.setUnavailable(Homey.__('errors.unavailable.ip_address_missing'));
            }
        }

    }

    onSettings(oldSettingsObj, newSettingsObj, changedKeysArr, callback) {
        if (changedKeysArr.includes('poll_interval')) {
            this.addPollDevice(newSettingsObj.poll_interval);
        }
        if (changedKeysArr.includes('delay_keys')) {
            this._samsung.config()["delay_keys"] = newSettingsObj.delay_keys;
        }
        if (changedKeysArr.includes('delay_channel_keys')) {
            this._samsung.config()["delay_channel_keys"] = newSettingsObj.delay_channel_keys;
        }
        callback(null, true);
    }

    async onDeviceOnline() {
        await this.shouldFetchModelName();
        await this.fetchState();
    }

    async shouldFetchModelName() {
        if (!this.getSetting('modelName')) {
            let modelName = 'unknown';
            try {
                const info = await this._samsung.getInfo();
                this.logger.verbose('shouldFetchModelName', info);
                if (info) {
                    modelName = info.ModelName;
                }
            } catch (err) {
                this.logger.info('Fetching modelName failed', err);
            } finally {
                await this.setSettings({ modelName: modelName });
                this.logger.setTags({ modelName });
                this.logger.info(`Modelname set to: ${modelName}`);
            }
        }
    }

    onAppAutocomplete(query, args) {
        let apps = this._samsung.getApps();
        return Promise.resolve((apps === undefined ? [] : apps).map(app => {
            return {
                id: app.appId,
                name: app.name
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
