#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

yargs(hideBin(process.argv)).commandDir("./cmds").strict().alias({ h: "help" }).help().argv;
