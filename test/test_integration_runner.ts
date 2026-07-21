const expect = require('chai').expect;
const {saveProfileForm} = require('../integration/web/form');
const {FULL_OPERATION_TEST_IDS, YOUTUBE_VIDEO_ID, validateFullOperationSuite} = require('../integration/suitePlan');

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

describe('Samsung integration web profile form', function () {
    it('resets the submitted form after the asynchronous save completes', async function () {
        let resetCount = 0;
        const form = {reset: () => resetCount++};
        let finishSave: () => void = () => undefined;
        const save = () => new Promise<void>(resolve => (finishSave = resolve));

        const submission = saveProfileForm(form, save, () => ({id: 'living-room', ipAddress: '192.0.2.1'}));
        finishSave();
        await submission;

        expect(resetCount).to.equal(1);
    });
});

describe('Samsung Homey-operation hardware suite', function () {
    it('covers the maintained Homey operations and uses the requested YouTube video', async function () {
        expect(FULL_OPERATION_TEST_IDS).to.include.members([
            'remote-navigation',
            'remote-sequence',
            'volume-up-down',
            'mute-unmute',
            'set-volume',
            'channel-up-down',
            'change-channel',
            'youtube',
            'app-running',
            'close-app',
            'browser',
            'art-mode',
            'power-cycle',
        ]);
        expect(YOUTUBE_VIDEO_ID).to.equal('aqz-KE-bpKQ');
        expect(() => validateFullOperationSuite(FULL_OPERATION_TEST_IDS.map((id: string) => ({id})))).to.not.throw();
    });
});
