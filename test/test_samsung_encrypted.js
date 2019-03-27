const expect = require("chai").expect;
const SamsungEncrypted = require('../lib/samsung_encrypted');

describe("samsung_encrypted", function () {

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

    describe("getUri", function () {
        it("getUri", async function () {
            expect(_samsung.getUri()).to.eql('http://192.168.2.105:8001/ms/1.0/');
        });
    });

    describe("getHostPort", function () {
        it("getHostPort false", async function () {
            expect(_samsung.getHostPort(false)).to.eql('http://192.168.2.105:8000');
        });
        it("getHostPort true", async function () {
            expect(_samsung.getHostPort(true)).to.eql('ws://192.168.2.105:8000');
        });
    });

    describe("getPairingUri", function () {
        it("getPairingUri 0", async function () {
            expect(_samsung.getPairingUri(0)).to.eql('http://192.168.2.105:8080/ws/pairing?step=0&app_id=721b6fce-4ee6-48ba-8045-955a539edadb&device_id=undefined');
        });
        it("getPairingUri 1", async function () {
            expect(_samsung.getPairingUri(1)).to.eql('http://192.168.2.105:8080/ws/pairing?step=1&app_id=721b6fce-4ee6-48ba-8045-955a539edadb&device_id=undefined');
        });
        it("getPairingUri 2", async function () {
            expect(_samsung.getPairingUri(2)).to.eql('http://192.168.2.105:8080/ws/pairing?step=2&app_id=721b6fce-4ee6-48ba-8045-955a539edadb&device_id=undefined');

        });

    });

});
