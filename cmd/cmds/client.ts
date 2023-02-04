import colors from "colors";
import type {Arguments, CommandBuilder} from "yargs";

const {Select} = require("enquirer");

import {Log} from "../index";
import {setClient} from "../api";

export const clients = ["Samsung", "Samsung Encrypted", "Samsung Legacy"];

type Options = {
    client: string | undefined;
};

export const command: string = "client";
export const desc: string = "Select client";

export const builder: CommandBuilder = (yargs) =>
    yargs.options({
        client: {
            alias: "c",
            desc: "client",
            type: "string",
        },
    });

export const handler = async (argv: Arguments<Options>): Promise<void> => {
    try {
        const {client} = argv;
        if (client) {
            if (!clients.includes(client as string)) {
                throw new Error(`No such client: ${client}`);
            }
            await setClient(client);
            Log(colors.green(`✓ Client set: ${client}`));
        } else {
            const prompt = new Select({
                name: "client",
                message: "Select a client",
                choices: clients,
            });
            const client = await prompt.run();
            if (client) {
                await setClient(client);
                Log(colors.green(`✓ Client set: ${client}`));
            }
        }
    } catch (err: any) {
        Log(colors.red(err.message));
    }
};
