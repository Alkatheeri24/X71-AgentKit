import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { assessCommand, scanTextForSecrets } from './agentops-guard.mjs';
import { auditMcpConfig } from './mcp-auditor.mjs';

const DEFAULT_IGNORED_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.turbo', '.cache', 'vendor'
]);

const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.yaml', '.yml', '.toml', '.md', '.txt', '.env'
]);

const MAX_FILES = 5000;
const MAX_FILE_BYTES = 1_000_000;
const MAX_TOTAL_BYTES = 25_000_000;

const STATUS_RANK = Object.freeze({ PASS: 0, WARN: 1, REVIEW: 2, BLOCK: 3 });
const PENALTIES = Object.freeze({ WARN: 5, REVIEW: 15, BLOCK: 30 });

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function isTextCandidate(filePath) {
  const base = path.basename(filePath).toLowerCase();
  if (base === '.env' || base.startsWith('.env.')) return true;
  return TEXT_EXTENSIONS.has(path.extname(base));
}

function isMcpCandidate(filePath) {
  const base = path.basename(filePath).toLowerCase();
  return base.endsWith('.json') && (base.includes('mcp') || base === 'claude_desktop_config.json');
}

function walkFiles(rootPath) {
  const files = [];
  let totalBytes = 0;
  let truncated = false;

  function visit(current) {
    if (files.length >= MAX_FILES || totalBytes >= MAX_TOTAL_BYTES) {
      truncated = true;
      return;
    }

    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (files.length >= MAX_FILES || totalBytes >= MAX_TOTAL_BYTES) {
        truncated = true;
        break;
      }
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory() && DEFAULT_IGNORED_DIRS.has(entry.name)) continue;

      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (!entry.isFile() || !isTextCandidate(absolute)) continue;

      let stat;
      try {
        stat = fs.statSync(absolute);
      } catch {
        continue;
      }
      if (stat.size > MAX_FILE_BYTES) continue;
      totalBytes += stat.size;
      files.push({ absolute, bytes: stat.size });
    }
  }

  visit(rootPath);
  return { files, totalBytes, truncated };
}

function severityForMcp(severity) {
  if (severity === 'CRITICAL') return 'BLOCK';
  if (severity === 'HIGH') return 'REVIEW';
  if (severity === 'MEDIUM' || severity === 'LOW') return 'WARN';
  return 'WARN';
}

function finding({ category, severity, id, file = null, detail = null }) {
  return Object.freeze({ category, severity, id, file, detail });
}

function highestStatus(findings) {
  let status = 'PASS';
  for (const item of findings) {
    if ((STATUS_RANK[item.severity] ?? 0) > STATUS_RANK[status]) status = item.severity;
  }
  return status;
}

function heuristicScore(findings) {
  let score = 100;
  for (const item of findings) score -= PENALTIES[item.severity] ?? 0;
  return Math.max(0, score);
}

function inspectPackageJson(rootPath, findings) {
  const packagePath = path.join(rootPath, 'package.json');
  if (!fs.existsSync(packagePath)) return { present: false, scriptCount: 0 };

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch {
    findings.push(finding({ category: 'package', severity: 'REVIEW', id: 'PACKAGE_JSON_INVALID', file: 'package.json' }));
    return { present: true, scriptCount: 0 };
  }

  const scripts = pkg && typeof pkg.scripts === 'object' && pkg.scripts ? pkg.scripts : {};
  for (const [name, command] of Object.entries(scripts)) {
    if (typeof command !== 'string') continue;
    try {
      const result = assessCommand(command);
      for (const item of result.findings) {
        findings.push(finding({
          category: 'package-script',
          severity: item.severity,
          id: item.id,
          file: 'package.json',
          detail: `script:${name}`
        }));
      }
    } catch {
      findings.push(finding({
        category: 'package-script',
        severity: 'REVIEW',
        id: 'PACKAGE_SCRIPT_EVALUATION_FAILED',
        file: 'package.json',
        detail: `script:${name}`
      }));
    }
  }

  return { present: true, scriptCount: Object.keys(scripts).length };
}

