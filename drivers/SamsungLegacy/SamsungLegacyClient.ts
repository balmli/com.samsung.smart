const net = require("net");
const chr = String.fromCharCode;

import {DEFAULT_NAME, DeviceSettings} from "../../lib/types";
import {SamsungBase, SamsungClient} from "../../lib/SamsungBase";

const APP_STRING = 'iphone..iapp.samsung';
const TV_APP_STRING = 'iphone.UN60D6000.iapp.samsung';

export class SamsungLegacyClientImpl extends SamsungBase implements SamsungClient {

    async turnOn(): Promise<void> {
        return this.sendKey('KEY_POWERON');
    }

    async turnOff(): Promise<void> {
        return this.sendKey('KEY_POWEROFF');
    }

    async sendKey(aKey: string, aCmd?: string): Promise<void> {
        return this.socketCmd(aKey);
    }

    private async socketCmd(aCmd: string): Promise<void> {
        const self = this;
        return new Promise((resolve, reject) => {
            const socket = net.connect(self.port, self.config.getSetting(DeviceSettings.ipaddress));

            socket.setTimeout(2000);

            socket.on('connect', async () => {
                const chunkOne = await self._socketChunkOne();
                socket.write(chunkOne);
                socket.write(self._socketChunkTwo(aCmd));
                socket.end();
                socket.destroy();
                resolve();
            });

            socket.on('error', function (err: any) {
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

            socket.on('timeout', () => {
                reject(self.i18n?.__('errors.connection_timeout'));
            });
        });
    }

    private async _socketChunkOne() {
        // TODO hente Homey IP uten await
        const ip_address_homey = await this.homeyIpUtil.getHomeyIpAddress(this.device!.homey);
        const ipEncoded = this.base64Encode(ip_address_homey);
        // TODO Ikke i settings
        const macEncoded = this.base64Encode(this.config.getSetting(DeviceSettings.mac_address_homey));

        const message = chr(0x64)
            + chr(0x00)
            + chr(ipEncoded.length)
            + chr(0x00)
            + ipEncoded
            + chr(macEncoded.length)
            + chr(0x00)
            + macEncoded
            + chr(this.base64Encode(DEFAULT_NAME).length)
            + chr(0x00)
            + this.base64Encode(DEFAULT_NAME);

        return chr(0x00)
            + chr(APP_STRING.length)
            + chr(0x00)
            + APP_STRING
            + chr(message.length)
            + chr(0x00)
            + message;
    }

    private _socketChunkTwo(command: string) {
        const message = chr(0x00)
            + chr(0x00)
            + chr(0x00)
            + chr(this.base64Encode(command).length)
            + chr(0x00)
            + this.base64Encode(command);

        return chr(0x00)
            + chr(TV_APP_STRING.length)
            + chr(0x00)
            + TV_APP_STRING
            + chr(message.length)
            + chr(0x00)
            + message;
    }

}
