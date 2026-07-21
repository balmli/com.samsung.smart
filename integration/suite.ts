import {IntegrationTest} from './core/IntegrationRunner';
import {SamsungIntegrationSession} from './SamsungIntegrationSession';

export function createSamsungIntegrationSuite(
    session: SamsungIntegrationSession,
    includeDisruptive = false,
): IntegrationTest[] {
    const tests: IntegrationTest[] = [
        {
            id: 'device-info',
            title: 'Read and validate TV information',
            run: async () => {
                await session.inspect();
            },
        },
        {
            id: 'power-state',
            title: 'Read the local Samsung power state',
            run: async () => {
                const online = await session.operations.isOnline(2000);
                if (!online) {
                    throw new Error('The Samsung API did not report the TV as powered on');
                }
            },
        },
        {
            id: 'remote-info',
            title: 'Send a remote-control key',
            run: async context => {
                await context.verify('Is the TV powered on and ready to show its information overlay?');
                try {
                    await session.operations.sendKey('KEY_INFO');
                    await context.verify('Did the TV show an information overlay?');
                } finally {
                    await session.operations.sendKey('KEY_RETURN').catch(() => undefined);
                }
            },
        },
    ];

    if (includeDisruptive) {
        tests.push(
            {
                id: 'volume-up',
                title: 'Increase volume',
                disruptive: true,
                run: async context => {
                    await context.verify('Is the TV volume below its maximum and safe to increase?');
                    await session.operations.volumeUp();
                    await context.verify('Did the TV volume increase by one step?');
                },
            },
            {
                id: 'mute-toggle',
                title: 'Toggle mute twice',
                disruptive: true,
                run: async context => {
                    await session.operations.toggleMute();
                    const answer = await context.verify('Did the TV mute state change?');
                    if (answer.outcome === 'yes') {
                        await session.operations.toggleMute();
                    }
                },
            },
        );

        if (session.getProfile().macAddress) {
            tests.push({
                id: 'power-cycle',
                title: 'Power off and wake the TV',
                disruptive: true,
                run: async context => {
                    await context.verify('May the test turn the TV off and then wake it again?');
                    await session.operations.turnOff();
                    await context.verify('Did the TV turn off?');
                    await session.operations.wake();
                    await context.verify('Did the TV turn back on?');
                },
            });
        }
    }

    return tests;
}
