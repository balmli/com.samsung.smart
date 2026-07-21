export interface PowerCycleOperations {
    isOnline(timeout?: number): Promise<boolean>;
    wake(): Promise<void>;
}

export interface PowerCycleTiming {
    offlineTimeoutMs: number;
    pollIntervalMs: number;
    settleDelayMs: number;
    wakeAttempts: number;
    wakeWaitMs: number;
}

const DEFAULT_TIMING: PowerCycleTiming = {
    offlineTimeoutMs: 30000,
    pollIntervalMs: 1000,
    settleDelayMs: 8000,
    wakeAttempts: 5,
    wakeWaitMs: 8000,
};

const delay = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForState(
    operations: PowerCycleOperations,
    expectedOnline: boolean,
    timeoutMs: number,
    pollIntervalMs: number,
): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() <= deadline) {
        if ((await operations.isOnline(1500)) === expectedOnline) return true;
        if (Date.now() >= deadline) return false;
        await delay(pollIntervalMs);
    }
    return false;
}

export async function waitForOffThenWake(
    operations: PowerCycleOperations,
    timing: Partial<PowerCycleTiming> = {},
): Promise<void> {
    const resolved = {...DEFAULT_TIMING, ...timing};
    if (!(await waitForState(operations, false, resolved.offlineTimeoutMs, resolved.pollIntervalMs))) {
        throw new Error('The TV did not finish shutting down before the Wake-on-LAN test');
    }

    await delay(resolved.settleDelayMs);

    for (let attempt = 0; attempt < resolved.wakeAttempts; attempt++) {
        await operations.wake();
        if (await waitForState(operations, true, resolved.wakeWaitMs, resolved.pollIntervalMs)) return;
    }

    throw new Error(`The TV did not come online after ${resolved.wakeAttempts} Wake-on-LAN attempts`);
}
