'use strict';

const Homey = require('homey');
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
            identitySessionId: settings.identitySessionId || (identity ? identity.sessionId : undefined),
            identityAesKey: settings.identityAesKey || (identity ? identity.aesKey : undefined)
        });

        this.log('onInit config:',
            this._samsung.config()['ip_address'],
            this._samsung.config()['identitySessionId'],
            this._samsung.config()['identityAesKey']
        );
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

    registerFlowCards() {
        super.registerFlowCards();

        new Homey.FlowCardCondition('is_app_running')
            .register()
            .registerRunListener(args => args.device._samsung.isAppRunning(args.app_id.id))
            .getArgument('app_id')
            .registerAutocompleteListener((query, args) => args.device.onAppAutocomplete(query, args));

        new Homey.FlowCardAction('launch_app')
            .register()
            .registerRunListener(args => args.device._samsung.launchApp(args.app_id.id))
            .getArgument('app_id')
            .registerAutocompleteListener((query, args) => args.device.onAppAutocomplete(query, args));

        new Homey.FlowCardAction('youtube')
            .register()
            .registerRunListener(args => {
                if (!args.videoId || args.videoId.length !== 11) {
                    return Promise.reject('Invalid video id');
                }
                return args.device._samsung.launchYouTube(args.videoId);
            });
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
