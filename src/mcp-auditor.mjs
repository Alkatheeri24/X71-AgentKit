const SECRET_NAME = /(secret|token|password|passwd|api[_-]?key|private[_-]?key|client[_-]?secret)/i;
const SECRET_VALUE = /(sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|-----BEGIN .*PRIVATE KEY-----)/i;
const SHELLS = new Set(['sh', 'bash', 'zsh', 'cmd', 'cmd.exe', 'powershell', 'pwsh']);

function push(findings, server, id, severity, message) {
  findings.push(Object.freeze({ server, id, severity, message }));
}

function basename(command) {
  return String(command ?? '').trim().split(/[\\/]/).pop()?.toLowerCase() ?? '';
}

function inspectServer(name, server, findings) {
  if (!server || typeof server !== 'object' || Array.isArray(server)) {
    push(findings, name, 'INVALID_SERVER_CONFIG', 'HIGH', 'Server configuration must be an object.');
    return;
  }

  const command = typeof server.command === 'string' ? server.command.trim() : '';
  const args = Array.isArray(server.args) ? server.args.map(String) : [];
  const url = typeof server.url === 'string' ? server.url.trim() : '';
  const env = server.env && typeof server.env === 'object' && !Array.isArray(server.env) ? server.env : {};

  if (url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      push(findings, name, 'INVALID_REMOTE_URL', 'HIGH', 'Remote server URL is invalid.');
    }
    if (parsed && parsed.protocol !== 'https:' && !['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
      push(findings, name, 'INSECURE_REMOTE_TRANSPORT', 'HIGH', 'Remote MCP endpoint does not use HTTPS.');
    }
    if (parsed && (parsed.username || parsed.password)) {
      push(findings, name, 'CREDENTIAL_IN_URL', 'HIGH', 'Credentials are embedded in the server URL.');
    }
  }

  if (command) {
    const exe = basename(command);
    if (SHELLS.has(exe)) {
      push(findings, name, 'SHELL_WRAPPER', 'HIGH', 'Server launches through a general-purpose shell.');
    }
    const joinedArgs = args.join(' ');
    if (/(^|\s)(-c|\/c|command)(\s|$)/i.test(joinedArgs) && SHELLS.has(exe)) {
      push(findings, name, 'ARBITRARY_SHELL_COMMAND', 'CRITICAL', 'Shell command mode may execute arbitrary commands.');
    }
    if ((exe === 'npx' || exe === 'npx.cmd') && args.some((arg) => arg === '-y' || arg === '--yes')) {
      push(findings, name, 'UNATTENDED_PACKAGE_BOOTSTRAP', 'MEDIUM', 'npx auto-confirm can download and execute packages without review.');
    }
  } else if (!url) {
    push(findings, name, 'NO_TRANSPORT', 'HIGH', 'Server has neither command nor URL transport.');
  }

  for (const [key, value] of Object.entries(env)) {
    const text = String(value ?? '');
    if (SECRET_NAME.test(key) && text && !/^\$\{?[A-Z0-9_]+\}?$/.test(text)) {
      push(findings, name, 'INLINE_SECRET_ENV', 'HIGH', `Environment variable ${key} appears to contain an inline secret.`);
    } else if (SECRET_VALUE.test(text)) {
      push(findings, name, 'SECRET_LIKE_ENV_VALUE', 'HIGH', `Environment variable ${key} contains a secret-like value.`);
    }
  }

  const allowedTools = server.allowedTools ?? server.tools ?? null;
  if (Array.isArray(allowedTools) && allowedTools.includes('*')) {
    push(findings, name, 'WILDCARD_TOOL_ACCESS', 'MEDIUM', 'Wildcard tool access grants broader capability than necessary.');
  }

  if (server.allowDestructive === true) {
    push(findings, name, 'DESTRUCTIVE_CAPABILITY_ENABLED', 'HIGH', 'Destructive capability is explicitly enabled.');
  }
}

function score(findings) {
  const weights = { INFO: 0, LOW: 1, MEDIUM: 3, HIGH: 7, CRITICAL: 15 };
  return findings.reduce((total, finding) => total + (weights[finding.severity] ?? 0), 0);
}

export function auditMcpConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError('config must be an object');
  }

  const servers = config.mcpServers ?? config.servers ?? config;
  if (!servers || typeof servers !== 'object' || Array.isArray(servers)) {
    throw new TypeError('MCP servers must be an object map');
  }

  const findings = [];
  for (const [name, server] of Object.entries(servers)) inspectServer(name, server, findings);

  const riskScore = score(findings);
  const critical = findings.some((f) => f.severity === 'CRITICAL');
  const high = findings.some((f) => f.severity === 'HIGH');
  const status = critical ? 'BLOCK' : high ? 'REVIEW' : findings.length ? 'WARN' : 'PASS';

  return Object.freeze({
    status,
    riskScore,
    serverCount: Object.keys(servers).length,
    findingCount: findings.length,
    findings: Object.freeze(findings),
    executesServers: false,
    performsNetworkRequests: false
  });
}
