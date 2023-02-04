import net from "net";
import PairSession from "homey/lib/PairSession";

import {BaseDriver} from "../../lib/BaseDriver";
import {DeviceSettings} from "../../lib/types";
import {SamsungEncryptedClient, SamsungEncryptedClientImpl} from "./SamsungEncryptedClient";

module.exports = class SamsungEncryptedDriver extends BaseDriver {

    samsungEncryptedClient!: SamsungEncryptedClient;

    async onInit(): Promise<void> {
        await super.initDriver('Samsung Encrypted');
        this.samsungClient = new SamsungEncryptedClientImpl({
            config: this.config,
            port: 8001,
            homeyIpUtil: this.homeyIpUtil,
            logger: this.logger
        });
        this.samsungEncryptedClient = this.samsungClient as SamsungEncryptedClient;
    }

    async onPair(session: PairSession): Promise<void> {

        let devices: any[] = [];

        session.setHandler('ip_address_entered', async (data) => {
            this.log('onPair: ip_address_entered:', data);
            let ipaddress = data.ipaddress;

            if (!net.isIP(ipaddress)) {
                throw new Error(this.homey.__('pair.valid_ip_address'));
            }

            const info = await this.samsungClient.getInfo(ipaddress, 2000);
            if (!info) {
                throw new Error(this.homey.__('pair.no_tvs_on_ip'));
            }
            await this.config.setSetting(DeviceSettings.ipaddress, ipaddress).catch((err: any) => this.logger.error(err));

            const deviceName = info.DeviceName;
            const modelName = info.ModelName;
            const modelClass = this.modelClass(modelName);
            if (!modelClass) {
                throw new Error(this.homey.__('pair.encrypted.invalid_model', {modelName} ));
            }

            devices = [{
                name: deviceName,
                data: {
                    id: modelName
                },
                settings: {
                    ipaddress,
                    duid: this.getDuidFromInfo(info),
                    modelName,
                    modelClass
                }
            }];

            await session.showView('pin_wait');
        });

        session.setHandler('showView', async (viewId) => {
            if (viewId === 'pin_wait') {
                await this.samsungEncryptedClient.showPinPage();
                await this.samsungEncryptedClient.startPairing();
                await session.showView('set_pin_code');
            }
        });

        session.setHandler('pincode', async (pincode) => {
            try {
                const pin = pincode.join('');
                this.logger.info('pincode:', pin, devices);

                let requestId = await this.samsungEncryptedClient.confirmPin(pin);
                this.logger.info('pincode requestId:', requestId);

                const identity = await this.samsungEncryptedClient.acknowledgeRequestId(requestId);
                this.logger.info('pincode identity:', identity);

                if (identity) {
                    devices[0].settings[DeviceSettings.identitySessionId] = identity.sessionId;
                    devices[0].settings[DeviceSettings.identityAesKey] = identity.aesKey;
                    return true;
                } else {
                    this.logger.info('pincode error: no identify');
                    return false;
                }

            } catch (err) {
                this.logger.error('pincode error:', err);
                return false;
            } finally {
                const hidePinPage = await this.samsungEncryptedClient.hidePinPage();
                this.logger.info('pincode hidePinPage:', hidePinPage);
            }
        });

        session.setHandler("list_devices", async () => {
            return devices;
        });
    }

    getDuidFromInfo(val: any) {
        const duid = val?.DUID || val?.device?.duid;
        return duid ?
            (duid.indexOf(':') >= 0 && duid.split(':').length > 1 ? duid.split(':')[1] : duid) :
            undefined;
    }

    modelClass(model: string): string | undefined {
        const tizenPattern = new RegExp('[U|E|N]+\\d+[J]([S|U|No|P])?\\d+([W|K|B|U|T])?');
        const sakepPattern = new RegExp('[U|E|N]+\\d+[H]([S|U|No|P])?\\d+([W|K|B|U|T])?');
        return tizenPattern.test(model) ? 'tizen' : sakepPattern.test(model) ? 'sakep' : undefined;
    }

};
