import colors from "colors";
import type {Arguments, CommandBuilder} from "yargs";

import {Log} from "../index";
import {initSamsungClient} from "../api";

type Options = {
    appid: string;
};

export const command: string = "launchapp";
export const desc: string = "Launch an app on the TV";

export const builder: CommandBuilder = (yargs) =>
    yargs.options({
        appid: {
            alias: "a",
            desc: "appid",
            type: "string",
            demand: true,
            demandOption: false,
        },
    });

export const handler = async (argv: Arguments<Options>): Promise<void> => {
    try {
        const {appid} = argv;
        const client = await initSamsungClient();
        const appIdIsNumber = !isNaN(Number(appid));
        const app = {
            appId: appIdIsNumber ? appid : undefined,
            dialId: appIdIsNumber ? undefined : appid,
        }
        await client.launchApp(app);
        Log(colors.green(`✓ Launched app: ${appid}`));
    } catch (err: any) {
        Log(colors.red(err.message));
    }
};
