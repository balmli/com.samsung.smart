'use strict';

const wol = require('wake_on_lan');
const isPortReachable = require('is-port-reachable');
const pThrottle = require('p-throttle');
const keycodes = require('./keys');

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

    async wake() {
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

    async turnOn() {
        return this.sendKey('KEY_POWER');
    }

    async turnOff() {
        return this.sendKey('KEY_POWER');
    }

    _commandsChannel(channel) {
        if (isNaN(parseInt(channel))) {
            throw new Error('Invalid channel number');
        }
        return [].concat(String(channel).split('').map(num => `KEY_${num}`), ['KEY_ENTER']);
    }

    setChannel(channel) {
        return this.sendKeys(this._commandsChannel(channel), this._config.delay_channel_keys);
    }

    sendKeys(commands, delay) {
        const doSendCmd = pThrottle(cmd => {
            return this.sendKey(cmd);
        }, 1, delay || this._config.delay_keys);

        return Promise.all(this._commands(commands).map(cmd => {
            return doSendCmd(cmd);
        }));
    }

    _keyCodeMap() {
        return Object.assign({}, ...keycodes.map(s => ({[s.id]: s.name})));
    }

    _commands(commands) {
        const keyCodeMap = this._keyCodeMap();
        let cmds = (!Array.isArray(commands) ? [commands] : commands)
            .map(cmd => cmd.toUpperCase().split(','))
            .reduce((acc, val) => acc.concat(val), [])
            .map(cmd => {
                let times = cmd.split('*');
                if (times[1]) {
                    return Array(parseInt(times[1])).fill(times[0]);
                }
                return cmd;
            })
            .reduce((acc, val) => acc.concat(val), []);
        if (cmds.length > 100) {
            throw new Error('Max 100 keys are supported');
        }
        cmds = cmds.slice(0, Math.min(cmds.length, 100));
        cmds.forEach(cmd => {
            if (!(cmd in keyCodeMap)) {
                throw new Error('Invalid key: ' + cmd);
            }
        });
        return cmds;
    }

    async sendKey(aKey) {
        throw new Error('unimplemented');
    }

    base64Encode(aStr) {
        return Buffer.from(aStr).toString('base64');
    }

    _delay(ms) {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    }

};
