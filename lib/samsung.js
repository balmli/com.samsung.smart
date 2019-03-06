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
                    }
                    resolve(false);
                })
                .catch(function (err) {
                    resolve(false);
                });
        });
    }

    async wake(device) {
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

    async turnOn(device) {
        const active = await this.apiActive();
        if (active) {
            return this.sendKey('KEY_POWER', device);
        }
        return this.wake(device);
    }

    async turnOff(device) {
        return this.sendKey('KEY_POWER', device);
    }

    async sendNumber(aNumber, device) {
        let aStr = '' + aNumber;
        let res;
        for (let i = 0; i < aStr.length; i++) {
            if (i > 0) {
                await this.sleep(500);
            }
            res = await this.sendKey('KEY_' + aStr.charAt(i), device);
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
        const app_name_base64 = this.base64Encode(this._config.name);
        let settings = await device.getSettings();
        let tokenAuthSupport = settings.tokenAuthSupport;
        let token = settings.token;

        return new Promise((resolve, reject) => {
            let hostPort = tokenAuthSupport ? 'wss://' + this._config.ip_address + ':8002/api/v2/' :
                'ws://' + this._config.ip_address + ':8001/api/v2/';

            let url = hostPort + 'channels/samsung.remote.control?' +
                'name=' + app_name_base64 + (tokenAuthSupport && token ? '&token=' + token : '');
            //console.log('websocketCmd', tokenAuthSupport, token, url);

            let ws = new WebSocket(url);
            ws.on('message', function (data) {
                data = JSON.parse(data);
                if (data.token) {
                    device.setSettings({"token": data.token});
                }
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

    getUri(ipAddress) {
        return 'http://' + (ipAddress || this._config.ip_address) + ':8001/api/v2/';
    }

    base64Encode(aStr) {
        return Buffer.from(aStr).toString('base64');
    }

}

module.exports = Samsung;
