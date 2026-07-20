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
const BaseDevice = Object.getPrototypeOf(SamsungDevice.prototype).constructor;

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

function createTransitionDevice() {
    let timerId = 0;
    const timers = new Map();
    const device = Object.create(SamsungDevice.prototype);
    device.homey = {
        __: function () {
            return arguments[0];
        },
        setTimeout: function () {
            const [callback, delay] = arguments;
            const timer = {callback, delay, id: ++timerId};
            timers.set(timer.id, timer);
            return timer;
        },
        clearTimeout: function () {
            const [timer] = arguments;
            timers.delete(timer.id);
        },
    };
    device.logger = {
        error: () => undefined,
        info: () => undefined,
        verbose: () => undefined,
    };
    device.samsungClient = {
        wake: async () => undefined,
        turnOff: async () => undefined,
    };
    device.clearPowerStatePolling = () => undefined;
    return {device, timers};
}

describe("SamsungDevice power transitions", function () {
    it("cleans up after a rejected power command", async function () {
        const {device} = createTransitionDevice();
        device.samsungClient.wake = async () => {
            throw new Error("wake failed");
        };
        let commandErrorMessage;

        try {
            await device.turnOnOff(true);
        } catch (err) {
            commandErrorMessage = err instanceof Error ? err.message : String(err);
        }

        expect(commandErrorMessage).to.equal("wake failed");
        expect(device.turning_onoff_process).to.equal(undefined);
        expect(device.onOffPollingTimeout).to.equal(undefined);
        expect(device.onOffCheckTimeout).to.equal(undefined);
    });

    it("cleans up after a successful transition", async function () {
        const {device} = createTransitionDevice();
        device.isDeviceOnline = async () => true;

        const command = device.turnOnOff(true);
        await new Promise(resolve => setImmediate(resolve));
        await device.doOnOffPollDevice();
        await command;

        expect(device.turning_onoff_process).to.equal(undefined);
        expect(device.onOffPollingTimeout).to.equal(undefined);
        expect(device.onOffCheckTimeout).to.equal(undefined);
    });

    it("retries after a failed poll and then completes", async function () {
        const {device} = createTransitionDevice();
        const pollResults = [new Error("temporary poll failure"), true];
        device.isDeviceOnline = async () => {
            const result = pollResults.shift();
            if (result instanceof Error) {
                throw result;
            }
            return result;
        };

        const command = device.turnOnOff(true);
        await new Promise(resolve => setImmediate(resolve));
        await device.doOnOffPollDevice();
        expect(device.turning_onoff_process).to.equal(true);
        expect(device.onOffPollingTimeout).to.not.equal(undefined);

        await device.doOnOffPollDevice();
        await command;
        expect(device.turning_onoff_process).to.equal(undefined);
        expect(device.onOffPollingTimeout).to.equal(undefined);
        expect(device.onOffCheckTimeout).to.equal(undefined);
    });

    it("returns a timeout error and allows a later command", async function () {
        const {device} = createTransitionDevice();
        let commandErrorMessage;
        const command = device.turnOnOff(true).catch(function () {
            const [err] = arguments;
            commandErrorMessage = err instanceof Error ? err.message : String(err);
        });
        await new Promise(resolve => setImmediate(resolve));

        device.onOnOffTimeout();
        await command;

        expect(commandErrorMessage).to.equal("errors.connection_timeout");
        expect(device.turning_onoff_process).to.equal(undefined);
        expect(device.onOffPollingTimeout).to.equal(undefined);
        expect(device.onOffCheckTimeout).to.equal(undefined);

        device.samsungClient.wake = async () => {
            throw new Error("next command reached TV");
        };
        let nextCommandErrorMessage;
        try {
            await device.turnOnOff(true);
        } catch (err) {
            nextCommandErrorMessage = err instanceof Error ? err.message : String(err);
        }
        expect(nextCommandErrorMessage).to.equal("next command reached TV");
    });

    it("blocks duplicate commands only while a transition is active", async function () {
        const {device} = createTransitionDevice();
        device.isDeviceOnline = async () => true;

        const command = device.turnOnOff(true);
        await new Promise(resolve => setImmediate(resolve));
        let duplicateErrorMessage;
        try {
            await device.turnOnOff(false);
        } catch (err) {
            duplicateErrorMessage = err instanceof Error ? err.message : String(err);
        }

        expect(duplicateErrorMessage).to.equal("errors.onoff.on_in_progress");
        await device.doOnOffPollDevice();
        await command;
    });

    it("clears stale transition state during initialization", async function () {
        const {device} = createTransitionDevice();
        const originalInitDevice = BaseDevice.prototype.initDevice;
        device.deleted = true;
        device.turning_onoff_process = true;
        device.scheduleOnOffPolling();
        device.scheduleOnOffTimeout();
        BaseDevice.prototype.initDevice = async () => undefined;
        device.initSettings = async () => undefined;
        device.migrate = async () => undefined;
        device.registerCapListeners = async () => undefined;
        device.schedulePowerStatePolling = () => undefined;
        device.initSmartThings = async () => undefined;
        device.config = {
            getSetting: () => undefined,
        };
        device.homeyIpUtil = {};
        device.getData = () => ({id: "test-tv"});

        try {
            await device.onInit();
        } finally {
            BaseDevice.prototype.initDevice = originalInitDevice;
        }

        expect(device.turning_onoff_process).to.equal(undefined);
        expect(device.deleted).to.equal(false);
        expect(device.onOffPollingTimeout).to.equal(undefined);
        expect(device.onOffCheckTimeout).to.equal(undefined);
    });

    it("clears transition state when the device is deleted", function () {
        const {device} = createTransitionDevice();
        device.turning_onoff_process = false;
        device.scheduleOnOffPolling();
        device.scheduleOnOffTimeout();

        device.onDeleted();

        expect(device.turning_onoff_process).to.equal(undefined);
        expect(device.deleted).to.equal(true);
        expect(device.onOffPollingTimeout).to.equal(undefined);
        expect(device.onOffCheckTimeout).to.equal(undefined);
    });
});
