'use strict';

const wol = require('wake_on_lan');
const isPortReachable = require('is-port-reachable');
const PQueue = require('p-queue');
const keycodes = require('./keys');

module.exports = class SamsungBase {

    constructor(config) {
        this._config = config;
    }

    config() {
        return this._config;
    }

    getId() {
        let id = this._config.device.getData().id;
        return id ? (id.indexOf(':') >= 0 && id.split(':').length > 1 ? id.split(':')[1] : id) : undefined;
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

    _keyCodeMap() {
        return Object.assign({}, ...keycodes.map(s => ({[s.id]: s.name})));
    }

    _commands(commands) {
        const keyCodeMap = this._keyCodeMap();
        const cmds = (!Array.isArray(commands) ? [commands] : commands)
            .map(cmd => cmd.toUpperCase().split(','))
            .reduce((acc, val) => acc.concat(val), [])
            .map(cmd => {
                const times = cmd.split('*');
                if (times[1]) {
                    return Array(parseInt(times[1])).fill(times[0]);
                }
                return cmd;
            })
            .reduce((acc, val) => acc.concat(val), [])
            .map(cmd => isNaN(cmd) ? cmd : parseFloat(cmd))
            .map(cmd => {
                if (isNaN(cmd) && !(cmd in keyCodeMap)) {
                    throw new Error('Invalid key: ' + cmd);
                } else if (typeof cmd === 'number' && (cmd < 1.0 || cmd >= 10000)) {
                    throw new Error('Delay must be between 1 and 9999');
                }
                return cmd;
            });
        if (cmds.length > 100) {
            throw new Error('Max 100 keys are supported');
        }
        return cmds;
    }

    _commandsWithDelays(commands, delay) {
        const cmds = this._commands(commands);
        return cmds.map(cmd => typeof cmd === 'number' ? {delay: cmd} :
            {cmd: cmd, delay: delay || this._config.delay_keys});
    }

    async sendKeys(commands, delay) {
        const cmds = this._commandsWithDelays(commands, delay);
        //console.log('sendKeys', cmds);
        const queue = new PQueue({concurrency: 1});
        return queue.addAll(cmds
            .map(cmd => cmd.cmd ? [() => this.sendKey(cmd.cmd), () => this._delay(cmd.delay)] : [() => this._delay(cmd.delay)])
            .reduce((acc, val) => acc.concat(val), []));
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

    modelClass(model) {
        const tizenPattern = new RegExp('[U|E|N]+\\d+[J]([S|U|No|P])?\\d+([W|K|B|U|T])?');
        const sakepPattern = new RegExp('[U|E|N]+\\d+[H]([S|U|No|P])?\\d+([W|K|B|U|T])?');
        return tizenPattern.test(model) ? 'tizen' : sakepPattern.test(model) ? 'sakep' : undefined;
    }

};
