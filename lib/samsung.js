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

    async apiActive() {
        return new Promise((resolve, reject) => {
            http.get({uri: this.getUri(), timeout: this._config.api_timeout, json: true})
                .then(function (data) {
                    if (data.data && data.response.statusCode === 200) {
                        resolve(true);
                    } else {
                        console.log('apiActive: ERROR', data.response.statusCode);
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
                    console.log('wake: ERROR', error);
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
        console.log('sendKey', aKey, this._config);

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
        return await this.websocketCmd({
            'method': 'ms.channel.emit',
            'params': {
                'event': 'ed.installedApp.get',
                'to': 'host'
            }
        }).catch(err => {
            console.log('getListOfApps ERROR', err);
            reject('Unable to get list of apps.')
        });
    }

    async getApp(appId) {
        return new Promise((resolve, reject) => {
            http.get({uri: this.getUri() + 'applications/' + appId, timeout: this._config.api_timeout, json: true})
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

    async isAppRunning(appId) {
        let appinfo = await this.getApp(appId);
        return appinfo && appinfo.data && appinfo.data.visible;
    }

    async launchApp(appId) {
        return new Promise((resolve, reject) => {
            http.post({uri: this.getUri() + 'applications/' + appId, timeout: 10000, json: true})
                .then(function (data) {
                    if (data.data && data.response.statusCode === 200) {
                        resolve(true);
                    } else {
                        console.log(data.response);
                        reject(false);
                    }
                })
                .catch(function (err) {
                    console.log('launchApp', err);
                    reject(false);
                });
        });
    }

    async launchYouTube(videoId) {
        console.log('launchYouTube', videoId);
        let launchData = 'v=' + videoId;
        return new Promise((resolve, reject) => {
            http.post({
                uri: 'http://' + this._config.ip_address + ':8080/ws/apps/YouTube',
                headers: {
                    'Content-Type': 'text/plain',
                    'Content-Length': Buffer.byteLength(launchData)
                },
                timeout: 3000
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
        //console.log('websocketCmd', aCmd, this._config);
        const self = this;

        const app_name_base64 = (new Buffer(this._config.name)).toString('base64');
        return new Promise((resolve, reject) => {
            let ws = new WebSocket(this.getUri() + 'channels/samsung.remote.control?name=' + app_name_base64);
            ws.on('message', function (data) {
                data = JSON.parse(data);
                if (data.event === 'ms.channel.ready') {
                    console.log('ms.channel.ready');

                } else if (data.event === "ms.channel.connect") {
                    ws.send(JSON.stringify(aCmd));

                    // setTimeout is necessary because the connection is closed before the tv action is completed
                    setTimeout(function () {
                        ws.close();
                    }, 1000);

                    if (resolveSent) {
                        resolve(true);
                    }
                } else if (data.event === 'ed.installedApp.get') {
                    resolve(data.data.data);

                } else {
                    console.log('message', data.event, data);
                }
            }).on('response', function (response) {
                console.log('response', response.statusCode);
                resolve(response.data);

            }).on('error', function (err) {
                if (err.code && err.code === 'ECONNREFUSED') {
                    reject('Connection to TV is refused (' + self._config.ip_address + ':8001)');
                } else if (err.code && err.code === 'EHOSTUNREACH') {
                    reject('Connection to TV is unreachable (' + self._config.ip_address + ':8001)');
                } else if (err.code && err.code === 'ENETUNREACH') {
                    reject('Connection to TV is unreachable (' + self._config.ip_address + ':8001)');
                } else {
                    console.log(err);
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
