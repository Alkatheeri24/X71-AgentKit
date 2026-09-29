# Changelog

All notable changes to X71 AgentKit are documented here.

## [0.2.0] - 2026-09-29

### Added

- `x71-agentkit scan [path]` for bounded local project scanning across secret-like material, risky package scripts, and MCP JSON configuration.
- `x71-agentkit doctor [path]` for a fast environment and project safety readiness report.
- JSON and Markdown report formats for machine use and shareable human review.
- Transparent heuristic Safety Score with an explicit `securityGuarantee=false` posture.
- Configurable CI threshold via `--fail-on never|warn|review|block`.
- Reusable root GitHub Action for pull-request safety scanning.
- Integration guidance for Claude Code, Codex, Cursor, MCP, custom agents, and CI.
- Public library export for `project-scanner`.

### Security posture

- Project scans are local and bounded by file-count, per-file-size, and total-byte limits.
- Common dependency/build directories are ignored.
- Secret findings expose category and location metadata, not captured secret values.
- MCP analysis remains static: no MCP server launch and no network request.
- The Safety Score is a triage heuristic, not proof of security.

### Verification required before publication

- Syntax checks, unit tests, project scanner tests, package dry-run, CLI install/smoke tests, and GitHub-hosted CI must pass.
- npm publication remains separate from merging source and must use the configured Trusted Publisher workflow.

## [0.1.2] - 2026-09-29

### Fixed

- Normalized the npm `bin` target from `./src/cli.mjs` to `src/cli.mjs` so current npm publish normalization does not remove or rewrite the `x71-agentkit` CLI entry.
- Kept the CLI implementation and package scope unchanged.

### Verification

- CI must pass syntax checks, unit tests, package dry-run, global install, and CLI startup before npm publication.

## [0.1.1] - 2026-09-29

### Changed

- Moved the npm package identity to the owned public organization scope `@x71-agentkit/agentkit`.
- Updated install, npx, and library import examples for the final npm scope.
- Kept GitHub distribution and the Apache-2.0 source license unchanged.

### Verification

- CI must pass syntax checks, unit tests, package dry-run, global install, and CLI startup before npm publication.

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
