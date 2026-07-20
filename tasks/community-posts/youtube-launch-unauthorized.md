# Launching YouTube or a YouTube video returns “application request must be authorized”

Status: Candidate bug

Area: Maintained `Samsung` driver application launching

## Problem

Launching Netflix and other apps works, while the YouTube Flow action or YouTube app launch repeatedly fails with an authorization error across multiple Frame and non-Frame model years.

## Source posts

- [#551](https://community.homey.app/t/app-pro-samsung-smarttv/10019/551), [#558](https://community.homey.app/t/app-pro-samsung-smarttv/10019/558), and [#562](https://community.homey.app/t/app-pro-samsung-smarttv/10019/562)
- [#626](https://community.homey.app/t/app-pro-samsung-smarttv/10019/626) through [#629](https://community.homey.app/t/app-pro-samsung-smarttv/10019/629)
- [#639](https://community.homey.app/t/app-pro-samsung-smarttv/10019/639) and [#640](https://community.homey.app/t/app-pro-samsung-smarttv/10019/640)
- [#663](https://community.homey.app/t/app-pro-samsung-smarttv/10019/663)

## Current code observations

- `lib/SamsungBase.ts#launchYouTube()` launches a DIAL-style `{dialId: 'YouTube'}` target with `v=<videoId>` data.
- `lib/apps.ts` also contains a Samsung app ID for YouTube.
- The supported launch mechanism or YouTube identifier may have changed on newer TVs.

## Expected behavior

The YouTube action should launch the requested video on supported TVs, or return a precise unsupported/authorization error rather than failing for all current models.

## Investigation and acceptance criteria

- Add tests for the generated launch request and video ID validation.
- Compare DIAL launch, Samsung `ed.apps.launch`, current installed-app metadata, and any supported deep-link payload.
- Prefer TV-discovered YouTube identifiers when available; use static identifiers only as a documented fallback.
- Distinguish app launch from deep-link/video launch support.
- Update the Flow hint if direct video launch is no longer supported on some model families.

## Hardware verification

Test on at least one modern non-Frame TV and one Frame TV if available. Do not claim universal support based on request construction alone.
