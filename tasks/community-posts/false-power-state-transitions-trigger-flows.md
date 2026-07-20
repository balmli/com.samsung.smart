# False power state transitions trigger flows while the TV remains unchanged

Status: Limitation documented — [GitHub issue #62](https://github.com/balmli/com.samsung.smart/issues/62)

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

## Confirmation evidence

The maintained driver uses Samsung's reported `PowerState` where available and otherwise combines API, UPnP, and
remote-control port reachability. These signals can prove that the TV's network stack is awake, but they cannot prove
that the physical panel or projector lamp is active. If Samsung reports `on` during standby, the app has no universal
authoritative display-state signal with which to reject it.

Debounce, probe voting, and timing heuristics cannot guarantee correct model-independent behavior. The user-facing
limitation and available mitigations are therefore documented instead of changing runtime behavior.

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

## Documentation and verification

- `README.md` now explains to end users that Samsung standby network activity can cause temporary on/off state and
  Flow triggers without visibly activating the display.
- The documented mitigations are to disable power-state polling and drive the **Set power state** action from a more
  reliable external signal, or to add delayed confirmation while recognizing that it is not guaranteed.
- No runtime, shared-library, retained-driver, manifest, locale, capability, setting, Flow-card, or generated
  `app.json` behavior changed.
- Node 24.16.0 checks passed: `npm run format`, `npm run build`, `npm run lint`, `npm run test:typecheck`, and
  `npm test --ignore-scripts` (58 passing).
- No hardware verification is claimed; model, firmware, Frame TV, and projector behavior remains variable.
