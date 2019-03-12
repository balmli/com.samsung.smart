'use strict';

const SamDriver = require('../../lib/SamDriver');
const Samsung = require('../../lib/samsung');

module.exports = class SamsungDriver extends SamDriver {

    onInit() {
        super.onInit('Samsung');

        this._samsung = new Samsung({
            port: 8001,
            api_timeout: 100
        });
    }

    async checkForTV(ipAddr, devices, socket) {
        this.log('searchForTVs', ipAddr);
        let data = await this._samsung.getInfo(ipAddr).catch(err => {});
        if (data && data.data) {
            this.log('Found TV', ipAddr);
            devices.push({
                'name': data.data.name,
                'data': {
                    'id': data.data.id
                },
                'settings': {
                    'ipaddress': ipAddr,
                    'tokenAuthSupport': data.data.device.TokenAuthSupport === 'true'
                }
            });
            socket.emit('list_devices', devices);
        }
    }

};
