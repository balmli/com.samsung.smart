# Power transition remains stuck in “in progress”

Status: Fix implemented — [GitHub issue #58](https://github.com/balmli/com.samsung.smart/issues/58)

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

## Confirmation evidence

The command-failure path is deterministically broken. `BaseDevice.turnOnOff()` sets `turning_onoff_process`, then
awaits `wake()` or `turnOff()`. If the command rejects, the catch block cancels both recovery timers but does not clear
the transition flag. With no timer left to recover it, every later power command is rejected as already in progress.

Successful transition polling also clears its timers and then unconditionally schedules another poll from `finally`.
The timeout callback clears polling and transition state but retains its own stored timeout handle. Initialization and
deletion do not explicitly reset a stale transition flag.

## Expected behavior

A transition must always resolve successfully or time out into a recoverable state. A later power command should never require rebooting Homey.

## Investigation and acceptance criteria

- Add tests for success, command failure, poll failure, timeout, app/device reinitialization, and deletion during a transition.
- Ensure every terminal path clears transition state and both transition timers.
- Ensure app restart/device initialization cannot restore a stale in-progress state.
- Return a clear timeout error while allowing the next user command.

## Hardware verification

Simulate an unreachable TV, then restore connectivity and verify subsequent power commands on a modern Samsung TV.

## Implementation and verification

- The maintained `Samsung` driver now waits for a transition outcome and uses one cleanup path for success, command
  failure, timeout, initialization, and deletion.
- Transition polling is rescheduled only while a transition remains active. A transient poll or Wake-on-LAN retry
  failure therefore continues toward the existing 30-second timeout without leaving an extra terminal timer.
- Timeout rejects the waiting command with the existing localized connection-timeout error, clears both timers and
  retry state, and permits a subsequent command.
- Regression test red: six focused lifecycle cases failed for retained flags, stray timers, missing timeout errors,
  and missing initialization/deletion cleanup.
- Regression test green: all seven focused transition cases pass, including duplicate-command blocking only during
  an active transition.
- Node 24.16.0 checks passed: `npm run build`, `npm run lint`, `npm run test:typecheck`, and
  `npm test --ignore-scripts` (54 passing).
- Only `drivers/Samsung/` runtime behavior changed. Two shared fields changed from `private` to `protected` for the
  maintained override; encrypted and legacy runtime behavior is unchanged.
- No manifest or generated `app.json` changes were required. Modern-TV failure/recovery testing remains outstanding;
  encrypted and legacy drivers were not hardware-tested.
