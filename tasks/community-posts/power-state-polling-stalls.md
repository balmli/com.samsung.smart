# Power state polling becomes stale until the app or Homey restarts

Status: Candidate bug

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
