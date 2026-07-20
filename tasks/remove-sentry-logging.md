# Remove Sentry logging

Status: Fix implemented — [GitHub issue #69](https://github.com/balmli/com.samsung.smart/issues/69)

Pull request: [#70](https://github.com/balmli/com.samsung.smart/pull/70)

Area: Shared application logging

## Problem

The app sends warnings and errors to Sentry through `homey-log`. When a request to Sentry times out, the rejected
capture promise is not handled and Homey reports an `unhandledRejection` that may crash the app in the future.

Reported failure:

```text
Error: Connection timed out on request to o230410.ingest.sentry.io
  at Timeout.<anonymous> (/node_modules/timed-out/index.js:14:18)
  at listOnTimeout (node:internal/timers:588:17)
  at process.processTimers (node:internal/timers:523:7)
```

## Evidence

- `Logger` conditionally constructs `homey-log` whenever Homey provides `HOMEY_LOG_URL`.
- `homey-log@2.1.0` installs Raven with unhandled-rejection capture enabled.
- Its `captureMessage()` and `captureException()` methods return promises that reject when Sentry delivery fails.
- `Logger._log()` invokes those methods without awaiting or catching the returned promises.
- The reported stack names the Sentry ingestion host and the timeout dependency used by the reporting path, so the
  failure does not depend on Samsung TV hardware behavior.

## Expected behavior

The app should continue writing through its normal Homey logger without initializing Sentry or making remote crash
reporting requests. A Sentry outage must not be able to create an unhandled rejection in the app.

## Acceptance criteria

- Add a focused regression test proving the logger has no remote capture API or capture-level behavior.
- Remove `homey-log` and its transitive Sentry/Raven dependencies from the application package.
- Preserve local log-level filtering and Homey-provided log/error functions.
- Remove obsolete Sentry tag and capture configuration from the shared logger and its callers.
- Do not change Samsung TV protocol behavior in any driver.

## Compatibility and hardware verification

The change affects the shared logger used by all three protocol drivers, but only removes remote telemetry. No TV
wire format, pairing, command, polling, or capability behavior is changed. Automated checks can verify the logging
contract and package contents; TV-family hardware compatibility remains unverified and is not claimed.

## Implementation and verification

- Removed Sentry capture levels, capture methods, context tags, `HOMEY_LOG_URL` handling, and `homey-log`
  initialization from the shared logger and its callers.
- Removed `homey-log` and its transitive Raven, timeout, and support packages from the application dependency lock.
- Preserved local log-level filtering and the Homey-provided log and error functions.
- Regression test red: the logger still exposed `captureLevel`, causing the focused assertion to fail.
- Regression test green: the logger exposes no remote capture state or methods, while warning and `Error` output is
  still routed to the supplied local functions.
- Node 24.16.0 checks passed: `npm run format`, `npm run build`, `npm run lint`, `npm run test:typecheck`, and
  `npm test --ignore-scripts` (63 passing).
- `homey app validate --level publish` passed. The generated `app.json` was inspected and has no committed diff.
- No TV hardware testing was needed for this telemetry-only change. Protocol compatibility for all TV families
  remains unverified and is not claimed.
