# Power transition remains stuck in “in progress”

Status: Candidate bug

Area: Maintained `Samsung` driver and shared transition state

## Problem

Users report persistent “power on/off in progress” errors followed by an unresponsive device. In at least one report, restarting the app did not recover it and Homey itself had to be rebooted.

## Source posts

- [#507](https://community.homey.app/t/app-pro-samsung-smarttv/10019/507)
- [#556](https://community.homey.app/t/app-pro-samsung-smarttv/10019/556)
- [#602](https://community.homey.app/t/app-pro-samsung-smarttv/10019/602)
- [#653](https://community.homey.app/t/app-pro-samsung-smarttv/10019/653)

## Current code observations

- `lib/BaseDevice.ts` blocks new commands whenever `turning_onoff_process` is not `undefined`.
- The flag is cleared by successful state reconciliation or the 30-second timeout callback.
- Timer cancellation, deletion/reinitialization, or an exception in the polling chain could leave the flag set or prevent timeout recovery.

## Expected behavior

A transition must always resolve successfully or time out into a recoverable state. A later power command should never require rebooting Homey.

## Investigation and acceptance criteria

- Add tests for success, command failure, poll failure, timeout, app/device reinitialization, and deletion during a transition.
- Ensure every terminal path clears transition state and both transition timers.
- Ensure app restart/device initialization cannot restore a stale in-progress state.
- Return a clear timeout error while allowing the next user command.

## Hardware verification

Simulate an unreachable TV, then restore connectivity and verify subsequent power commands on a modern Samsung TV.
