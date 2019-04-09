'use strict';

const Homey = require('homey');
const SamDevice = require('../../lib/SamDevice');
const Samsung = require('../../lib/samsung');

module.exports = class SamsungDevice extends SamDevice {

    async onInit() {
        super.onInit('Samsung');

        let settings = await this.getSettings();
        if (settings.tokenAuthSupport === undefined || settings.tokenAuthSupport === null) {
            this.setSettings({"tokenAuthSupport": false});
            settings.tokenAuthSupport = false;
        }
        this._samsung = new Samsung({
            device: this,
            name: "homey",
            ip_address: settings.ipaddress,
            mac_address: settings.mac_address,
            port: 8001,
            api_timeout: 2000,
            delay_keys: settings.delay_keys || 100,
            delay_channel_keys: settings.delay_channel_keys || 1250,
            tokenAuthSupport: settings.tokenAuthSupport,
            frameTVSupport: settings.frameTVSupport,
            token: settings.token
        });

        this._pairRetries = 3;
        this._lastAppsRefresh = undefined;
        this.pairDevice();
    }

    onSettings(oldSettingsObj, newSettingsObj, changedKeysArr, callback) {
        if (changedKeysArr.includes('ipaddress')) {
            this.updateIPAddress(newSettingsObj.ipaddress);
            this._lastAppsRefresh = undefined; // Force app list refresh
        }
        if (changedKeysArr.includes('poll_interval')) {
            this.addPollDevice(newSettingsObj.poll_interval);
        }
        if (changedKeysArr.includes('delay_keys')) {
            this._samsung.config()["delay_keys"] = newSettingsObj.delay_keys;
        }
        if (changedKeysArr.includes('delay_channel_keys')) {
            this._samsung.config()["delay_channel_keys"] = newSettingsObj.delay_channel_keys;
        }
        if (changedKeysArr.includes('tokenAuthSupport')) {
            this._samsung.config()["tokenAuthSupport"] = newSettingsObj.tokenAuthSupport;
            if (newSettingsObj.tokenAuthSupport) {
                // Will pair if tokenAuthSupport is set to TRUE
                this._pairRetries = 3;
                this.pairDevice();
            } else {
                // Clear token
                this._samsung.config()["token"] = undefined;
                this.setSettings({"token": undefined});
            }
        }
        if (changedKeysArr.includes('frameTVSupport')) {
            this._samsung.config()["frameTVSupport"] = newSettingsObj.frameTVSupport;
        }
        callback(null, true);
    }

    async checkIPAddress(ipaddress) {
        let info = await this._samsung.getInfo(ipaddress)
            .catch(err => {
                this.log('TV set unavailable');
                this.setUnavailable('TV not found. Check IP address.');
            });
        if (info) {
            this.log('TV set available');
            this.setAvailable();
        }
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
            this.shouldRefreshAppList();
        }
    }

    async pairDevice(delay = 5000) {
        let config = this._samsung.config();
        if (config.tokenAuthSupport !== true || config.token) {
            return;
        }

        await this._delay(delay);

        this.log('Pairing started...');
        this._samsung.pair()
            .then(token => {
                this.log(`pairDevice: got a new token: ${self._config.token}`);
                this.setSettings({"token": token});
            })
            .catch(error => {
                if (this._pairRetries > 1) {
                    this.pairDevice(1000);
                    this._pairRetries--;
                } else {
                    this.log('pairDevice: failed', error);
                    this.setSettings({"tokenAuthSupport": false});
                    config.tokenAuthSupport = false;
                }
            });
    }

    async refreshAppList() {
        this._samsung.getListOfApps().catch(err => this.log('refreshAppList ERROR', err));
        this._lastAppsRefresh = new Date().getTime();
    }

    async shouldRefreshAppList() {
        let now = new Date().getTime();
        if (!this._lastAppsRefresh || (now - this._lastAppsRefresh) > 300000) {
            this.refreshAppList();
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

        new Homey.FlowCardAction('browse')
            .register()
            .registerRunListener(args => {
                if (!args.url || args.url.length === 0) {
                    return Promise.reject('Invalid URL');
                }
                return args.device._samsung.launchBrowser(args.url);
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
