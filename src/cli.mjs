#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import { assessCommand } from './agentops-guard.mjs';
import { auditMcpConfig } from './mcp-auditor.mjs';
import { summarizeCosts, evaluateBudget } from './ai-cost-guard.mjs';

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

function usage() {
  return `X71 AgentKit\n\n` +
    `Commands:\n` +
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

  if (subcommand === 'agentops') {
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
