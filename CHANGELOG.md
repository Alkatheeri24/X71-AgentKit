# Changelog

All notable changes to X71 AgentKit are documented here.

## [0.1.0] - 2026-09-29

### Added

- AgentOps Guard for destructive command, risky Git operation, and inline-secret pre-flight checks.
- MCP Auditor for static MCP configuration security review without launching servers or making network requests.
- AI Cost Guard for provider-neutral cost estimation, pricing-coverage reporting, and budget decisions.
- Dependency-free Node.js CLI.
- Unit tests covering destructive commands, force pushes, secret redaction, shell-based MCP risk, safe local MCP configuration, cost estimation, incomplete pricing, and budget blocking.
- GitHub Actions CI with syntax, unit-test, and package dry-run verification.
- Apache-2.0 license, security policy, and contribution guide.
- GitHub-installable public distribution path.

### Security posture

A `PASS` result means only that implemented checks passed. X71 AgentKit does not replace sandboxing, least-privilege permissions, branch protection, secret managers, dependency scanning, SAST/DAST, or human review.
