# Power-on through Wake-on-LAN is unreliable

Status: Candidate bug

Area: Maintained `Samsung` driver

## Problem

Many users can control a TV while it is online and can turn it off, but cannot turn it back on through this app. The same TV may wake through SmartThings, another Homey app, a channel key, or after restarting this app. Reports include both Wi-Fi and Ethernet TVs with Wake-on-LAN enabled.

## Source posts

- [#545](https://community.homey.app/t/app-pro-samsung-smarttv/10019/545), [#549](https://community.homey.app/t/app-pro-samsung-smarttv/10019/549), and [#552](https://community.homey.app/t/app-pro-samsung-smarttv/10019/552)
- [#561](https://community.homey.app/t/app-pro-samsung-smarttv/10019/561)
- [#630](https://community.homey.app/t/app-pro-samsung-smarttv/10019/630) through [#638](https://community.homey.app/t/app-pro-samsung-smarttv/10019/638)
- [#653](https://community.homey.app/t/app-pro-samsung-smarttv/10019/653) through [#656](https://community.homey.app/t/app-pro-samsung-smarttv/10019/656)

## Current code observations

- `lib/SamsungBase.ts` sends Wake-on-LAN using the stored TV MAC address.
- `lib/BaseDevice.ts` performs an initial wake and up to five retries while polling for the target state.
- MAC discovery, interface/broadcast selection, stale addressing, retry timing, and transition detection can all affect the result.

## Expected behavior

When the TV advertises Wake-on-LAN support and has a valid stored MAC address, the on command should wake it reliably or return a useful, bounded error.

## Investigation and acceptance criteria

- Add tests for missing/invalid MAC addresses, retry count, retry timing, and completion/timeout behavior.
- Log safe diagnostic context such as retry number and whether a valid MAC exists, without logging the MAC itself in task artifacts.
- Verify whether broadcast addressing or the Homey network interface must be selected explicitly.
- Distinguish Wake-on-LAN failure from subsequent online-state detection failure.
- Provide a clear user-facing error when wake cannot be attempted.

## Hardware verification

Test separately with a modern Samsung TV connected over Wi-Fi and Ethernet where available. Wake behavior depends heavily on TV and network configuration.
