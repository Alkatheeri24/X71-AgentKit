# Contributing to X71 AgentKit

Thanks for helping improve X71 AgentKit.

## Principles

- Keep the project local-first and provider-neutral.
- Do not add telemetry, external network calls, or credential collection by default.
- Never commit real secrets, production data, private keys, access tokens, or proprietary X71 material.
- Security-critical checks should fail closed when input is malformed or ambiguous.
- A PASS result must never be presented as a complete security guarantee.

## Development

Requirements:

- Node.js 22 or newer.

Before opening a pull request, run:

```bash
npm run check
npm test
```

Add or update tests for behavior changes. Keep dependencies minimal and justify any new runtime dependency.

## Pull requests

A useful pull request should include:

- a clear problem statement;
- the proposed behavior;
- tests covering the change;
- security and privacy impact;
- compatibility impact, if any.

For security vulnerabilities, follow `SECURITY.md` instead of filing a public exploit report.
