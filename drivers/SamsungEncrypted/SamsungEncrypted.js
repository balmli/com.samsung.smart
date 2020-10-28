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

    async turnOn() {
        return this.sendKey(this._config.modelClass === 'sakep' ? 'KEY_POWERON' : 'KEY_POWER');
    }

    async turnOff() {
        return this.sendKey(this._config.modelClass === 'sakep' ? 'KEY_POWEROFF' : 'KEY_POWER');
    }

    getApps() {
        return [
            {
                appId: 'YouTube',
                name: 'YouTube'
            },
            {
                appId: 'Netflix',
                name: 'Netflix'
            },
            {
                appId: 'Plex',
                name: 'Plex'
            }
        ];
    }

    async getApp(appId) {
        return this.applicationCmd(appId, 'get');
    }

    async isAppRunning(appId) {
        let response = await this.getApp(appId).catch(err => {
        });
        return this.isRunning(response);
    }

    isRunning(response) {
        return response && response.data && response.data.indexOf('running') >= 0;
    }

    async launchApp(appId, launchData) {
        let response = await this.getApp(appId);
        if (this.isRunning(response)) {
            return true;
        }
        this._onSocketTimeout();
        let data = await this.applicationCmd(appId, 'post', launchData);
        return data && data.response && (data.response.statusCode === 200 || data.response.statusCode === 201);
    }

    async applicationCmd(appId, cmd, launchData) {
        let lData = launchData || '';
        const self = this;
        return new Promise((resolve, reject) => {
            http[cmd]({
                uri: 'http://' + this._config.ip_address + ':8080/ws/apps/' + appId + (cmd === 'delete' ? '/run' : ''),
                headers: {
                    'Content-Type': 'text/plain',
                    'Content-Length': Buffer.byteLength(lData)
                },
                timeout: 10000
            }, lData)
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
        return this.launchApp('YouTube', 'v=' + videoId);
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

                this.logger.verbose('_connection', uri);

                this.socket.on('message', data => {
                    //this.logger.info('_connection:', data);
                    this._onMessage(data);

                    resolve();

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
            this.logger.info('_onSocketTimeout');
            this.socket.close();
        }
    }

    async connectAndSend(aMsg) {
        const self = this;
        return new Promise(async (resolve, reject) => {
            try {
                await this._connection();
            } catch (error) {
                return reject(error ? error : self.i18n.__('errors.connection'));
            }
            this.logger.info('connectAndSend', aMsg);
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
        let data = await this.applicationCmd('CloudPINPage', 'post');
        //this.logger.info('showPinPage', data.response.statusCode);
        return data && data.response && (data.response.statusCode === 200 || data.response.statusCode === 201);
    }

    async hidePinPage() {
        let data = await this.applicationCmd('CloudPINPage', 'delete');
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
                    //this.logger.info('Received server hello', data.data);
                    //this.logger.info('Validating server hello auth data', authData.GeneratorClientHello);
                    if (Encryption.parseClientHello(authData.GeneratorClientHello) !== 0) {
                        reject(self.i18n.__('pair.encrypted.invalid_pin'));
                    }

                    //this.logger.info('Obtained requestId', authData.request_id);
                    resolve(authData.request_id);
                })
                .catch(function (err) {
                    this.logger.info('confirmPin ERROR', err);
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
                    //this.logger.info('Received client acknowledge', data.data);
                    const authData = JSON.parse(data.data.auth_data);
                    //this.logger.info('Validating acknowledge auth data', authData.ClientAckMsg);
                    const clientAck = Encryption.parseClientAcknowledge(authData.ClientAckMsg);

                    if (!clientAck) {
                        reject(self.i18n.__('pair.encrypted.failed_ack_client'));
                    }

                    //this.logger.info('acknowledgeRequestId clientAck', authData, clientAck);

                    const identity = {
                        sessionId: authData.session_id,
                        aesKey: Encryption.getKey()
                    };

                    //this.logger.info('Identity:', identity);
                    resolve(identity);
                })
                .catch(function (err) {
                    this.logger.info('acknowledgeRequestId ERROR', err);
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