export function scanProject(projectPath = '.') {
  const rootPath = path.resolve(projectPath);
  let stat;
  try {
    stat = fs.statSync(rootPath);
  } catch {
    throw new Error(`project path does not exist: ${projectPath}`);
  }
  if (!stat.isDirectory()) throw new Error(`project path is not a directory: ${projectPath}`);

  const findings = [];
  const packageInfo = inspectPackageJson(rootPath, findings);
  const walked = walkFiles(rootPath);
  let secretFindingCount = 0;
  let mcpConfigCount = 0;

  for (const file of walked.files) {
    const relative = toPosix(path.relative(rootPath, file.absolute));
    let text;
    try {
      text = fs.readFileSync(file.absolute, 'utf8');
    } catch {
      continue;
    }

    const secretFindings = scanTextForSecrets(text);
    secretFindingCount += secretFindings.length;
    for (const item of secretFindings) {
      findings.push(finding({ category: 'secret', severity: 'BLOCK', id: item.id, file: relative }));
    }

    if (isMcpCandidate(file.absolute)) {
      let config;
      try {
        config = JSON.parse(text);
      } catch {
        findings.push(finding({ category: 'mcp', severity: 'REVIEW', id: 'MCP_JSON_INVALID', file: relative }));
        continue;
      }

      const hasMcpShape = config && typeof config === 'object' && (
        Object.prototype.hasOwnProperty.call(config, 'mcpServers') ||
        Object.prototype.hasOwnProperty.call(config, 'servers')
      );
      if (!hasMcpShape) continue;

      mcpConfigCount += 1;
      try {
        const audit = auditMcpConfig(config);
        for (const item of audit.findings) {
          findings.push(finding({
            category: 'mcp',
            severity: severityForMcp(item.severity),
            id: item.id,
            file: relative,
            detail: item.server ?? null
          }));
        }
      } catch {
        findings.push(finding({ category: 'mcp', severity: 'REVIEW', id: 'MCP_AUDIT_FAILED', file: relative }));
      }
    }
  }

  if (walked.truncated) {
    findings.push(finding({ category: 'scanner', severity: 'WARN', id: 'SCAN_LIMIT_REACHED' }));
  }

  const status = highestStatus(findings);
  const score = heuristicScore(findings);
  const counts = Object.freeze({
    block: findings.filter((item) => item.severity === 'BLOCK').length,
    review: findings.filter((item) => item.severity === 'REVIEW').length,
    warn: findings.filter((item) => item.severity === 'WARN').length
  });

  return Object.freeze({
    schemaVersion: 1,
    status,
    score,
    scoreModel: 'heuristic-v1',
    securityGuarantee: false,
    root: rootPath,
    summary: Object.freeze({
      filesScanned: walked.files.length,
      bytesScanned: walked.totalBytes,
      scanTruncated: walked.truncated,
      packageJsonPresent: packageInfo.present,
      packageScriptCount: packageInfo.scriptCount,
      mcpConfigCount,
      secretFindingCount,
      ...counts
    }),
    findings: Object.freeze(findings)
  });
}

export function doctorProject(projectPath = '.') {
  const scan = scanProject(projectPath);
  const major = Number(process.versions.node.split('.')[0]);
  const checks = Object.freeze([
    Object.freeze({ id: 'NODE_VERSION', status: major >= 22 ? 'PASS' : 'REVIEW', detail: process.versions.node }),
    Object.freeze({ id: 'PACKAGE_JSON', status: scan.summary.packageJsonPresent ? 'PASS' : 'WARN', detail: scan.summary.packageJsonPresent ? 'found' : 'not found' }),
    Object.freeze({ id: 'PROJECT_SCAN', status: scan.status, detail: `${scan.summary.filesScanned} files scanned` })
  ]);
  const status = highestStatus(checks.map((item) => ({ severity: item.status })));

  return Object.freeze({
    schemaVersion: 1,
    status,
    score: scan.score,
    scoreModel: scan.scoreModel,
    securityGuarantee: false,
    checks,
    scan
  });
}

export function renderMarkdown(report, title = 'X71 AgentKit Safety Report') {
  const lines = [
    `# ${title}`,
    '',
    `- Status: **${report.status}**`,
    `- Safety score: **${report.score}/100**`,
    `- Score model: \`${report.scoreModel}\` (heuristic, not a security guarantee)`,
    ''
  ];

  const scan = report.scan ?? report;
  lines.push('## Summary', '');
  lines.push(`- Files scanned: ${scan.summary.filesScanned}`);
  lines.push(`- MCP configs inspected: ${scan.summary.mcpConfigCount}`);
  lines.push(`- Secret-like findings: ${scan.summary.secretFindingCount}`);
  lines.push(`- BLOCK: ${scan.summary.block}`);
  lines.push(`- REVIEW: ${scan.summary.review}`);
  lines.push(`- WARN: ${scan.summary.warn}`);
  lines.push('');

  if (scan.findings.length) {
    lines.push('## Findings', '');
    for (const item of scan.findings.slice(0, 100)) {
      const location = item.file ? ` — \`${item.file}\`` : '';
      const detail = item.detail ? ` (${item.detail})` : '';
      lines.push(`- **${item.severity}** \`${item.id}\`${location}${detail}`);
    }
    if (scan.findings.length > 100) lines.push(`- … ${scan.findings.length - 100} additional findings omitted from Markdown output.`);
    lines.push('');
  }

  lines.push('> X71 AgentKit is a defensive pre-flight layer. PASS does not prove that a project is secure.');
  return `${lines.join('\n')}\n`;
}
