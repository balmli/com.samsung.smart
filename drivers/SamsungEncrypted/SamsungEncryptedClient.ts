const WebSocket = require('ws');
const http = require('http.min');

const Encryption = require('@balmli/homey-samsung-encryption');

import {DeviceSettings} from "../../lib/types";
import {SamsungBase, SamsungClient} from "../../lib/SamsungBase";

const USER_ID = '654321'
const APP_ID = '12345';
const DEVICE_ID = '74f3606e-1ce4-45ee-a800-40f2271949d0';

export interface SamsungEncryptedClient extends SamsungClient {
    /**
     *
     */
    showPinPage(): Promise<void>;

    /**
     *
     */
    hidePinPage(): Promise<void>;

    /**
     *
     */
    startPairing(): Promise<boolean>;

    /**
     *
     * @param pin
     */
    confirmPin(pin: any): Promise<any>;

    /**
     *
     * @param requestId
     */
    acknowledgeRequestId(requestId: any): Promise<any>;

    /**
     *
     * @param val
     */
    getDuidFromInfo(val: any): string | undefined;
}

export class SamsungEncryptedClientImpl extends SamsungBase implements SamsungEncryptedClient {

    getUri(ipAddress?: string) {
        return `http://${(ipAddress || this.config.getSetting(DeviceSettings.ipaddress))}:${this.port}/ms/1.0/`;
    }

    async turnOn() {
        return this.sendKey(this.isSakep() ? 'KEY_POWERON' : 'KEY_POWER');
    }

    async turnOff() {
        return this.sendKey(this.isSakep() ? 'KEY_POWEROFF' : 'KEY_POWER');
    }

    getApps() {
        return this._apps.filter((a: any) => !!a.dialId);
    }

    async sendKey(aKey: string, aCmd?: string): Promise<void> {
        this.logger.info('sendKey', aKey);
        return this.connectAndSend(this.encryptMessageAndCreate('callCommon', {
            method: 'POST',
            body: {
                plugin: 'RemoteControl',
                version: '1.000',
                api: 'SendRemoteKey',
                param1: this.getDuid(),
                param2: 'Click',
                param3: aKey,
                param4: 'false'
            }
        }));
    }

