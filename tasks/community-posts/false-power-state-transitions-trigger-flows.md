# False power state transitions trigger flows while the TV remains unchanged

Status: Candidate bug

Area: Maintained `Samsung` driver and shared power-state reconciliation

## Problem

Users report Homey firing TV-on and TV-off triggers even though the physical display did not change state. This can unexpectedly operate curtains, lights, or other devices. One report describes a false on event roughly every 25 minutes followed by an off event about 30 seconds later.

## Source posts

- [#576](https://community.homey.app/t/app-pro-samsung-smarttv/10019/576), [#581](https://community.homey.app/t/app-pro-samsung-smarttv/10019/581), [#584](https://community.homey.app/t/app-pro-samsung-smarttv/10019/584), and [#592](https://community.homey.app/t/app-pro-samsung-smarttv/10019/592)
- [#608](https://community.homey.app/t/app-pro-samsung-smarttv/10019/608)

## Current code observations

- `lib/BaseDevice.ts` treats any successful probe in `isDeviceOnline()` as sufficient for an on state and any false result as off when no probe is true.
- Capability changes can fire Homey triggers even when a probe is transient or contradictory.
- The behavior may be related to polling, websocket availability, UPnP availability, or devices briefly exposing network services without actually turning the display on.

## Expected behavior

Homey should fire power-state triggers only after a reliable, stable physical state transition.

## Investigation and acceptance criteria

- Capture which probe changes during reported false transitions.
- Add tests for conflicting, transient, and `undefined` probe results.
- Consider confirmation/debounce rules before changing `onoff`, without delaying legitimate transitions excessively.
- Ensure repeated identical states do not fire duplicate triggers.
- Document how standby behavior differs for projectors and Frame TVs if it cannot be represented as a simple boolean.

## Hardware verification

Requires observation on a modern TV or Samsung Freestyle device with timeline logging. Do not mark resolved from unit tests alone.
