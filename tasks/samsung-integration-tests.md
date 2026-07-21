# Samsung hardware integration test runner

Status: Pull request open

Area: Maintained `Samsung` driver only

GitHub issue: https://github.com/balmli/com.samsung.smart/issues/71

Pull request: https://github.com/balmli/com.samsung.smart/pull/72

## Summary

Create an explicitly invoked integration test runner that connects directly to a maintained-protocol Samsung Smart TV without Homey. The runner must use the same production Samsung client and operation code as the Homey device, pair with a separate TV-visible identity, and support human checkpoints such as pressing OK on the TV remote and answering whether an observed operation succeeded.

The preferred interface is a local web application, with a terminal presenter using the same runner as a secondary interface.

## Requirements

- Support only `drivers/Samsung/`; do not import, change, or claim support for the encrypted or legacy drivers.
- Import production Samsung protocol and operation code rather than copying wire formats or command behavior.
- Use a distinct, configurable connection identity so the integration token is separate from Homey's token.
- Store local integration profiles and tokens outside the repository and never log tokens.
- Bind the web interface to loopback by default.
- Require explicit invocation; hardware tests must never run through `npm test` or CI by default.
- Model manual outcomes separately from transport errors: pass, fail, skip/cannot-determine, and error.
- Add pairing timeout/cancellation and cleanly close sockets when a run ends.
- Provide structured JSON results and human-readable output.

## Evidence and current limitations

The existing `cmd/` package proves that `drivers/Samsung/SamsungClient.ts` can be imported outside Homey, but it is not a suitable integration harness:

- it exposes all three Samsung protocol families;
- it uses an older separate TypeScript and dependency lifecycle;
- it constructs the client without the device/runtime facilities used by delays, translated errors, socket cleanup, Wake-on-LAN fallback, and Art Mode;
- it does not provide human checkpoints or structured test results;
- it does not load all settings needed to match Homey behavior.

The production client currently hard-codes the WebSocket connection name to `homey`, preventing a clearly separate integration-test authorization identity.

## Intended automated coverage

- A custom client identity is encoded in WebSocket pairing and command connection URIs while Homey retains the existing `homey` default.
- Integration profiles persist the identity and token without exposing the token through public runner state or logs.
- The runner transitions through automated and human-checkpoint states and records Yes, No, and Skip distinctly.
- The web API binds to loopback and can answer a pending human checkpoint.
- The terminal presenter uses the same test definitions and runner.
- Only the maintained Samsung client is constructed by the integration runtime.

## Hardware limitations

Automated tests can validate runner behavior and production-code wiring, but cannot prove TV-visible behavior. Pairing, key handling, application launching, volume, power, Wake-on-LAN, and Frame Art Mode remain unverified until the suite is run against matching hardware and the human observations are recorded.

## Acceptance criteria

- A documented command starts the local web runner and another starts terminal mode.
- The runner discovers or accepts a TV IP, validates that it is supported by the maintained driver, and pairs under a separate identity.
- A human can press OK on the TV and answer observation questions in either interface.
- The web workflow has one connection/approval action followed by one broad Homey-operation suite. Terminal mode
  keeps disruptive operations opt-in.
- Unit tests establish the runner state machine and identity behavior without contacting a LAN device.
- Root build, lint, type-check, unit tests, and relevant Homey validation pass.
