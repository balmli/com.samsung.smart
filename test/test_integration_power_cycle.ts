const expect = require('chai').expect;

import {waitForOffThenWake} from '../integration/powerCycle';
import {redactIntegrationLog} from '../integration/SamsungIntegrationSession';

describe('Samsung integration power cycle', function () {
    it('waits for shutdown and retries Wake-on-LAN until the TV is online', async function () {
        const calls: string[] = [];
        const onlineStates = [true, false, false, true];
        const operations = {
            isOnline: async () => {
                calls.push('isOnline');
                return onlineStates.shift() ?? true;
            },
            wake: async () => {
                calls.push('wake');
            },
        };

        await waitForOffThenWake(operations, {
            offlineTimeoutMs: 20,
            pollIntervalMs: 0,
            settleDelayMs: 0,
            wakeAttempts: 3,
            wakeWaitMs: 0,
        });

        expect(calls).to.eql(['isOnline', 'isOnline', 'wake', 'isOnline', 'wake', 'isOnline']);
    });

    it('removes a TV MAC address from integration logs', function () {
        expect(redactIntegrationLog('wake: 5C:49:7D:F3:38:7F')).to.equal('wake: [mac-address]');
    });
});
