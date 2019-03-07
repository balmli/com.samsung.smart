'use strict';

const Homey = require('homey');
const SamDevice = require('../../lib/SamDevice');
const Samsung = require('../../lib/samsung');

module.exports = class SamsungDevice extends SamDevice {

    async onInit() {
        super.onInit('Samsung');

        let settings = await this.getSettings();
        this._samsung = new Samsung({
            name: "homey",
            ip_address: settings.ipaddress,
            mac_address: settings.mac_address,
            api_timeout: 2000
        });

        this._apps = [];
        this._lastAppsRefresh = undefined;
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
            if (onOff) {
                this._turnedOnTrigger.trigger(this);
            } else {
                this._turnedOffTrigger.trigger(this);
            }
        }
        if (onOff) {
            this.log('pollDevice: TV is on');
            this.shouldRefreshAppList();
        } else {
            this.log('pollDevice: TV is off');
        }
    }

    async refreshAppList() {
        let apps = await this._samsung.getListOfApps(this).catch(err => this.log('refreshAppList ERROR', err));
        if (apps && apps.length > 0) {
            this._apps = apps
        }
        this._lastAppsRefresh = new Date().getTime();
        this.log(`refreshAppList: has ${this._apps.length} apps`);
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
                return args.device._samsung.launchBrowser(args.url, args.device);
            });
    }

    onAppAutocomplete(query, args) {
        return Promise.resolve((this._apps === undefined ? [] : this._apps).map(app => {
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
