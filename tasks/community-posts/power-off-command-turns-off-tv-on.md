# Sending “off” to an already-off TV can turn it on

Status: Candidate bug

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

## Expected behavior

An absolute off request must be idempotent: requesting off while already off must not wake the TV.

## Investigation and acceptance criteria

- Add a maintained-driver regression test proving no power key is sent when a reliable current state is already off.
- Decide how to handle unknown or stale state without introducing false wake-ups.
- Investigate whether modern Samsung TVs support a dedicated power-off command that is safer than `KEY_POWER`.
- Keep Frame behavior separate and verify it explicitly.

## Hardware verification

Test repeated off commands against both an ordinary modern Samsung TV and, if available, a Frame TV. The Frame path remains unverified without hardware.
