import {Logger} from "../lib/Logger";
import {SamsungConfigImpl} from "../lib/SamsungConfig";
import {HomeyIpUtilImpl} from "../lib/HomeyIpUtil";
import {HomeyDeviceMock} from "./HomeyDevice";
import {SamsungClientImpl} from "../drivers/Samsung/SamsungClient";

const logger = new Logger({
    logFunc: console.log,
    errorFunc: console.error,
}, {});
const device = new HomeyDeviceMock({logger});
const config = new SamsungConfigImpl({logger});
const homeyIpUtil = new HomeyIpUtilImpl();

export const createSamsungClient = () => new SamsungClientImpl({
    // @ts-ignore
    device,
    config,
    port: 8001,
    connectionTimeout: 10,
    homeyIpUtil,
    logger,
});

