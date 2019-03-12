'use strict';

const wol = require('wake_on_lan');
const isPortReachable = require('is-port-reachable');

module.exports = class SamsungBase {

    constructor(config) {
        this._config = config;
    }

    config() {
        return this._config;
    }

    getUri(ipAddress) {
        throw new Error('unimplemented');
    }

    async getInfo(addr) {
        throw new Error('unimplemented');
    }

    async apiActive(timeout) {
        return this.pingPort(undefined, undefined, timeout);
    }

    pingPort(ipaddress, port, timeout) {
        return isPortReachable((port || this._config.port), {
            host: (ipaddress || this._config.ip_address),
            timeout: timeout || this._config.api_timeout
        });
    }

    async wake(device) {
        return new Promise((resolve, reject) => {
            if (!this._config.mac_address) {
                reject('Unable to wake up device.');
            }
            wol.wake(this._config.mac_address, function (error) {
                if (error) {
                    console.log('wake ERROR', error);
                    reject(error);
                } else {
                    resolve(true);
                }
            });
        });
    }

    async turnOn(device) {
        return this.sendKey('KEY_POWER', device);
    }

    async turnOff(device) {
        return this.sendKey('KEY_POWER', device);
    }

    async sendKey(aKey, device) {
        throw new Error('unimplemented');
    }

    base64Encode(aStr) {
        return Buffer.from(aStr).toString('base64');
    }

};
