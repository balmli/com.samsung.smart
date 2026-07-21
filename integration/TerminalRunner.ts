import {randomUUID} from 'crypto';
import {createInterface} from 'readline/promises';

import {IntegrationProfile, IntegrationProfileStore} from './core/IntegrationProfileStore';
import {HumanCheckpointBroker, IntegrationRunner, TestResult} from './core/IntegrationRunner';
import {SamsungIntegrationSession} from './SamsungIntegrationSession';
import {createSamsungIntegrationSuite} from './suite';

export interface TerminalOptions {
    profileId: string;
    ipAddress: string;
    macAddress?: string;
    includeDisruptive?: boolean;
}

export async function runInTerminal(options: TerminalOptions): Promise<number> {
    const input = createInterface({input: process.stdin, output: process.stdout});
    const store = new IntegrationProfileStore();
    const existing = await store.get(options.profileId);
    const profile: IntegrationProfile = {
        id: options.profileId,
        clientId: existing?.clientId || `integration-${randomUUID()}`,
        clientName: existing?.clientName || 'Homey Samsung Integration Tests',
        ipAddress: options.ipAddress,
        macAddress: options.macAddress || existing?.macAddress,
        token: existing?.token,
        tokenAuthSupport: existing?.tokenAuthSupport,
        frameTVSupport: existing?.frameTVSupport,
        modelName: existing?.modelName,
    };
    await store.save(profile);
    const session = new SamsungIntegrationSession(profile, store);
    session.on('log', entry => console.log(`[${entry.level}] ${entry.message}`));

    try {
        const inspected = await session.inspect();
        console.log(`Connected to ${inspected.modelName} at ${inspected.ipAddress}.`);
        if (inspected.tokenAuthSupport && !inspected.paired) {
            console.log('Press OK/Allow on the TV remote when the permission prompt appears.');
            await session.pair();
            console.log('Pairing completed with the separate integration-test identity.');
        }

        const checkpoints = new HumanCheckpointBroker();
        const runner = new IntegrationRunner(
            createSamsungIntegrationSuite(session, options.includeDisruptive),
            checkpoints,
        );
        checkpoints.on('change', async pending => {
            if (!pending) return;
            const answer = await input.question(`${pending.prompt} [y]es/[n]o/[s]kip: `);
            const outcome = answer.trim().toLowerCase().startsWith('y')
                ? 'yes'
                : answer.trim().toLowerCase().startsWith('n')
                  ? 'no'
                  : 'skip';
            checkpoints.answer({outcome});
        });
        runner.on('change', snapshot => {
            const active = snapshot.tests.find((test: TestResult) =>
                ['running', 'awaiting-human'].includes(test.status),
            );
            if (active?.status === 'running') console.log(`Running: ${active.title}`);
        });

        const result = await runner.run();
        for (const test of result.tests) {
            console.log(`${test.status.toUpperCase().padEnd(7)} ${test.title}${test.note ? ` — ${test.note}` : ''}`);
        }
        return result.status === 'passed' ? 0 : 1;
    } finally {
        input.close();
        session.close();
    }
}
