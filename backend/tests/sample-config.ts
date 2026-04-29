import type { RoutingConfig } from '../src/core/config-types.js';

export const sampleConfig: RoutingConfig = {
  rules: [
    {
      type: 'approval',
      when: { field: 'value', operator: '>', value: 1000 },
      action: { approval: 'INSURANCE' }
    },
    {
      type: 'approval',
      when: { field: 'isFragile', operator: 'is_true' },
      action: { approval: 'FRAGILE_HANDLING' }
    },
    {
      type: 'route',
      priority: 10,
      when: { field: 'weight', operator: '<=', value: 1 },
      action: { department: 'MAIL' }
    },
    {
      type: 'route',
      priority: 5,
      when: { field: 'weight', operator: '<=', value: 10 },
      action: { department: 'REGULAR' }
    },
    {
      type: 'route',
      priority: 1,
      when: { field: 'weight', operator: '>', value: 10 },
      action: { department: 'HEAVY' }
    }
  ]
};
