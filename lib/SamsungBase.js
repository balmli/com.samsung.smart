'use strict';

const http = require('http.min');
const Homey = require('homey');
const wol = require('wake_on_lan');
const isPortReachable = require('is-port-reachable');
const {default: PQueue} = require('p-queue');
const keycodes = require('./keys');

module.exports = class SamsungBase {

    constructor(config) {
        this._config = config;
        this.logger = config.logger;
        this.i18n = config.i18n || Homey;
        this._commandQueue = new PQueue({concurrency: 1});
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
        try {
            const result = await http.get({
                uri: this.getUri(addr),
                timeout: this._config.api_timeout
            });
            if (result.response && result.response.statusCode === 200) {
                try {
                    const data = JSON.parse(result.data);
                    this.logger.verbose('getInfo', addr, data);
                    return data;
                } catch (jsonErr) {
                    this.logger.info('getInfo JSON error', addr, result.data);
                }
            }
        } catch (err) {
            this.logger.verbose('getInfo error', err.message);
        }
    }

    async apiActive(timeout) {
        const ret = this.pingPort(undefined, undefined, timeout);
        this.logger.verbose(`SamsungBase apiActive: ${ret}`);
        return ret;
    }

    pingPort(ipaddress, port, timeout) {
        return isPortReachable((port || this._config.port), {
            host: (ipaddress || this._config.ip_address),
            timeout: timeout || this._config.api_timeout
        });
    }

    async wake() {
        const self = this;
        return new Promise((resolve, reject) => {
            if (!this._config.mac_address) {
                reject(this.i18n.__('errors.wake_error'));
            }
            wol.wake(this._config.mac_address, function (error) {
                if (error) {
                    self.logger.info('wake ERROR', error);
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
            throw new Error(this.i18n.__('errors.invalid_channel_number'));
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
                    throw new Error(this.i18n.__('errors.invalid_key', { key: cmd }));
                } else if (typeof cmd === 'number' && (cmd < 1.0 || cmd >= 10000)) {
                    throw new Error(this.i18n.__('errors.invalid_delay'));
                }
                return cmd;
            });
        if (cmds.length > 100) {
            throw new Error(this.i18n.__('errors.invalid_number_of_keys'));
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
        //this.logger.info('sendKeys', cmds);
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
