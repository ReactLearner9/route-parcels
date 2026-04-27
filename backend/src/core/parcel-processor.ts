import type { Parcel, RoutingResult } from './config-types.js';
import { evaluateCondition } from './condition-engine.js';
import { validateConfig } from './rule-validator.js';

export function processParcel(parcel: Parcel, config: unknown): RoutingResult {
  const validated = validateConfig(config);

  const sortedRules = [...validated.rules].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
  );

  const approvals: RoutingResult['approvals'] = [];
  let route: RoutingResult['route'] | null = null;

  for (const rule of sortedRules) {
    if (!evaluateCondition(parcel, rule.when)) continue;

    if (rule.type === 'approval') {
      if (!approvals.includes(rule.action.approval)) {
        approvals.push(rule.action.approval);
      }
    }

    if (rule.type === 'route' && !route) {
      route = rule.action.department;
    }
  }

  if (!route) {
    throw new Error('No routing rule matched parcel');
  }

  return {
    parcelId: parcel.id,
    route,
    approvals
  };
}
