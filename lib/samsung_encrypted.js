'use strict';

const WebSocket = require('ws');
const http = require('http.min');
const SamsungBase = require('./samsung_base');
const Encryption = require('./Encryption/');

module.exports = class SamsungEncrypted extends SamsungBase {

    constructor(config) {
        super(config);
    }

    getUri(ipAddress) {
        return `http://${(ipAddress || this._config.ip_address)}:${this._config.port}/ms/1.0/`;
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

    async turnOn() {
        return this.sendKey(this._config.modelClass === 'sakep' ? 'KEY_POWERON' : 'KEY_POWER');
    }

    async turnOff() {
        return this.sendKey(this._config.modelClass === 'sakep' ? 'KEY_POWEROFF' : 'KEY_POWER');
    }

    async sendKey(aKey) {
        return this.connectAndSend(this.encryptMessageAndCreate('callCommon', {
            method: 'POST',
            body: {
                plugin: 'RemoteControl',
                version: '1.000',
                api: 'SendRemoteKey',
                param1: this._config.duid,
                param2: 'Click',
                param3: aKey,
                param4: 'false'
            }
        }));
    }

    async _connection() {
        let mask = undefined;
        if (!this.socket) {
            await this.getStartService();
            mask = await this.getHandshake();
        }

        return new Promise((resolve, reject) => {

            if (this.socket) {
                this._addSocketTimeout();
                resolve(true);
            } else {

                const hostPort = this.getHostPort(true);
                const uri = this.getWsUri(mask);

                this.socket = new WebSocket(uri, {
                    rejectUnauthorized: false
                });

                console.log('_connection', uri);

                this.socket.on('message', data => {
                    console.log('_connection:', data);
                    this._onMessage(data);

                    resolve();

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

    _onMessage(data) {
        this._addSocketTimeout();

        if (data === '1::') {
            console.log('SOCKET MESSAGE:  1::');
            this.socket.send('1::/com.samsung.companion');
            this.socket.send(this.encryptMessageAndCreate('registerPush', {
                eventType: 'EMP',
                plugin: 'SecondTV'
            }));
            this.socket.send(this.encryptMessageAndCreate('registerPush', {
                eventType: 'EMP',
                plugin: 'RemoteControl'
            }));
            this.socket.send(this.encryptMessageAndCreate('callCommon', {
                method: 'POST',
                body: {
                    plugin: 'NNavi',
                    api: 'GetDUID',
                    version: '1.000'
                }
            }));

        } else if (data === '2::') {
            console.log('SOCKET MESSAGE:  2::');
            this.socket.send('2::');

        } else if (data.startsWith('5::/com.samsung.companion:')) {
            console.log('SOCKET MESSAGE:  5::');
            const event = JSON.parse(data.slice('5::/com.samsung.companion:'.length));
            console.log('SOCKET MESSAGE:  5::', event);

            /*
            const decrypted = JSON.parse(this.decryptMessage(event.args));
            console.log('SOCKET MESSAGE:  5:: -> decrypted', decrypted);

            if (event.name === 'receiveCommon' &&
                decrypted.plugin === 'NNavi' &&
                decrypted.api === 'GetDUID') {
                console.log('SOCKET MESSAGE:  5:: -> GetDUID', decrypted.result, decrypted.api);
                this.duid = decrypted.result;
            }
            */
        }
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

    async connectAndSend(aMsg) {
        return new Promise(async (resolve, reject) => {
            try {
                await this._connection();
            } catch (error) {
                return reject(error ? error : 'Can\'t reach TV');
            }
            console.log('connectAndSend', aMsg);
            this.socket.send(aMsg, error => {
                if (error) {
                    reject(error)
                } else {
                    resolve(true);
                }
            })
        });
    }

    async getStartService() {
        return new Promise((resolve, reject) => {
            http.get({uri: `${this.getHostPort(false)}/common/1.0.0/service/startService?appID=com.samsung.companion`})
                .then(function (data) {
                    resolve(true);
                })
                .catch(function (err) {
                    reject(false);
                });
        });
    }

    async getHandshake() {
        return new Promise((resolve, reject) => {
            http.get({uri: `${this.getHostPort(false)}/socket.io/1`})
                .then(function (data) {
                    const handshake = data.data.split(':');
                    console.log('getHandshake:', handshake[0]);
                    resolve(handshake[0]);
                })
                .catch(function (err) {
                    reject(false);
                });
        });
    }

    encryptMessageAndCreate(name, message) {
        return '5::/com.samsung.companion:' + JSON.stringify({
            name: name,
            args: [this.encryptMessage(message)]
        });
    }

    encryptMessage(message) {
        return Encryption.encryptData(this._config.identityAesKey, this._config.identitySessionId, message);
    }

    decryptMessage(message) {
        console.log('descryptMessage', this._config.identityAesKey, message);
        return Encryption.decryptData(this._config.identityAesKey, message);
    }

    showPinPage() {
        return new Promise((resolve, reject) => {
            http.post({
                uri: 'http://' + this._config.ip_address + ':8080/ws/apps/CloudPINPage',
                headers: {
                    'Content-Type': 'text/plain'
                },
                timeout: 10000
            })
                .then(function (data) {
                    resolve(true);
                })
                .catch(function (err) {
                    reject(false);
                });
        });
    }

    hidePinPage() {
        return new Promise((resolve, reject) => {
            http.delete({
                uri: 'http://' + this._config.ip_address + ':8080/ws/apps/CloudPINPage/run',
                timeout: 10000
            })
                .then(function (data) {
                    resolve(true);
                })
                .catch(function (err) {
                    reject(false);
                });
        });
    }

    startPairing() {
        return new Promise((resolve, reject) => {
            http.get({
                uri: `${this.getPairingUri(0)}&type=1`,
                timeout: 10000
            })
                .then(function (data) {
                    resolve(true);
                })
                .catch(function (err) {
                    reject(false);
                });
        });
    }

    confirmPin(pin) {
        console.log('Sending server hello 1:', pin, typeof pin);
        const serverHello = Encryption.generateServerHello(this._config.userId, pin);
        console.log('Sending server hello 2:', serverHello);
        return new Promise((resolve, reject) => {
            http.post({
                uri: this.getPairingUri(1),
                timeout: 10000,
                json: true
            }, {
                auth_Data: {
                    auth_type: 'SPC',
                    GeneratorServerHello: serverHello
                }
            })
                .then(function (data) {
                    const authData = JSON.parse(data.data.auth_data);
                    console.log('Received server hello', data.data);
                    console.log('Validating server hello auth data', authData.GeneratorClientHello);
                    if (Encryption.parseClientHello(authData.GeneratorClientHello) !== 0) {
                        reject('Invalid PIN entered');
                    }

                    console.log('Obtained requestId', authData.request_id);
                    resolve(authData.request_id);
                })
                .catch(function (err) {
                    console.log('confirmPin ERROR', err);
                    reject(err);
                });
        });
    }

    acknowledgeRequestId(requestId) {
        const serverAck = Encryption.generateServerAcknowledge();
        console.log('Sending server acknowledge', serverAck);
        return new Promise((resolve, reject) => {
            http.post({
                uri: this.getPairingUri(2),
                timeout: 10000,
                json: true
            }, {
                auth_Data: {
                    auth_type: 'SPC',
                    request_id: requestId,
                    ServerAckMsg: serverAck
                }
            })
                .then(function (data) {
                    console.log('Received client acknowledge', data.data);
                    const authData = JSON.parse(data.data.auth_data);
                    console.log('Validating acknowledge auth data', authData.ClientAckMsg);
                    const clientAck = Encryption.parseClientAcknowledge(authData.ClientAckMsg);

                    if (!clientAck) {
                        reject('Failed to acknowledge client');
                    }

                    console.log('acknowledgeRequestId clientAck', authData, clientAck);

                    const identity = {
                        sessionId: authData.session_id,
                        aesKey: Encryption.getKey()
                    };

                    console.log('Identity:', identity);
                    resolve(identity);
                })
                .catch(function (err) {
                    console.log('acknowledgeRequestId ERROR', err);
                    reject(false);
                });
        });
    }

    getHostPort(ws) {
        return `${(ws ? 'ws' : 'http')}://${this._config.ip_address}:8000`;
    }

    getWsUri(mask) {
        return `${this.getHostPort(true)}/socket.io/1/websocket/${mask}`;
    }

    getPairingUri(step) {
        return `http://${this._config.ip_address}:8080/ws/pairing?step=${step}&app_id=${this._config.appId}&device_id=${this._config.deviceId}`;
    }

};
