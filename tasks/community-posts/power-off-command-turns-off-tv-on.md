# Sending “off” to an already-off TV can turn it on

Status: Fix implemented — [GitHub issue #60](https://github.com/balmli/com.samsung.smart/issues/60)

Pull request: [#61](https://github.com/balmli/com.samsung.smart/pull/61)

Area: Maintained `Samsung` driver

## Problem

A Homey “turn everything off” flow can turn on a Samsung TV that is already off. Similar reports describe the TV being found on later without an intentional on flow. This is consistent with using Samsung's toggle-style `KEY_POWER` for an absolute off request.

## Source posts

- [#512](https://community.homey.app/t/app-pro-samsung-smarttv/10019/512) and [#539](https://community.homey.app/t/app-pro-samsung-smarttv/10019/539)
- [#553](https://community.homey.app/t/app-pro-samsung-smarttv/10019/553)
- [#563](https://community.homey.app/t/app-pro-samsung-smarttv/10019/563)

## Current code observations

- `drivers/Samsung/SamsungClient.ts` implements non-Frame `turnOff()` by sending `KEY_POWER`, which is a toggle on many TVs.
- The capability listener starts the off operation without first proving the TV is currently on.
- Frame TVs use a long power-key hold and have separate standby/art-mode semantics.

## Confirmation evidence

The defect is certain from deterministic command dispatch. `SamsungDevice.turnOnOff(false)` unconditionally calls
the maintained client's `turnOff()` method. For a non-Frame TV, `SamsungClientImpl.turnOff()` sends the toggle-style
`KEY_POWER`, even when Homey's current `onoff` capability reliably reports `false`. The redundant absolute-off
request can therefore reverse the physical state instead of remaining off.

Hardware is still required to establish model-specific behavior and to verify the separate Frame path.

## Expected behavior

An absolute off request must be idempotent: requesting off while already off must not wake the TV.

## Investigation and acceptance criteria

- Add a maintained-driver regression test proving no power key is sent when a reliable current state is already off.
- Decide how to handle unknown or stale state without introducing false wake-ups.
- Investigate whether modern Samsung TVs support a dedicated power-off command that is safer than `KEY_POWER`.
- Keep Frame behavior separate and verify it explicitly.

## Hardware verification

Test repeated off commands against both an ordinary modern Samsung TV and, if available, a Frame TV. The Frame path remains unverified without hardware.

## Implementation and verification

- The maintained `Samsung` driver now treats an off request as complete without starting transition timers or sending
  a power command when a non-Frame TV's current `onoff` capability is explicitly `false`.
- Known-on and unknown states retain the existing off-command path. Frame TVs retain their separate long-hold path;
  its hardware behavior remains unverified.
- Regression test red: the focused known-off test failed because `samsungClient.turnOff()` was reached and raised
  `redundant power-off command was sent`.
- Regression test green: all 11 focused maintained-driver transition cases passed after the guard, including
  known-on, unknown-state, and Frame-path preservation cases.
- Node 24.16.0 checks passed: `npm run format`, `npm run build`, `npm run lint`, `npm run test:typecheck`, and
  `npm test --ignore-scripts` (58 passing).
- No shared, retained-driver, manifest, locale, or generated `app.json` changes were required. Real-TV verification
  remains outstanding for both an ordinary modern Samsung TV and a Frame TV.
