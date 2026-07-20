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

function createPollingDevice() {
    const state = {
        available: true,
        onOff: false,
        scheduledPolls: 0,
    };
    const device = Object.create(SamsungDevice.prototype);
    device.logger = {
        error: () => undefined,
        info: () => undefined,
        verbose: () => undefined,
    };
    device.getSetting = function () {
        const [key] = arguments;
        return key === DeviceSettings.power_state_polling ? true : undefined;
    };
    device.getCapabilityValue = () => state.onOff;
    device.setCapabilityValue = async function () {
        const [capability, value] = arguments;
        if (capability === "onoff") {
            state.onOff = value;
        }
    };
    device.getAvailable = () => state.available;
    device.setAvailable = async () => {
        state.available = true;
    };
    device.schedulePowerStatePolling = () => {
        state.scheduledPolls++;
    };
    device.shouldFetchPowerState = async () => undefined;
    device.shouldFetchModelName = async () => undefined;
    device.pairDevice = async () => undefined;
    device.shouldRefreshAppList = async () => undefined;
    device.fetchState = async () => undefined;
    return {device, state};
}

describe("SamsungDevice power-state polling", function () {
    it("reschedules while online maintenance remains pending", async function () {
        const {device, state} = createPollingDevice();
        let finishRefresh = () => {};
        const pendingRefresh = new Promise(resolve => {
            finishRefresh = () => resolve(undefined);
        });
        device.isDeviceOnline = async () => true;
        device.shouldFetchPowerState = () => pendingRefresh;

        const poll = device.doPowerStatePolling();
        await new Promise(resolve => setImmediate(resolve));
        const scheduledWhilePending = state.scheduledPolls;
        finishRefresh();
        await poll;

        expect(scheduledWhilePending).to.equal(1);
    });

    it("does not overlap online maintenance", async function () {
        const {device} = createPollingDevice();
        let refreshes = 0;
        let finishRefresh = () => {};
        const pendingRefresh = new Promise(resolve => {
            finishRefresh = () => resolve(undefined);
        });
        device.shouldFetchPowerState = () => {
            refreshes++;
            return pendingRefresh;
        };

        const firstRefresh = device.onDeviceOnline();
        const secondRefresh = device.onDeviceOnline();
        await new Promise(resolve => setImmediate(resolve));
        const refreshesWhilePending = refreshes;
        finishRefresh();
        await Promise.all([firstRefresh, secondRefresh]);

        expect(refreshesWhilePending).to.equal(1);
    });

    it("allows online maintenance to run again after completion", async function () {
        const {device} = createPollingDevice();
        let refreshes = 0;
        device.shouldFetchPowerState = async () => {
            refreshes++;
        };

        await device.onDeviceOnline();
        await device.onlineRefreshPromise;
        await device.onDeviceOnline();
        await device.onlineRefreshPromise;

        expect(refreshes).to.equal(2);
    });

    it("reschedules after a rejected probe without changing state", async function () {
        const {device, state} = createPollingDevice();
        device.isDeviceOnline = async () => {
            throw new Error("temporary probe failure");
        };
        device.onDeviceOnline = async () => undefined;

        await device.doPowerStatePolling();

        expect(state.onOff).to.equal(false);
        expect(state.scheduledPolls).to.equal(1);
    });

    it("reschedules while a power transition is active", async function () {
        const {device, state} = createPollingDevice();
        let probes = 0;
        device.turning_onoff_process = true;
        device.isDeviceOnline = async () => {
            probes++;
            return true;
        };

        await device.doPowerStatePolling();

        expect(probes).to.equal(0);
        expect(state.scheduledPolls).to.equal(1);
    });

    it("recovers after an indeterminate probe", async function () {
        const {device, state} = createPollingDevice();
        const probeResults = [undefined, true];
        device.isDeviceOnline = async () => probeResults.shift();
        device.onDeviceOnline = async () => undefined;

        await device.doPowerStatePolling();
        expect(state.onOff).to.equal(false);

        await device.doPowerStatePolling();
        expect(state.onOff).to.equal(true);
        expect(state.scheduledPolls).to.equal(2);
    });
});
