import colors from "colors";
import type {Arguments, CommandBuilder} from "yargs";

import {Log} from "../index";
import {initSamsungClient} from "../api";

type Options = {};

export const command: string = "turnon";
export const desc: string = "Turn on TV";

export const builder: CommandBuilder = (yargs) =>
    yargs.options({});

export const handler = async (argv: Arguments<Options>): Promise<void> => {
    try {
        const client = await initSamsungClient();
        await client.wake();
        Log(colors.green(`✓ Turned on`));
    } catch (err: any) {
        Log(colors.red(err.message));
    }
};
