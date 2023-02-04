import {DEFAULT_NAME, DeviceSettings} from "../../lib/types";
import {SamsungBase, SamsungClient} from "../../lib/SamsungBase";

const WebSocket = require('ws');

export class SamsungClientImpl extends SamsungBase implements SamsungClient {

    getUri(ipAddress?: string) {
        return `http://${(ipAddress || this.config.getSetting(DeviceSettings.ipaddress))}:${this.port}/api/v2/`;
    }

    async pair(): Promise<string> {
        return new Promise(async (resolve, reject) => {
            const uri = this.getWsUri(true);
            this.logger.info(`Pair to ${uri}`);

            let ws = new WebSocket(uri, {
                rejectUnauthorized: false
            });

            ws.on('message', (response: any) => {
                const message = Buffer.isBuffer(response) ? response.toString() : response;
                this.logger.verbose('pair: message: ', message);
                const data = JSON.parse(message);
                ws.close();

                // Got the token
                if (data.data && data.data.token) {
                    this.logger.verbose('pair: got token', data.data.token);
                    resolve(data.data.token);
                } else {
                    reject();
                }
            }).on('close', () => {
                ws = null;
            }).on('error', (error: any) => {
                this.logger.info('Pair error', error);
                ws.close();
                reject();
            })
        });
    }

    async getListOfApps(): Promise<any> {
        return this.connectAndSend({
            method: 'ms.channel.emit',
            params: {
                event: 'ed.installedApp.get',
                to: 'host'
            }
        });
    }

    async turnOn(): Promise<void> {
        return this.sendKey('KEY_POWER');
    }

    async turnOff(): Promise<void> {
        return this.config.getSetting(DeviceSettings.frameTVSupport) ? this.holdKey('KEY_POWER', 5000) : this.sendKey('KEY_POWER');
    }

