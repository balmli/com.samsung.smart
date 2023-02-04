import colors from "colors";
import type {Arguments, CommandBuilder} from "yargs";

import {Log} from "../index";
import {initSamsungClient} from "../api";

type Options = {
    key: string;
};

export const command: string = "sendkey";
export const desc: string = "Send key to TV";

export const builder: CommandBuilder = (yargs) =>
    yargs.options({
        key: {
            alias: "k",
            desc: "key",
            type: "string",
            demand: true,
            demandOption: false,
        },
    });

export const handler = async (argv: Arguments<Options>): Promise<void> => {
    try {
        const {key} = argv;
        const client = await initSamsungClient();
        await client.sendKey(key);
        Log(colors.green(`✓ Sent key: ${key}`));
    } catch (err: any) {
        Log(colors.red(err.message));
    }
};
