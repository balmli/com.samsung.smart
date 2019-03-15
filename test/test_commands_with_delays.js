const expect = require("chai").expect;
const SamsungBase = require('../lib/samsung_base');

describe("_commandsWithDelays", function () {
    let samsungBase = new SamsungBase({
        delay_keys: 100
    });
    describe("simple", function () {
        it("simple 1", async function () {
            let sk = samsungBase._commandsWithDelays('KEY_16_9,2500,KEY_PLAY');
            expect(sk.length).to.eql(3);
            expect(sk[0].delay).to.eql(100);
            expect(sk[0].cmd).to.eql('KEY_16_9');
            expect(sk[1].delay).to.eql(2500);
            expect(sk[2].delay).to.eql(100);
            expect(sk[2].cmd).to.eql('KEY_PLAY');
        });
        it("simple 2", async function () {
            let sk = samsungBase._commandsWithDelays('KEY_16_9,250,KEY_PLAY,250');
            expect(sk.length).to.eql(4);
            expect(sk[0].delay).to.eql(100);
            expect(sk[0].cmd).to.eql('KEY_16_9');
            expect(sk[1].delay).to.eql(250);
            expect(sk[2].delay).to.eql(100);
            expect(sk[2].cmd).to.eql('KEY_PLAY');
            expect(sk[1].delay).to.eql(250);
        });
    });
    describe("mult", function () {
        it("mult 1", async function () {
            let sk = samsungBase._commandsWithDelays('KEY_16_9*3,250,KEY_PLAY');
            expect(sk.length).to.eql(5);
            expect(sk[0].delay).to.eql(100);
            expect(sk[0].cmd).to.eql('KEY_16_9');
            expect(sk[1].delay).to.eql(100);
            expect(sk[1].cmd).to.eql('KEY_16_9');
            expect(sk[2].delay).to.eql(100);
            expect(sk[2].cmd).to.eql('KEY_16_9');
            expect(sk[3].delay).to.eql(250);
            expect(sk[4].delay).to.eql(100);
            expect(sk[4].cmd).to.eql('KEY_PLAY');
        });
    });
});
