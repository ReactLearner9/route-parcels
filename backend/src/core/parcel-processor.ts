import type { Parcel, RoutingResult } from './config-types.js';
import { evaluateCondition } from './condition-engine.js';
import { fallbackRouteRule, validateConfig } from './rule-validator.js';
import { makeParcelId } from '../config/parcel-store.js';

export function processParcel(parcel: Parcel, config: unknown): RoutingResult {
  const validated = validateConfig(config);

  const sortedRules = [...validated.rules];

  const approvals: RoutingResult['approvals'] = [];
  let route: RoutingResult['route'] | null = null;

  for (const rule of sortedRules.filter((current) => current.type === 'approval')) {
    if (!evaluateCondition(parcel, rule.when)) continue;

    if (!approvals.includes(rule.action.approval)) {
      approvals.push(rule.action.approval);
    }
  }

  for (const rule of sortedRules.filter((current) => current.type === 'route')) {
    if (!evaluateCondition(parcel, rule.when)) continue;
    route = rule.action.department;
    break;
  }

  const fallbackRoute = fallbackRouteRule.action.department;
  const selectedRoute = route ?? fallbackRoute;

  const hasApprovals = approvals.length > 0;
  return {
    parcelId: makeParcelId(),
    route: selectedRoute,
    approvals,
    toBeRouted: hasApprovals ? selectedRoute : 'n/a',
    routedTo: hasApprovals ? 'n/a' : selectedRoute,
    status: route ? (hasApprovals ? 'approval pending' : 'processed') : 'defaulted'
  };
}
