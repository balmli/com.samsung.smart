'use strict';

const net = require("net");
const chr = String.fromCharCode;
const SamsungBase = require('./samsung_base');

module.exports = class SamsungLegacy extends SamsungBase {

    constructor(config) {
        super(config);
    }

    async turnOn(device) {
        return this.sendKey('KEY_POWERON', device);
    }

    async turnOff(device) {
        return this.sendKey('KEY_POWEROFF', device);
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
                    reject('Connection to TV is refused (' + hostPort + ')');
                } else if (err.code && err.code === 'EHOSTUNREACH') {
                    reject('Connection to TV is unreachable (' + hostPort + ')');
                } else if (err.code && err.code === 'ENETUNREACH') {
                    reject('Connection to TV is unreachable (' + hostPort + ')');
                } else {
                    console.log('sendLegacy ERROR', err);
                    reject(err);
                }
            });

            socket.on('timeout', () => {
                reject('Timeout');
            });
        });
    }

};
