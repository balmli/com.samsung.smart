import {SamsungConfig, SamsungConfigImpl} from "../lib/SamsungConfig";
import {Logger} from "../lib/Logger";
import {SamsungClient} from "../lib/SamsungBase";
import {HomeyIpUtilImpl} from "../lib/HomeyIpUtil";
import {UPnPClientImpl} from "../lib/UPnPClient";
import {SamsungClientImpl} from "../drivers/Samsung/SamsungClient";

import {settings} from "./index";
import {DeviceSettings, HomeyDevice} from "../lib/types";
import {SamsungEncryptedClientImpl} from "../drivers/SamsungEncrypted/SamsungEncryptedClient";
import {SamsungLegacyClientImpl} from "../drivers/SamsungLegacy/SamsungLegacyClient";

let device: HomeyDevice;
let config: SamsungConfig;
let samsungClient: SamsungClient;

export const getDevice = (): HomeyDevice => {
    return device;
}

export const getConfig = (): SamsungConfig => {
    return config;
}

export const getClient = async () => {
    return await settings.get("client");
};

export const setClient = async (client: string) => {
    await settings.set("client", client);
    await initialize(client);
};

export const getSetting = async (key: DeviceSettings) => {
    const client = await getClient();
    return await settings.get(`${client}-${key}`);
}

export const setSetting = async (key: DeviceSettings, value: any) => {
    const client = await getClient();
    const val = typeof value === 'object' ? JSON.stringify(value) : value;
    await settings.set(`${client}-${key}`, val);
}

export const initSamsungClient = async () => {
    const client = await getClient();

    // @ts-ignore
    let logger = new Logger({
        logFunc: console.log,
        errorFunc: console.error,
    }, {});

    config = new SamsungConfigImpl({logger});
    let homeyIpUtil = new HomeyIpUtilImpl();

    let upnpClient = new UPnPClientImpl({config, logger});
    upnpClient.on('available', (event: any) => {
        console.log(event);
    });

    if (client === "Samsung") {
        samsungClient = new SamsungClientImpl({
            config,
            port: 8001,
            connectionTimeout: 10,
            homeyIpUtil,
            logger
        });
        getConfig().setSetting(DeviceSettings.ipaddress, await getSetting(DeviceSettings.ipaddress));
        getConfig().setSetting(DeviceSettings.tokenAuthSupport, await getSetting(DeviceSettings.tokenAuthSupport));
        getConfig().setSetting(DeviceSettings.token, await getSetting(DeviceSettings.token));

    } else if (client === "Samsung Encrypted") {
        samsungClient = new SamsungEncryptedClientImpl({
            config,
            port: 8001,
            homeyIpUtil,
            logger
        });
        getConfig().setSetting(DeviceSettings.ipaddress, await getSetting(DeviceSettings.ipaddress));
        getConfig().setSetting(DeviceSettings.modelName, await getSetting(DeviceSettings.modelName));
        getConfig().setSetting(DeviceSettings.modelClass, await getSetting(DeviceSettings.modelClass));
        getConfig().setSetting(DeviceSettings.duid, await getSetting(DeviceSettings.duid));
        getConfig().setSetting(DeviceSettings.identitySessionId, await getSetting(DeviceSettings.identitySessionId));
        getConfig().setSetting(DeviceSettings.identityAesKey, await getSetting(DeviceSettings.identityAesKey));

    } else if (client === "Samsung Legacy") {
        samsungClient = new SamsungLegacyClientImpl({
            config,
            port: 55000,
            homeyIpUtil,
            logger
        });
    }

    return samsungClient;
}

const initialize = async (toClient?: string) => {
    try {
        const client = toClient ? toClient : await getClient();
        if (client) {
            if (toClient) {
                //Log(colors.green(`✓ Initialized: ${toClient}`));
            }
        }
    } catch (err) {
        console.log("initialize failed:", err);
    }
};

initialize();
