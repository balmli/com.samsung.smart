# Add a condition for whether a Frame TV is displaying Art Mode

Status: Candidate small feature

Area: Maintained `Samsung` driver, Frame-specific behavior

## Problem

Frame TV users need to distinguish normal viewing from Art Mode. The current boolean power state cannot represent both states, which complicates amplifier, lighting, and automation flows.

## Source posts

- [#520](https://community.homey.app/t/app-pro-samsung-smarttv/10019/520)
- [#646](https://community.homey.app/t/app-pro-samsung-smarttv/10019/646) and [#651](https://community.homey.app/t/app-pro-samsung-smarttv/10019/651)
- [#667](https://community.homey.app/t/app-pro-samsung-smarttv/10019/667) and [#668](https://community.homey.app/t/app-pro-samsung-smarttv/10019/668)

## Current code observations

- `drivers/Samsung/SamsungClient.ts` can send `set_artmode_status` but has no corresponding getter or state subscription.
- Pairing stores `FrameTVSupport`, and Frame power-off uses a long key hold.
- No Flow condition currently exposes Art Mode.

## Expected behavior

For TVs that advertise Frame support, a Flow condition should report whether Art Mode is active without confusing Art Mode with fully on or off.

## Investigation and acceptance criteria

- Identify a supported query/event for Art Mode status on maintained Samsung websocket models.
- Add sanitized protocol fixtures and tests for on, off, unsupported, timeout, and malformed responses.
- Add a Frame-only Flow condition while preserving existing power behavior and card IDs.
- Do not expose the condition for non-Frame TVs unless it reliably returns false/unsupported.
- Document that support varies by model/firmware.

## Hardware verification

This cannot be considered complete without a compatible Frame TV. Keep it as investigation-only if hardware is unavailable.
