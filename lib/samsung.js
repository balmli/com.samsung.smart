'use strict';

const WebSocket = require('ws');
const http = require('http.min');
const SamsungBase = require('./samsung_base');

module.exports = class Samsung extends SamsungBase {

    constructor(config) {
        super(config);
        this._current_app = undefined;
        this._apps = undefined;
    }

    getUri(ipAddress) {
        return `http://${(ipAddress || this._config.ip_address)}:${this._config.port}/api/v2/`;
    }

    async getInfo(addr) {
        return new Promise((resolve, reject) => {
            http.get({uri: this.getUri(addr), timeout: this._config.api_timeout, json: true})
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
            http.get({uri: this.getUri(), timeout: (timeout || this._config.api_timeout), json: true})
                .then(function (data) {
                    if (data.data && data.response.statusCode === 200) {
                        resolve(true);
                    } else {
                        console.log('apiActive: ERROR', data.response.statusCode, data.response.statusMessage);
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
            throw new Error('Frame is not supported');
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
            throw new Error('No app is running...');
        }
        let running = await this.isAppRunning(this._current_app);
        if (!running) {
            this._current_app = undefined;
            throw new Error('App is not running...');
        }
        let appId = this._current_app;
        this._current_app = undefined;
        return this.closeApp(appId);
    }

    async applicationCmd(appId, cmd) {
        return new Promise((resolve, reject) => {
            http[cmd]({uri: this.getUri() + 'applications/' + appId, timeout: 10000, json: true})
                .then(function (data) {
                    if (data.response && (data.response.statusCode === 200 || data.response.statusCode === 201)) {
                        resolve(data);
                    } else if (data.response && data.response.statusCode === 403) {
                        reject('The application request must be authorized');
                    } else if (data.response && data.response.statusCode === 404) {
                        reject('Application not found');
                    } else if (data.response && data.response.statusCode === 413) {
                        reject('Request entity too large');
                    } else if (data.response && data.response.statusCode === 501) {
                        reject('Application does not support arguments or failed to process arguments');
                    } else if (data.response && data.response.statusCode === 503) {
                        reject('Unable to start application');
                    } else {
                        console.log('applicationCmd ERROR', data.data, data.response.statusMessage, data.response.statusCode);
                        reject(`Operation failed. (${data.response.statusCode} ${data.response.statusMessage}`);
                    }
                })
                .catch(function (err) {
                    console.log('applicationCmd ERROR', err);
                    reject(`Operation failed. (${err})`);
                });
        });
    }

    async launchYouTube(videoId) {
        let launchData = 'v=' + videoId;
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

                let self = this;

                this.socket = new WebSocket(uri, {
                    rejectUnauthorized: false
                });

                console.log('_connection', tokenAuthSupport, token, uri);

                this.socket.on('message', data => {
                    data = JSON.parse(data);

                    if (data.event === "ms.channel.connect") {
                        if (data.data && data.data.token) {
                            self._config.token = data.data.token;
                            console.log(`_connection: got a new token ${self._config.token}`);
                            self._config.device.setSettings({"token": self._config.token});
                        }

                        this._addSocketTimeout();

                        resolve(true);
                    } else if (data.event === 'ed.installedApp.get') {
                        this._apps = data.data.data;
                        console.log(`_connection: has ${this._apps ? this._apps.length : 0} apps`);
                    }

                }).on('close', () => {
                    this._clearSocketTimeout();
                    this.socket = null;

                }).on('error', err => {
                    if (err.code && err.code === 'ECONNREFUSED') {
                        reject('Connection to TV is refused (' + hostPort + ')');
                    } else if (err.code && err.code === 'EHOSTUNREACH') {
                        reject('Connection to TV is unreachable (' + hostPort + ')');
                    } else if (err.code && err.code === 'ENETUNREACH') {
                        reject('Connection to TV is unreachable (' + hostPort + ')');
                    } else {
                        console.log('_connection ERROR', err);
                        reject(err);
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
            console.log('_onSocketTimeout');
            this.socket.close();
        }
    }

    async connectAndSend(aCmd) {
        return new Promise(async (resolve, reject) => {
            try {
                await this._connection();
            } catch (error) {
                return reject(error ? error : 'Can\'t reach TV');
            }
            console.log('connectAndSend', aCmd);
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
            console.log(`Pair to ${uri}`);

            let ws = new WebSocket(uri, {
                rejectUnauthorized: false
            });

            ws.on('message', (response) => {
                let data = JSON.parse(response);
                console.log('pair: message', data.data);
                ws.close();

                // Got the token
                if (data.data && data.data.token) {
                    console.log('pair: got token', data.data.token);
                    resolve(data.data.token);
                } else {
                    reject();
                }
            }).on('close', () => {
                ws = null;
            }).on('error', (error) => {
                console.log('Pair error', error);
                ws.close();
                reject();
            })
        });
    }

};
