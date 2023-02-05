const expect = require("chai").expect;

import {DeviceSettings} from "../lib/types";
import {createSamsungEncryptedClient} from "./test_create_samsung_encrypted_client";
const samsungClient = createSamsungEncryptedClient();

samsungClient.config.setSetting(DeviceSettings.ipaddress, '192.168.2.105');

describe("samsung_encrypted", function () {

    describe("getUri", function () {
        it("getUri", async function () {
            expect(samsungClient.getUri()).to.eql('http://192.168.2.105:8001/ms/1.0/');
        });
    });

    describe("getHostPort", function () {
        it("getHostPort false", async function () {
            expect(samsungClient.getHostPort(false)).to.eql('http://192.168.2.105:8000');
        });
        it("getHostPort true", async function () {
            expect(samsungClient.getHostPort(true)).to.eql('ws://192.168.2.105:8000');
        });
    });

    describe("getPairingUri", function () {
        it("getPairingUri 0", async function () {
            expect(samsungClient.getPairingUri(0)).to.eql('http://192.168.2.105:8080/ws/pairing?step=0&app_id=12345&device_id=74f3606e-1ce4-45ee-a800-40f2271949d0');
        });
        it("getPairingUri 1", async function () {
            expect(samsungClient.getPairingUri(1)).to.eql('http://192.168.2.105:8080/ws/pairing?step=1&app_id=12345&device_id=74f3606e-1ce4-45ee-a800-40f2271949d0');
        });
        it("getPairingUri 2", async function () {
            expect(samsungClient.getPairingUri(2)).to.eql('http://192.168.2.105:8080/ws/pairing?step=2&app_id=12345&device_id=74f3606e-1ce4-45ee-a800-40f2271949d0');
        });
    });

});
