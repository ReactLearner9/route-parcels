import { operators } from './operators.js';
import type { Condition, Parcel } from './config-types.js';

function getFieldValue(target: unknown, path: string) {
  if (!path.trim()) return undefined;
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[segment];
  }, target);
}

export function evaluateCondition(parcel: Parcel, condition: Condition) {
  const value = getFieldValue(parcel, condition.field);
  const op = operators[condition.operator];

  if (!op) {
    throw new Error(`Unsupported operator: ${condition.operator}`);
  }

  if (
    condition.operator === 'is_true' ||
    condition.operator === 'is_false'
  ) {
    return op(value);
  }

  return op(value, condition.value);
}
