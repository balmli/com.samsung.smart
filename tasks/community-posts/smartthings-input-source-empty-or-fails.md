# SmartThings input-source list is empty or source changes fail

Status: Candidate bug

Area: Maintained `Samsung` driver and SmartThings integration

## Problem

This is the most frequently repeated report. After enabling SmartThings and entering a token, the “Set input source” autocomplete is empty, or selecting a source fails with errors such as `409 Conflict`. Sending HDMI remote keys is not a reliable substitute. Some users report that input selection worked before version 2.1.0.

## Source posts

- [#498](https://community.homey.app/t/app-pro-samsung-smarttv/10019/498) through [#506](https://community.homey.app/t/app-pro-samsung-smarttv/10019/506)
- [#517](https://community.homey.app/t/app-pro-samsung-smarttv/10019/517) and [#518](https://community.homey.app/t/app-pro-samsung-smarttv/10019/518)
- [#538](https://community.homey.app/t/app-pro-samsung-smarttv/10019/538) and [#543](https://community.homey.app/t/app-pro-samsung-smarttv/10019/543)
- [#568](https://community.homey.app/t/app-pro-samsung-smarttv/10019/568), [#577](https://community.homey.app/t/app-pro-samsung-smarttv/10019/577), and [#579](https://community.homey.app/t/app-pro-samsung-smarttv/10019/579)
- [#589](https://community.homey.app/t/app-pro-samsung-smarttv/10019/589), [#593](https://community.homey.app/t/app-pro-samsung-smarttv/10019/593), and [#596](https://community.homey.app/t/app-pro-samsung-smarttv/10019/596) through [#600](https://community.homey.app/t/app-pro-samsung-smarttv/10019/600)
- [#620](https://community.homey.app/t/app-pro-samsung-smarttv/10019/620), [#641](https://community.homey.app/t/app-pro-samsung-smarttv/10019/641) through [#645](https://community.homey.app/t/app-pro-samsung-smarttv/10019/645), and [#652](https://community.homey.app/t/app-pro-samsung-smarttv/10019/652)
- [#657](https://community.homey.app/t/app-pro-samsung-smarttv/10019/657) through [#661](https://community.homey.app/t/app-pro-samsung-smarttv/10019/661)

## Current code observations

- `lib/SmartThings.ts#getStInputSources()` assumes `components.main.mediaInputSource.supportedInputSources.value` exists and returns `[]` for every error.
- Returning an empty list hides whether the problem is authentication, device matching, a changed SmartThings status shape, or a TV without that capability.
- SmartThings device matching depends on exact Homey setting name/model matches and a capability filter that should be reviewed.
- `setStInputSource()` accepts only HTTP 200 and assumes a particular error response shape.

## Expected behavior

Supported input sources should populate when SmartThings exposes them. Unsupported TVs, invalid tokens, device-match failures, and command conflicts should produce distinct actionable errors.

## Investigation and acceptance criteria

- Capture current SmartThings `/devices`, `/status`, and `/commands` response shapes using sanitized fixtures.
- Add tests for valid sources, missing capability paths, token errors, no/multiple TV matches, non-200 responses, and asynchronous command responses.
- Avoid swallowing errors into an indistinguishable empty autocomplete list.
- Review token permissions and document the minimum required scopes.
- Confirm HDMI and DisplayPort capability names are passed exactly as returned by SmartThings.

## Hardware verification

Requires a SmartThings-linked modern Samsung TV. Remove account IDs, tokens, device IDs, MAC addresses, and IP addresses from fixtures and diagnostics.
