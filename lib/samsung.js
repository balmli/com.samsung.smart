'use strict';

const WebSocket = require('ws');
const http = require('http.min');
const wol = require('wake_on_lan');

class Samsung {

    constructor(config) {
        this._config = config;
    }

    config() {
        return this._config;
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
                        resolve(false);
                    }
                })
                .catch(function (err) {
                    resolve(false);
                });
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
        const active = await this.apiActive();
        if (active) {
            return this.sendKey('KEY_POWER');
        }
        return this.wake();
    }

    async turnOff() {
        return this.sendKey('KEY_POWER');
    }

    async sendNumber(aNumber) {
        let aStr = '' + aNumber;
        let res;
        for (let i = 0; i < aStr.length; i++) {
            if (i > 0) {
                await this.sleep(500);
            }
            res = await this.sendKey('KEY_' + aStr.charAt(i));
            if (!res) {
                return res;
            }
        }
        return res;
    }

    sleep(ms) {
        return new Promise(resolve => {
            setTimeout(resolve, ms)
        });
    }

    async sendKey(aKey) {
        return this.websocketCmd({
            'method': 'ms.remote.control',
            'params': {
                'Cmd': 'Click',
                'DataOfCmd': aKey,
                'Option': 'false',
                'TypeOfRemote': 'SendRemoteKey'
            }
        }, true);
    }

    async getListOfApps() {
        return this.websocketCmd({
            'method': 'ms.channel.emit',
            'params': {
                'event': 'ed.installedApp.get',
                'to': 'host'
            }
        });
    }

    async getApp(appId) {
        return this.applicationCmd(appId, 'get');
    }

    async isAppRunning(appId) {
        let response = await this.getApp(appId).catch(err => {});
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

    async launchBrowser(url) {
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
        }, true);
    }

    async websocketCmd(aCmd, resolveSent) {
        const self = this;
        const app_name_base64 = (new Buffer(this._config.name)).toString('base64');
        return new Promise((resolve, reject) => {
            let ws = new WebSocket(this.getUri() + 'channels/samsung.remote.control?name=' + app_name_base64);
            ws.on('message', function (data) {
                data = JSON.parse(data);
                if (data.event === "ms.channel.connect") {
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
                    reject('Connection to TV is refused (' + self.getUri() + ')');
                } else if (err.code && err.code === 'EHOSTUNREACH') {
                    reject('Connection to TV is unreachable (' + self.getUri() + ')');
                } else if (err.code && err.code === 'ENETUNREACH') {
                    reject('Connection to TV is unreachable (' + self.getUri() + ')');
                } else {
                    console.log('websocketCmd ERROR', err);
                    reject(err);
                }
            });
        });
    }

    getUri(ipAddress) {
        return 'http://' + (ipAddress || this._config.ip_address) + ':8001/api/v2/';
    }

}

module.exports = Samsung;
