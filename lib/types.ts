export const DEFAULT_NAME = "homey";

export enum DeviceSettings {
    delay_channel_keys = "delay_channel_keys",
    delay_keys = "delay_keys",
    frameTVSupport = "frameTVSupport",
    ipaddress = "ipaddress",
    mac_address = "mac_address",
    max_volume = "max_volume",
    modelName = "modelName",
    poll_interval = "poll_interval",
    power_state = "power_state",
    power_state_polling = "power_state_polling",
    smartthings = "smartthings",
    smartthings_token = "smartthings_token",
    token = "token",
    tokenAuthSupport = "tokenAuthSupport",

    // Samsung Encrypted
    modelClass = "modelClass",
    duid = "duid",
    identityAesKey = "identityAesKey",
    identitySessionId = "identitySessionId",

    // Samsung Legacy
    mac_address_homey = "mac_address_homey",
}

export interface HomeyDevice {
    getSetting(key: string): any;
    setSettings(settings: any): Promise<void>;
}
