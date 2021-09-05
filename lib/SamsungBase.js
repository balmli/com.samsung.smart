'use strict';

const http = require('http.min');
const Homey = require('homey');
const wol = require('wake_on_lan');
const isPortReachable = require('is-port-reachable');
const { default: PQueue } = require('p-queue');
const keycodes = require('./keys');
const appCodes = require('./apps');

module.exports = class SamsungBase {

    constructor(config) {
        this._config = config;
        this.logger = config.logger;
        this.i18n = config.i18n || Homey;
        this._apps = appCodes;
        this._commandQueue = new PQueue({ concurrency: 1 });
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
        try {
            const result = await http.get({
                uri: this.getUri(),
                timeout: (timeout || this._config.api_timeout)
            });
            let ret = result.response && result.response.statusCode === 200;
            if (ret) {
                try {
                    const data = JSON.parse(result.data);
                    if (data.device && data.device.PowerState) {
                        ret = data.device.PowerState.toLowerCase() === 'on';
                    }
                } catch (jsonErr) {
                    this.logger.verbose('apiActive JSON error', jsonErr);
                }
            }
            this.logger.verbose(`Samsung apiActive: ${ret}`);
            return ret;
        } catch (err) {
        }
        return false;
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

    getApps() {
        return this._apps;
    }

    mergeApps(apps) {
        if (apps && apps.length > 0) {
            const curIds = new Set();
            this._apps.map(a => curIds.add(a.appId));
            apps.filter(a => !curIds.has(a.appId))
                .map(a => this._apps.push({
                    name: a.name,
                    appId: a.appId,
                    dialId: ""
                }));
        }
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
        return Object.assign({}, ...keycodes.map(s => ({ [s.id]: s.name })));
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
        return cmds.map(cmd => typeof cmd === 'number' ? { delay: cmd } :
            { cmd: cmd, delay: delay || this._config.delay_keys });
    }

    async sendKeys(commands, delay) {
        const cmds = this._commandsWithDelays(commands, delay);
        //this.logger.info('sendKeys', cmds);
        const queue = new PQueue({ concurrency: 1 });
        return queue.addAll(cmds
            .map(cmd => cmd.cmd ? [() => this.sendKey(cmd.cmd), () => this._delay(cmd.delay)] : [() => this._delay(cmd.delay)])
            .reduce((acc, val) => acc.concat(val), []));
    }

    async sendKey(aKey) {
        throw new Error('unimplemented');
    }

    async isAppRunning(app) {
        if (!!app.id) {
            app = this.findApp(app.id);
        }
        const notFoundError = this.i18n.__('errors.app_request_404');
        if (app.dialId) {
            try {
                const resp1 = await this._applicationCmd(`http://${this._config.ip_address}:8080/ws/apps/${app.dialId}`, app.dialId, 'get', false);
                return resp1 && resp1.includes('<state>running</state>');
            } catch (err) {
                this.logger.info('isAppRunning DIAL app', err);
                if (err !== notFoundError) {
                    throw err;
                }
            }
        }
        if (app.appId) {
            try {
                const resp2 = await this._applicationCmd(`${this.getUri()}applications/${app.appId}`, app.appId, 'get', true);
                return resp2 && resp2.visible;
            } catch (err) {
                this.logger.info('isAppRunning Samsung app', err);
                if (err !== notFoundError) {
                    throw err;
                }
            }
        }
        throw new Error(notFoundError);
    }

    launchApp(app, launchData) {
        if (!!app.id) {
            app = this.findApp(app.id);
        }
        return this.applicationCmd(app, 'post', launchData);
    }

    findApp(appId) {
        for (let app of appCodes) {
            if (app.appId === appId || app.dialId === appId) {
                return app;
            }
        }
        throw new Error(this.i18n.__('errors.app_request_404'));
    }

    async launchYouTube(videoId) {
        try {
            await this.launchApp({ "name": "YouTube", "appId": "", "dialId": "YouTube" }, 'v=' + videoId);
            this.logger.verbose(`launchYouTube: started YouTube with video ID: ${videoId}`);
        } catch (err) {
            this.logger.info(`launchYouTube: error starting Youtube for video ID: ${videoId}`, err);
            throw new Error(this.i18n.__('errors.app.start_youtube', { message: err.message }));
        }
    }

    async applicationCmd(app, cmd, launchData) {
        this.logger.verbose('applicationCmd', app, cmd, launchData);
        const notFoundError = this.i18n.__('errors.app_request_404');
        if (app.dialId) {
            try {
                return await this._applicationCmd(`http://${this._config.ip_address}:8080/ws/apps/${app.dialId}${cmd === 'delete' ? '/run' : ''}`, app.dialId, cmd, false, launchData);
            } catch (err) {
                this.logger.info('applicationCmd DIAL app', err);
                if (err !== notFoundError) {
                    throw err;
                }
            }
        }
        if (app.appId) {
            try {
                return await this._applicationCmd(`${this.getUri()}applications/${app.appId}`, app.appId, cmd, true, launchData);
            } catch (err) {
                this.logger.info('applicationCmd Samsung app', err);
                if (err !== notFoundError) {
                    throw err;
                }
            }
        }
        throw new Error(notFoundError);
    }

    _applicationCmd(url, appId, cmd, json, launchData) {
        let lData = launchData || '';
        const self = this;
        this.logger.verbose('_applicationCmd', appId, cmd, url);

        return new Promise((resolve, reject) => {
            http[cmd]({
                uri: url,
                headers: {
                    'Content-Type': json ? 'application/json' : 'text/plain',
                    'Content-Length': Buffer.byteLength(lData)
                },
                json: json,
                timeout: 10000
            }, lData)
                .then(function (data) {
                    if (data.response && (data.response.statusCode === 200 || data.response.statusCode === 201)) {
                        self.logger.info(`Application command OK: ${cmd} ${appId}`);
                        resolve(data.data);
                    } else if (data.response && data.response.statusCode === 403) {
                        const msg = self.i18n.__('errors.app_request_403');
                        self.logger.info(`Application command failed: ${cmd} ${appId}:`, msg);
                        reject(msg);
                    } else if (data.response && data.response.statusCode === 404) {
                        const msg = self.i18n.__('errors.app_request_404');
                        self.logger.info(`Application command failed: ${cmd} ${appId}:`, msg);
                        reject(msg);
                    } else if (data.response && data.response.statusCode === 413) {
                        const msg = self.i18n.__('errors.app_request_413');
                        self.logger.info(`Application command failed: ${cmd} ${appId}:`, msg);
                        reject(msg);
                    } else if (data.response && data.response.statusCode === 501) {
                        const msg = self.i18n.__('errors.app_request_501');
                        self.logger.info(`Application command failed: ${cmd} ${appId}:`, msg);
                        reject(msg);
                    } else if (data.response && data.response.statusCode === 503) {
                        const msg = self.i18n.__('errors.app_request_503');
                        self.logger.info(`Application command failed: ${cmd} ${appId}:`, msg);
                        reject(msg);
                    } else {
                        self.logger.error('Application command', data.data, data.response.statusMessage, data.response.statusCode);
                        reject(self.i18n.__('errors.app_request_failed', {
                            statusCode: data.response.statusCode,
                            statusMessage: data.response.statusMessage
                        }));
                    }
                })
                .catch(function (err) {
                    if (err.code && err.code === 'ECONNREFUSED') {
                        const msg = self.i18n.__('errors.connection_refused', { address: err.address, port: err.port });
                        self.logger.info(`Application command failed: ${cmd} ${appId}:`, msg);
                        reject(msg);
                    } else if (err.code && err.code === 'EHOSTUNREACH') {
                        const msg = self.i18n.__('errors.connection_hostunreachable', {
                            address: err.address,
                            port: err.port
                        });
                        self.logger.info(`Application command failed: ${cmd} ${appId}:`, msg);
                        reject(msg);
                    } else if (err.code && err.code === 'ENETUNREACH') {
                        const msg = self.i18n.__('errors.connection_netunreachable', {
                            address: err.address,
                            port: err.port
                        });
                        self.logger.info(`Application command failed: ${cmd} ${appId}:`, msg);
                        reject(msg);
                    } else if (err.message === 'timeout') {
                        self.logger.info(`Application command timeout: ${cmd} ${appId}`);
                        reject(self.i18n.__('errors.connection_timeout'));
                    } else {
                        self.logger.error('Application command:', err);
                        reject(self.i18n.__('errors.connection_unknown', { message: err }));
                    }
                });
        });
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
