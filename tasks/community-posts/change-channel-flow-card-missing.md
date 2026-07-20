# “Change channel” card is missing from Advanced Flow

Status: Candidate small bug

Area: Homey Flow manifest for maintained `Samsung` driver

## Problem

A user reports that the absolute “Change channel” action is no longer visible in Advanced Flow, leaving only channel-up and channel-down actions.

## Source posts

- [#665](https://community.homey.app/t/app-pro-samsung-smarttv/10019/665)

## Current code observations

- `.homeycompose/flow/actions/change_channel.json` still defines the action and includes the `Samsung` driver filter.
- `app.ts` still registers the `change_channel` action listener.
- The generated manifest, Homey card compatibility, numeric argument definition, and Advanced Flow presentation need verification.

## Expected behavior

The “Change channel” action should be selectable for a maintained Samsung device in both standard and Advanced Flow editors.

## Investigation and acceptance criteria

- Validate the composed manifest and inspect the generated `app.json` card.
- Reproduce in the current Homey web/mobile Advanced Flow editor.
- Compare the card schema with current Homey SDK documentation.
- Add a manifest-level regression check if practical.
- Preserve the existing card ID so saved flows remain compatible.

## Hardware verification

Card visibility can be verified without a TV; actual digit-key channel switching still requires hardware.
