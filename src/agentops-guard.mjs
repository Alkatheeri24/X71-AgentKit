const COMMAND_RULES = Object.freeze([
  { id: 'FS_ROOT_DELETE', severity: 'BLOCK', re: /(^|\s)(sudo\s+)?rm\s+-[^\n]*r[^\n]*f[^\n]*(\/|~)(\s|$)/i },
  { id: 'FS_RECURSIVE_DELETE', severity: 'REVIEW', re: /(^|\s)(sudo\s+)?rm\s+-[^\n]*r/i },
  { id: 'DISK_DESTRUCTIVE', severity: 'BLOCK', re: /(^|\s)(mkfs|fdisk|diskutil\s+eraseDisk|dd\s+if=\/dev\/zero)/i },
  { id: 'GIT_FORCE_PUSH', severity: 'REVIEW', re: /(^|\s)git\s+push\b[^\n]*(--force|-f)(\s|$)/i },
  { id: 'GIT_HARD_RESET', severity: 'REVIEW', re: /(^|\s)git\s+reset\s+--hard\b/i },
  { id: 'GIT_CLEAN_FORCE', severity: 'REVIEW', re: /(^|\s)git\s+clean\b[^\n]*-[^\n]*f/i },
  { id: 'DATABASE_DESTRUCTIVE', severity: 'REVIEW', re: /\b(drop\s+(database|table)|truncate\s+table|delete\s+from\s+\S+\s*;)/i },
  { id: 'K8S_DELETE', severity: 'REVIEW', re: /(^|\s)kubectl\s+delete\b/i },
  { id: 'TERRAFORM_DESTROY', severity: 'REVIEW', re: /(^|\s)terraform\s+destroy\b/i },
  { id: 'CLOUD_RESOURCE_DELETE', severity: 'REVIEW', re: /(^|\s)(aws|gcloud|az)\b[^\n]*(delete|destroy|terminate)\b/i },
  { id: 'PIPE_TO_SHELL', severity: 'REVIEW', re: /(curl|wget)[^\n|]*\|\s*(sh|bash|zsh|powershell)\b/i }
]);

const SECRET_RULES = Object.freeze([
  { id: 'OPENAI_STYLE_KEY', re: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { id: 'GITHUB_TOKEN', re: /\b(gh[pousr]_[A-Za-z0-9_]{20,})\b/g },
  { id: 'AWS_ACCESS_KEY', re: /\b(AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { id: 'PRIVATE_KEY', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { id: 'BEARER_TOKEN', re: /\bBearer\s+[A-Za-z0-9._~+\/-]{20,}=*/gi },
  { id: 'GENERIC_SECRET_ASSIGNMENT', re: /\b(api[_-]?key|secret|token|password)\s*[:=]\s*["']?[A-Za-z0-9._~+\/-]{12,}/gi }
]);

const RANK = Object.freeze({ ALLOW: 0, REVIEW: 1, BLOCK: 2 });

function normalizeCommand(command) {
  if (typeof command !== 'string') throw new TypeError('command must be a string');
  const value = command.trim();
  if (!value) throw new TypeError('command must not be empty');
  if (value.length > 32_768) throw new RangeError('command exceeds 32768 characters');
  return value;
}

function highestDecision(findings) {
  let decision = 'ALLOW';
  for (const finding of findings) {
    if (RANK[finding.severity] > RANK[decision]) decision = finding.severity;
  }
  return decision;
}

export function scanTextForSecrets(text) {
  if (typeof text !== 'string') return Object.freeze([]);
  const findings = [];
  for (const rule of SECRET_RULES) {
    rule.re.lastIndex = 0;
    let match;
    while ((match = rule.re.exec(text)) !== null) {
      const value = match[0];
      findings.push(Object.freeze({
        id: rule.id,
        severity: 'BLOCK',
        index: match.index,
        length: value.length,
        redacted: true
      }));
      if (match.index === rule.re.lastIndex) rule.re.lastIndex += 1;
    }
  }
  return Object.freeze(findings);
}

export function assessCommand(command, options = {}) {
  const value = normalizeCommand(command);
  const findings = [];

  for (const rule of COMMAND_RULES) {
    if (rule.re.test(value)) {
      findings.push(Object.freeze({ id: rule.id, severity: rule.severity }));
    }
  }

  if (options.inspectInlineSecrets !== false) {
    for (const finding of scanTextForSecrets(value)) findings.push(finding);
  }

  const decision = highestDecision(findings);
  return Object.freeze({
    decision,
    allowed: decision === 'ALLOW',
    requiresHumanReview: decision === 'REVIEW',
    blocked: decision === 'BLOCK',
    commandLength: value.length,
    findings: Object.freeze(findings),
    executesCommand: false
  });
}

export function assessGitArgs(args = []) {
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) {
    throw new TypeError('args must be an array of strings');
  }
  return assessCommand(`git ${args.join(' ')}`);
}
