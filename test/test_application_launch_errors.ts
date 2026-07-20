const expect = require("chai").expect;
const http = require("http.min");

import {SamsungBase} from "../lib/SamsungBase";
import {SamsungClientImpl} from "../drivers/Samsung/SamsungClient";

const messages: Record<string, string> = {
    "errors.app_request_401":
        "The TV rejected the application request. Make sure the app is installed and supported on this TV",
    "errors.app_request_failed": "Operation failed (__statusCode__ __statusMessage__)",
    "errors.app.start_youtube": "Unable to start YouTube (__message__).",
};

function translate(key: string, values: Record<string, string | number> = {}) {
    let message = messages[key];
    for (const [name, value] of Object.entries(values)) {
        message = message.replace(`__${name}__`, String(value));
    }
    return message;
}

function createClient(Client: any = SamsungClientImpl) {
    return new Client({
        device: {
            homey: {
                __: translate,
            },
        },
        config: {
            getSetting: () => "192.0.2.1",
        },
        port: 8001,
        homeyIpUtil: {},
        logger: {
            error: () => undefined,
            info: () => undefined,
            verbose: () => undefined,
        },
    });
}

describe("Samsung application launch errors", function () {
    const originalPost = http.post;

    afterEach(function () {
        http.post = originalPost;
    });

    it("explains a 401 response from the maintained driver", async function () {
        const client = createClient();
        http.post = async () => ({
            data: "",
            response: {
                statusCode: 401,
                statusMessage: "Unauthorized",
            },
        });

        let errorMessage;
        try {
            await client.launchApp({name: "Missing app", appId: "missing-app", dialId: ""});
        } catch (err) {
            errorMessage = err instanceof Error ? err.message : String(err);
        }

        expect(errorMessage).to.equal(messages["errors.app_request_401"]);
    });

    it("preserves a string application error for the YouTube action", async function () {
        const client = createClient();
        client.launchApp = async () => {
            throw messages["errors.app_request_401"];
        };

        let errorMessage;
        try {
            await client.launchYouTube("abcdefghijk");
        } catch (err) {
            errorMessage = err instanceof Error ? err.message : String(err);
        }

        expect(errorMessage).to.equal(
            `Unable to start YouTube (${messages["errors.app_request_401"]}).`,
        );
    });

    it("keeps the shared base 401 response unchanged", async function () {
        const client = createClient(SamsungBase);
        http.post = async () => ({
            data: "",
            response: {
                statusCode: 401,
                statusMessage: "Unauthorized",
            },
        });

        let errorMessage;
        try {
            await client._applicationCmd("http://192.0.2.1/apps/missing", "missing-app", "post", false);
        } catch (err) {
            errorMessage = err instanceof Error ? err.message : String(err);
        }

        expect(errorMessage).to.equal("Operation failed (401 Unauthorized)");
    });
});
