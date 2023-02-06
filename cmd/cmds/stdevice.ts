import colors from "colors";
import type {Arguments, CommandBuilder} from "yargs";

import {Log} from "../index";
import {getConfig, initSmartThingsClient} from "../api";
import {DeviceSettings} from "../../lib/types";

type Options = {
    token: string;
    deviceId: string;
};

export const command: string = "stdevice";
export const desc: string = "List SmartThings devices";

export const builder: CommandBuilder = (yargs) =>
    yargs.options({
        token: {
            alias: "t",
            desc: "token",
            type: "string",
            demand: true,
            demandOption: false,
        },
        deviceId: {
            alias: "d",
            desc: "deviceId",
            type: "string",
            demand: true,
            demandOption: false,
        },
    });

export const handler = async (argv: Arguments<Options>): Promise<void> => {
    try {
        const {token, deviceId} = argv;
        const client = await initSmartThingsClient();
        getConfig().setSetting(DeviceSettings.smartthings_token, token);

        const device = await client.fetchSmartThingsDevice(deviceId, '/status');
        if (device) {
            const main = device.components.main;
            Log(colors.green(`✓ Fetched SmartThings device: ${deviceId}:`));
            Log(colors.yellow(JSON.stringify(device)));
            showAttribute(`Name`, main.ocf.n.value);
            showAttribute(`Model number`, main.ocf.mnmo.value);
            showAttribute(`Platform version`, main.ocf.mnpv.value);
            showAttribute(`Platform OS`, main.ocf.mnos.value);
            showAttribute(`Firmware version`, main.ocf.mnfv.value);
            showAttribute(`Vendor ID`, main.ocf.vid.value);
            showAttribute(`Supported input sources`, main.mediaInputSource.supportedInputSources.value);
            showAttribute(`Input source`, main.mediaInputSource.inputSource.value);
            showAttribute(`Supported picture modes`, main['custom.picturemode'].supportedPictureModes.value);
            showAttribute(`Picture mode`, main['custom.picturemode'].pictureMode.value);
        }
    } catch (err: any) {
        Log(colors.red(err.message));
    }
};

const showAttribute = (label: string, attribute: any) => {
    try {
        Log(colors.cyan(`${label}: `) + colors.white(attribute));
    } catch (err) {
    }
}
