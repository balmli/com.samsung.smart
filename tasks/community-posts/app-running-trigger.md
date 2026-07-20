# Add a trigger for when a selected TV app starts running

Status: Candidate small feature

Area: Maintained `Samsung` driver Flow cards

## Problem

A user wants to start a lighting scene when a specific TV app, such as Netflix, begins running. The app currently exposes an “Is app running” condition but no corresponding trigger.

## Source posts

- [#634](https://community.homey.app/t/app-pro-samsung-smarttv/10019/634)

## Current code observations

- `.homeycompose/flow/conditions/is_app_running.json` and `app.ts` already expose and register an app-running condition with app autocomplete.
- `lib/SamsungBase.ts#isAppRunning()` can query DIAL and Samsung app state.
- No lifecycle currently polls app state or tracks transitions, so a trigger must avoid excessive TV/network requests and duplicate events.

## Expected behavior

Users can select an installed app and trigger a Flow once when that app transitions from not running to running.

## Investigation and acceptance criteria

- Determine whether modern Samsung websocket events can provide app-state changes without polling.
- If polling is required, make its interval bounded and avoid requests while the TV is offline.
- Reuse installed-app autocomplete and preserve app identifiers consistently.
- Add tests for initial state, not-running to running, repeated running state, app change, TV off, and query failure.
- Do not expose or implement the trigger for frozen drivers unless explicitly requested and supported.

## Hardware verification

Requires a modern Samsung TV with at least two launchable apps. Verify that the trigger fires once per transition and does not wake the TV.
