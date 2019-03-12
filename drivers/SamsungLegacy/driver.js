'use strict';

const SamDriver = require('../../lib/SamDriver');
const SamsungLegacy = require('../../lib/samsung_legacy');

module.exports = class SamsungLegacyDriver extends SamDriver {

    onInit() {
        super.onInit('Samsung Legacy');

        this._samsung = new SamsungLegacy({
            port: 55000,
            api_timeout: 100
        });
    }

    async checkForTV(ipAddr, devices, socket) {
        this.log('searchForTVs', ipAddr);
        let data = await this._samsung.pingPort(ipAddr);
        if (data) {
            this.log('Found TV', ipAddr);
            devices.push({
                'name': 'Samsung TV',
                'data': {
                    'id': 'samsung_tv_' + ipAddr
                },
                'settings': {
                    'ipaddress': ipAddr
                }
            });
            socket.emit('list_devices', devices);
        }
    }

};
