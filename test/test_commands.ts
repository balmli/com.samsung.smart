const expect = require("chai").expect;

import {createSamsungClient} from "./test_create_samsung_client";
const samsungClient = createSamsungClient();

describe("_commands", function () {
    describe("simple", function () {
        it("simple 1", function () {
            expect(samsungClient._commands('KEY_1')).to.eql(['KEY_1']);
        });
        it("simple 2", function () {
            expect(samsungClient._commands(['KEY_1'])).to.eql(['KEY_1']);
        });
        it("simple 3", function () {
            expect(samsungClient._commands('KEY_1,KEY_2')).to.eql(['KEY_1', 'KEY_2']);
        });
    });
    describe("multiply", function () {
        it("mult 1", function () {
            expect(samsungClient._commands('KEY_1*2')).to.eql(['KEY_1', 'KEY_1']);
        });
        it("mult 2", function () {
            expect(samsungClient._commands(['KEY_1*99', 'KEY_ENTER']).length).to.eql(100);
        });
        it("mult 3", function () {
            expect(samsungClient._commands('KEY_1*100').length).to.eql(100);
        });
        it("mult 4", function () {
            let cmds = samsungClient._commands('KEY_VOLUP*10,KEY_ENTER');
            expect(cmds).to.eql(['KEY_VOLUP', 'KEY_VOLUP', 'KEY_VOLUP', 'KEY_VOLUP', 'KEY_VOLUP', 'KEY_VOLUP', 'KEY_VOLUP', 'KEY_VOLUP', 'KEY_VOLUP', 'KEY_VOLUP', 'KEY_ENTER']);
        });
    });
    describe("delay", function () {
        it("delay 1", function () {
            expect(samsungClient._commands('KEY_16_9,2500,KEY_PLAY')).to.eql(['KEY_16_9',2500,'KEY_PLAY']);
        });
        it("delay 2", function () {
            expect(samsungClient._commands('KEY_16_9,KEY_VOLUP*10,2500,KEY_PLAY')).to.eql(['KEY_16_9','KEY_VOLUP','KEY_VOLUP','KEY_VOLUP','KEY_VOLUP','KEY_VOLUP','KEY_VOLUP','KEY_VOLUP','KEY_VOLUP','KEY_VOLUP','KEY_VOLUP',2500,'KEY_PLAY']);
        });
        it("delay 3", function () {
            expect(samsungClient._commands('KEY_16_9,123.45,KEY_PLAY')).to.eql(['KEY_16_9',123.45,'KEY_PLAY']);
        });
        it("delay 4", function () {
            expect(function () {samsungClient._commands('KEY_16_9,0,KEY_PLAY')}).to.throw('errors.invalid_delay');
        });
        it("delay 5", function () {
            expect(function () {samsungClient._commands('KEY_16_9,-1,KEY_PLAY')}).to.throw('errors.invalid_delay');
        });
        it("delay 6", function () {
            expect(samsungClient._commands('KEY_16_9,9999,KEY_PLAY')).to.eql(['KEY_16_9',9999,'KEY_PLAY']);
        });
        it("delay 7", function () {
            expect(function () {samsungClient._commands('KEY_16_9,10000,KEY_PLAY')}).to.throw('errors.invalid_delay');
        });
    });
    describe("lowercase", function () {
        it("valid-but-lowercase 1", function () {
            expect(samsungClient._commands('key_1')).to.eql(['KEY_1']);
        });
    });
    describe("max 100 keys", function () {
        it("max 100 1", function () {
            expect(function () {
                samsungClient._commands('KEY_1*200')
            }).to.throw('errors.invalid_number_of_keys');
        });
    });
    describe("invalid keys", function () {
        it("invalid key 1", function () {
            expect(function () {
                samsungClient._commands('KEY_XYZ')
            }).to.throw('errors.invalid_key');
        });
    });
});
