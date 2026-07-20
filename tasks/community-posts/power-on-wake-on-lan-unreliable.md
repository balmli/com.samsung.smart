# Power-on through Wake-on-LAN is unreliable

Status: Wont fix — no reproducible app defect

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
- The bundled Wake-on-LAN client sends three magic packets per attempt to the limited broadcast address
  `255.255.255.255` on UDP port 9.
- The maintained driver performs an initial wake and up to five retries while polling for the target state, then
  returns the existing bounded connection-timeout error after 30 seconds.
- MAC discovery, interface/broadcast selection, stale addressing, retry timing, and transition detection can all affect the result.

## Assessment

The reports do not identify one common app failure. They do not include the resolved MAC source, Wake-on-LAN send
error, packet destination observed on the LAN, probe results after the command, or evidence distinguishing a TV that
did not receive the magic packet from a TV that woke but was not detected.

The reported alternatives are not equivalent tests of this app's Wake-on-LAN path. SmartThings and voice assistants
can use Samsung's cloud service, while channel keys use the Samsung remote-control service. A channel key waking one
model does not prove that a generic remote key is a safe power-on fallback: toggle-style power keys can turn an
already-on TV off, and arbitrary channel keys have visible side effects.

Wake-on-LAN delivery depends on the TV's active network adapter and firmware standby behavior, the stored MAC
address, wired-to-wireless broadcast forwarding, access-point isolation, VLANs, and router handling of limited or
directed broadcasts. A successful UDP send also cannot confirm that the TV received or acted on the packet.

The separate persistent **power on in progress** failure reported in post #653 was addressed by
[`power-transition-stuck-in-progress.md`](power-transition-stuck-in-progress.md). That recovery fix does not establish
why an individual TV fails to wake.

Without reproducible hardware or packet-level evidence, changing broadcast addresses, adding remote-key fallbacks,
or routing power-on through SmartThings would be speculative and could regress working installations. No production
change is justified for this task.

## Expected behavior

When the TV advertises Wake-on-LAN support and has a valid stored MAC address, the on command should wake it reliably or return a useful, bounded error.

## Reopen criteria

- Reproduce on identified maintained Samsung hardware and record whether it uses Wi-Fi or Ethernet, without
  publishing the MAC or local IP address.
- Confirm that the stored MAC belongs to the adapter that remains wake-capable in standby.
- Capture sanitized evidence showing the magic packet's source interface and broadcast destination.
- Compare with another Wake-on-LAN sender on the same LAN and adapter; a SmartThings cloud wake is not equivalent.
- Record whether the physical TV wakes before Homey's online probes succeed or time out.
- Identify a deterministic app behavior that can be covered by a focused failing regression test before proposing a
  production change.

## Hardware verification

No qualifying hardware reproduction or packet capture is available. Wake behavior remains dependent on TV model,
firmware, network adapter, and LAN configuration.
