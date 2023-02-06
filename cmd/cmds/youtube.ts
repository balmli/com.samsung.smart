import colors from "colors";
import type {Arguments, CommandBuilder} from "yargs";

import {Log} from "../index";
import {initSamsungClient} from "../api";

type Options = {
    videoid: string;
};

export const command: string = "youtube";
export const desc: string = "Launch YouTube with a video on the TV";

export const builder: CommandBuilder = (yargs) =>
    yargs.options({
        videoid: {
            alias: "v",
            desc: "videoid",
            type: "string",
            demand: true,
            demandOption: false,
        },
    });

export const handler = async (argv: Arguments<Options>): Promise<void> => {
    try {
        const {videoid} = argv;
        const client = await initSamsungClient();
        await client.launchYouTube(videoid);
        Log(colors.green(`✓ Launched YouTube video: ${videoid}`));
    } catch (err: any) {
        Log(colors.red(err.message));
    }
};
