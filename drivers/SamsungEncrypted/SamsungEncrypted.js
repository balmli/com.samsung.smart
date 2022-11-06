'use strict';

const WebSocket = require('ws');
const http = require('http.min');
const SamsungBase = require('../../lib/SamsungBase');
const Encryption = require('../../lib/Encryption/');

module.exports = class SamsungEncrypted extends SamsungBase {

    constructor(config) {
        super(config);
    }

    getUri(ipAddress) {
        return `http://${(ipAddress || this._config.ip_address)}:${this._config.port}/ms/1.0/`;
    }

    async turnOn() {
        return this.sendKey(this._config.modelClass === 'sakep' ? 'KEY_POWERON' : 'KEY_POWER');
    }

    async turnOff() {
        return this.sendKey(this._config.modelClass === 'sakep' ? 'KEY_POWEROFF' : 'KEY_POWER');
    }

    getApps() {
        return this._apps.filter(a => !!a.dialId);
    }

    async sendKey(aKey) {
        this.logger.info('sendKey', aKey);
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

        const self = this;
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

                self.logger.verbose('_connection', uri);

                this.socket.on('message', data => {
                    //self.logger.info('_connection:', data);
                    this._onMessage(data);

                    resolve();

                }).on('close', () => {
                    this._clearSocketTimeout();
                    this.socket = null;

                }).on('error', err => {
                    if (err.code && err.code === 'ECONNREFUSED') {
                        const msg = self.i18n.__('errors.connection_refused', { address: err.address, port: err.port });
                        self.logger.info(`Socket connect failed:`, msg);
                        reject(msg);
                    } else if (err.code && err.code === 'EHOSTUNREACH') {
                        const msg = self.i18n.__('errors.connection_hostunreachable', {
                            address: err.address,
                            port: err.port
                        });
                        self.logger.info(`Socket connect failed:`, msg);
                        reject(msg);
                    } else if (err.code && err.code === 'ENETUNREACH') {
                        const msg = self.i18n.__('errors.connection_netunreachable', {
                            address: err.address,
                            port: err.port
                        });
                        self.logger.info(`Socket connect failed:`, msg);
                        reject(msg);
                    } else if (err.code && err.code === 'ETIMEDOUT' || err.toString().indexOf('ETIMEDOUT') >= 0) {
                        const msg = self.i18n.__('errors.conn.connection_timedout');
                        self.logger.info(`Socket timeout:`, msg);
                        reject(msg);
                    } else if (err.code && err.code === 'ECONNRESET' || err.toString().indexOf('ECONNRESET') >= 0) {
                        const msg = self.i18n.__('errors.conn.connection_reset');
                        self.logger.info(`Socket connection reset:`, msg);
                        reject(msg);
                    } else {
                        self.logger.error('Socket error:', err);
                        reject(self.i18n.__('errors.connection_unknown', { message: err }));
                    }
                });
            }
        });
    }

    _onMessage(data) {
        this._addSocketTimeout();

        if (data === '1::') {
            //this.logger.info('SOCKET MESSAGE:  1::');
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
            //this.logger.info('SOCKET MESSAGE:  2::');
            this.socket.send('2::');

        } else if (data.startsWith('5::/com.samsung.companion:')) {
            //this.logger.info('SOCKET MESSAGE:  5::');
            //const event = JSON.parse(data.slice('5::/com.samsung.companion:'.length));
            //this.logger.info('SOCKET MESSAGE:  5::', event);

            /*
            const decrypted = JSON.parse(this.decryptMessage(event.args));
            this.logger.info('SOCKET MESSAGE:  5:: -> decrypted', decrypted);

            if (event.name === 'receiveCommon' &&
                decrypted.plugin === 'NNavi' &&
                decrypted.api === 'GetDUID') {
                this.logger.info('SOCKET MESSAGE:  5:: -> GetDUID', decrypted.result, decrypted.api);
                this.duid = decrypted.result;
            }
            */
        }
    }

    _addSocketTimeout() {
        this._clearSocketTimeout();
        this.socketTimeout = this._config.homey.setTimeout(() => this._onSocketTimeout(), 1000 * 60 * 2);
    }

    _clearSocketTimeout() {
        if (this.socketTimeout) {
            this._config.homey.clearTimeout(this.socketTimeout);
            this.socketTimeout = undefined;
        }
    }

    _onSocketTimeout() {
        if (this.socket) {
            this.logger.info('_onSocketTimeout');
            this.socket.close();
        }
    }

    async connectAndSend(aMsg) {
        const self = this;
        return this._commandQueue.add(() => new Promise(async (resolve, reject) => {
            try {
                await this._connection();
            } catch (err) {
                return reject(err);
            }
            if (this.socket.readyState !== WebSocket.OPEN) {
                const msg = self.i18n.__('errors.conn.readystate_not_open');
                self.logger.info('Socket not ready:', msg);
                return reject(msg);
            }
            self.logger.info('connectAndSend', aMsg);
            try {
                this.socket.send(aMsg, error => {
                    if (error) {
                        reject(error)
                    } else {
                        resolve(true);
                    }
                });
            } catch (err) {
                const msg = self.i18n.__('errors.conn.send_failed', { message: err.message });
                self.logger.info(`Socket send failed:`, msg);
                reject(msg);
            }
        }));
    }

    async getStartService() {
        return new Promise((resolve, reject) => {
            http.get({ uri: `${this.getHostPort(false)}/common/1.0.0/service/startService?appID=com.samsung.companion` })
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
            http.get({ uri: `${this.getHostPort(false)}/socket.io/1` })
                .then(function (data) {
                    const handshake = data.data.split(':');
                    //this.logger.info('getHandshake:', handshake[0]);
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
        //this.logger.info('descryptMessage', this._config.identityAesKey, message);
        return Encryption.decryptData(this._config.identityAesKey, message);
    }

    async showPinPage() {
        let data = await this.applicationCmd({ name: "CloudPINPage", appId: "", dialId: "CloudPINPage" }, 'post');
        //this.logger.info('showPinPage', data.response.statusCode);
        return data && data.response && (data.response.statusCode === 200 || data.response.statusCode === 201);
    }

    async hidePinPage() {
        let data = await this.applicationCmd({ name: "CloudPINPage", appId: "", dialId: "CloudPINPage" }, 'delete');
        //this.logger.info('hidePinPage', data.response.statusCode);
        return data && data.response && (data.response.statusCode === 200 || data.response.statusCode === 201);
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
        //this.logger.info('Sending server hello 1:', pin, typeof pin);
        const serverHello = Encryption.generateServerHello(this._config.userId, pin);
        //this.logger.info('Sending server hello 2:', serverHello);
        const self = this;
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
                    //self.logger.info('Received server hello', data.data);
                    //self.logger.info('Validating server hello auth data', authData.GeneratorClientHello);
                    if (Encryption.parseClientHello(authData.GeneratorClientHello) !== 0) {
                        reject(self.i18n.__('pair.encrypted.invalid_pin'));
                    }

                    //self.logger.info('Obtained requestId', authData.request_id);
                    resolve(authData.request_id);
                })
                .catch(function (err) {
                    self.logger.info('confirmPin ERROR', err);
                    reject(err);
                });
        });
    }

    acknowledgeRequestId(requestId) {
        const serverAck = Encryption.generateServerAcknowledge();
        //this.logger.info('Sending server acknowledge', serverAck);
        const self = this;
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
                    //self.logger.info('Received client acknowledge', data.data);
                    const authData = JSON.parse(data.data.auth_data);
                    //self.logger.info('Validating acknowledge auth data', authData.ClientAckMsg);
                    const clientAck = Encryption.parseClientAcknowledge(authData.ClientAckMsg);

                    if (!clientAck) {
                        reject(self.i18n.__('pair.encrypted.failed_ack_client'));
                    }

                    //self.logger.info('acknowledgeRequestId clientAck', authData, clientAck);

                    const identity = {
                        sessionId: authData.session_id,
                        aesKey: Encryption.getKey()
                    };

                    //self.logger.info('Identity:', identity);
                    resolve(identity);
                })
                .catch(function (err) {
                    self.logger.info('acknowledgeRequestId ERROR', err);
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
