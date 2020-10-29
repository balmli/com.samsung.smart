'use strict';

const BaseDriver = require('../../lib/BaseDriver');
const Samsung = require('./Samsung');

module.exports = class SamsungDriver extends BaseDriver {

    onInit() {
        super.onInit('Samsung');

        this._samsung = new Samsung({
            port: 8001,
            api_timeout: 100,
            logger: this.logger
        });
    }

    async checkForTV(ipAddr, devices, socket) {
        this.logger.info('searchForTVs', ipAddr);
        let data = await this._samsung.getInfo(ipAddr).catch(err => {});
        if (data && data.data) {
            this.logger.info('Found TV', ipAddr);
            devices.push({
                name: data.data.name,
                data: {
                    id: data.data.id
                },
                settings: {
                    ipaddress: ipAddr,
                    modelName: data.data.device.modelName,
                    tokenAuthSupport: data.data.device.TokenAuthSupport === 'true',
                    frameTVSupport: data.data.device.FrameTVSupport === 'true'
                }
            });
            socket.emit('list_devices', devices);
        }
    }

};
