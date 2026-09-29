# X71 AgentKit

Open-source, local-first utilities for safer AI-assisted software development.

X71 AgentKit is intentionally small and provider-neutral. It does not require an X71 backend, does not upload source code, and does not execute external network calls by default.

## Products

### 1. AgentOps Guard

Pre-flight safety checks for terminal and Git actions before an AI agent executes them.

- blocks clearly destructive command patterns;
- requires review for risky Git operations;
- detects likely secrets without returning their raw values;
- returns structured JSON suitable for Claude Code, Codex, Cursor, OpenHands, Aider, CI, or custom agents.

### 2. MCP Auditor

Static security audit for Model Context Protocol (MCP) configuration.

- insecure HTTP endpoint detection;
- shell-wrapper and arbitrary command execution warnings;
- secret-like environment value detection;
- wildcard tool access warnings;
- risky package bootstrap patterns such as unattended `npx -y` execution;
- no server execution during audit.

### 3. AI Cost Guard

Provider-neutral LLM/AI usage cost estimation and budget enforcement.

- user-supplied pricing catalog;
- token-based call estimates;
- coverage reporting when pricing is incomplete;
- hard and warning budget thresholds;
- no claim that a price is current unless the caller provides a verified catalog.

## Install

Requires Node.js 22 or newer.

### From npm

```bash
npm install -g @x71-agentkit/agentkit
```

Or run without a global install:

```bash
npx @x71-agentkit/agentkit --help
```

### From GitHub

```bash
npm install -g github:Alkatheeri24/X71-AgentKit
```

Then run:

```bash
x71-agentkit --help
x71-agentkit agentops --command "git push --force origin main"
x71-agentkit mcp-audit ./mcp.json
x71-agentkit cost ./usage.json ./pricing.json --budget 5
```

You can also run directly from a clone:

```bash
node src/cli.mjs agentops --command "git push --force origin main"
node src/cli.mjs mcp-audit ./mcp.json
node src/cli.mjs cost ./usage.json ./pricing.json --budget 5
```

The CLI is fail-closed for malformed input and never executes the command being inspected.

## npm package

The npm package name is `@x71-agentkit/agentkit`. Version `0.1.2` normalizes the CLI `bin` path for current npm publishing behavior while keeping the package API and organization scope unchanged. Public registry publication is performed only after the package dry-run, tests, and CLI smoke checks pass.

## Design principles

- **Local first:** input stays on the machine unless the integrating application chooses otherwise.
- **No secret echo:** findings identify secret categories, never return captured secret values.
- **Fail closed:** malformed security-critical input returns an error or review decision.
- **Provider neutral:** no dependency on a specific model vendor or agent framework.
- **Evidence over claims:** cost estimates expose pricing coverage and data provenance supplied by the caller.
- **Human authority:** a `PASS` means the implemented checks passed; it is not a guarantee that software is secure or safe to merge.

## Library usage

```js
import { assessCommand } from '@x71-agentkit/agentkit/agentops-guard';
import { auditMcpConfig } from '@x71-agentkit/agentkit/mcp-auditor';
import { summarizeCosts, evaluateBudget } from '@x71-agentkit/agentkit/ai-cost-guard';
```

## Security scope

AgentKit is a defensive control layer. It does not replace sandboxing, operating-system permissions, repository branch protection, secret managers, dependency scanners, SAST/DAST, or human review.

See `SECURITY.md` for reporting guidance and known limitations.

## Development

```bash
npm test
npm run check
npm run pack:check
```

The v0.1 line has no runtime dependencies.

## License

Apache License 2.0.