    async sendKey(aKey: string, aCmd?: string): Promise<void> {
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

    async mouseMove(posX: number, posY: number): Promise<any> {
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

    async mouseClick(left = true): Promise<any> {
        return this.connectAndSend({
            method: "ms.remote.control",
            params: {
                Cmd: left ? "LeftClick" : "RightClick",
                TypeOfRemote: "ProcessMouseDevice"
            }
        });
    }

    async sendText(text: string): Promise<any> {
        return this.connectAndSend({
            method: "ms.remote.control",
            params: {
                Cmd: this.base64Encode(text),
                DataOfCmd: "base64",
                TypeOfRemote: "SendInputString"
            }
        });
    }

    async sendInputEnd(): Promise<any> {
        return this.connectAndSend({
            method: "ms.remote.control",
            params: {
                TypeOfRemote: "SendInputEnd"
            }
        });
    }

    async launchBrowser(url: string): Promise<any> {
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

    async artMode(onOff: boolean): Promise<any> {
        if (!this.config.getSetting(DeviceSettings.frameTVSupport)) {
            throw new Error(this.device?.homey.__('errors.frame_is_not_supported'));
        }
        const homeyIpAddress = await this.homeyIpUtil.getHomeyIpAddress(this.device!.homey);
        return this.connectAndSend({
            method: 'ms.channel.emit',
            params: {
                event: 'art_app_request',
                to: 'host',
                clientIp: homeyIpAddress,
                deviceName: this.base64Encode(DEFAULT_NAME),
                data: JSON.stringify({
                    id: this.getId(),
                    value: onOff ? 'on' : 'off',
                    request: 'set_artmode_status'
                })
            }
        });
    }

    async _connection() {
        return new Promise((resolve, reject) => {

            if (this.socket) {
                this._addSocketTimeout();
                resolve(true);
            } else {

                let tokenAuthSupport = this.config.getSetting(DeviceSettings.tokenAuthSupport);
                let token = this.config.getSetting(DeviceSettings.token);
                this.logger.verbose('_connection: tokenAuthSupport:', tokenAuthSupport, ', token:', token);

                const hostPort = this.getHostPort(tokenAuthSupport);
                const uri = this.getWsUri(tokenAuthSupport, token);

                const self = this;

                this.socket = new WebSocket(uri, {
                    rejectUnauthorized: false
                });

                this.logger.verbose('_connection', tokenAuthSupport, token, uri);

                this.socket.on('message', (response: any) => {
                    const message = Buffer.isBuffer(response) ? response.toString() : response;
                    this.logger.verbose('WS message: ', message);
                    const data = JSON.parse(message);

                    if (data.event === "ms.channel.connect") {
                        if (data.data && data.data.token) {
                            const token = data.data.token;
                            this.logger.info(`_connection: got a new token ${token}`);
                            self.config.setSetting(DeviceSettings.token, token).catch((err: any) => this.logger.error(err));
                        }

                        this._addSocketTimeout();

                        resolve(true);
                    } else if (data.event === 'ed.installedApp.get') {
                        try {
                            const apps = data.data.data;
                            if (apps && apps.length > 0) {
                                this.logger.info(`_connection: got ${apps.length} apps`);
                                this.mergeApps(apps.map((a: any) => ({ appId: a.appId, name: a.name })));
                                this.logger.verbose(`_connection: after merge:`, this.getApps());
                            }
                        } catch (err: any) {
                        }
                    }

                }).on('close', () => {
                    this._clearSocketTimeout();
                    this.socket = null;

                }).on('error', (err: any) => {
                    if (err.code && err.code === 'ECONNREFUSED') {
                        const msg = self.device?.homey.__('errors.connection_refused', { address: err.address, port: err.port });
                        self.logger.info(`Socket connect failed:`, msg);
                        reject(msg);
                    } else if (err.code && err.code === 'EHOSTUNREACH') {
                        const msg = self.device?.homey.__('errors.connection_hostunreachable', { address: err.address, port: err.port });
                        self.logger.info(`Socket connect failed:`, msg);
                        reject(msg);
                    } else if (err.code && err.code === 'ENETUNREACH') {
                        const msg = self.device?.homey.__('errors.connection_netunreachable', { address: err.address, port: err.port });
                        self.logger.info(`Socket connect failed:`, msg);
                        reject(msg);
                    } else if (err.code && err.code === 'ETIMEDOUT' || err.toString().indexOf('ETIMEDOUT') >= 0) {
                        const msg = self.device?.homey.__('errors.conn.connection_timedout');
                        self.logger.info(`Socket timeout:`, msg);
                        reject(msg);
                    } else if (err.code && err.code === 'ECONNRESET' || err.toString().indexOf('ECONNRESET') >= 0) {
                        const msg = self.device?.homey.__('errors.conn.connection_reset');
                        self.logger.info(`Socket connection reset:`, msg);
                        reject(msg);
                    } else if (err.toString().indexOf('invalid status code 1005') >= 0) {
                        if (!this.config.getSetting(DeviceSettings.tokenAuthSupport) || !this.config.getSetting(DeviceSettings.token)) {
                            const msg = self.device?.homey.__('errors.conn.token_missing');
                            self.logger.info(`Socket token:`, msg);
                            reject(msg);
                        } else {
                            const msg = self.device?.homey.__('errors.conn.token_error');
                            self.logger.info(`Socket token:`, msg);
                            reject(msg);
                        }
                    } else {
                        self.logger.error('Socket error:', err);
                        reject(self.device?.homey.__('errors.connection_unknown', { message: err }));
                    }
                });
            }
        });
    }

    _addSocketTimeout() {
        this._clearSocketTimeout();
        this.socketTimeout = this.device?.homey.setTimeout(() => this._onSocketTimeout(), this.connectionTimeout);
    }

    _clearSocketTimeout() {
        if (this.socketTimeout) {
            this.device?.homey.clearTimeout(this.socketTimeout);
            this.socketTimeout = undefined;
        }
    }

    _onSocketTimeout() {
        if (this.socket) {
            this.logger.verbose('_onSocketTimeout');
            this.socket.close();
        }
    }

    private async connectAndSend(aCmd: any): Promise<any> {
        const self = this;
        return this._commandQueue.add(() => new Promise(async (resolve, reject) => {
            try {
                await this._connection();
            } catch (err: any) {
                return reject(err);
            }
            if (this.socket.readyState !== WebSocket.OPEN) {
                const msg = self.device?.homey.__('errors.conn.readystate_not_open');
                self.logger.info('Socket not ready:', msg);
                return reject(msg);
            }
            this.logger.info('connectAndSend', aCmd);
            try {
                this.socket.send(JSON.stringify(aCmd), (error: any) => {
                    if (error) {
                        reject(error)
                    } else {
                        resolve(true);
                    }
                });
            } catch (err: any) {
                const msg = self.device?.homey.__('errors.conn.send_failed', { message: err.message });
                self.logger.info(`Socket send failed:`, msg);
                reject(msg);
            }
        }));
    }

    private getHostPort(tokenAuthSupport: boolean) {
        return `${(tokenAuthSupport ? 'wss' : 'ws')}://${this.config.getSetting(DeviceSettings.ipaddress)}:${(tokenAuthSupport ? 8002 : 8001)}`;
    }

    private getWsUri(tokenAuthSupport: boolean, token?: string) {
        const app_name_base64 = this.base64Encode(DEFAULT_NAME);
        const tokenPart = token ? ('&token=' + token) : '';
        return `${this.getHostPort(tokenAuthSupport)}/api/v2/channels/samsung.remote.control?name=${app_name_base64}${tokenPart}`;
    }

}
