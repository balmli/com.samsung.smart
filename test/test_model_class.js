const expect = require("chai").expect;
const SamsungBase = require('../lib/samsung_base');

describe("modelClass", function () {
    let samsungBase = new SamsungBase({});

    describe("modelClass", function () {

        it("undefined", function () {
            expect(samsungBase.modelClass('UE55KS8005')).to.eql(undefined);
        });

        it("sakep", function () {
            [
                'UE48H6270',
                'UE48H6400',
                'UE55H6400',
                'UE50HU6900',
                'UE55HU7500'
            ].forEach(model => {
                expect(samsungBase.modelClass(model)).to.eql('sakep');
            });
        });

        it("tizen", function () {
            [
                'UE48J6300',
                'UE40JU6000',
                'UN40JU6000',
                'UE50JU6800',
                'UE55JU7505',
                'UE55JU7590',
                'UN60JS7000',
                'UE55JS8500',
                'UE48JS9000'
            ].forEach(model => {
                expect(samsungBase.modelClass(model)).to.eql('tizen');
            });
        });
    });
});
