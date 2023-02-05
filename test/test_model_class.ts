const expect = require("chai").expect;

import {createSamsungClient} from "./test_create_samsung_client";
const samsungClient = createSamsungClient();

describe("modelClass", function () {

    describe("modelClass", function () {

        it("undefined", function () {
            [
                'QE65QN95BATXXC',
                'UE55KS8005',
                'UE46F8000'
            ].forEach(model => {
                expect(samsungClient.modelClass(model)).to.eql(undefined);
            });
        });

        it("sakep", function () {
            [
                'UE48H6270',
                'UE48H6400',
                'UE55H6400',
                'UE50HU6900',
                'UE55HU7500'
            ].forEach(model => {
                expect(samsungClient.modelClass(model)).to.eql('sakep');
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
                expect(samsungClient.modelClass(model)).to.eql('tizen');
            });
        });
    });
});
