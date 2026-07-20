# Power transition confirmation exceeds Homey capability timeout

Status: Fix implemented — [GitHub issue #66](https://github.com/balmli/com.samsung.smart/issues/66)

Pull request: [#67](https://github.com/balmli/com.samsung.smart/pull/67)

Area: Maintained `Samsung` driver power transition lifecycle

## Problem

After the recent power-transition recovery changes, turning off a real Samsung TV can display Homey's
`Timeout after 10000ms` message even though the command succeeds and the TV eventually turns off. Some TVs take more
than 10 seconds to become unreachable after accepting the power command.

## Source

- Maintainer hardware test reported on 2026-07-20 after the power-state fixes were merged to `main`.

## Confirmation evidence

The maintained driver's `turnOnOff()` method waits for polling to confirm the requested physical state before its
capability-listener promise resolves. The transition timeout is 30 seconds, while the observed Homey request timeout is
10 seconds. Hardware testing confirms that a successful TV shutdown can cross that UI deadline.

## Expected behavior

Once the TV accepts the power command, Homey should acknowledge the capability request without waiting for the physical
shutdown to finish. Transition polling must continue in the background and retain bounded cleanup, duplicate-command
protection, and recovery from command or polling failures.

## Intended regression test

- Prove that a successfully sent power command resolves before physical transition polling completes.
- Prove that transition state and timers remain active until later polling confirms the requested state.
- Preserve immediate command-failure cleanup, duplicate-command blocking, transition timeout cleanup, initialization,
  and deletion behavior.

## Scope and hardware limitations

- Change only the maintained `drivers/Samsung/` implementation and its focused unit tests.
- Do not change the encrypted or legacy drivers.
- Verify the behavior with deterministic tests. Final confirmation that the Homey UI no longer reports its 10-second
  timeout requires another real modern Samsung TV test.

## Implementation and verification

- The maintained driver now resolves the Homey capability request after Samsung accepts the power command instead of
  waiting for the physical state transition to complete.
- Polling, the 30-second transition bound, duplicate-command protection, Wake-on-LAN retries, and lifecycle cleanup
  continue in the background.
- Immediate command failures still reject the capability request and clear transition state. A later background
  confirmation timeout is logged and cleaned up without attempting to reject an already completed request.
- Regression test red: the command-send promise resolved, but `turnOnOff()` remained pending until transition cleanup.
- Regression test green: all 12 focused transition cases pass, including early acknowledgement with active background
  timers and later cleanup.
- Node 24.16.0 checks passed: `npm run format`, `npm run build`, `npm run lint`, `npm run test:typecheck`, and
  `npm test --ignore-scripts` (62 passing).
- No manifest or generated `app.json` changes were required. Modern Samsung hardware confirmation of the corrected UI
  behavior remains outstanding; encrypted and legacy drivers were not changed or hardware-tested.
