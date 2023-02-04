import Homey from "homey";

import {Logger} from "./Logger";
import {SamsungConfig, SamsungConfigImpl} from "./SamsungConfig";
import {HomeyIpUtil, HomeyIpUtilImpl} from "./HomeyIpUtil";
import {SamsungClient} from "./SamsungBase";

export class BaseDriver extends Homey.Driver {

    logger: any;
    config!: SamsungConfig;
    homeyIpUtil!: HomeyIpUtil;
    samsungClient!: SamsungClient;

    async initDriver(driverType: string) {
        // @ts-ignore
        this.logger = new Logger({
            homey: this.homey,
            logFunc: this.log,
            errorFunc: this.error,
        }, Homey.env);

        this.config = new SamsungConfigImpl({logger: this.logger});
        this.homeyIpUtil = new HomeyIpUtilImpl();

        this.logger.verbose(`${driverType} driver has been initialized`);
    }

}
