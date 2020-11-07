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
        this.logger.info('checkForTV', ipAddr);
        const info = await this._samsung.getInfo(ipAddr);
        if (info) {
            this.logger.info('Found TV', ipAddr, info);
            devices.push({
                name: info.name,
                data: {
                    id: info.id
                },
                settings: {
                    ipaddress: ipAddr,
                    modelName: info.device.modelName,
                    tokenAuthSupport: info.device.TokenAuthSupport === 'true',
                    frameTVSupport: info.device.FrameTVSupport === 'true'
                }
            });
            socket.emit('list_devices', devices);
        }
    }

};
