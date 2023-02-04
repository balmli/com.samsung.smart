import net from "net";
import PairSession from "homey/lib/PairSession";

import {BaseDriver} from "../../lib/BaseDriver";
import {SamsungLegacyClientImpl} from "./SamsungLegacyClient";

module.exports = class SamsungLegacyDriver extends BaseDriver {

    async onInit(): Promise<void> {
        await super.initDriver('Samsung Legacy');
        this.samsungClient = new SamsungLegacyClientImpl({
            config: this.config,
            port: 55000,
            homeyIpUtil: this.homeyIpUtil,
            logger: this.logger
        });
    }

    async onPair(session: PairSession): Promise<void> {

        let devices: any[] = [];

        session.setHandler('ip_address_entered', async (data) => {
            this.log('onPair: ip_address_entered:', data);
            const ipAddress = data.ipaddress;

            if (!net.isIP(ipAddress)) {
                throw new Error(this.homey.__('pair.valid_ip_address'));
            }

            const pingResponse = await this.samsungClient.pingPort(ipAddress);
            if (!pingResponse) {
                throw new Error(this.homey.__('pair.no_tvs_on_ip'));
            }

            devices = [{
                name: 'Samsung TV',
                data: {
                    id: 'samsung_tv_' + ipAddress
                },
                settings: {
                    ipaddress: ipAddress,
                    modelName: 'legacy'
                }
            }];

            return devices[0];
        });
    };

};