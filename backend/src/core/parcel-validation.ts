import type { ApprovalRule, ConfigRule, Parcel, RouteRule } from './config-types.js';
import { operators } from './operators.js';

export type ValidationIssue = {
  field: string;
  reason: string;
};

export type RuleFieldCheck = {
  field: string;
  operator: ConfigRule['when']['operator'];
  value?: unknown;
  ruleType: ConfigRule['type'];
  ruleLabel: string;
};

function getFieldValue(target: unknown, path: string) {
  if (!path.trim()) return undefined;
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[segment];
  }, target);
}

function isPlainNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value);
}

function ruleLabel(rule: ConfigRule) {
  return rule.type === 'approval'
    ? `approval rule "${rule.action.approval}"`
    : `routing rule #${rule.priority}`;
}

export function collectRuleFieldChecks(rules: ConfigRule[]) {
  const checks: RuleFieldCheck[] = [];
  const seen = new Set<string>();

  for (const rule of rules) {
    const key = `${rule.type}:${rule.when.field}:${rule.when.operator}:${String(rule.when.value ?? '')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    checks.push({
      field: rule.when.field,
      operator: rule.when.operator,
      value: rule.when.value,
      ruleType: rule.type,
      ruleLabel: ruleLabel(rule)
    });
  }

  return checks;
}

export function validateParcelAgainstRules(
  parcel: Parcel,
  rules: ConfigRule[],
  options: { requireKnownCoreFields?: boolean } = {},
) {
  const issues: ValidationIssue[] = [];
  const { requireKnownCoreFields = true } = options;

  if (!requireKnownCoreFields) return issues;

  if (!isPlainNumber(parcel.weight)) {
        issues.push({
          field: 'weight',
          reason: 'The parcel weight is missing or not a valid number.',
        });
      }

  if (!isPlainNumber(parcel.value)) {
        issues.push({
          field: 'value',
          reason: 'The parcel value is missing or not a valid number.',
        });
      }

  for (const check of collectRuleFieldChecks(rules)) {
    const fieldValue = getFieldValue(parcel, check.field);
    const op = operators[check.operator];
    if (!op) continue;

    if (fieldValue === undefined || fieldValue === null) {
      continue;
    }

    if (check.operator === 'is_true' || check.operator === 'is_false') {
      if (typeof fieldValue !== 'boolean') {
        issues.push({
          field: check.field,
          reason: `The field ${check.field} must be a boolean for ${check.ruleLabel}.`,
        });
      }
      continue;
    }

    if (!isPlainNumber(fieldValue)) {
      issues.push({
        field: check.field,
        reason: `The field ${check.field} must be numeric for ${check.ruleLabel}.`,
      });
      continue;
    }
  }

  return issues;
}
