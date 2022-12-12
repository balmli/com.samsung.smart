'use strict';

const Logger = require('./Logger');
const Homey = require('homey');
const keycodes = require('./keys');

module.exports = class BaseDevice extends Homey.Device {

    async onInit(deviceType) {
        this.logger = new Logger({
            homey: this.homey,
            logFunc: this.log,
            errorFunc: this.error,
        }, Homey.env);
        this.logger.setTags({ deviceType });
        const modelName = this.getSetting('modelName');
        if (modelName) {
            this.logger.setTags({ modelName });
        }

        this._samsung = undefined;
        this._upnpClient = undefined;
        this._is_powering_onoff = undefined;
        this._pollOnOffInterval = undefined;
        this._onOffTimeout = undefined;

    }

    async migrate() {
        try {
            const upnpAvailable = this.getStoreValue('upnp_available');
            this.logger.info(`Migration: upnp_available = ${upnpAvailable}`);
            if (upnpAvailable) {
                if (!this.hasCapability('volume_set')) {
                    await this.addCapability('volume_set');
                    this.logger.info('Migration: added volume_set');
                }
            } else {
                if (this.hasCapability('volume_set')) {
                    await this.removeCapability('volume_set');
                    this.logger.info('Migration: removed volume_set');
                }
            }
            const migVersion = this.getStoreValue('version');
            if (!migVersion || migVersion < 2) {
                if (this.getAvailable() === false) {
                    await this.setAvailable();
                }
            }
            await this.setStoreValue('version', 2);
        } catch (err) {
            this.logger.error('Migration failed', err);
        }
    }

    async onAdded() {
        this.logger.info(`device added: ${this.getData().id}`);
        let settings = this.getSettings();
        if (settings.ipaddress) {
            await this.updateMacAddress(settings.ipaddress);
        } else {
            await this.setUnavailable(this.homey.__('errors.unavailable.ip_address_missing')).catch(err => this.logger.error(err));
        }
    }

    onDeleted() {
        this.clearPollDevice();
        this.clearOnOffPolling();
        this.clearOnOffTimeout();
        this.logger.verbose('device deleted');
    }

    async onSettings({ oldSettings, newSettings, changedKeys }) {
        throw new Error('unimplemented');
    }

    async updateIPAddress(ipaddress) {
        this._samsung.config()["ip_address"] = ipaddress;
        if (this._upnpClient) {
            this._upnpClient.config()["ip_address"] = ipaddress;
        }
        this.logger.info(`Updated IP address: ${ipaddress}`);
        this.checkIPAddress(ipaddress);
        this.updateMacAddress(ipaddress);
    }

    async checkIPAddress(ipaddress) {
        this.logger.info('checkIPAddress', ipaddress);
        let info = await this._samsung.pingPort(ipaddress);
        if (info) {
            this.logger.info('TV set available');
            await this.setAvailable();
        } else {
            this.logger.info('TV set unavailable');
            await this.setUnavailable(this.homey.__('errors.unavailable.not_found')).catch(err => this.logger.error(err));
        }
    }

    async updateMacAddress(ipaddress) {
        try {
            const mac = await this.homey.arp.getMAC(ipaddress);
            if (mac.indexOf(':') >= 0) {
                this.logger.info(`Found MAC address for IP address: ${ipaddress} -> ${mac}`);
                if (this._samsung) {
                    this._samsung.config()["mac_address"] = mac;
                }
                await this.setSettings({ "mac_address": mac });
                return true;
            } else {
                this.logger.info('Invalid MAC address for IP address', ipaddress, mac);
            }
        } catch (err) {
            this.logger.info(`Unable to find MAC address for IP address: ${ipaddress}`);
        }
        return false;
    }

    async _onUPnPAvailable(event) {
        this.logger.info('UPnP is available');
        await this.setStoreValue('upnp_available', true);
        await this.migrate();
    }

    clearPollDevice() {
        if (this._pollDeviceInterval) {
            this.homey.clearInterval(this._pollDeviceInterval);
        }
    }

    addPollDevice(polling_interval) {
        this.clearPollDevice();
        const settings = this.getSettings();
        const pollInterval = polling_interval || (settings.poll_interval || 10);
        if (pollInterval >= 10) {
            this._pollDeviceInterval = this.homey.setInterval(this.pollDevice.bind(this), pollInterval * 1000);
        }
    }

    isSmartThingsEnabled() {
        return false;
    }

    pollMethods(timeout) {
        if (this.getSetting('power_state')) {
            return [
                { id: 'apiActive', method: this._samsung.apiActive(timeout) }
            ];
        }
        return [
            { id: 'apiActive', method: this._samsung.apiActive(timeout) },
            { id: 'upnp', method: this._upnpClient ? this._upnpClient.apiActive(timeout) : undefined },
            { id: 'ping', method: this._samsung.pingPort(undefined, undefined, timeout) }
        ];
    }

    async isDeviceOnline(timeout) {
        const pollMethods = this.pollMethods(timeout).filter(pm => !!pm);
        const pollResults = await Promise.all(pollMethods.map(pm => pm.method));
        const onOff = pollResults.includes(true) ? true : pollResults.includes(false) ? false : undefined;
        this.logger.verbose('isDeviceOnline', pollMethods.map(pm => pm.id), pollResults, onOff);
        return onOff;
    }

    async pollDevice() {
        if (this._is_powering_onoff !== undefined) {
            return;
        }

        let onOff = this.getSetting('power_state_polling') === false ?
            this.getCapabilityValue('onoff') :
            await this.isDeviceOnline();

        if (onOff && this.getAvailable() === false) {
            await this.setAvailable();
        }
        if (onOff !== undefined && onOff !== this.getCapabilityValue('onoff')) {
            await this.setCapabilityValue('onoff', onOff).catch(err => this.logger.error(err));
        }
        if (onOff) {
            this.logger.verbose('pollDevice: TV is on');
            await this.onDeviceOnline();
        }
    }

    async onDeviceOnline() {
        throw new Error('unimplemented');
    }

    async registerCapListeners() {
        this.registerCapabilityListener('onoff', async (value, opts) => {
            return this.turnOnOff(value);
        });

        this.registerCapabilityListener('volume_set', async (value, opts) => {
            return this._upnpClient ? this._upnpClient.setVolume(Math.round(value * this.getSetting('max_volume'))) :
                Promise.resolve()
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
            throw new Error(this.homey.__(this._is_powering_onoff ? 'errors.onoff.on_in_progress' : 'errors.onoff.off_in_progress'));
        }

        try {
            this.addOnOffPolling();
            this.addOnOffTimeout();
            this._is_powering_onoff = onOff;
            if (onOff) {
                await this._samsung.wake(this);
            } else {
                await this._samsung.turnOff(this);
            }
            this.logger.info('turnOnOff: finished: ' + (onOff ? 'on' : 'off'));
        } catch (err) {
            this.logger.info('turnOnOff: failed: ', err);
            this.clearOnOffPolling();
            this.clearOnOffTimeout();
            throw err;
        }
    }

    async fetchState() {
        try {
            if (this._upnpClient) {
                await this._upnpClient.search();
                if (this.hasCapability('volume_set')) {
                    const volumeState = await this._upnpClient.getVolume();
                    if (volumeState !== undefined) {
                        const volume = Math.round(100 * volumeState / this.getSetting('max_volume')) / 100;
                        if (volume >= 0.0 && volume <= 1.0 && volume !== this.getCapabilityValue('volume_set')) {
                            await this.setCapabilityValue('volume_set', volume).catch(err => this.logger.error('Error setting volume_set capability', err));
                            this.logger.verbose('fetchState: volume updated: ', volume);
                        }
                    }
                }
                if (this.hasCapability('volume_mute')) {
                    const muted = await this._upnpClient.getMute();
                    if (muted !== undefined) {
                        if (muted !== this.getCapabilityValue('volume_mute')) {
                            await this.setCapabilityValue('volume_mute', muted).catch(err => this.logger.error('Error setting volume_mute capability', err));
                            this.logger.verbose('fetchState: mute updated: ', muted);
                        }
                    }
                }
            }
        } catch (err) {

        }
    }

    addOnOffPolling() {
        this.clearOnOffPolling();
        this._pollOnOffInterval = this.homey.setInterval(this.onOffPollDevice.bind(this), 1000);
    }

    clearOnOffPolling() {
        if (this._pollOnOffInterval) {
            this.homey.clearInterval(this._pollOnOffInterval);
            this._pollOnOffInterval = undefined;
        }
        this._is_powering_onoff = undefined;
    }

    async onOffPollDevice() {
        let onOff = await this.isDeviceOnline(500);
        if (this._is_powering_onoff === onOff) {
            // Finished on / off process
            this.clearOnOffPolling();
            this.clearOnOffTimeout();
            this.logger.info('onOffPollDevice: finished');
        }
    }

    addOnOffTimeout() {
        this.clearOnOffTimeout();
        this._onOffTimeout = this.homey.setTimeout(this.onOffTimeout.bind(this), 30000);
    }

    clearOnOffTimeout() {
        if (this._onOffTimeout) {
            this.homey.clearTimeout(this._onOffTimeout);
            this._onOffTimeout = undefined;
        }
        this._is_powering_onoff = undefined;
    }

    onOffTimeout() {
        this._is_powering_onoff = undefined;
        this.clearOnOffPolling();
    }

    onAppAutocomplete(query, args) {
        let apps = this._samsung.getApps();
        return Promise.resolve((apps === undefined ? [] : apps).map(app => {
            return {
                name: app.name,
                appId: app.appId,
                dialId: app.dialId
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

    _delay(ms) {
        return new Promise(resolve => {
            this.homey.setTimeout(resolve, ms);
        });
    }

};
