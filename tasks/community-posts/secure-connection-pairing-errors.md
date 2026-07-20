# Secure connection errors persist after secure mode is enabled

Status: Candidate bug

Area: Maintained `Samsung` driver websocket pairing and token lifecycle

## Problem

Users report repeated authorization prompts or “TV needs a secure connection” errors even after enabling secure connection, toggling it off/on, checking the IP, and initially controlling the TV successfully. One recent report combines this with loss of power/volume control.

## Source posts

- [#528](https://community.homey.app/t/app-pro-samsung-smarttv/10019/528)
- [#560](https://community.homey.app/t/app-pro-samsung-smarttv/10019/560)
- [#574](https://community.homey.app/t/app-pro-samsung-smarttv/10019/574)
- [#662](https://community.homey.app/t/app-pro-samsung-smarttv/10019/662)

## Current code observations

- `drivers/Samsung/device.ts` toggles token support, clears stored tokens, and retries pairing.
- `drivers/Samsung/SamsungClient.ts` selects `ws:8001` or `wss:8002` from the stored `tokenAuthSupport` setting.
- Pairing and connection code logs newly received tokens; token values must never be exposed in diagnostics.
- Socket errors map only a subset of authorization failures to actionable messages.

## Expected behavior

The app should select the correct secure mode from TV capabilities, pair once with user approval, persist the token safely, and recover clearly when authorization is revoked.

## Investigation and acceptance criteria

- Add tests for secure/non-secure URI selection, missing/invalid/replaced tokens, pairing retries, and setting changes.
- Ensure tokens are redacted from all logs.
- Detect authorization rejection separately from network failure and provide a repair path.
- Verify that reconnecting does not create repeated Homey entries or repeated TV authorization prompts.
- Re-evaluate secure capability data when repairing or re-pairing a device.

## Hardware verification

Requires a token-auth Samsung TV and explicit testing of first pairing, reconnect, revoked authorization, and repair. Never attach real token or device identifiers to the task.
