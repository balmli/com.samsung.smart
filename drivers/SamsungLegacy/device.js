'use strict';

const macaddress = require('macaddress');

const BaseDevice = require('../../lib/BaseDevice');
const UPnPClient = require('../../lib/UPnPClient');
const SamsungLegacy = require('./SamsungLegacy');

module.exports = class SamsungLegacyDevice extends BaseDevice {

    async onInit() {
        await super.onInit('Samsung Legacy');

        let settings = this.getSettings();
        const ipAddressResponse = await this.homey.cloud.getLocalAddress();
        const homeyIpAddress = ipAddressResponse.split(':')[0]

        this._samsung = new SamsungLegacy({
            device: this,
            homey: this.homey,
            name: "homey",
            ip_address: settings.ipaddress,
            mac_address: settings.mac_address,
            port: 55000,
            api_timeout: 2000,
            delay_keys: settings.delay_keys || 100,
            delay_channel_keys: settings.delay_channel_keys || 1250,
            ip_address_homey: homeyIpAddress,
            appString: 'iphone..iapp.samsung',
            tvAppString: 'iphone.UN60D6000.iapp.samsung',
            logger: this.logger
        });

        await this.migrate();
        await this.registerCapListeners();
        this.addPollDevice();

        this._upnpClient = new UPnPClient({
            ip_address: settings.ipaddress,
            logger: this.logger
        });
        this._upnpClient.on('available', this._onUPnPAvailable.bind(this));

        let self = this;
        macaddress.one(function (err, mac) {
            self._samsung.config()["mac_address_homey"] = mac;
            self.log(`Found MAC address for Homey -> ${mac}`, self._samsung.config());
        });

        this.logger.verbose(`Device initialized`, this.getData());
    }

    async onSettings({ oldSettings, newSettings, changedKeys }) {
        if (changedKeys.includes('ipaddress')) {
            this.updateIPAddress(newSettings.ipaddress);
        }
        if (changedKeys.includes('poll_interval')) {
            this.addPollDevice(newSettings.poll_interval);
        }
        if (changedKeys.includes('delay_keys')) {
            this._samsung.config()["delay_keys"] = newSettings.delay_keys;
        }
        if (changedKeys.includes('delay_channel_keys')) {
            this._samsung.config()["delay_channel_keys"] = newSettings.delay_channel_keys;
        }
    }

    pollMethods(timeout) {
        return [
            { id: 'ping', method: this._samsung.pingPort(undefined, undefined, timeout) },
            { id: 'upnp', method: this._upnpClient ? this._upnpClient.apiActive(timeout) : undefined }
        ];
    }

    async onDeviceOnline() {
        await this.fetchState();
    }

};
