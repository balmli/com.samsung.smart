# “Change channel” card is missing from Advanced Flow

Status: Closed — not reproduced

Area: Homey Flow manifest for maintained `Samsung` driver

## Problem

A user reports that the absolute “Change channel” action is no longer visible in Advanced Flow, leaving only channel-up and channel-down actions.

## Source posts

- [#665](https://community.homey.app/t/app-pro-samsung-smarttv/10019/665)

## Current code observations

- `.homeycompose/flow/actions/change_channel.json` still defines the action and includes the `Samsung` driver filter.
- `app.ts` still registers the `change_channel` action listener.
- The generated manifest retains the `change_channel` action with its numeric channel argument.

## Expected behavior

The “Change channel” action should be selectable for a maintained Samsung device in both standard and Advanced Flow editors.

## Verification outcome

Maintainer verification on 2026-07-20 confirmed that the **Change channel to** action card is visible in the current
Homey Flow editor. The manifest definition and runtime registration are present and consistent, so the reported
missing-card behavior is not reproducible and is not considered an app bug.

No manifest, runtime, test, or documentation change is required. Preserve the existing card ID and reopen the
investigation only if a current reproducible case identifies a specific editor, Homey platform, or device-filter
combination where the card is absent.

## Reopen criteria

- Obtain a current reproduction with the affected Homey platform and Flow editor identified.
- Inspect the composed manifest and device filter in that environment.
- Add a manifest-level regression check if a reproducible schema or filtering defect is found.
- Preserve the existing card ID so saved flows remain compatible.

## Hardware verification

Card visibility can be verified without a TV; actual digit-key channel switching still requires hardware.
