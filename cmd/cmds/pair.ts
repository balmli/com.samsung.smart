import colors from "colors";
import type {Arguments, CommandBuilder} from "yargs";

import {DeviceSettings} from "../../lib/types";
import {Log} from "../index";
import {getConfig, initSamsungClient, setSetting} from "../api";

type Options = {
    ipaddress: string;
};

export const command: string = "pair";
export const desc: string = "Pair TV";

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
        const {ipaddress} = argv;
        await setSetting(DeviceSettings.ipaddress, ipaddress);
        const client = await initSamsungClient();

        const info = await client.getInfo(ipaddress, 100);
        if (info) {
            getConfig().setSetting(DeviceSettings.modelName, info.device.modelName);
            await setSetting(DeviceSettings.modelName, info.device.modelName);
            getConfig().setSetting(DeviceSettings.frameTVSupport, info.device.FrameTVSupport === 'true');
            await setSetting(DeviceSettings.frameTVSupport, info.device.FrameTVSupport === 'true');
            getConfig().setSetting(DeviceSettings.tokenAuthSupport, info.device.TokenAuthSupport === 'true');
            await setSetting(DeviceSettings.tokenAuthSupport, info.device.TokenAuthSupport === 'true');

            const token = await client.pair();
            await setSetting(DeviceSettings.token, token);
            Log(colors.green(`✓ Token: ${token}`));
        }
    } catch (err: any) {
        Log(colors.red(err.message));
    }
};
