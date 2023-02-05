const expect = require("chai").expect;

import {createSamsungClient} from "./test_create_samsung_client";
const samsungClient = createSamsungClient();


describe("_commandsChannel", function () {
    describe("simple", function () {
        it("simple 1", function () {
            expect(samsungClient._commandsChannel(1)).to.eql(['KEY_1','KEY_ENTER']);
        });
        it("simple 3", function () {
            expect(samsungClient._commandsChannel(123)).to.eql(['KEY_1','KEY_2','KEY_3','KEY_ENTER']);
        });
    });
});
