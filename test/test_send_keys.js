const expect = require("chai").expect;
const SamsungBase = require('../lib/samsung_base');

describe("sendKeys", function () {
    let samsungBase = new SamsungBase({
        delay_keys: 100
    });

    // Override, for testing
    samsungBase.sendKey = aKey => aKey;
    samsungBase._delay = ms => ms;

    describe("simple", function () {
        it("simple 1", function () {
            samsungBase.sendKeys('KEY_16_9')
                .then(x => {
                    expect(x).to.eql(['KEY_16_9', 100]);
                })
        });
        it("simple 2", function () {
            samsungBase.sendKeys('KEY_16_9,2500,KEY_PLAY')
                .then(x => {
                    expect(x).to.eql(['KEY_16_9', 100, 2500, 'KEY_PLAY', 100]);
                })
        });
        it("simple 3", function () {
            samsungBase.sendKeys('KEY_16_9,250,KEY_PLAY,250')
                .then(x => {
                    expect(x).to.eql(['KEY_16_9', 100, 250, 'KEY_PLAY', 100, 250]);
                })
        });
    });

    describe("mult", function () {
        it("mult 1", function () {
            samsungBase.sendKeys('KEY_16_9*2')
                .then(x => {
                    expect(x).to.eql(['KEY_16_9', 100, 'KEY_16_9', 100]);
                })
        });
        it("mult 2", function () {
            samsungBase.sendKeys('KEY_16_9*3,250,KEY_PLAY')
                .then(x => {
                    expect(x).to.eql(['KEY_16_9', 100, 'KEY_16_9', 100, 'KEY_16_9', 100, 250, 'KEY_PLAY', 100]);
                })
        });
    });
});
