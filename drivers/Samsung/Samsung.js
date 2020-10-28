'use strict';

const WebSocket = require('ws');
const http = require('http.min');
const SamsungBase = require('../../lib/SamsungBase');
const SMARTTHINGS_API = 'https://api.smartthings.com/v1';
const appCodes = require('./apps');

module.exports = class Samsung extends SamsungBase {

    constructor(config) {
        super(config);
        this._current_app = undefined;
        this._apps = appCodes;
    }

    getUri(ipAddress) {
        return `http://${(ipAddress || this._config.ip_address)}:${this._config.port}/api/v2/`;
    }

    async getInfo(addr) {
        return new Promise((resolve, reject) => {
            http.get({ uri: this.getUri(addr), timeout: this._config.api_timeout, json: true })
                .then(function (data) {
                    if (data.data && data.response.statusCode === 200) {
                        resolve(data);
                    } else {
                        reject(false);
                    }
                })
                .catch(function (err) {
                    reject(false);
                });
        });
    }

    async apiActive(timeout) {
        return new Promise((resolve, reject) => {
            http.get({ uri: this.getUri(), timeout: (timeout || this._config.api_timeout), json: true })
                .then(function (data) {
                    if (data.data && data.response.statusCode === 200) {
                        resolve(true);
                    } else {
                        this.logger.info('apiActive: ERROR', data.response.statusCode, data.response.statusMessage);
                    }
                    resolve(false);
                })
                .catch(function (err) {
                    resolve(false);
                });
        });
    }

    async turnOff() {
        return this._config.frameTVSupport ? this.holdKey('KEY_POWER', 5000) : this.sendKey('KEY_POWER');
    }

    async sendKey(aKey, aCmd) {
        return this.connectAndSend({
            method: 'ms.remote.control',
            params: {
                Cmd: aCmd || 'Click',
                DataOfCmd: aKey,
                Option: 'false',
                TypeOfRemote: 'SendRemoteKey'
            }
        });
    }

    async holdKey(aKey, aDelay = 1000) {
        await this.sendKey(aKey, 'Press');
        await this._delay(aDelay);
        await this.sendKey(aKey, 'Release');
    }

    async mouseMove(posX, posY) {
        return this.connectAndSend({
            method: "ms.remote.control",
            params: {
                Cmd: "Move",
                Position: {
                    x: posX,
                    y: posY,
                    Time: +new Date()
                },
                TypeOfRemote: "ProcessMouseDevice"
            }
        });
    }

    async mouseClick(left = true) {
        return this.connectAndSend({
            method: "ms.remote.control",
            params: {
                Cmd: left ? "LeftClick" : "RightClick",
                TypeOfRemote: "ProcessMouseDevice"
            }
        });
    }

    async sendText(text) {
        return this.connectAndSend({
            method: "ms.remote.control",
            params: {
                Cmd: this.base64Encode(text),
                DataOfCmd: "base64",
                TypeOfRemote: "SendInputString"
            }
        });
    }

    async sendInputEnd() {
        return this.connectAndSend({
            method: "ms.remote.control",
            params: {
                TypeOfRemote: "SendInputEnd"
            }
        });
    }

    async getListOfApps() {
        return this.connectAndSend({
            method: 'ms.channel.emit',
            params: {
                event: 'ed.installedApp.get',
                to: 'host'
            }
        });
    }

    getApps() {
        return this._apps;
    }

    async launchBrowser(url) {
        return this.connectAndSend({
            method: 'ms.channel.emit',
            params: {
                event: 'ed.apps.launch',
                to: 'host',
                data: {
                    appId: 'org.tizen.browser',
                    action_type: 'NATIVE_LAUNCH',
                    metaTag: url
                }
            }
        });
    }

    async artMode(onOff) {
        if (!this._config.frameTVSupport) {
            throw new Error(this.i18n.__('errors.frame_is_not_supported'));
        }
        return this.connectAndSend({
            method: 'ms.channel.emit',
            params: {
                event: 'art_app_request',
                to: 'host',
                clientIp: this._config.ip_address_homey,
                deviceName: this.base64Encode(this._config.name),
                data: JSON.stringify({
                    id: this.getId(),
                    value: onOff ? 'on' : 'off',
                    request: 'set_artmode_status'
                })
            }
        });
    }

    async getApp(appId) {
        return this.applicationCmd(appId, 'get');
    }

    async isAppRunning(appId) {
        let response = await this.getApp(appId).catch(err => {
        });
        return response && response.data && response.data.visible;
    }

    async launchApp(appId) {
        let data = await this.applicationCmd(appId, 'post');
        let result = data && data.response && (data.response.statusCode === 200 || data.response.statusCode === 201);
        this._current_app = appId;
        return result;
    }

    async closeApp(appId) {
        let data = await this.applicationCmd(appId, 'delete');
        return data && data.response && (data.response.statusCode === 200 || data.response.statusCode === 201);
    }

    async closeCurrentApp() {
        if (!this._current_app) {
            throw new Error(this.i18n.__('errors.app_no_app_running'));
        }
        let running = await this.isAppRunning(this._current_app);
        if (!running) {
            this._current_app = undefined;
            throw new Error(this.i18n.__('errors.app_app_not_running'));
        }
        let appId = this._current_app;
        this._current_app = undefined;
        return this.closeApp(appId);
    }

    async applicationCmd(appId, cmd) {
        const self = this;
        return new Promise((resolve, reject) => {
            http[cmd]({ uri: this.getUri() + 'applications/' + appId, timeout: 10000, json: true })
                .then(function (data) {
                    if (data.response && (data.response.statusCode === 200 || data.response.statusCode === 201)) {
                        self.logger.info(`Application command OK: ${cmd} ${appId}`);
                        resolve(data);
                    } else if (data.response && data.response.statusCode === 403) {
                        const msg = self.i18n.__('errors.app_request_403');
                        self.logger.info(`Application command failed: ${cmd} ${appId}`, msg);
                        reject(msg);
                    } else if (data.response && data.response.statusCode === 404) {
                        const msg = self.i18n.__('errors.app_request_404');
                        self.logger.info(`Application command failed: ${cmd} ${appId}`, msg);
                        reject(msg);
                    } else if (data.response && data.response.statusCode === 413) {
                        const msg = self.i18n.__('errors.app_request_413');
                        self.logger.info(`Application command failed: ${cmd} ${appId}`, msg);
                        reject(msg);
                    } else if (data.response && data.response.statusCode === 501) {
                        const msg = self.i18n.__('errors.app_request_501');
                        self.logger.info(`Application command failed: ${cmd} ${appId}`, msg);
                        reject(msg);
                    } else if (data.response && data.response.statusCode === 503) {
                        const msg = self.i18n.__('errors.app_request_503');
                        self.logger.info(`Application command failed: ${cmd} ${appId}`, msg);
                        reject(msg);
                    } else {
                        self.logger.error('applicationCmd ERROR', data.data, data.response.statusMessage, data.response.statusCode);
                        reject(self.i18n.__('errors.app_request_failed', { statusCode: data.response.statusCode, statusMessage: data.response.statusMessage }));
                    }
                })
                .catch(function (err) {
                    if (err.code && err.code === 'ECONNREFUSED') {
                        const msg = self.i18n.__('errors.connection_refused', { address: err.address, port: err.port });
                        self.logger.info(`Application command failed: ${cmd} ${appId}`, msg);
                        reject(msg);
                    } else if (err.code && err.code === 'EHOSTUNREACH') {
                        const msg = self.i18n.__('errors.connection_hostunreachable', { address: err.address, port: err.port });
                        self.logger.info(`Application command failed: ${cmd} ${appId}`, msg);
                        reject(msg);
                    } else if (err.code && err.code === 'ENETUNREACH') {
                        const msg = self.i18n.__('errors.connection_netunreachable', { address: err.address, port: err.port });
                        self.logger.info(`Application command failed: ${cmd} ${appId}`, msg);
                        reject(msg);
                    } else if (err.message === 'timeout') {
                        self.logger.info(`Application command timeout: ${cmd} ${appId}`);
                        reject(self.i18n.__('errors.connection_timeout'));
                    } else {
                        self.logger.error('applicationCmd ERROR', err);
                        reject(self.i18n.__('errors.connection_unknown', { message: err }));
                    }
                });
        });
    }

    async launchYouTube(videoId) {
        const launchData = 'v=' + videoId;
        return new Promise((resolve, reject) => {
            http.post({
                uri: 'http://' + this._config.ip_address + ':8080/ws/apps/YouTube',
                headers: {
                    'Content-Type': 'text/plain',
                    'Content-Length': Buffer.byteLength(launchData)
                },
                timeout: 10000
            }, launchData)
                .then(function (data) {
                    resolve(true);
                })
                .catch(function (err) {
                    reject(false);
                });
        });
    }

    async _connection() {
        return new Promise((resolve, reject) => {

            if (this.socket) {
                this._addSocketTimeout();
                resolve(true);
            } else {

                let tokenAuthSupport = this._config.tokenAuthSupport;
                let token = this._config.token;

                const hostPort = this.getHostPort(tokenAuthSupport, token);
                const uri = this.getWsUri(tokenAuthSupport, token);

                const self = this;

                this.socket = new WebSocket(uri, {
                    rejectUnauthorized: false
                });

                this.logger.verbose('_connection', tokenAuthSupport, token, uri);

                this.socket.on('message', data => {
                    data = JSON.parse(data);

                    if (data.event === "ms.channel.connect") {
                        if (data.data && data.data.token) {
                            self._config.token = data.data.token;
                            this.logger.info(`_connection: got a new token ${self._config.token}`);
                            self._config.device.setSettings({ "token": self._config.token });
                        }

                        this._addSocketTimeout();

                        resolve(true);
                    } else if (data.event === 'ed.installedApp.get') {
                        try {
                            const apps = data.data.data;
                            if (apps && apps.length > 0) {
                                this._apps = apps.map(a => ({ appId: a.appId, name: a.name }));
                                this.logger.info(`_connection: has ${this._apps ? this._apps.length : 0} apps`);
                                this.logger.verbose(`_connection:`, this._apps);
                            }
                        } catch (err) {
                        }
                    }

                }).on('close', () => {
                    this._clearSocketTimeout();
                    this.socket = null;

                }).on('error', err => {
                    if (err.code && err.code === 'ECONNREFUSED') {
                        const msg = self.i18n.__('errors.connection_refused', { address: err.address, port: err.port });
                        self.logger.info(`Socket connect failed`, msg);
                        reject(msg);
                    } else if (err.code && err.code === 'EHOSTUNREACH') {
                        const msg = self.i18n.__('errors.connection_hostunreachable', { address: err.address, port: err.port });
                        self.logger.info(`Socket connect failed`, msg);
                        reject(msg);
                    } else if (err.code && err.code === 'ENETUNREACH') {
                        const msg = self.i18n.__('errors.connection_netunreachable', { address: err.address, port: err.port });
                        self.logger.info(`Socket connect failed`, msg);
                        reject(msg);
                    } else {
                        self.logger.error('Socket connect ERROR', err);
                        reject(self.i18n.__('errors.connection_unknown', { message: err }));
                    }
                });
            }
        });
    }

    _addSocketTimeout() {
        this._clearSocketTimeout();
        this.socketTimeout = setTimeout(() => this._onSocketTimeout(), 1000 * 60 * 2);
    }

    _clearSocketTimeout() {
        if (this.socketTimeout) {
            clearTimeout(this.socketTimeout);
            this.socketTimeout = undefined;
        }
    }

    _onSocketTimeout() {
        if (this.socket) {
            this.logger.verbose('_onSocketTimeout');
            this.socket.close();
        }
    }

    async connectAndSend(aCmd) {
        const self = this;
        return new Promise(async (resolve, reject) => {
            try {
                await this._connection();
            } catch (error) {
                return reject(error ? error : self.i18n.__('errors.connection'));
            }
            this.logger.info('connectAndSend', aCmd);
            this.socket.send(JSON.stringify(aCmd), error => {
                if (error) {
                    reject(error)
                } else {
                    resolve(true);
                }
            })
        });
    }

    getHostPort(tokenAuthSupport) {
        return `${(tokenAuthSupport ? 'wss' : 'ws')}://${this._config.ip_address}:${(tokenAuthSupport ? 8002 : 8001)}`;
    }

    getWsUri(tokenAuthSupport, token) {
        const app_name_base64 = this.base64Encode(this._config.name);
        const tokenPart = token ? ('&token=' + token) : '';
        return `${this.getHostPort(tokenAuthSupport)}/api/v2/channels/samsung.remote.control?name=${app_name_base64}${tokenPart}`;
    }

    // ------------------------------------------------------------------------
    // Solution borrowed from https://github.com/tavicu/homebridge-samsung-tizen

    async pair() {
        return new Promise(async (resolve, reject) => {
            let uri = this.getWsUri(true);
            this.logger.info(`Pair to ${uri}`);

            let ws = new WebSocket(uri, {
                rejectUnauthorized: false
            });

            ws.on('message', (response) => {
                let data = JSON.parse(response);
                this.logger.info('pair: message', data.data);
                ws.close();

                // Got the token
                if (data.data && data.data.token) {
                    this.logger.info('pair: got token', data.data.token);
                    resolve(data.data.token);
                } else {
                    reject();
                }
            }).on('close', () => {
                ws = null;
            }).on('error', (error) => {
                this.logger.info('Pair error', error);
                ws.close();
                reject();
            })
        });
    }

    // ------------------------------------------------------------------------
    // SmartThings API

    clearStClient() {
        this._config.stTvDeviceId = undefined;
    }

    async getStToken() {
        let settings = await this._config.device.getSettings();
        if (!settings.smartthings) {
            throw new Error(this.i18n.__('errors.smartthings.not_enabled'));
        }
        if (!settings.smartthings_token) {
            throw new Error(this.i18n.__('errors.smartthings.no_token'));
        }
        return settings.smartthings_token;
    }

    async stDevices() {
        const token = await this.getStToken();
        const response = await http({
            uri: `${SMARTTHINGS_API}/devices`,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.response.statusCode === 200) {
            const json = JSON.parse(response.data);
            return json.items;
        }
        this.logger.info('stDevices error', response.response.statusCode, response.response.statusMessage);
        if (response.response.statusCode === 401) {
            throw new Error(this.i18n.__('errors.smartthings.incorrect_token'));
        }
        throw new Error(this.i18n.__('errors.smartthings.failed_fetching_devices', { statusCode: response.response.statusCode, statusMessage: response.response.statusMessage }));
    }

    async stDevice(deviceId, path = '') {
        const token = await this.getStToken();
        return http({
            uri: `${SMARTTHINGS_API}/devices/${deviceId}${path}`,
            headers: {
                'Authorization': `Bearer ${token}`
            },
            json: true
        });
    };

    async stCommand(deviceId, commands) {
        const token = await this.getStToken();
        this.logger.info('stCommand', commands);
        return http.post({
                uri: `${SMARTTHINGS_API}/devices/${deviceId}/commands`,
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                json: true
            },
            { "commands": commands }
        );
    };

    async getStTvDevice() {
        if (this._config.stTvDeviceId) {
            return this._config.stTvDeviceId;
        }

        const devices = await this.stDevices();
        const tvDevices = devices
            .filter(d => d.components.filter(c => c.capabilities.filter(cap => cap.id === 'tvChannel') > 0))
            .map(d => d.deviceId);

        if (tvDevices.length === 0) {
            throw new Error(this.i18n.__('errors.smartthings.no_tvs'));
        }

        // Just support one TV for now
        this._config.stTvDeviceId = tvDevices[0];
        return this._config.stTvDeviceId;
    }

    async getStHealth() {
        try {
            const deviceId = await this.getStTvDevice();
            const response = await this.stDevice(deviceId, '/health');
            this.logger.verbose('getStHealth', response.data, response.response.statusCode, response.response.statusMessage);
            return response && response.data && response.data.state === 'ONLINE';
        } catch (err) {
            return null;
        }
    }

    async getStInputSources() {
        try {
            const deviceId = await this.getStTvDevice();
            const response = await this.stDevice(deviceId, '/status');
            this.logger.verbose('getStInputSources', response.data, response.response.statusCode, response.response.statusMessage);
            return response.data.components.main.mediaInputSource.supportedInputSources.value;
        } catch (err) {
            this.logger.info('getStInputSources failed', err);
            return [];
        }
    }

    async setInputSource(input_source) {
        const deviceId = await this.getStTvDevice();
        const response = await this.stCommand(deviceId, [{
            component: 'main',
            capability: 'mediaInputSource',
            command: 'setInputSource',
            arguments: [input_source]
        }]);
        if (response.response.statusCode !== 200) {
            this.logger.info('Changing input source failed', response.data, response.response.statusCode, response.response.statusMessage);
            throw new Error(this.i18n.__('errors.smartthings.failed_changing_input_source', { message: response.data.error.message, statusCode: response.response.statusCode, statusMessage: response.response.statusMessage }));
        }
    }

};
