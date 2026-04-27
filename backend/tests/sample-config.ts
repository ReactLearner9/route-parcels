import type { RoutingConfig } from '../src/core/config-types.js';

export const sampleConfig: RoutingConfig = {
  rules: [
    {
      name: 'high-value-insurance',
      type: 'approval',
      priority: 50,
      when: { field: 'value', operator: '>', value: 1000 },
      action: { approval: 'INSURANCE' }
    },
    {
      name: 'fragile-check',
      type: 'approval',
      priority: 40,
      when: { field: 'isFragile', operator: 'is_true' },
      action: { approval: 'FRAGILE_HANDLING' }
    },
    {
      name: 'mail-rule',
      type: 'route',
      priority: 10,
      when: { field: 'weight', operator: '<=', value: 1 },
      action: { department: 'MAIL' }
    },
    {
      name: 'regular-rule',
      type: 'route',
      priority: 5,
      when: { field: 'weight', operator: '<=', value: 10 },
      action: { department: 'REGULAR' }
    },
    {
      name: 'heavy-rule',
      type: 'route',
      priority: 1,
      when: { field: 'weight', operator: '>', value: 10 },
      action: { department: 'HEAVY' }
    }
  ]
};
