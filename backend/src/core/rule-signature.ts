import type { ConfigRule } from './config-types.js';

export function ruleSignature(rule: ConfigRule) {
  return JSON.stringify({
    type: rule.type,
    when: rule.when,
    action: rule.action
  });
}
