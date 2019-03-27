'use strict';

const SamDevice = require('../../lib/SamDevice');
const SamsungEncrypted = require('../../lib/samsung_encrypted');

module.exports = class SamsungEncryptedDevice extends SamDevice {

    async onInit() {
        super.onInit('Samsung Encrypted');

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
            identitySessionId: settings.identitySessionId || (identity ? identity.sessionId : undefined),
            identityAesKey: settings.identityAesKey || (identity ? identity.aesKey : undefined)
        });

        console.log('config 1', this._samsung.config());
    }

    async onAdded() {
        this.log(`virtual device added: ${this.getData().id}`);

        let identity = this.getDriver().getIdentity();
        if (!identity || !identity.sessionId || !identity.aesKey) {
            this.log('TV set unavailable. Missing identity.');
            this.setUnavailable('Pairing failed.');

        } else {
            this.setSettings({
                identitySessionId: identity.sessionId,
                identityAesKey: identity.aesKey
            });

            let settings = await this.getSettings();
            if (settings.ipaddress) {
                await this.updateMacAddress(settings.ipaddress);
            } else {
                this.setUnavailable('IP address needs to be set.');
            }
        }

    }

    onSettings(oldSettingsObj, newSettingsObj, changedKeysArr, callback) {
        if (changedKeysArr.includes('delay_keys')) {
            this._samsung.config()["delay_keys"] = newSettingsObj.delay_keys;
        }
        if (changedKeysArr.includes('delay_channel_keys')) {
            this._samsung.config()["delay_channel_keys"] = newSettingsObj.delay_channel_keys;
        }
        callback(null, true);
    }

    async pollDevice() {
        if (this._is_powering_onoff !== undefined) {
            return;
        }
        let onOff = await this._samsung.apiActive();
        if (onOff && this.getAvailable() === false) {
            this.setAvailable();
        }
        if (onOff !== this.getCapabilityValue('onoff')) {
            this.setCapabilityValue('onoff', onOff).catch(console.error);
        }
        if (onOff) {
            this.log('pollDevice: TV is on');
        }
    }

};
