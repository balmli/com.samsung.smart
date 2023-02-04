import net from "net";
import PairSession from "homey/lib/PairSession";

import {BaseDriver} from "../../lib/BaseDriver";
import {UPnPClient, UPnPClientImpl} from "../../lib/UPnPClient";
import {SamsungClientImpl} from "./SamsungClient";

module.exports = class SamsungDriver extends BaseDriver {

    async onInit(): Promise<void> {
        await super.initDriver('Samsung');
        this.samsungClient = new SamsungClientImpl({
            config: this.config,
            port: 8001,
            homeyIpUtil: this.homeyIpUtil,
            logger: this.logger
        });
    }

    async onPair(session: PairSession): Promise<void> {

        let devices: any[] = [];
        let stopSearch = false;
        const upnpClient: UPnPClient = new UPnPClientImpl({config: this.config, logger: this.logger});
        upnpClient.on('device', async (event: any) => {
            this.logger.info(`UPnP device found: ${event.ip_address})`);
            await this.checkForTV({ ipAddress: event.ip_address, devices, session });
        });

        session.setHandler('list_devices', async (data) => {
            try {
                const startIpAddress = await this.homeyIpUtil.getHomeyIpAddress(this.homey);

                upnpClient.search();

                let lastDot = startIpAddress.lastIndexOf(".");
                let ipAddrPrefix = startIpAddress.substring(0, lastDot + 1);
                let ipHomey = Number(startIpAddress.substring(lastDot + 1, startIpAddress.length));
                let first = Math.max(ipHomey - 20, 2);
                let last = Math.min(first + 40, 254);

                const searchTimeout = this.homey.setTimeout(() => {
                    this.logger.info('searchForTVs timeout');
                    stopSearch = true;
                }, 29000);

                for (let i = first; i <= last; i++) {
                    if (stopSearch) {
                        break;
                    }
                    await this.checkForTV({ ipAddress: ipAddrPrefix + i, devices, session });
                }
                for (let i = 2; i < 255; i++) {
                    if (stopSearch) {
                        break;
                    }
                    if (i < first || i > last) {
                        await this.checkForTV({ ipAddress: ipAddrPrefix + i, devices, session });
                    }
                }
                this.homey.clearTimeout(searchTimeout);

                if (devices.length === 0) {
                    session.showView('ip_address');
                } else {
                    return devices;
                }
            } catch (err) {
                throw new Error(this.homey.__('pair.no_tvs'));
            }
        });

        session.setHandler('ip_address_entered', async (data) => {
            this.log('onPair: ip_address_entered:', data);
            let ipAddress = data.ipaddress;

            if (!net.isIP(ipAddress)) {
                throw new Error(this.homey.__('pair.valid_ip_address'));
            }

            await this.checkForTV({ ipAddress, devices, session });
            if (devices.length === 0) {
                throw new Error(this.homey.__('pair.no_tvs_on_ip'));
            }

            return devices[0];
        });

        session.setHandler('disconnect', async () => {
            stopSearch = true;
        });
    }

    async checkForTV({ ipAddress, devices, session } : {
        ipAddress: string,
        devices: any[],
        session?: PairSession,
    }): Promise<boolean> {
        this.logger.info('checkForTV', ipAddress);
        const info = await this.samsungClient.getInfo(ipAddress, 100);
        if (info && this.isValidDevice(info) && devices.find(d => d.data.id === info.id) === undefined) {
            this.logger.info('Found TV: ', ipAddress, info);
            devices.push({
                name: info.name,
                data: {
                    id: info.id
                },
                settings: {
                    ipaddress: ipAddress,
                    modelName: info.device.modelName,
                    frameTVSupport: info.device.FrameTVSupport === 'true',
                    tokenAuthSupport: info.device.TokenAuthSupport === 'true',
                }
            });
            session?.emit('list_devices', devices);
            return true;
        }
        return false;
    }

    private isValidDevice(info: any) {
        return info && (!info.type || info.type !== 'Samsung Speaker');
    }

};
