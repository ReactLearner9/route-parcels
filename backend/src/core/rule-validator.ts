import { configSchema, type ApprovalRule, type ConfigRule, type RoutingConfig, type RouteRule } from './config-types.js';

function comparePriority(a: { priority: number }, b: { priority: number }) {
  return a.priority - b.priority;
}

export function validateConfig(config: unknown): RoutingConfig {
  const parsed = configSchema.parse(config);
  const routePriorities = new Set<number>();

  const routeRules = parsed.rules.filter((rule): rule is RouteRule => rule.type === 'route');
  const approvalRules = parsed.rules.filter((rule): rule is ApprovalRule => rule.type === 'approval');

  for (const rule of routeRules) {
    if (routePriorities.has(rule.priority)) {
      throw new Error(`Duplicate routing priority ${rule.priority} is not allowed`);
    }
    routePriorities.add(rule.priority);
  }

  return {
    rules: [...approvalRules, ...routeRules.sort(comparePriority)] as ConfigRule[],
  };
}

export const fallbackRouteRule: RouteRule = {
  type: 'route',
  priority: Number.MAX_SAFE_INTEGER,
  when: { field: 'weight', operator: '>', value: 0 },
  action: { department: 'MANUAL_REVIEW' }
};

export function withFallbackRouteRule(config: RoutingConfig | null | undefined): RoutingConfig {
  const rules = [...(config?.rules ?? []).filter((rule) => !(rule.type === 'route' && rule.priority === fallbackRouteRule.priority && rule.action.department === fallbackRouteRule.action.department))];
  rules.push(fallbackRouteRule);
  return {
    rules: [
      ...rules.filter((rule) => rule.type === 'approval'),
      ...rules.filter((rule) => rule.type === 'route').sort(comparePriority)
    ] as ConfigRule[]
  };
}
