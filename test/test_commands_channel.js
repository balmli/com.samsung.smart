const expect = require("chai").expect;
const SamsungBase = require('../lib/samsung_base');

describe("_commandsChannel", function () {
    describe("simple", function () {
        it("simple 1", function () {
            expect(new SamsungBase({})._commandsChannel(1)).to.eql(['KEY_1','KEY_ENTER']);
        });
        it("simple 2", function () {
            expect(function () {
                new SamsungBase({})._commandsChannel()}).to.throw('Invalid channel number');
        });
        it("simple 3", function () {
            expect(new SamsungBase({})._commandsChannel(123)).to.eql(['KEY_1','KEY_2','KEY_3','KEY_ENTER']);
        });
    });
});
