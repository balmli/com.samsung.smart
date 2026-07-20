# Power state polling setting appears to disable itself

Status: Candidate small bug

Area: Shared device setting used by the maintained `Samsung` driver

## Problem

A user reports that the “Power state polling” setting becomes disabled automatically. This can remove the on/off status needed by flows and may contribute to apparent power-state unreliability.

## Source posts

- [#625](https://community.homey.app/t/app-pro-samsung-smarttv/10019/625)

## Current code observations

- `lib/BaseDevice.ts#setPowerState()` explicitly writes `power_state_polling = false` before manually setting the `onoff` capability.
- The `set_power_state` Flow action calls this method.
- A one-off Flow action therefore appears able to persistently change an advanced device setting as a side effect.

## Expected behavior

Using “Set power state” should update Homey's current state without silently changing the user's polling preference.

## Investigation and acceptance criteria

- Add a regression test showing that `setPowerState()` preserves the configured polling setting.
- Clarify whether polling should be paused temporarily or simply reconciled on the next interval.
- Remove or replace the persistent setting mutation if it is not intentional.
- Confirm that manually setting state does not create immediate contradictory triggers.

## Hardware verification

Primarily testable with Homey device mocks; perform a short real-device check to verify the next poll behaves sensibly.
