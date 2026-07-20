const expect = require("chai").expect;

import {Logger} from "../lib/Logger";

describe("Logger", function () {
    it("keeps logging local without exposing remote capture behavior", function () {
        const logs: any[][] = [];
        const errors: any[][] = [];
        const logger = new Logger({
            logLevel: "silly",
            logFunc: (...args: any[]) => logs.push(args),
            errorFunc: (...args: any[]) => errors.push(args),
        });

        (logger as any).warn("warning");
        (logger as any).error(new Error("failure"));

        expect(logger).not.to.have.property("captureLevel");
        expect(logger).not.to.have.property("captureMessage");
        expect(logger).not.to.have.property("captureException");
        expect(logs).to.deep.equal([["[Warn]", "warning"]]);
        expect(errors[0][0]).to.equal("[Error]");
        expect(errors[0][1]).to.equal("failure");
    });
});