    async _connection() {
        let mask: string;
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

                this.socket.on('message', (response: any) => {
                    const data = Buffer.isBuffer(response) ? response.toString() : response;
                    //self.logger.info('_connection:', data);
                    self._onMessage(data);

                    resolve(true);

                }).on('close', () => {
                    self._clearSocketTimeout();
                    self.socket = null;

                }).on('error', (err: any) => {
                    if (err.code && err.code === 'ECONNREFUSED') {
                        const msg = self.i18n?.__('errors.connection_refused', {address: err.address, port: err.port});
                        self.logger.info(`Socket connect failed:`, msg);
                        reject(msg);
                    } else if (err.code && err.code === 'EHOSTUNREACH') {
                        const msg = self.i18n?.__('errors.connection_hostunreachable', {
                            address: err.address,
                            port: err.port
                        });
                        self.logger.info(`Socket connect failed:`, msg);
                        reject(msg);
                    } else if (err.code && err.code === 'ENETUNREACH') {
                        const msg = self.i18n?.__('errors.connection_netunreachable', {
                            address: err.address,
                            port: err.port
                        });
                        self.logger.info(`Socket connect failed:`, msg);
                        reject(msg);
                    } else if (err.code && err.code === 'ETIMEDOUT' || err.toString().indexOf('ETIMEDOUT') >= 0) {
                        const msg = self.i18n?.__('errors.conn.connection_timedout');
                        self.logger.info(`Socket timeout:`, msg);
                        reject(msg);
                    } else if (err.code && err.code === 'ECONNRESET' || err.toString().indexOf('ECONNRESET') >= 0) {
                        const msg = self.i18n?.__('errors.conn.connection_reset');
                        self.logger.info(`Socket connection reset:`, msg);
                        reject(msg);
                    } else {
                        self.logger.error('Socket error:', err);
                        reject(self.i18n?.__('errors.connection_unknown', {message: err}));
                    }
                });
            }
        });
    }

    _onMessage(data: any) {
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

        }
        //} else if (data.startsWith('5::/com.samsung.companion:')) {
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
        //}
    }

    _addSocketTimeout() {
        this._clearSocketTimeout();
        this.socketTimeout = this.device?.homey.setTimeout(() => this._onSocketTimeout(), 1000 * 60 * 2);
    }

    _clearSocketTimeout() {
        if (this.socketTimeout) {
            this.device?.homey.clearTimeout(this.socketTimeout);
            this.socketTimeout = undefined;
        }
    }

    _onSocketTimeout() {
        if (this.socket) {
            this.logger.info('_onSocketTimeout');
            this.socket.close();
        }
    }

    async connectAndSend(aMsg: any): Promise<any> {
        const self = this;
        return this._commandQueue.add(() => new Promise(async (resolve, reject) => {
            try {
                await this._connection();
            } catch (err) {
                return reject(err);
            }
            if (this.socket.readyState !== WebSocket.OPEN) {
                const msg = self.i18n?.__('errors.conn.readystate_not_open');
                self.logger.info('Socket not ready:', msg);
                return reject(msg);
            }
            self.logger.info('connectAndSend', aMsg);
            try {
                this.socket.send(aMsg, (error: any) => {
                    if (error) {
                        reject(error)
                    } else {
                        resolve(true);
                    }
                });
            } catch (err: any) {
                const msg = self.i18n?.__('errors.conn.send_failed', {message: err.message});
                self.logger.info(`Socket send failed:`, msg);
                reject(msg);
            }
        }));
    }

    private async getStartService() {
        return new Promise((resolve, reject) => {
            http.get({uri: `${this.getHostPort(false)}/common/1.0.0/service/startService?appID=com.samsung.companion`})
                .then(function (data: any) {
                    resolve(true);
                })
                .catch(function (err: any) {
                    reject(false);
                });
        });
    }

    private async getHandshake(): Promise<string> {
        return new Promise((resolve, reject) => {
            http.get({uri: `${this.getHostPort(false)}/socket.io/1`})
                .then(function (data: any) {
                    const handshake = data.data.split(':');
                    //this.logger.info('getHandshake:', handshake[0]);
                    resolve(handshake[0]);
                })
                .catch(function (err: any) {
                    reject(false);
                });
        });
    }

    private encryptMessageAndCreate(name: any, message: any) {
        return '5::/com.samsung.companion:' + JSON.stringify({
            name: name,
            args: [this.encryptMessage(message)]
        });
    }

    private encryptMessage(message: any) {
        return Encryption.encryptData(this.config.getSetting(DeviceSettings.identityAesKey), this.config.getSetting(DeviceSettings.identitySessionId), message);
    }

    private decryptMessage(message: any) {
        //this.logger.info('descryptMessage', this._config.identityAesKey, message);
        return Encryption.decryptData(this.config.getSetting(DeviceSettings.identityAesKey), message);
    }

    async showPinPage(): Promise<void> {
        let data = await this.applicationCmd({name: "CloudPINPage", appId: "", dialId: "CloudPINPage"}, 'post');
        //this.logger.info('showPinPage', data.response.statusCode);
        return data && data.response && (data.response.statusCode === 200 || data.response.statusCode === 201);
    }

    async hidePinPage(): Promise<void> {
        let data = await this.applicationCmd({name: "CloudPINPage", appId: "", dialId: "CloudPINPage"}, 'delete');
        //this.logger.info('hidePinPage', data.response.statusCode);
        return data && data.response && (data.response.statusCode === 200 || data.response.statusCode === 201);
    }

    startPairing(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            http.get({
                uri: `${this.getPairingUri(0)}&type=1`,
                timeout: 10000
            })
                .then(function (data: any) {
                    resolve(true);
                })
                .catch(function (err: any) {
                    reject(false);
                });
        });
    }

    confirmPin(pin: any): Promise<any> {
        //this.logger.info('Sending server hello 1:', pin, typeof pin);
        const serverHello = Encryption.generateServerHello(USER_ID, pin);
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
                .then(function (data: any) {
                    const authData = JSON.parse(data.data.auth_data);
                    //self.logger.info('Received server hello', data.data);
                    //self.logger.info('Validating server hello auth data', authData.GeneratorClientHello);
                    if (Encryption.parseClientHello(authData.GeneratorClientHello) !== 0) {
                        reject(self.i18n?.__('pair.encrypted.invalid_pin'));
                    }

                    //self.logger.info('Obtained requestId', authData.request_id);
                    resolve(authData.request_id);
                })
                .catch(function (err: any) {
                    self.logger.info('confirmPin ERROR', err);
                    reject(err);
                });
        });
    }

    acknowledgeRequestId(requestId: any): Promise<any> {
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
                .then(function (data: any) {
                    //self.logger.info('Received client acknowledge', data.data);
                    const authData = JSON.parse(data.data.auth_data);
                    //self.logger.info('Validating acknowledge auth data', authData.ClientAckMsg);
                    const clientAck = Encryption.parseClientAcknowledge(authData.ClientAckMsg);

                    if (!clientAck) {
                        reject(self.i18n?.__('pair.encrypted.failed_ack_client'));
                    }

                    //self.logger.info('acknowledgeRequestId clientAck', authData, clientAck);

                    const identity = {
                        sessionId: authData.session_id,
                        aesKey: Encryption.getKey()
                    };

                    //self.logger.info('Identity:', identity);
                    resolve(identity);
                })
                .catch(function (err: any) {
                    self.logger.info('acknowledgeRequestId ERROR', err);
                    reject(false);
                });
        });
    }

    getHostPort(ws: boolean) {
        return `${(ws ? 'ws' : 'http')}://${this.config.getSetting(DeviceSettings.ipaddress)}:8000`;
    }

    getWsUri(mask: string) {
        return `${this.getHostPort(true)}/socket.io/1/websocket/${mask}`;
    }

    getPairingUri(step: number) {
        return `http://${this.config.getSetting(DeviceSettings.ipaddress)}:8080/ws/pairing?step=${step}&app_id=${APP_ID}&device_id=${DEVICE_ID}`;
    }

    private isSakep(): boolean {
        return this.config.getSetting(DeviceSettings.modelClass) === 'sakep';
    }

    private getDuid(): string {
        return this.config.getSetting(DeviceSettings.duid);
    }

    getDuidFromInfo(val: any): string | undefined {
        const duid = val?.DUID || val?.device?.duid;
        return duid ?
            (duid.indexOf(':') >= 0 && duid.split(':').length > 1 ? duid.split(':')[1] : duid) :
            undefined;
    }

}
