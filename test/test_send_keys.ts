const expect = require("chai").expect;

import {createSamsungClient} from "./test_create_samsung_client";
const samsungClient = createSamsungClient();


describe("sendKeys", function () {

    // Override, for testing
    // @ts-ignore
    samsungClient.sendKey = aKey => aKey;
    // @ts-ignore
    samsungClient._delay = ms => ms;

    describe("simple", function () {
        it("simple 1", function () {
            samsungClient.sendKeys('KEY_16_9')
                .then(x => {
                    expect(x).to.eql(['KEY_16_9', 100]);
                })
        });
        it("simple 2", function () {
            samsungClient.sendKeys('KEY_16_9,2500,KEY_PLAY')
                .then(x => {
                    expect(x).to.eql(['KEY_16_9', 100, 2500, 'KEY_PLAY', 100]);
                })
        });
        it("simple 3", function () {
            samsungClient.sendKeys('KEY_16_9,250,KEY_PLAY,250')
                .then(x => {
                    expect(x).to.eql(['KEY_16_9', 100, 250, 'KEY_PLAY', 100, 250]);
                })
        });
    });

    describe("mult", function () {
        it("mult 1", function () {
            samsungClient.sendKeys('KEY_16_9*2')
                .then(x => {
                    expect(x).to.eql(['KEY_16_9', 100, 'KEY_16_9', 100]);
                })
        });
        it("mult 2", function () {
            samsungClient.sendKeys('KEY_16_9*3,250,KEY_PLAY')
                .then(x => {
                    expect(x).to.eql(['KEY_16_9', 100, 'KEY_16_9', 100, 'KEY_16_9', 100, 250, 'KEY_PLAY', 100]);
                })
        });
    });
});
