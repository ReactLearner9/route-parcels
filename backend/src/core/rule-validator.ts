import { configSchema, type RoutingConfig } from './config-types.js';
import { operators } from './operators.js';
import { ruleSignature } from './rule-signature.js';

export function validateConfig(config: unknown): RoutingConfig {
  const parsed = configSchema.parse(config);

  const routePrioritySet = new Set<number>();
  const signatures = new Set<string>();

  for (const rule of parsed.rules) {
    if (!operators[rule.when.operator]) {
      throw new Error(`Invalid operator in ${rule.name}`);
    }

    if (rule.type === 'route') {
      if (routePrioritySet.has(rule.priority)) {
        throw new Error(`Route priority conflict: ${rule.priority} used multiple times`);
      }

      routePrioritySet.add(rule.priority);
    }

    const sig = ruleSignature(rule);

    if (signatures.has(sig)) {
      throw new Error(`Duplicate rule detected: ${rule.name}`);
    }

    signatures.add(sig);
  }

  return parsed;
}
