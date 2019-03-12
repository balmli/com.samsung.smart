'use strict';

const WebSocket = require('ws');
const http = require('http.min');
const SamsungBase = require('./samsung_base');

module.exports = class Samsung extends SamsungBase {

    constructor(config) {
        super(config);
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

    async sendKey(aKey, device) {
        return this.websocketCmd({
            'method': 'ms.remote.control',
            'params': {
                'Cmd': 'Click',
                'DataOfCmd': aKey,
                'Option': 'false',
                'TypeOfRemote': 'SendRemoteKey'
            }
        }, true, device);
    }

    async getListOfApps(device) {
        return this.websocketCmd({
            'method': 'ms.channel.emit',
            'params': {
                'event': 'ed.installedApp.get',
                'to': 'host'
            }
        }, false, device);
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
        return data && data.response && (data.response.statusCode === 200 || data.response.statusCode === 201);
    }

    async closeApp(appId) {
        let data = await this.applicationCmd(appId, 'delete');
        return data && data.response && (data.response.statusCode === 200 || data.response.statusCode === 201);
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

    async launchBrowser(url, device) {
        return this.websocketCmd({
            'method': 'ms.channel.emit',
            'params': {
                'event': 'ed.apps.launch',
                'to': 'host',
                'data': {
                    'appId': 'org.tizen.browser',
                    'action_type': 'NATIVE_LAUNCH',
                    'metaTag': url
                }
            }
        }, true, device);
    }

    async websocketCmd(aCmd, resolveSent, device) {
        let tokenAuthSupport = this._config.tokenAuthSupport;
        let token = this._config.token;

        return new Promise((resolve, reject) => {
            const hostPort = this.getHostPort(tokenAuthSupport, token);
            const uri = this.getWsUri(tokenAuthSupport, token);
            console.log('websocketCmd', tokenAuthSupport, token, uri);

            let self = this;

            let ws = new WebSocket(uri, {
                rejectUnauthorized: false
            });

            ws.on('message', function (data) {
                data = JSON.parse(data);

                if (data.event === "ms.channel.connect") {
                    if (data.data && data.data.token) {
                        self._config.token = data.data.token;
                        console.log(`websocketCmd: got a new token ${self._config.token}`);
                        device.setSettings({"token": self._config.token});
                    }

                    ws.send(JSON.stringify(aCmd));

                    setTimeout(function () {
                        ws.close();
                    }, 1000);

                    if (resolveSent) {
                        resolve(true);
                    }
                } else if (data.event === 'ed.installedApp.get') {
                    resolve(data.data.data);
                }
            }).on('error', function (err) {
                if (err.code && err.code === 'ECONNREFUSED') {
                    reject('Connection to TV is refused (' + hostPort + ')');
                } else if (err.code && err.code === 'EHOSTUNREACH') {
                    reject('Connection to TV is unreachable (' + hostPort + ')');
                } else if (err.code && err.code === 'ENETUNREACH') {
                    reject('Connection to TV is unreachable (' + hostPort + ')');
                } else {
                    console.log('websocketCmd ERROR', err);
                    reject(err);
                }
            });
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
