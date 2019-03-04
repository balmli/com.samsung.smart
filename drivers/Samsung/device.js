'use strict';

const Homey = require('homey');
const {ManagerArp} = Homey;
const Samsung = require('../../lib/samsung');
const keycodes = require('../../lib/keys');

module.exports = class SamsungDevice extends Homey.Device {

    async onInit() {
        super.onInit();

        let settings = await this.getSettings();
        this._samsung = new Samsung({
            name: "homey",
            ip_address: settings.ipaddress,
            mac_address: settings.mac_address,
            api_timeout: 2000
        });
        this._is_powering_on = false;
        this._is_powering_off = false;
        this._onOffTimeout = undefined;
        this._apps = undefined;
        this._lastAppsRefresh = undefined;

        this.registerFlowCards();
        this._pollDeviceInterval = setInterval(this.pollDevice.bind(this), 10000);
        this.pollDevice();
        this.log('virtual device initialized', this.getData());
    }

    async onAdded() {
        this.log(`virtual device added: ${this.getData().id}`);
        let settings = await this.getSettings();
        if (settings.ipaddress) {
            await this.updateMacAddress(settings.ipaddress);
        } else {
            this.setUnavailable('IP address needs to be set.');
        }
    }

    onDeleted() {
        clearInterval(this._pollDeviceInterval);
        this.log('virtual device deleted');
    }

    onSettings(oldSettingsObj, newSettingsObj, changedKeysArr, callback) {
        if (changedKeysArr.includes('ipaddress')) {
            this.updateIPAddress(newSettingsObj.ipaddress);
        }
        callback(null, true);
    }

    async updateIPAddress(ipaddress) {
        this._samsung.config()["ip_address"] = ipaddress;
        this.log(`Updated IP address: ${ipaddress}`);
        this.checkIPAddress(ipaddress);
        this.updateMacAddress(ipaddress);
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
            this._lastAppsRefresh = undefined; // Force app list refresh
        }
    }

    async updateMacAddress(ipaddress) {
        ManagerArp.getMAC(ipaddress)
            .then(mac => {
                if (mac.indexOf(':') >= 0) {
                    this.log(`Found MAC address for IP address: ${ipaddress} -> ${mac}`);
                    if (this._samsung) {
                        this._samsung.config()["mac_address"] = mac;
                    }
                    this.setSettings({"mac_address": mac});
                    return true;
                } else {
                    console.log('Invalid MAC address for IP address', ipaddress, mac);
                    return false;
                }
            })
            .catch(err => {
                this.log(`Unable to find MAC address for IP address: ${ipaddress}`);
                return false;
            });
    }

    async pollDevice() {
        if (this._is_powering_on || this._is_powering_off) {
            return;
        }
        let onOff = await this._samsung.apiActive();
        if (onOff && this.getAvailable() === false) {
            this.setAvailable();
        }

        let settings = await this.getSettings();
        if (onOff !== settings["power"]) {
            this.setCapabilityValue('onoff', onOff).catch(console.error);
            this.handleOnOff(onOff);
        }
        if (onOff !== this.getCapabilityValue('onoff')) {
            this.setCapabilityValue('onoff', onOff).catch(console.error);
        }
        if (onOff) {
            this.log('pollDevice: TV is on');
            this.shouldRefreshAppList();
        }
    }

    handleOnOff(onoff) {
        if (onoff) {
            this.setSettings({"power": true});
            this._turnedOnTrigger.trigger(this, null, null);
        } else {
            this.setSettings({"power": false});
            this._turnedOffTrigger.trigger(this, null, null);
        }
    }

    async refreshAppList() {
        this._apps = await this._samsung.getListOfApps().catch(err => this.log('refreshAppList ERROR', err));
        if (!this._apps || !Array.isArray(this._apps)) {
            this._apps = [];
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
        this._turnedOnTrigger = new Homey.FlowCardTriggerDevice('onoff_true');
        this._turnedOnTrigger.register();

        this._turnedOffTrigger = new Homey.FlowCardTriggerDevice('onoff_false');
        this._turnedOffTrigger.register();

        new Homey.FlowCardCondition('on')
            .register()
            .registerRunListener((args, state) => {
                return args.device._samsung.apiActive();
            });

        new Homey.FlowCardCondition('is_app_running')
            .register()
            .registerRunListener((args, state) => {
                return args.device._samsung.isAppRunning(args.app_id.id);
            })
            .getArgument('app_id')
            .registerAutocompleteListener((query, args) => args.device.onAppAutocomplete(query, args));

        new Homey.FlowCardAction('on')
            .register()
            .registerRunListener((args, state) => {
                if (args.device._is_powering_on || args.device._is_powering_off) {
                    return;
                }
                args.device._is_powering_on = true;
                args.device.addOnOffTimeout();
                return args.device._samsung.turnOn();
            });

        new Homey.FlowCardAction('off')
            .register()
            .registerRunListener((args, state) => {
                if (args.device._is_powering_on || args.device._is_powering_off) {
                    return;
                }
                args.device._is_powering_off = true;
                args.device.addOnOffTimeout();
                return args.device._samsung.turnOff();
            });

        new Homey.FlowCardAction('send_key')
            .register()
            .registerRunListener((args, state) => {
                return args.device._samsung.sendKey(args.key.id);
            })
            .getArgument('key')
            .registerAutocompleteListener((query, args) => args.device.onKeyAutocomplete(query, args));

        new Homey.FlowCardAction('launch_app')
            .register()
            .registerRunListener((args, state) => {
                return args.device._samsung.launchApp(args.app_id.id);
            })
            .getArgument('app_id')
            .registerAutocompleteListener((query, args) => args.device.onAppAutocomplete(query, args));

        new Homey.FlowCardAction('youtube')
            .register()
            .registerRunListener((args, state) => {
                if (!args.videoId || args.videoId.length !== 11) {
                    return Promise.reject('Invalid video id');
                }
                return args.device._samsung.launchYouTube(args.videoId);
            });

        new Homey.FlowCardAction('browse')
            .register()
            .registerRunListener((args, state) => {
                if (!args.url || args.url.length === 0) {
                    return Promise.reject('Invalid URL');
                }
                return args.device._samsung.launchBrowser(args.url);
            });

        this.registerCapabilityListener('onoff', async (value, opts) => {
            this.handleOnOff(value);
            this._is_powering_on = value;
            this._is_powering_off = !value;
            this.addOnOffTimeout();
            return value ? this._samsung.turnOn() : this._samsung.turnOff();
        });

        this.registerCapabilityListener('volume_mute', async (value, opts) => {
            return this._samsung.sendKey('KEY_MUTE');
        });

        this.registerCapabilityListener('volume_up', async (value, opts) => {
            return this._samsung.sendKey('KEY_VOLUP');
        });

        this.registerCapabilityListener('volume_down', async (value, opts) => {
            return this._samsung.sendKey('KEY_VOLDOWN');
        });

        this.registerCapabilityListener('channel_up', async (value, opts) => {
            return this._samsung.sendKey('KEY_CHUP');
        });

        this.registerCapabilityListener('channel_down', async (value, opts) => {
            return this._samsung.sendKey('KEY_CHDOWN');
        });
    }

    addOnOffTimeout() {
        this.clearOnOffTimeout();
        let self = this;
        this._onOffTimeout = setTimeout(function () {
            self._is_powering_on = false;
            self._is_powering_off = false;
        }, 15000);
    }

    clearOnOffTimeout() {
        if (this._onOffTimeout) {
            clearTimeout(this._onOffTimeout);
            this._onOffTimeout = undefined;
        }
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

    onKeyAutocomplete(query, args) {
        return Promise.resolve(keycodes.filter(result => {
            return result.name.toLowerCase().indexOf(query.toLowerCase()) > -1;
        }));
    }

};
