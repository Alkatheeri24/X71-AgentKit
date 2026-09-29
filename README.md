# X71 AgentKit

**A local-first safety gate for AI coding agents, MCP configurations, and AI cost controls.**

Use it before Claude Code, Codex, Cursor, CI, or a custom agent executes something risky.

- blocks clearly destructive command patterns;
- sends risky Git operations to review;
- detects secret-like material without echoing raw values;
- statically audits MCP configuration without launching servers;
- scans a project with `doctor` and `scan`;
- estimates AI cost from caller-supplied pricing instead of inventing prices;
- requires no X71 backend and performs no network request by default.

## Protect a project in 60 seconds

Requires Node.js 22 or newer.

```bash
npm install -g @x71-agentkit/agentkit
x71-agentkit --help
```

Check a proposed agent command:

```bash
x71-agentkit agentops --command "git push --force origin main"
```

Run a project-wide safety scan:

```bash
x71-agentkit scan . --format markdown
```

Run a fast readiness check:

```bash
x71-agentkit doctor . --format markdown
```

## What it protects

### AgentOps Guard

Pre-flight safety checks for terminal and Git actions before an AI agent executes them.

```bash
x71-agentkit agentops --command "sudo rm -rf /"
```

The guard returns structured `ALLOW`, `REVIEW`, or `BLOCK` evidence and **never executes the command being inspected**.

### Project Safety Scan

`scan` performs a bounded, local static scan of the project. It checks:

- secret-like material without returning captured values;
- risky `package.json` scripts;
- MCP JSON configurations;
- common agent-development safety signals.

```bash
x71-agentkit scan . --format markdown --fail-on review
```

The reported Safety Score is a transparent **heuristic for triage**, not a security guarantee.

### Doctor

`doctor` combines environment readiness with the project scan:

```bash
x71-agentkit doctor . --format markdown
```

This makes it easy to produce a short, shareable pre-flight report before giving an AI agent broad tool access.

### MCP Auditor

Static security audit for Model Context Protocol configuration:

```bash
x71-agentkit mcp-audit ./mcp.json
```

It detects insecure transport, shell wrappers, arbitrary shell command mode, inline secret-like values, wildcard tool access, unattended `npx -y`, and explicitly destructive capabilities. It does not start MCP servers or perform network requests.

### AI Cost Guard

Provider-neutral token-cost estimation and budget enforcement:

```bash
x71-agentkit cost ./usage.json ./pricing.json --budget 5
```

Pricing is supplied by the caller. Unknown pricing remains unknown instead of being guessed.

## GitHub Action

The repository includes a reusable composite action. After the `v0.2.0` release tag is available:

```yaml
name: Agent safety

on:
  pull_request:

permissions:
  contents: read

jobs:
  x71-agentkit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Alkatheeri24/X71-AgentKit@v0.2.0
        with:
          path: .
          fail-on: review
```

For higher-assurance environments, pin the action to a full commit SHA.

## Agent integrations

The same pre-flight pattern works with Claude Code, Codex, Cursor, OpenHands, Aider, CI, and custom agent runtimes:

```text
AI agent
   ↓
X71 AgentKit
   ↓
ALLOW / REVIEW / BLOCK
   ↓
actual tool execution
```

See [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) for integration patterns.

## Library usage

```js
import { assessCommand } from '@x71-agentkit/agentkit/agentops-guard';
import { auditMcpConfig } from '@x71-agentkit/agentkit/mcp-auditor';
import { summarizeCosts, evaluateBudget } from '@x71-agentkit/agentkit/ai-cost-guard';
import { scanProject, doctorProject } from '@x71-agentkit/agentkit/project-scanner';
```

## Design principles

- **Local first:** input stays on the machine unless the integrating application chooses otherwise.
- **No secret echo:** findings identify secret categories, never return captured secret values.
- **Fail closed:** malformed security-critical input returns an error, block, or review outcome.
- **Provider neutral:** no dependency on a specific model vendor or agent framework.
- **Evidence over claims:** cost and safety outputs expose what was actually checked.
- **Human authority:** `PASS` means the implemented checks passed; it is not proof that software is secure or safe to merge.

## Security scope

AgentKit is a defensive control layer. It does not replace sandboxing, operating-system permissions, repository branch protection, secret managers, dependency scanners, SAST/DAST, or human review.

See [`SECURITY.md`](SECURITY.md) for reporting guidance and known limitations.

## Development

```bash
npm test
npm run check
npm run pack:check
```

AgentKit has no runtime dependencies in the v0.2 release candidate.

## License

Apache License 2.0.
