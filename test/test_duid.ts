const expect = require("chai").expect;

import {createSamsungEncryptedClient} from "./test_create_samsung_encrypted_client";
const samsungClient = createSamsungEncryptedClient();


describe("duid", function () {

    describe("undefined", function () {
        it("undefined 1", async function () {
            expect(samsungClient.getDuidFromInfo('')).to.eql(undefined);
        });
        it("undefined 2", async function () {
            expect(samsungClient.getDuidFromInfo({ DUID: undefined})).to.eql(undefined);
        });
    });

    describe("set", function () {
        it("set 1", async function () {
            expect(samsungClient.getDuidFromInfo({DUID: '07270e01-0078-1000-8cd0-5056bf7d0220'})).to.eql('07270e01-0078-1000-8cd0-5056bf7d0220');
        });
        it("set 2", async function () {
            expect(samsungClient.getDuidFromInfo({DUID: 'uuid:348a7102-c2a4-4dff-8bea-6f062d892043'})).to.eql('348a7102-c2a4-4dff-8bea-6f062d892043');
        });
    });
});
