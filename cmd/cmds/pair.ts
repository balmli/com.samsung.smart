import colors from "colors";
import type {Arguments, CommandBuilder} from "yargs";

import {DeviceSettings} from "../../lib/types";
import {Log} from "../index";
import {getConfig, initSamsungClient, setClient, setSetting} from "../api";

type Options = {
    ipaddress: string;
};

export const command: string = "pair";
export const desc: string = "Pair Samsung TV";

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
        await setClient("Samsung");
        const {ipaddress} = argv;
        await setSetting(DeviceSettings.ipaddress, ipaddress);
        const client = await initSamsungClient();
        getConfig().setSetting(DeviceSettings.ipaddress, ipaddress);

        const info = await client.getInfo(ipaddress, 2000);
        if (!info) {
            throw new Error("Unable to find a Samsung TV on that IP address");
        }

        const modelName = info.device.modelName;
        const frameTVSupport = info.device.FrameTVSupport === 'true';
        const tokenAuthSupport = info.device.TokenAuthSupport === 'true';

        const modelClass = client.modelClass(modelName);
        if (modelClass) {
            throw new Error(`This is a ${modelName} model, and does not support H, HU, J, JU or JS models`);
        }

        Log(colors.green(`✓ DeviceName : ${info.name}, ModelName : ${modelName}`));

        getConfig().setSetting(DeviceSettings.modelName, modelName);
        await setSetting(DeviceSettings.modelName, modelName);
        getConfig().setSetting(DeviceSettings.frameTVSupport, frameTVSupport);
        await setSetting(DeviceSettings.frameTVSupport, frameTVSupport);
        getConfig().setSetting(DeviceSettings.tokenAuthSupport, tokenAuthSupport);
        await setSetting(DeviceSettings.tokenAuthSupport, tokenAuthSupport);

        if (tokenAuthSupport) {
            const token = await client.pair();
            await setSetting(DeviceSettings.token, token);
            Log(colors.green(`✓ Token: ${token}`));
        }

        Log(colors.green(`✓ Pairing completed. ${modelName}`));
    } catch (err: any) {
        Log(colors.red(err.message));
    }
};
