const expect = require("chai").expect;
const SamsungBase = require('../lib/samsung_base');

describe("_commands", function () {
    describe("simple", function () {
        it("simple 1", function () {
            expect(new SamsungBase({})._commands('KEY_1')).to.eql(['KEY_1']);
        });
        it("simple 2", function () {
            expect(new SamsungBase({})._commands(['KEY_1'])).to.eql(['KEY_1']);
        });
        it("simple 3", function () {
            expect(new SamsungBase({})._commands('KEY_1,KEY_2')).to.eql(['KEY_1', 'KEY_2']);
        });
    });
    describe("multiply", function () {
        it("mult 1", function () {
            expect(new SamsungBase({})._commands('KEY_1*2')).to.eql(['KEY_1', 'KEY_1']);
        });
        it("mult 2", function () {
            expect(new SamsungBase({})._commands(['KEY_1*99', 'KEY_ENTER']).length).to.eql(100);
        });
        it("mult 3", function () {
            expect(new SamsungBase({})._commands('KEY_1*100').length).to.eql(100);
        });
        it("mult 4", function () {
            let cmds = new SamsungBase({})._commands('KEY_VOLUP*10,KEY_ENTER');
            expect(cmds).to.eql(['KEY_VOLUP', 'KEY_VOLUP', 'KEY_VOLUP', 'KEY_VOLUP', 'KEY_VOLUP', 'KEY_VOLUP', 'KEY_VOLUP', 'KEY_VOLUP', 'KEY_VOLUP', 'KEY_VOLUP', 'KEY_ENTER']);
        });
    });
    describe("lowercase", function () {
        it("valid-but-lowercase 1", function () {
            expect(new SamsungBase({})._commands('key_1')).to.eql(['KEY_1']);
        });
    });
    describe("max 100 keys", function () {
        it("max 100 1", function () {
            expect(function () {
                new SamsungBase({})._commands('KEY_1*200')
            }).to.throw('Max 100 keys are supported');
        });
    });
    describe("invalid keys", function () {
        it("invalid key 1", function () {
            expect(function () {
                new SamsungBase({})._commands('KEY_XYZ')
            }).to.throw('Invalid key: KEY_XYZ');
        });
    });
});
