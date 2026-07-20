# Installed app discovery is incomplete and some apps cannot be launched

Status: Candidate bug or small enhancement

Area: Maintained `Samsung` driver application discovery

## Problem

Users cannot select installed regional apps such as Canal Digitaal, SVT Play, or TV4 Play. Plex and Prime Video are present for some users but fail to launch. Several users request using the TV or SmartThings as the authoritative installed-app list instead of relying on static IDs.

## Source posts

- [#518](https://community.homey.app/t/app-pro-samsung-smarttv/10019/518)
- [#529](https://community.homey.app/t/app-pro-samsung-smarttv/10019/529)
- [#544](https://community.homey.app/t/app-pro-samsung-smarttv/10019/544)
- [#554](https://community.homey.app/t/app-pro-samsung-smarttv/10019/554), [#555](https://community.homey.app/t/app-pro-samsung-smarttv/10019/555), [#565](https://community.homey.app/t/app-pro-samsung-smarttv/10019/565), and [#571](https://community.homey.app/t/app-pro-samsung-smarttv/10019/571)

## Current code observations

- `lib/apps.ts` supplies a static fallback list.
- `drivers/Samsung/SamsungClient.ts#getListOfApps()` requests `ed.installedApp.get` and merges returned IDs into the existing list.
- App discovery depends on receiving a later websocket event, while autocomplete can be requested before the event arrives.
- Discovered records appear to retain only `appId` and `name`, potentially losing launch metadata.

## Expected behavior

Autocomplete should show launchable apps actually installed on the TV, including regional apps, with static entries used only when live discovery is unavailable.

## Investigation and acceptance criteria

- Add sanitized fixtures for successful, empty, delayed, malformed, and unsupported installed-app responses.
- Make discovery completion explicit before returning autocomplete results, with a bounded timeout and fallback.
- Preserve all launch identifiers needed by `launchApp()`.
- Deduplicate discovered and static apps deterministically.
- Surface a useful error when an installed app rejects the selected launch method.

## Hardware verification

Compare live app lists and launches on multiple modern Samsung model years and regions. App IDs are region/model dependent.
