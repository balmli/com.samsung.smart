'use strict';

const Homey = require('homey');
const Samsung = require('../../lib/samsung');
const ip = require('ip');

class SamsungDriver extends Homey.Driver {

    onInit() {
        this.log('Samsung driver has been initialized');
        this.searchTimeout = undefined;
        this.stopSearch = false;
    }

    onPair(socket) {
        let self = this;
        socket.on('list_devices', function (data, callback) {

            self.searchForTVs(ip.address(), socket)
                .then(devices => {
                    if (devices.length === 0) {
                        devices.push({
                            'name': 'Samsung TV',
                            'data': {
                                'id': guid()
                            }
                        });
                    }

                    callback(null, devices);
                })
                .catch(err => {
                    callback(new Error('Found no Samsung model 2016+ TVs.'));
                });

        });

        socket.on('disconnect', function () {
            self.clearSearchTimeout();
        });
    }

    async searchForTVs(homeyIpAddress, socket) {

        let devices = [];
        let lastDot = homeyIpAddress.lastIndexOf(".");
        let ipAddrPrefix = homeyIpAddress.substring(0, lastDot + 1);
        let ipHomey = homeyIpAddress.substring(lastDot + 1, homeyIpAddress.length);
        let first = Math.max(ipHomey - 20, 2);
        let last = Math.min(first + 40, 254);

        this.addSearchTimeout();

        const samsung = new Samsung({
            api_timeout: 100
        });

        for (let i = first; i <= last; i++) {
            if (this.stopSearch) {
                break;
            }
            await this.checkForTV(samsung, ipAddrPrefix + i, devices, socket);
        }
        for (let i = 2; i < 255; i++) {
            if (this.stopSearch) {
                break;
            }
            if (i < first || i > last) {
                await this.checkForTV(samsung, ipAddrPrefix + i, devices, socket);
            }
        }
        this.clearSearchTimeout();
        return devices;
    }

    addSearchTimeout() {
        let self = this;
        this.stopSearch = false;
        this.searchTimeout = setTimeout(function () {
            self.log('searchForTVs TIMEOUT');
            self.stopSearch = true;
        }, 25000);
    }

    clearSearchTimeout() {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = undefined;
            this.stopSearch = true;
        }
    }

    async checkForTV(samsung, ipAddr, devices, socket) {
        this.log('searchForTVs', ipAddr);
        let data = await samsung.getInfo(ipAddr).catch(err => {});
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

}

module.exports = SamsungDriver;

function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}
