const expect = require("chai").expect;

const Module = require("module");
const originalLoad = Module._load;
Module._load = function () {
    const [request] = arguments;
    if (request === "homey") {
        return {Device: class {}};
    }
    return originalLoad.apply(this, arguments);
};
const SamsungDevice = require("../drivers/Samsung/device");
Module._load = originalLoad;
const {DeviceSettings} = require("../lib/types");

describe("SamsungDevice.setPowerState", function () {
    it("preserves the power-state polling preference", async function () {
        const settings = new Map([[DeviceSettings.power_state_polling, true]]);
        const capabilities = new Map();
        const device = Object.create(SamsungDevice.prototype);
        device.config = {
            setSetting: async function () {
                const [key, value] = arguments;
                settings.set(key, value);
            },
        };
        device.setCapabilityValue = async function () {
            const [capability, value] = arguments;
            capabilities.set(capability, value);
        };
        device.logger = {
            error: () => undefined,
            info: () => undefined,
        };

        await device.setPowerState(false);

        expect(capabilities.get("onoff")).to.equal(false);
        expect(settings.get(DeviceSettings.power_state_polling)).to.equal(true);
    });
});
