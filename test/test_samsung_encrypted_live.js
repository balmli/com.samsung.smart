const chai = require('chai');
const expect = chai.expect;
const readline = require('readline');
const SamsungEncrypted = require('../drivers/SamsungEncrypted/SamsungEncrypted');

const _samsung = new SamsungEncrypted({
    ip_address: '192.168.2.105',
    port: 8001,
    api_timeout: 2000,
    delay_keys: 100,
    delay_channel_keys: 1250,
    appId: '721b6fce-4ee6-48ba-8045-955a539edadb',
    deviceId: undefined,
    userId: '654321'
});

let apiActive = false;

describe("apiActive", function () {
    this.timeout(10000);
    describe("apiActive", function () {
        it("apiActive", async () => {
            apiActive = await _samsung.apiActive();
        });
    });
});

function ifConditionIt(title, test) {
    return apiActive ? it(title, test) : it.skip(title, test);
}

describe("samsung_encrypted_live", function () {

    describe("apiActive", function () {
        ifConditionIt("apiActive", async function () {
            const apiActive = await _samsung.apiActive().data;
            expect(apiActive).to.eql(true);
        });
    });

    describe("getInfo", function () {
        ifConditionIt("getInfo", async function () {
            const getInfo = await _samsung.getInfo().data;
            expect(getInfo.DeviceID).to.eql('uuid:348a7102-c2a4-4dff-8bea-6f062d892043');
            expect(getInfo.DeviceName).to.eql('[TV] Samsung 8 Series (55)');
            expect(getInfo.IP).to.eql('192.168.2.105');
            expect(getInfo.ModelName).to.eql('UE55KS8005');
        });
    });

    describe("getStartService", function () {
        ifConditionIt("getStartService", async function () {
            const getStartService = await _samsung.getStartService();
            expect(getStartService).to.eql(true);
        });
    });

    describe("getHandshake", function () {
        ifConditionIt("getHandshake", async function () {
            const getHandshake = await _samsung.getHandshake();
            expect(getHandshake.length > 0).to.eql(true);
        });
    });

    describe("showPinPage", function () {
        ifConditionIt("showPinPage", async function () {
            const showPinPage = await _samsung.showPinPage();
            expect(showPinPage).to.eql(true);
        });
    });

    describe("hidePinPage", function () {
        ifConditionIt("hidePinPage", async function () {
            const hidePinPage = await _samsung.hidePinPage();
            expect(hidePinPage).to.eql(true);
        });
    });

    describe("pairing", function () {
        ifConditionIt("pairing", async function () {
            const showPinPage = await _samsung.showPinPage();
            expect(showPinPage).to.eql(true);

            const startPairing = await _samsung.startPairing();
            expect(startPairing).to.eql(true);

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

            const pin = await input('Enter the pin: ');
            expect(pin, 'Missing pin').to.not.eql(undefined);

            let requestId = await _samsung.confirmPin({pin});
            expect(requestId, 'Missing requestId').to.not.eql(undefined);
            console.log('requestId', requestId);
            await _samsung._delay(1000);

            let identity = await _samsung.acknowledgeRequestId(requestId);
            expect(identity, 'Missing identity').to.not.eql(undefined);
            console.log('identity', identity);

            _samsung.config()['identitySessionId'] = identity.sessionId;
            _samsung.config()['identityAesKey'] = identity.aesKey;

            const encrypted = _samsung.encryptMessage({
                eventType: 'EMP',
                plugin: 'SecondTV'
            });
            console.log('encrypted', encrypted);

            const decrypted = _samsung.decryptMessage(encrypted);
            console.log('decrypted', decrypted);
        });
    });
});
