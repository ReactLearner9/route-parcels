import type { ConditionOperator } from './config-types.js';

type OperatorFn = (left: unknown, right?: unknown) => boolean;

export const operators: Record<ConditionOperator, OperatorFn> = {
  '>': (a, b) => Number(a) > Number(b),
  '<': (a, b) => Number(a) < Number(b),
  '>=': (a, b) => Number(a) >= Number(b),
  '<=': (a, b) => Number(a) <= Number(b),
  '==': (a, b) => a == b,
  exists: (a) => a !== undefined && a !== null,
  not_exists: (a) => a === undefined || a === null,
  is_true: (a) => a === true,
  is_false: (a) => a === false
};
