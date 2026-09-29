#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import { assessCommand } from './agentops-guard.mjs';
import { auditMcpConfig } from './mcp-auditor.mjs';
import { summarizeCosts, evaluateBudget } from './ai-cost-guard.mjs';
import { doctorProject, renderMarkdown, scanProject } from './project-scanner.mjs';

function fail(message, code = 2) {
  console.error(JSON.stringify({ status: 'ERROR', message }, null, 2));
  process.exitCode = code;
}

function readJson(path) {
  if (!path) throw new Error('missing JSON file path');
  const stat = fs.statSync(path);
  if (!stat.isFile()) throw new Error(`not a file: ${path}`);
  if (stat.size > 5_000_000) throw new Error(`JSON file exceeds 5 MB: ${path}`);
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function positional(args) {
  return args.filter((value, index) => {
    if (value.startsWith('--')) return false;
    const previous = args[index - 1];
    return !['--command', '--budget', '--format', '--fail-on'].includes(previous);
  });
}

function printReport(report, args, title) {
  const format = option(args, '--format') ?? 'json';
  if (format === 'json') {
    console.log(JSON.stringify(report, null, 2));
  } else if (format === 'markdown') {
    console.log(renderMarkdown(report, title));
  } else {
    throw new Error('--format must be json or markdown');
  }
}

function applyFailThreshold(status, args) {
  const threshold = option(args, '--fail-on') ?? 'never';
  const rank = { PASS: 0, WARN: 1, REVIEW: 2, BLOCK: 3 };
  const thresholdRank = { never: 99, warn: 1, review: 2, block: 3 };
  if (!(threshold in thresholdRank)) throw new Error('--fail-on must be never, warn, review, or block');
  if ((rank[status] ?? 0) >= thresholdRank[threshold]) process.exitCode = 1;
}

function usage() {
  return `X71 AgentKit\n\n` +
    `Commands:\n` +
    `  x71-agentkit doctor [path] [--format json|markdown]\n` +
    `  x71-agentkit scan [path] [--format json|markdown] [--fail-on never|warn|review|block]\n` +
    `  x71-agentkit agentops --command "<command>"\n` +
    `  x71-agentkit mcp-audit <config.json>\n` +
    `  x71-agentkit cost <usage.json> <pricing.json> [--budget <usd>]\n`;
}

try {
  const [, , subcommand, ...args] = process.argv;
  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    console.log(usage());
    process.exit(0);
  }

  if (subcommand === 'doctor') {
    const projectPath = positional(args)[0] ?? '.';
    const report = doctorProject(projectPath);
    printReport(report, args, 'X71 AgentKit Doctor');
    applyFailThreshold(report.status, args);
  } else if (subcommand === 'scan') {
    const projectPath = positional(args)[0] ?? '.';
    const report = scanProject(projectPath);
    printReport(report, args, 'X71 AgentKit Safety Scan');
    applyFailThreshold(report.status, args);
  } else if (subcommand === 'agentops') {
    const command = option(args, '--command');
    if (!command) throw new Error('agentops requires --command');
    console.log(JSON.stringify(assessCommand(command), null, 2));
  } else if (subcommand === 'mcp-audit') {
    console.log(JSON.stringify(auditMcpConfig(readJson(args[0])), null, 2));
  } else if (subcommand === 'cost') {
    const usageRecords = readJson(args[0]);
    const pricing = readJson(args[1]);
    const summary = summarizeCosts(usageRecords, pricing);
    const budgetRaw = option(args, '--budget');
    const budget = budgetRaw == null ? null : Number(budgetRaw);
    const budgetDecision = evaluateBudget(summary, { hardBudgetUsd: budget });
    console.log(JSON.stringify({ summary, budget: budgetDecision }, null, 2));
  } else {
    fail(`unknown command: ${subcommand}`);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
