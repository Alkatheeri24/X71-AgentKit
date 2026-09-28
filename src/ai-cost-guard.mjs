function finiteNonNegative(value, field) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new TypeError(`${field} must be a finite non-negative number`);
  return parsed;
}

function round(value) {
  return Number(value.toFixed(8));
}

function key(provider, model) {
  return `${String(provider ?? '').trim()}/${String(model ?? '').trim()}`;
}

export function buildPricingMap(catalog = []) {
  if (!Array.isArray(catalog)) throw new TypeError('catalog must be an array');
  const map = new Map();
  for (const entry of catalog) {
    if (!entry || typeof entry !== 'object') continue;
    const provider = String(entry.provider ?? '').trim();
    const model = String(entry.model ?? '*').trim() || '*';
    if (!provider) continue;
    const inputPerMillionUsd = finiteNonNegative(entry.inputPerMillionUsd, 'inputPerMillionUsd');
    const outputPerMillionUsd = finiteNonNegative(entry.outputPerMillionUsd, 'outputPerMillionUsd');
    map.set(key(provider, model), Object.freeze({
      provider,
      model,
      inputPerMillionUsd,
      outputPerMillionUsd,
      source: String(entry.source ?? 'caller-supplied'),
      verifiedAt: entry.verifiedAt ? String(entry.verifiedAt) : null
    }));
  }
  return map;
}

function pricingFor(record, pricing) {
  const provider = String(record.provider ?? '').trim();
  const model = String(record.model ?? '').trim();
  return pricing.get(key(provider, model)) ?? pricing.get(key(provider, '*')) ?? null;
}

export function estimateCall(record, catalog = []) {
  if (!record || typeof record !== 'object') throw new TypeError('record must be an object');
  const inputTokens = finiteNonNegative(record.inputTokens ?? 0, 'inputTokens');
  const outputTokens = finiteNonNegative(record.outputTokens ?? 0, 'outputTokens');
  const pricing = pricingFor(record, buildPricingMap(catalog));
  if (!pricing) {
    return Object.freeze({ status: 'UNPRICED', provider: record.provider ?? null, model: record.model ?? null, estimatedCostUsd: null });
  }
  const inputCostUsd = (inputTokens / 1_000_000) * pricing.inputPerMillionUsd;
  const outputCostUsd = (outputTokens / 1_000_000) * pricing.outputPerMillionUsd;
  return Object.freeze({
    status: 'PRICED',
    provider: String(record.provider),
    model: String(record.model),
    inputTokens,
    outputTokens,
    inputCostUsd: round(inputCostUsd),
    outputCostUsd: round(outputCostUsd),
    estimatedCostUsd: round(inputCostUsd + outputCostUsd),
    pricingSource: pricing.source,
    pricingVerifiedAt: pricing.verifiedAt
  });
}

export function summarizeCosts(records = [], catalog = []) {
  if (!Array.isArray(records)) throw new TypeError('records must be an array');
  const pricing = buildPricingMap(catalog);
  let total = 0;
  let pricedCalls = 0;
  const byModel = new Map();

  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    const inputTokens = finiteNonNegative(record.inputTokens ?? 0, 'inputTokens');
    const outputTokens = finiteNonNegative(record.outputTokens ?? 0, 'outputTokens');
    const price = pricingFor(record, pricing);
    const groupKey = key(record.provider, record.model);
    const group = byModel.get(groupKey) ?? { provider: record.provider ?? null, model: record.model ?? null, calls: 0, pricedCalls: 0, estimatedCostUsd: 0 };
    group.calls += 1;

    if (price) {
      const cost = ((inputTokens / 1_000_000) * price.inputPerMillionUsd) + ((outputTokens / 1_000_000) * price.outputPerMillionUsd);
      group.pricedCalls += 1;
      group.estimatedCostUsd += cost;
      total += cost;
      pricedCalls += 1;
    }
    byModel.set(groupKey, group);
  }

  const calls = records.filter((item) => item && typeof item === 'object').length;
  const coveragePercent = calls === 0 ? 0 : Number(((pricedCalls / calls) * 100).toFixed(2));

  return Object.freeze({
    status: calls === 0 ? 'NO_USAGE' : pricedCalls === calls ? 'PRICED' : pricedCalls === 0 ? 'COST_UNKNOWN' : 'PARTIALLY_PRICED',
    totals: Object.freeze({ calls, pricedCalls, unpricedCalls: calls - pricedCalls, pricingCoveragePercent: coveragePercent, estimatedCostUsd: round(total) }),
    byModel: Object.freeze([...byModel.values()].map((group) => Object.freeze({ ...group, estimatedCostUsd: round(group.estimatedCostUsd) })))
  });
}

export function evaluateBudget(summary, options = {}) {
  if (!summary?.totals) throw new TypeError('summary must be produced by summarizeCosts');
  const hardBudgetUsd = options.hardBudgetUsd == null ? null : finiteNonNegative(options.hardBudgetUsd, 'hardBudgetUsd');
  const warningPercent = options.warningPercent == null ? 80 : finiteNonNegative(options.warningPercent, 'warningPercent');
  const requireFullPricing = options.requireFullPricing !== false;

  if (requireFullPricing && summary.totals.pricingCoveragePercent < 100) {
    return Object.freeze({ decision: 'REVIEW', reason: 'INCOMPLETE_PRICING_COVERAGE', budgetUsd: hardBudgetUsd, estimatedCostUsd: summary.totals.estimatedCostUsd });
  }
  if (hardBudgetUsd == null) {
    return Object.freeze({ decision: 'PASS', reason: 'NO_HARD_BUDGET', budgetUsd: null, estimatedCostUsd: summary.totals.estimatedCostUsd });
  }
  if (summary.totals.estimatedCostUsd > hardBudgetUsd) {
    return Object.freeze({ decision: 'BLOCK', reason: 'BUDGET_EXCEEDED', budgetUsd: hardBudgetUsd, estimatedCostUsd: summary.totals.estimatedCostUsd });
  }
  const ratio = hardBudgetUsd === 0 ? (summary.totals.estimatedCostUsd > 0 ? Infinity : 0) : (summary.totals.estimatedCostUsd / hardBudgetUsd) * 100;
  if (ratio >= warningPercent) {
    return Object.freeze({ decision: 'WARN', reason: 'BUDGET_WARNING_THRESHOLD', budgetUsd: hardBudgetUsd, estimatedCostUsd: summary.totals.estimatedCostUsd, budgetUsedPercent: Number(ratio.toFixed(2)) });
  }
  return Object.freeze({ decision: 'PASS', reason: 'WITHIN_BUDGET', budgetUsd: hardBudgetUsd, estimatedCostUsd: summary.totals.estimatedCostUsd, budgetUsedPercent: Number(ratio.toFixed(2)) });
}
