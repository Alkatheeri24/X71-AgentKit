# X71 AgentKit integrations

X71 AgentKit is provider-neutral. The safest integration pattern is to place it **before** a tool or command is executed, not after.

## Claude Code, Codex, Cursor, and other coding agents

Use AgentKit as a pre-flight gate for any command proposed by an agent:

```bash
x71-agentkit agentops --command "git push --force origin main"
```

Interpret the structured result before execution:

- `ALLOW` — the implemented checks did not find a blocking pattern.
- `REVIEW` — require human review before execution.
- `BLOCK` — do not execute the proposed command.

Do not treat `ALLOW` as a security guarantee. Keep operating-system permissions, sandboxing, branch protection, secret management, and human approval in place.

## Project-wide scan

Run a local static scan before giving an AI coding agent broad tool access:

```bash
x71-agentkit scan . --format markdown
```

To use the scan as a CI gate:

```bash
x71-agentkit scan . --format markdown --fail-on review
```

The scanner:

- ignores common dependency/build directories;
- detects secret-like material without returning raw secret values;
- checks risky `package.json` scripts;
- statically audits MCP JSON configurations;
- does not launch MCP servers or execute inspected commands;
- uses a bounded local scan and makes no network request.

## Doctor

For a fast local readiness check:

```bash
x71-agentkit doctor . --format markdown
```

The reported score is a transparent heuristic intended for triage and sharing. It is not proof that a project is secure.

## GitHub Actions

After a release tag that contains the root `action.yml`, a repository can add:

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

Pinning a full commit SHA is stronger supply-chain practice for high-assurance environments.

## MCP

Audit an MCP configuration before enabling it:

```bash
x71-agentkit mcp-audit ./mcp.json
```

The auditor is static. It does not start the configured server and does not perform network requests.

## AI cost controls

Provide usage and pricing data explicitly:

```bash
x71-agentkit cost ./usage.json ./pricing.json --budget 5
```

AgentKit never invents current provider pricing. Unknown or incomplete pricing coverage is surfaced instead of being silently guessed.
