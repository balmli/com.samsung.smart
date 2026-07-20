# Application launch returns an unhelpful 401 Unauthorized error

Status: Fix implemented — [GitHub issue #64](https://github.com/balmli/com.samsung.smart/issues/64)

Pull request: [#65](https://github.com/balmli/com.samsung.smart/pull/65)

Area: Maintained `Samsung` driver application launching

## Problem

When a user launches an app that is not installed on the TV, some modern Samsung TVs return HTTP 401. The app
currently exposes this as `Operation failed (401 Unauthorized)`, which does not explain the likely cause or tell the
user what to check.

The **Launch video on YouTube** action uses the same application endpoint. If YouTube is not installed and the TV
returns 401, users should receive the same actionable explanation with YouTube context.

## Evidence

- Maintainer hardware reproduction on 2026-07-20: launching an app that was not installed on the TV returned
  `Operation failed (401 Unauthorized)`.
- `SamsungBase._applicationCmd()` has explicit mappings for 403, 404, 413, 501, and 503, but 401 falls through to
  the generic status message.
- `SamsungBase.launchYouTube()` reads `err.message`, while application-command status failures are rejected as
  strings. A YouTube launch failure can therefore lose the underlying message.

## Related community tasks

- [`installed-app-discovery-incomplete.md`](installed-app-discovery-incomplete.md) covers authoritative installed-app
  discovery and launch metadata.
- [`youtube-launch-unauthorized.md`](youtube-launch-unauthorized.md) covers whether YouTube launching and deep links
  are supported across current TV models.

This task improves error reporting only. It does not claim to fix app discovery, install an absent app, or make
YouTube deep-link launching compatible with unsupported models.

## Expected behavior

For the maintained Samsung driver, an HTTP 401 application response should explain that the TV rejected the request
and advise the user to verify that the app is installed and supported. The **Launch video on YouTube** action should
preserve that underlying message instead of displaying an undefined or generic error.

## Acceptance criteria

- Add a focused regression test for a 401 response from **Launch app**.
- Add a focused regression test proving that **Launch video on YouTube** preserves string-based application errors.
- Keep the wording actionable without claiming that every 401 definitively means the app is absent.
- Preserve existing mappings for 403, 404, 413, 501, and 503.
- Keep retained encrypted and legacy driver behavior unchanged.

## Hardware verification

The direct app-launch 401 behavior has been reproduced on maintained Samsung hardware. The YouTube-not-installed
case remains unverified on hardware; its shared response handling is covered deterministically by tests.

## Implementation and verification

- The maintained `Samsung` client maps HTTP 401 application responses to an actionable message advising users to
  verify that the app is installed and supported.
- The maintained YouTube action now preserves both string and `Error` messages from the underlying application
  request. Installed-app discovery and YouTube protocol compatibility are unchanged.
- A no-op shared hook leaves retained encrypted-driver response mapping unchanged; the legacy driver does not expose
  application launch actions.
- Regression test red: direct app launch returned `Operation failed (401 Unauthorized)`, and the YouTube wrapper
  rendered the string failure as `undefined`. The shared-base preservation case already passed.
- Regression test green: all three focused cases passed after the maintained-driver overrides.
- Node 24.16.0 checks passed: `npm run format`, `npm run build`, `npm run lint`, `npm run test:typecheck`, and
  `npm test --ignore-scripts` (61 passing).
- The locale changed only for the new maintained-driver message. No manifest, Flow-card, setting, capability, or
  generated `app.json` changes were required.
