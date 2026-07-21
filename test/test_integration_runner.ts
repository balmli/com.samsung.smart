const expect = require('chai').expect;

import {
    HumanCheckpointBroker,
    IntegrationRunner,
    IntegrationTest,
    RunSnapshot,
} from '../integration/core/IntegrationRunner';

async function waitFor(
    predicate: () => boolean,
    timeout = 1000,
): Promise<void> {
    const started = Date.now();
    while (!predicate()) {
        if (Date.now() - started > timeout) {
            throw new Error('Timed out waiting for runner state');
        }
        await new Promise(resolve => setImmediate(resolve));
    }
}

describe('Samsung integration runner', function () {
    it('records automated and accepted human checks', async function () {
        const checkpoint = new HumanCheckpointBroker();
        const tests: IntegrationTest[] = [
            {
                id: 'automatic',
                title: 'Automatic check',
                run: async () => undefined,
            },
            {
                id: 'observed',
                title: 'Observed check',
                run: async context => {
                    await context.verify('Did the operation work?');
                },
            },
        ];
        const runner = new IntegrationRunner(tests, checkpoint);

        const run = runner.run();
        await waitFor(() => checkpoint.getPending() !== undefined);
        checkpoint.answer({outcome: 'yes', note: 'Visible on the TV'});
        const result = await run;

        expect(result.status).to.equal('passed');
        expect(result.tests.map(test => test.status)).to.eql(['passed', 'passed']);
        expect(result.tests[1].note).to.equal('Visible on the TV');
    });

    it('records No as a failed observation and Skip separately', async function () {
        const checkpoint = new HumanCheckpointBroker();
        const tests: IntegrationTest[] = [
            {
                id: 'failed-observation',
                title: 'Failed observation',
                run: async context => {
                    await context.verify('Did it work?');
                },
            },
            {
                id: 'skipped-observation',
                title: 'Skipped observation',
                run: async context => {
                    await context.verify('Can you verify it?');
                },
            },
        ];
        const snapshots: RunSnapshot[] = [];
        const runner = new IntegrationRunner(tests, checkpoint);
        runner.on('change', (snapshot: RunSnapshot) => snapshots.push(snapshot));

        const run = runner.run();
        await waitFor(() => checkpoint.getPending()?.testId === 'failed-observation');
        checkpoint.answer({outcome: 'no', note: 'Nothing changed'});
        await waitFor(() => checkpoint.getPending()?.testId === 'skipped-observation');
        checkpoint.answer({outcome: 'skip', note: 'Cannot see the volume overlay'});
        const result = await run;

        expect(result.status).to.equal('failed');
        expect(result.tests.map(test => test.status)).to.eql(['failed', 'skipped']);
        expect(snapshots.some(snapshot => snapshot.status === 'awaiting-human')).to.equal(true);
    });
});
