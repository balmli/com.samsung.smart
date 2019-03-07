'use strict';

const Homey = require('homey');
const {ManagerArp} = Homey;
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
            api_timeout: 2000
        });

        this.initDevice();
    }

    async initDevice() {
        const homeyIp = ip.address();
        let config = this._samsung.config();
        config["ip_address_homey"] = homeyIp;
        config["appString"] = 'iphone..iapp.samsung';
        config["tvAppString"] = 'iphone.UN60D6000.iapp.samsung'; // TODO get from TV

        ManagerArp.getMAC(homeyIp)
            .then(mac => {
                this.log(`Found MAC address for IP address: ${homeyIp} -> ${mac}`);
                config["mac_address_homey"] = mac;
            })
            .catch(err => {
                this.log(`Unable to find MAC address for IP address: ${ipaddress}`);
            });

        this.log('initDevice', this._samsung.config());
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
