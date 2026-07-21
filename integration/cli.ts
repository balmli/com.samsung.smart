#!/usr/bin/env node

import {isIP} from 'net';

import {runInTerminal} from './TerminalRunner';
import {IntegrationWebServer} from './WebServer';

function option(name: string): string | undefined {
    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
    const mode = process.argv[2] || 'web';
    if (mode === 'web') {
        const server = new IntegrationWebServer();
        const address = await server.listen(Number(option('port') || 8765));
        console.log(`Samsung integration tests: http://${address.host}:${address.port}`);
        const stop = async () => {
            await server.close();
            process.exit(0);
        };
        process.once('SIGINT', stop);
        process.once('SIGTERM', stop);
        return;
    }

    if (mode === 'terminal') {
        const ipAddress = option('ip');
        if (!ipAddress || isIP(ipAddress) !== 4) {
            throw new Error('Terminal mode requires --ip <valid TV IPv4 address>');
        }
        process.exitCode = await runInTerminal({
            profileId: option('profile') || ipAddress.replace(/[^a-zA-Z0-9_-]/g, '-'),
            ipAddress,
            macAddress: option('mac'),
            includeDisruptive: process.argv.includes('--disruptive'),
            channel: option('channel') ? Number(option('channel')) : undefined,
            restoreChannel: option('restore-channel') ? Number(option('restore-channel')) : undefined,
            browserUrl: option('browser-url'),
        });
        return;
    }

    throw new Error(`Unknown mode: ${mode}. Use web or terminal.`);
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
