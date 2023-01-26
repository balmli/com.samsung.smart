'use strict';

const Logger = require('./Logger');
const Homey = require('homey');

module.exports = class BaseDriver extends Homey.Driver {

    onInit(driverType) {
        this.logger = new Logger({
            homey: this.homey,
            logFunc: this.log,
            errorFunc: this.error,
        }, Homey.env);

        this.searchTimeout = undefined;
        this.stopSearch = false;
        this.logger.verbose(`${driverType} driver has been initialized`);
    }

    async onPair(session) {
        session.setHandler('list_devices', async (data) => {
            try {
                const ipAddressResponse = await this.homey.cloud.getLocalAddress();
                const homeyIpAddress = ipAddressResponse.split(':')[0]
                const devices = await this.searchForTVs(homeyIpAddress, session);

                if (devices.length === 0) {
                    devices.push({
                        'name': 'Samsung TV',
                        'data': {
                            'id': this.guid()
                        }
                    });
                }

                return devices;

            } catch (err) {
                throw new Error(this.homey.__('pair.no_tvs'));
            }
        });

        session.setHandler('disconnect', async () => {
            this.clearSearchTimeout();
        });
    }

    async searchForTVs(homeyIpAddress, session) {

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
            await this.checkForTV(ipAddrPrefix + i, devices, session);
        }
        for (let i = 2; i < 255; i++) {
            if (this.stopSearch) {
                break;
            }
            if (i < first || i > last) {
                await this.checkForTV(ipAddrPrefix + i, devices, session);
            }
        }
        this.clearSearchTimeout();
        return devices;
    }

    addSearchTimeout() {
        this.stopSearch = false;
        this.searchTimeout = this.homey.setTimeout(() => {
            this.log('searchForTVs TIMEOUT');
            this.stopSearch = true;
        }, 25000);
    }

    clearSearchTimeout() {
        if (this.searchTimeout) {
            this.homey.clearTimeout(this.searchTimeout);
            this.searchTimeout = undefined;
            this.stopSearch = true;
        }
    }

    async checkForTV(ipAddr, devices, session) {
        throw new Error('unimplemented');
    }

    guid() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        }

        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    }

};
