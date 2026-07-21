const YOUTUBE_VIDEO_ID = 'aqz-KE-bpKQ';
const FULL_OPERATION_TEST_IDS = [
    'remote-navigation',
    'remote-sequence',
    'volume-up-down',
    'mute-unmute',
    'set-volume',
    'channel-up-down',
    'change-channel',
    'launch-app',
    'youtube',
    'app-running',
    'close-app',
    'browser',
    'art-mode',
    'power-cycle',
];

function validateFullOperationSuite(tests) {
    const ids = new Set(tests.map(test => test.id));
    const missing = FULL_OPERATION_TEST_IDS.filter(id => !ids.has(id));
    if (missing.length) throw new Error(`The Homey-operation suite is missing: ${missing.join(', ')}`);
}

module.exports = {FULL_OPERATION_TEST_IDS, YOUTUBE_VIDEO_ID, validateFullOperationSuite};
