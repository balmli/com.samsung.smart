# Power state polling becomes stale until the app or Homey restarts

Status: Fix implemented — [GitHub issue #56](https://github.com/balmli/com.samsung.smart/issues/56)

Pull request: [#57](https://github.com/balmli/com.samsung.smart/pull/57)

Area: Maintained `Samsung` driver and shared polling lifecycle

## Problem

Multiple users report that Homey eventually stops reflecting whether a TV is on or off. Restarting the app or rebooting Homey temporarily restores correct status. Reports became especially frequent after migration to Homey Pro 2023.

## Source posts

- [#502](https://community.homey.app/t/app-pro-samsung-smarttv/10019/502), [#510](https://community.homey.app/t/app-pro-samsung-smarttv/10019/510), [#511](https://community.homey.app/t/app-pro-samsung-smarttv/10019/511), and [#514](https://community.homey.app/t/app-pro-samsung-smarttv/10019/514)
- [#531](https://community.homey.app/t/app-pro-samsung-smarttv/10019/531) through [#535](https://community.homey.app/t/app-pro-samsung-smarttv/10019/535)
- [#537](https://community.homey.app/t/app-pro-samsung-smarttv/10019/537), [#557](https://community.homey.app/t/app-pro-samsung-smarttv/10019/557), and [#559](https://community.homey.app/t/app-pro-samsung-smarttv/10019/559)

## Current code observations

- `lib/BaseDevice.ts` reschedules `pollDevice()` through `schedulePowerStatePolling()`.
- Polling skips updates while `turning_onoff_process` is set.
- `isDeviceOnline()` combines several asynchronous probes and can return `undefined`.
- A rejected probe, stale transition flag, timer lifecycle error, or socket state may prevent later useful status updates.

## Confirmation evidence

The recursive timeout is scheduled in `BaseDevice.doPowerStatePolling()` only after the complete online refresh
settles. For an online TV, the maintained driver awaits pairing, application discovery, and UPnP state refresh.
Samsung WebSocket connection and pairing promises contain paths that can remain pending indefinitely. A pending
online refresh therefore prevents the polling `finally` block from scheduling the next timeout.

Restarting the app schedules a fresh one-second poll, matching the reported temporary recovery. Historical code used
`setInterval`, so an individual pending online refresh did not own creation of the next timer.

The polling interval is not the defect: the documented contract says values below 10 seconds disable polling.
Rejected probes, `undefined` results, and active transition skips currently reach `finally` and reschedule; focused
tests should preserve those behaviors.

## Expected behavior

Polling continues for the lifetime of the device and eventually reconciles Homey's `onoff` capability with the TV without requiring an app or Homey restart.

## Investigation and acceptance criteria

- Add focused tests around repeated polling, rejected/undefined probes, transition completion, and timer rescheduling.
- Determine whether one failed poll can stop the timer chain or leave `turning_onoff_process` set.
- Ensure transient failures are logged and retried without emitting an incorrect state.
- Verify status recovery after a TV or network becomes reachable again.
- Confirm no behavioral changes are made to the frozen encrypted or legacy drivers unless explicitly requested.

## Hardware verification

Requires long-running validation on at least one modern Samsung TV. Compilation and mocked timers cannot establish that the Samsung endpoints remain reachable over time.

## Implementation and verification

- The maintained `Samsung` driver now starts online-device maintenance in the background, allowing the shared polling
  callback to finish and schedule its next timeout even if maintenance remains pending.
- A single-flight guard prevents overlapping maintenance work and clears after completion or rejection so a later
  poll can refresh again.
- Regression test red: the next poll was not scheduled while maintenance was pending, and two callbacks started two
  concurrent maintenance refreshes.
- Regression test green: all six focused lifecycle cases pass, including rejected and indeterminate probes,
  transition skips, non-overlap, guard release, and later status recovery.
- Node 24.16.0 checks passed: `npm run build`, `npm run lint`, `npm run test:typecheck`, and
  `npm test --ignore-scripts` (47 passing).
- Only `drivers/Samsung/` production behavior changed. No manifest or generated `app.json` changes were required.
- Long-running modern-TV verification remains outstanding. Encrypted and legacy driver behavior was not changed or
  hardware-tested.
