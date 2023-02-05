import colors from "colors";
import type {Arguments, CommandBuilder} from "yargs";
import {prompt} from "enquirer";

import {DeviceSettings} from "../../lib/types";
import {Log} from "../index";
import {getConfig, initSamsungClient, setClient, setSetting} from "../api";
import {SamsungEncryptedClient} from "../../drivers/SamsungEncrypted/SamsungEncryptedClient";

type Options = {
    ipaddress: string;
};

export const command: string = "pairenc";
export const desc: string = "Pair Samsung (H, HU, J, JU and JS models) TV";

export const builder: CommandBuilder = (yargs) =>
    yargs.options({
        ipaddress: {
            alias: "ip",
            desc: "ipaddress",
            type: "string",
            demand: true,
            demandOption: false,
        },
    });

export const handler = async (argv: Arguments<Options>): Promise<void> => {
    try {
        await setClient("Samsung Encrypted");
        const {ipaddress} = argv;
        await setSetting(DeviceSettings.ipaddress, ipaddress);
        const client = await initSamsungClient();
        const samsungEncryptedClient = client as SamsungEncryptedClient;
        getConfig().setSetting(DeviceSettings.ipaddress, ipaddress);

        const info = await client.getInfo(ipaddress, 2000);
        if (!info) {
            throw new Error("Unable to find a Samsung TV on that IP address");
        }

        const modelName = info.ModelName;
        const modelClass = client.modelClass(modelName);
        if (!modelClass) {
            throw new Error(`This is a ${modelName} model. Only H, HU, J, JU and JS models`);
        }
        const duid = samsungEncryptedClient.getDuidFromInfo(info);

        Log(colors.green(`✓ DeviceName : ${info.DeviceName}, ModelName : ${modelName}, ModelClass : ${modelClass}, DUID : ${duid}`));

        getConfig().setSetting(DeviceSettings.modelName, modelName);
        await setSetting(DeviceSettings.modelName, modelName);
        getConfig().setSetting(DeviceSettings.modelClass, modelClass);
        await setSetting(DeviceSettings.modelClass, modelClass);
        getConfig().setSetting(DeviceSettings.duid, duid);
        await setSetting(DeviceSettings.duid, duid);

        await samsungEncryptedClient.showPinPage();
        await samsungEncryptedClient.startPairing();

        const response = await prompt({
            type: 'input',
            name: 'pin',
            message: 'Enter pin'
        });
        // @ts-ignore
        const pin = response.pin;

        const requestId = await samsungEncryptedClient.confirmPin(pin);
        const identity = await samsungEncryptedClient.acknowledgeRequestId(requestId);

        await samsungEncryptedClient.hidePinPage();

        getConfig().setSetting(DeviceSettings.identitySessionId, identity.sessionId);
        await setSetting(DeviceSettings.identitySessionId, identity.sessionId);

        getConfig().setSetting(DeviceSettings.identityAesKey, identity.aesKey);
        await setSetting(DeviceSettings.identityAesKey, identity.aesKey);

        Log(colors.green(`✓ identitySessionId : ${identity.sessionId}, identityAesKey : ${identity.aesKey}`));
        Log(colors.green(`✓ Pairing completed. ${modelName}`));
    } catch (err: any) {
        Log(colors.red(err.message));
    }
};
