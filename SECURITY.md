# Security Policy

## Scope

X71 AgentKit provides defensive pre-flight checks. It does not claim complete detection of malicious commands, secrets, unsafe MCP behavior, or billing anomalies.

## Reporting a vulnerability

Please report vulnerabilities privately to the maintainers before public disclosure. Include:

- affected version and component;
- minimal reproduction;
- expected versus observed behavior;
- security impact;
- whether exploitation requires user interaction or elevated privileges.

Do not include real production credentials, personal data, or third-party secrets in reports.

## Security invariants

- the AgentOps Guard never executes the command it evaluates;
- the MCP Auditor is static by default and does not launch servers or make network requests;
- secret findings do not include captured secret values;
- malformed security-critical input fails with an error instead of being silently accepted;
- Cost Guard does not invent provider prices and exposes incomplete pricing coverage;
- a PASS result is evidence only for implemented checks, not a security guarantee.

## Known limitations

Pattern-based command and secret detection can produce false positives and false negatives. Shell quoting, aliases, generated scripts, encoded payloads, nested interpreters, platform-specific utilities, and novel credential formats may bypass static rules. MCP behavior can differ from configuration after a server launches. Cost estimates depend on caller-supplied usage and pricing data.

Use AgentKit with least privilege, operating-system sandboxing, protected branches, secret managers, dependency scanning, SAST/DAST, CI checks, and human review for sensitive actions.
