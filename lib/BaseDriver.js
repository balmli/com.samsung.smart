'use strict';

const Logger = require('./Logger');
const Homey = require('homey');
const ip = require('ip');

module.exports = class BaseDriver extends Homey.Driver {

    onInit(driverType) {
        this.logger = new Logger({
            logFunc: this.log,
            errorFunc: this.error,
        }, Homey.env);

        this.searchTimeout = undefined;
        this.stopSearch = false;
        this.logger.verbose(`${driverType} driver has been initialized`);
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
                                'id': self.guid()
                            }
                        });
                    }

                    callback(null, devices);
                })
                .catch(err => {
                    callback(new Error(Homey.__('pair.no_tvs')));
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

        for (let i = first; i <= last; i++) {
            if (this.stopSearch) {
                break;
            }
            await this.checkForTV(ipAddrPrefix + i, devices, socket);
        }
        for (let i = 2; i < 255; i++) {
            if (this.stopSearch) {
                break;
            }
            if (i < first || i > last) {
                await this.checkForTV(ipAddrPrefix + i, devices, socket);
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

    async checkForTV(ipAddr, devices, socket) {
        throw new Error('unimplemented');
    }

    guid() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        }

        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    }

};
