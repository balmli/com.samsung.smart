'use strict';

const BaseDriver = require('../../lib/BaseDriver');
const SamsungLegacy = require('./SamsungLegacy');

module.exports = class SamsungLegacyDriver extends BaseDriver {

    onInit() {
        super.onInit('Samsung Legacy');

        this._samsung = new SamsungLegacy({
            port: 55000,
            api_timeout: 100,
            logger: this.logger
        });
    }

    async checkForTV(ipAddr, devices, socket) {
        this.logger.info('searchForTVs', ipAddr);
        let data = await this._samsung.pingPort(ipAddr);
        if (data) {
            this.logger.info('Found TV', ipAddr);
            devices.push({
                name: 'Samsung TV',
                data: {
                    id: 'samsung_tv_' + ipAddr
                },
                settings: {
                    ipaddress: ipAddr,
                    modelName: 'legacy'
                }
            });
            socket.emit('list_devices', devices);
        }
    }

};
