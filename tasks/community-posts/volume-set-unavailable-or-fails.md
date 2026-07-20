# Absolute volume setting fails while volume keys work

Status: Candidate bug requiring more evidence

Area: Shared UPnP volume integration used by maintained `Samsung` driver

## Problem

A user reports that volume-up/down keys work, but setting an absolute volume value does not. The same report also describes unreliable power state, so the volume symptom needs isolated reproduction.

## Source posts

- [#545](https://community.homey.app/t/app-pro-samsung-smarttv/10019/545)

## Current code observations

- Absolute volume uses `lib/UPnPClient.ts`; volume keys use the Samsung remote websocket and therefore exercise a different protocol.
- `lib/BaseDevice.ts` conditionally adds/removes `volume_set` according to stored UPnP availability.
- Failure may involve UPnP discovery, capability migration, maximum-volume scaling, or a TV that supports remote keys but not the expected RenderingControl service.

## Expected behavior

When `volume_set` is exposed, setting a value should work within the configured maximum or return a clear UPnP-specific error. Unsupported TVs should not expose a misleading capability.

## Investigation and acceptance criteria

- Add tests for UPnP availability changes, capability migration, scaling, and request failures.
- Verify that the capability is removed or marked unavailable when UPnP support disappears.
- Distinguish discovery failure from a rejected SetVolume request.
- Collect a sanitized UPnP description/response from a reproducible modern-TV case before implementing protocol changes.

## Hardware verification

Requires a modern Samsung TV that exposes UPnP RenderingControl. This task should remain low confidence until reproduced.
