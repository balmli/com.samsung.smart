'use strict';

const Logger = require('./Logger');
const Homey = require('homey');
const {ManagerArp} = Homey;
const keycodes = require('./keys');

module.exports = class BaseDevice extends Homey.Device {

    async onInit(deviceType) {
        this.logger = new Logger({
            logFunc: this.log,
            errorFunc: this.error,
        }, Homey.env);
        this.logger.setTags({ deviceType });
        const modelName = this.getSetting('modelName');
        if (modelName) {
            this.logger.setTags({ modelName });
        }

        this._samsung = undefined;
        this._is_powering_onoff = undefined;
        this._pollOnOffInterval = undefined;
        this._onOffTimeout = undefined;

        await this.registerCapListeners();
        this.addPollDevice();
        this.logger.verbose(`${deviceType} device initialized`, this.getData());
    }

    async onAdded() {
        this.logger.info(`device added: ${this.getData().id}`);
        let settings = await this.getSettings();
        if (settings.ipaddress) {
            await this.updateMacAddress(settings.ipaddress);
        } else {
            this.setUnavailable('IP address needs to be set.');
        }
    }

    onDeleted() {
        clearInterval(this._pollDeviceInterval);
        this.clearOnOffPolling();
        this.clearOnOffTimeout();
        this.logger.verbose('device deleted');
    }

    onSettings(oldSettingsObj, newSettingsObj, changedKeysArr, callback) {
        throw new Error('unimplemented');
    }

    async updateIPAddress(ipaddress) {
        this._samsung.config()["ip_address"] = ipaddress;
        this.logger.info(`Updated IP address: ${ipaddress}`);
        this.checkIPAddress(ipaddress);
        this.updateMacAddress(ipaddress);
    }

    async checkIPAddress(ipaddress) {
        throw new Error('unimplemented');
    }

    async updateMacAddress(ipaddress) {
        ManagerArp.getMAC(ipaddress)
            .then(mac => {
                if (mac.indexOf(':') >= 0) {
                    this.logger.info(`Found MAC address for IP address: ${ipaddress} -> ${mac}`);
                    if (this._samsung) {
                        this._samsung.config()["mac_address"] = mac;
                    }
                    this.setSettings({"mac_address": mac});
                    return true;
                } else {
                    this.logger.info('Invalid MAC address for IP address', ipaddress, mac);
                    return false;
                }
            })
            .catch(err => {
                this.logger.info(`Unable to find MAC address for IP address: ${ipaddress}`);
                return false;
            });
    }

    addPollDevice(polling_interval) {
        if (this._pollDeviceInterval) {
            clearInterval(this._pollDeviceInterval);
        }
        const settings = this.getSettings();
        const pollInterval = polling_interval || (settings.poll_interval || 10);
        if (pollInterval >= 10) {
            this._pollDeviceInterval = setInterval(this.pollDevice.bind(this), pollInterval * 1000);
        }
    }

    async pollDevice() {
        throw new Error('unimplemented');
    }

    async registerCapListeners() {
        this.registerCapabilityListener('onoff', async (value, opts) => {
            return this.turnOnOff(value);
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

    async turnOnOff(onOff) {
        if (this._is_powering_onoff !== undefined) {
            throw new Error(Homey.__(this._is_powering_onoff ? 'errors.onoff.on_in_progress' : 'errors.onoff.off_in_progress'));
        }

        let isOnOff = await this._samsung.apiActive(500);
        if (onOff === isOnOff) {
            throw new Error(Homey.__(onOff ? 'errors.onoff.on_already' : 'errors.onoff.off_already'));
        }

        this._is_powering_onoff = onOff;
        this.setCapabilityValue('onoff', onOff).catch(err => this.logger.error('Error setting onoff capability', err));
        this.addOnOffPolling();
        this.addOnOffTimeout();
        let response = onOff ? await this._samsung.wake(this) : await this._samsung.turnOff(this);
        if (response) {
            this.logger.info('turnOnOff: finished: ' + (onOff ? 'on' : 'off'), response);
        }
        return response;
    }

    addOnOffPolling() {
        this.clearOnOffPolling();
        this._pollOnOffInterval = setInterval(this.onOffPollDevice.bind(this), 1000);
    }

    clearOnOffPolling() {
        if (this._pollOnOffInterval) {
            clearTimeout(this._pollOnOffInterval);
            this._pollOnOffInterval = undefined;
        }
    }

    async onOffPollDevice() {
        let onOff = await this._samsung.apiActive(500);
        if (this._is_powering_onoff === onOff) {
            // Finished on / off process
            this._is_powering_onoff = undefined;
            this.clearOnOffPolling();
            this.clearOnOffTimeout();
            this.logger.info('onOffPollDevice: finished');
        }
    }

    addOnOffTimeout() {
        this.clearOnOffTimeout();
        this._onOffTimeout = setTimeout(this.onOffTimeout.bind(this), 30000);
    }

    clearOnOffTimeout() {
        if (this._onOffTimeout) {
            clearTimeout(this._onOffTimeout);
            this._onOffTimeout = undefined;
        }
    }

    onOffTimeout() {
        this._is_powering_onoff = undefined;
        this.clearOnOffPolling();
    }

    onKeyAutocomplete(query, args) {
        return Promise.resolve(keycodes.filter(result => {
            return result.name.toLowerCase().indexOf(query.toLowerCase()) > -1;
        }));
    }

    _delay(ms) {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    }

};
