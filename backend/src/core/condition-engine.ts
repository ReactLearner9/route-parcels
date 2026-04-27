import { operators } from './operators.js';
import type { Condition, Parcel } from './config-types.js';

export function evaluateCondition(parcel: Parcel, condition: Condition) {
  const value = parcel?.[condition.field];
  const op = operators[condition.operator];

  if (!op) {
    throw new Error(`Unsupported operator: ${condition.operator}`);
  }

  if (
    condition.operator === 'exists' ||
    condition.operator === 'not_exists' ||
    condition.operator === 'is_true' ||
    condition.operator === 'is_false'
  ) {
    return op(value);
  }

  return op(value, condition.value);
}
