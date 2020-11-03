'use strict';

const net = require("net");
const chr = String.fromCharCode;
const SamsungBase = require('../../lib/SamsungBase');

module.exports = class SamsungLegacy extends SamsungBase {

    constructor(config) {
        super(config);
    }

    async turnOn() {
        return this.sendKey('KEY_POWERON');
    }

    async turnOff() {
        return this.sendKey('KEY_POWEROFF');
    }

    async sendKey(aKey) {
        return this.socketCmd(aKey);
    }

    // ------------------------------------------------------------------------
    // Solution borrowed from https://github.com/natalan/samsung-remote

    _socketChunkOne() {
        const ipEncoded = this.base64Encode(this._config.ip_address_homey);
        const macEncoded = this.base64Encode(this._config.mac_address_homey);

        const message = chr(0x64)
            + chr(0x00)
            + chr(ipEncoded.length)
            + chr(0x00)
            + ipEncoded
            + chr(macEncoded.length)
            + chr(0x00)
            + macEncoded
            + chr(this.base64Encode(this._config.name).length)
            + chr(0x00)
            + this.base64Encode(this._config.name);

        return chr(0x00)
            + chr(this._config.appString.length)
            + chr(0x00)
            + this._config.appString
            + chr(message.length)
            + chr(0x00)
            + message;
    }

    _socketChunkTwo(command) {
        const message = chr(0x00)
            + chr(0x00)
            + chr(0x00)
            + chr(this.base64Encode(command).length)
            + chr(0x00)
            + this.base64Encode(command);

        return chr(0x00)
            + chr(this._config.tvAppString.length)
            + chr(0x00)
            + this._config.tvAppString
            + chr(message.length)
            + chr(0x00)
            + message;
    }

    async socketCmd(aCmd) {
        const self = this;
        return new Promise((resolve, reject) => {
            const hostPort = `${this._config.ip_address}:${this._config.port}`;
            const socket = net.connect(this._config.port, this._config.ip_address);

            socket.setTimeout(this._config.api_timeout);

            socket.on('connect', () => {
                socket.write(this._socketChunkOne());
                socket.write(this._socketChunkTwo(aCmd));
                socket.end();
                socket.destroy();
                resolve(true);
            });

            socket.on('error', function (err) {
                if (err.code && err.code === 'ECONNREFUSED') {
                    const msg = self.i18n.__('errors.connection_refused', { address: err.address, port: err.port });
                    self.logger.info(`Socket connect failed:`, msg);
                    reject(msg);
                } else if (err.code && err.code === 'EHOSTUNREACH') {
                    const msg = self.i18n.__('errors.connection_hostunreachable', { address: err.address, port: err.port });
                    self.logger.info(`Socket connect failed:`, msg);
                    reject(msg);
                } else if (err.code && err.code === 'ENETUNREACH') {
                    const msg = self.i18n.__('errors.connection_netunreachable', { address: err.address, port: err.port });
                    self.logger.info(`Socket connect failed:`, msg);
                    reject(msg);
                } else if (err.code && err.code === 'ETIMEDOUT' || err.toString().indexOf('ETIMEDOUT') >= 0) {
                    const msg = self.i18n.__('errors.conn.connection_timedout');
                    self.logger.info(`Socket timeout:`, msg);
                    reject(msg);
                } else if (err.code && err.code === 'ECONNRESET' || err.toString().indexOf('ECONNRESET') >= 0) {
                    const msg = self.i18n.__('errors.conn.connection_reset');
                    self.logger.info(`Socket connection reset:`, msg);
                    reject(msg);
                } else {
                    self.logger.error('Socket error:', err);
                    reject(self.i18n.__('errors.connection_unknown', { message: err }));
                }
            });

            socket.on('timeout', () => {
                reject(self.i18n.__('errors.connection_timeout'));
            });
        });
    }

};
