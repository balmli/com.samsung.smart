# Power state polling setting appears to disable itself

Status: Fix implemented — [GitHub issue #54](https://github.com/balmli/com.samsung.smart/issues/54)

Pull request: [#55](https://github.com/balmli/com.samsung.smart/pull/55)

Area: Shared device setting used by the maintained `Samsung` driver

## Problem

A user reports that the “Power state polling” setting becomes disabled automatically. This can remove the on/off status needed by flows and may contribute to apparent power-state unreliability.

## Source posts

- [#625](https://community.homey.app/t/app-pro-samsung-smarttv/10019/625)

## Current code observations

- `lib/BaseDevice.ts#setPowerState()` explicitly writes `power_state_polling = false` before manually setting the `onoff` capability.
- The `set_power_state` Flow action calls this method.
- A one-off Flow action therefore appears able to persistently change an advanced device setting as a side effect.

## Confirmation evidence

The defect is certain from deterministic code behavior: the registered `set_power_state` Flow action calls
`BaseDevice.setPowerState()`, which unconditionally persists `power_state_polling = false` before updating the
`onoff` capability. No TV or network behavior is involved in that setting mutation.

Polling should not be paused by the manual action. When polling remains enabled, the existing bounded polling loop
will reconcile the manually supplied state with the detected TV state on the next configured interval. This avoids
an immediate extra poll while preserving the user's preference.

## Expected behavior

Using “Set power state” should update Homey's current state without silently changing the user's polling preference.

## Investigation and acceptance criteria

- Add a regression test showing that `setPowerState()` preserves the configured polling setting.
- Clarify whether polling should be paused temporarily or simply reconciled on the next interval.
- Remove or replace the persistent setting mutation if it is not intentional.
- Confirm that manually setting state does not create immediate contradictory triggers.

## Hardware verification

Primarily testable with Homey device mocks; perform a short real-device check to verify the next poll behaves sensibly.

## Implementation and verification

- The maintained `Samsung` driver overrides `setPowerState()` so the action updates `onoff` without changing the
  polling preference. Shared `BaseDevice` behavior remains unchanged for the retained encrypted and legacy drivers.
- Regression test red: `npm test --ignore-scripts -- --grep SamsungDevice.setPowerState` failed because the setting
  changed from `true` to `false`.
- Regression test green: the same focused command passed after the maintained-driver override.
- Node 24.16.0 checks passed: `npm run build`, `npm run lint`, `npm run test:typecheck`, and
  `npm test --ignore-scripts` (41 passing).
- No manifest or generated `app.json` changes were required.
- Real-TV behavior remains unverified; the next scheduled poll should be checked on maintained Samsung hardware.
