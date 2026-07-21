import {IntegrationTest} from './core/IntegrationRunner';
import {SamsungIntegrationSession} from './SamsungIntegrationSession';

const {YOUTUBE_VIDEO_ID, validateFullOperationSuite} = require('./suitePlan');
const YOUTUBE_APP = {name: 'YouTube', appId: '', dialId: 'YouTube'};

export interface SamsungSuiteOptions {
    includeDisruptive?: boolean;
    channel?: number;
    restoreChannel?: number;
    browserUrl?: string;
}

export function createSamsungIntegrationSuite(
    session: SamsungIntegrationSession,
    options: SamsungSuiteOptions | boolean = {},
): IntegrationTest[] {
    const resolved = typeof options === 'boolean' ? {includeDisruptive: options} : options;
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
                if (!online) throw new Error('The Samsung API did not report the TV as powered on');
            },
        },
        {
            id: 'remote-navigation',
            title: 'Send a remote-control navigation key',
            run: async context => {
                await context.verify('Open a TV menu and place its highlight where it can move right. Is it ready?');
                try {
                    await session.operations.sendKey('KEY_RIGHT');
                    await context.verify('Did the highlighted menu item move right?');
                } finally {
                    await session.operations.sendKey('KEY_LEFT').catch(() => undefined);
                }
            },
        },
        {
            id: 'remote-sequence',
            title: 'Send a list of keys with a delay',
            run: async context => {
                await context.verify('Keep the same TV menu open with room to move right and back. Is it ready?');
                await session.operations.sendKeys('KEY_RIGHT,1000,KEY_LEFT');
                await context.verify('Did the highlight move right and then return left after about one second?');
            },
        },
        {
            id: 'installed-apps',
            title: 'Request installed applications',
            run: async () => {
                await session.operations.refreshApps();
                await new Promise(resolve => setTimeout(resolve, 1500));
                if (!session.operations.getApps()?.length) throw new Error('The TV returned no applications');
            },
        },
    ];

    if (!resolved.includeDisruptive) return tests;

    tests.push(
        {
            id: 'volume-up-down',
            title: 'Increase and restore volume',
            disruptive: true,
            run: async context => {
                await context.verify('Is the TV volume below its maximum and safe to change?');
                await session.operations.volumeUp();
                await context.verify('Did the volume increase by one step?');
                await session.operations.volumeDown();
                await context.verify('Did the volume return to its previous level?');
            },
        },
        {
            id: 'mute-unmute',
            title: 'Mute and restore sound',
            disruptive: true,
            run: async context => {
                await session.operations.toggleMute();
                try {
                    await context.verify('Did the TV become muted?');
                } finally {
                    await session.operations.toggleMute().catch(() => undefined);
                }
                await context.verify('Was sound restored?');
            },
        },
        {
            id: 'set-volume',
            title: 'Set and restore volume through UPnP',
            disruptive: true,
            run: async context => {
                const original = await session.operations.getVolume();
                if (original === undefined) context.skip('UPnP volume is not available on this TV');
                const originalVolume = original as number;
                const target = originalVolume < 100 ? originalVolume + 1 : originalVolume - 1;
                await session.operations.setVolume(target);
                await context.verify(`Did the TV volume change to ${target}?`);
                await session.operations.setVolume(originalVolume);
                await context.verify(`Did the TV volume return to ${originalVolume}?`);
            },
        },
        {
            id: 'channel-up-down',
            title: 'Change and restore the channel',
            disruptive: true,
            run: async context => {
                await context.verify(
                    'Switch the TV to a live-TV source. May the test change the channel up and back down?',
                );
                await session.operations.channelUp();
                await context.verify('Did the TV change one channel up?');
                await session.operations.channelDown();
                await context.verify('Did the TV return one channel down?');
            },
        },
        {
            id: 'change-channel',
            title: 'Enter a channel number',
            disruptive: true,
            run: async context => {
                const channel = resolved.channel;
                if (!channel) context.skip('No target channel was configured');
                await context.verify(`May the test change the live-TV channel to ${channel}?`);
                await session.operations.setChannel(channel as number);
                await context.verify(`Did the TV change to channel ${channel}?`);
                if (resolved.restoreChannel !== undefined) {
                    await session.operations.setChannel(resolved.restoreChannel);
                    await context.verify(`Did the TV return to channel ${resolved.restoreChannel}?`);
                }
            },
        },
        {
            id: 'launch-app',
            title: 'Launch an application',
            disruptive: true,
            run: async context => {
                await session.operations.launchApp(YOUTUBE_APP);
                await context.verify('Did the YouTube application open?');
            },
        },
        {
            id: 'youtube',
            title: 'Launch the test YouTube video',
            disruptive: true,
            run: async context => {
                await session.operations.launchYouTube(YOUTUBE_VIDEO_ID);
                await context.verify(`Did YouTube start video ${YOUTUBE_VIDEO_ID}?`);
            },
        },
        {
            id: 'app-running',
            title: 'Check whether YouTube is running',
            run: async () => {
                if (!(await session.operations.isAppRunning(YOUTUBE_APP))) {
                    throw new Error('The TV did not report YouTube as running');
                }
            },
        },
        {
            id: 'close-app',
            title: 'Close the YouTube application',
            disruptive: true,
            run: async context => {
                await session.operations.closeApp(YOUTUBE_APP);
                await context.verify('Did the YouTube application close?');
            },
        },
        {
            id: 'browser',
            title: 'Launch the TV browser',
            disruptive: true,
            run: async context => {
                const url = resolved.browserUrl || 'https://example.com';
                await session.operations.launchBrowser(url);
                try {
                    await context.verify(`Did the TV browser open ${url}?`);
                } finally {
                    await session.operations.sendKey('KEY_RETURN').catch(() => undefined);
                }
            },
        },
        {
            id: 'art-mode',
            title: 'Enable and leave Frame Art Mode',
            disruptive: true,
            run: async context => {
                if (!session.getProfile().frameTVSupport) context.skip('This TV does not report Frame support');
                await context.verify('May the test enable Art Mode and then return to normal TV mode?');
                await session.operations.artMode(true);
                await context.verify('Did the TV enter Art Mode?');
                await session.operations.artMode(false);
                await context.verify('Did the TV leave Art Mode?');
            },
        },
        {
            id: 'power-cycle',
            title: 'Power off and wake the TV',
            disruptive: true,
            run: async context => {
                if (!session.getProfile().macAddress) context.skip('No MAC address is configured for Wake-on-LAN');
                await context.verify('May the test turn the TV off and then wake it again?');
                await session.operations.turnOff();
                await context.verify('Did the TV turn off completely?');
                await session.operations.wake();
                await context.verify('Did the TV turn back on?');
            },
        },
    );

    validateFullOperationSuite(tests);
    return tests;
}
