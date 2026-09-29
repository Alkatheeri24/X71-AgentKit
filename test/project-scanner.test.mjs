import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { doctorProject, renderMarkdown, scanProject } from '../src/project-scanner.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'x71-agentkit-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function fakeSecret() {
  return ['sk-', 'abcdefghijklmnopqrstuv123456789'].join('');
}

test('scanProject passes a minimal clean project', (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    name: 'clean-project',
    scripts: { test: 'node --test' }
  }));
  fs.writeFileSync(path.join(root, 'index.mjs'), 'console.log("ok");\n');

  const report = scanProject(root);
  assert.equal(report.status, 'PASS');
  assert.equal(report.score, 100);
  assert.equal(report.securityGuarantee, false);
  assert.equal(report.summary.packageJsonPresent, true);
});

test('scanProject reports secret metadata without returning the secret value', (t) => {
  const root = fixture(t);
  const secret = fakeSecret();
  fs.writeFileSync(path.join(root, '.env'), `OPENAI_API_KEY=${secret}\n`);

  const report = scanProject(root);
  assert.equal(report.status, 'BLOCK');
  assert.ok(report.summary.secretFindingCount >= 1);
  assert.equal(JSON.stringify(report).includes(secret), false);
});

test('scanProject reviews risky package scripts', (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    name: 'risky-project',
    scripts: { release: 'git push --force origin main' }
  }));

  const report = scanProject(root);
  assert.equal(report.status, 'REVIEW');
  assert.ok(report.findings.some((item) => item.id === 'GIT_FORCE_PUSH'));
});

test('scanProject audits MCP config statically and blocks shell command mode', (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'mcp.json'), JSON.stringify({
    mcpServers: {
      dangerous: { command: 'bash', args: ['-c', 'echo unsafe'] }
    }
  }));

  const report = scanProject(root);
  assert.equal(report.status, 'BLOCK');
  assert.equal(report.summary.mcpConfigCount, 1);
  assert.ok(report.findings.some((item) => item.id === 'ARBITRARY_SHELL_COMMAND'));
});

test('scanProject ignores dependency directories', (t) => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(root, 'node_modules', 'bad.js'), `const token = "${fakeSecret()}";\n`);
  fs.writeFileSync(path.join(root, 'index.js'), 'console.log("safe");\n');

  const report = scanProject(root);
  assert.equal(report.status, 'PASS');
  assert.equal(report.summary.secretFindingCount, 0);
});

test('doctorProject includes environment and scan checks', (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'doctor-project' }));
  const report = doctorProject(root);

  assert.ok(['PASS', 'WARN', 'REVIEW', 'BLOCK'].includes(report.status));
  assert.ok(report.checks.some((item) => item.id === 'NODE_VERSION'));
  assert.ok(report.checks.some((item) => item.id === 'PROJECT_SCAN'));
});

test('renderMarkdown clearly labels the score as heuristic', (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'index.js'), 'console.log("safe");\n');
  const markdown = renderMarkdown(scanProject(root));

  assert.match(markdown, /Safety score/);
  assert.match(markdown, /heuristic, not a security guarantee/);
});
