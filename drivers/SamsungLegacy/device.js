'use strict';

const Homey = require('homey');
const macaddress = require('macaddress');

const SamDevice = require('../../lib/SamDevice');
const SamsungLegacy = require('../../lib/samsung_legacy');
const ip = require('ip');

module.exports = class SamsungLegacyDevice extends SamDevice {

    async onInit() {
        super.onInit('Samsung Legacy');

        let settings = await this.getSettings();
        this._samsung = new SamsungLegacy({
            name: "homey",
            ip_address: settings.ipaddress,
            mac_address: settings.mac_address,
            api_timeout: 2000,
            ip_address_homey: ip.address(),
            appString: 'iphone..iapp.samsung',
            tvAppString: 'iphone.' + settings.tvAppString + '.iapp.samsung'
        });

        let self = this;
        macaddress.one(function (err, mac) {
            self._samsung.config()["mac_address_homey"] = mac;
            self.log(`Found MAC address for Homey -> ${mac}`, self._samsung.config());
        });
    }

    onSettings(oldSettingsObj, newSettingsObj, changedKeysArr, callback) {
        if (changedKeysArr.includes('ipaddress')) {
            this.updateIPAddress(newSettingsObj.ipaddress);
        }
        if (changedKeysArr.includes('tvAppString')) {
            this._samsung.config()["tvAppString"] = 'iphone.' + newSettingsObj.tvAppString + '.iapp.samsung';
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
            if (onOff) {
                this._turnedOnTrigger.trigger(this);
            } else {
                this._turnedOffTrigger.trigger(this);
            }
        }
    }

};
