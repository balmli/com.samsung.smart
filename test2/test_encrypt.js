'use strict';

const readline = require('readline');
const SamsungEncrypted = require('../drivers/SamsungEncrypted/SamsungEncrypted');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

async function input(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            resolve(answer);
        });
    });
}

const _samsung = new SamsungEncrypted({
    device: this,
    name: "homey",
    ip_address: '192.168.2.105',
    mac_address: '???',
    port: 8001,
    api_timeout: 2000,
    delay_keys: 100,
    delay_channel_keys: 1250,
    appId: '721b6fce-4ee6-48ba-8045-955a539edadb',
    deviceId: undefined,
    userId: '654321'
});

const pair = async function () {
    console.log('showPinPage:', await _samsung.showPinPage());
    await _samsung._delay(200);

    console.log('startPairing:', await _samsung.startPairing());
    const pin = await input('Enter the pin: ');

    try {
        let requestId = await _samsung.confirmPin(pin);
        console.log('requestId:', requestId);
        await _samsung._delay(100);

        if (requestId) {
            console.log('acknowledgeRequestId');
            let identity = await _samsung.acknowledgeRequestId(requestId);
            console.log('acknowledgeRequestId identity:', identity);

            _samsung.config()['identitySessionId'] = identity.sessionId;
            _samsung.config()['identityAesKey'] = identity.aesKey;

            console.log('new config', _samsung.config());

            const encrypted = _samsung.encryptMessage({
                eventType: 'EMP',
                plugin: 'SecondTV'
            });
            console.log('encryptMessage:', encrypted);

            const encryptedStr = JSON.stringify(encrypted);

            const decrypted = _samsung.decryptMessage(encryptedStr);
            console.log('decryptMessage:', decrypted);

            //await _samsung._delay(500);
            //console.log('sendKey KEY_VOLUP');
            //console.log('sendKey KEY_VOLUP: ', await _samsung.sendKey('KEY_VOLUP'));
        }
    } catch (err) {
        console.log('error', err);
    } finally {
        console.log('hidePinPage:', await _samsung.hidePinPage());
    }
};

pair();
