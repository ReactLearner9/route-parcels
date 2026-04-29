import { describe, expect, it } from 'vitest';
import { validateParcelAgainstRules } from '../src/core/parcel-validation.js';
import type { RoutingConfig } from '../src/core/config-types.js';

const rules: RoutingConfig['rules'] = [
  {
    type: 'approval',
    when: { field: 'value', operator: '>', value: 1000 },
    action: { approval: 'INSURANCE' }
  },
  {
    type: 'route',
    priority: 1,
    when: { field: 'delivery.signatureRequired', operator: 'is_false' },
    action: { department: 'NO_SIGNATURE_NEEDED' }
  },
  {
    type: 'route',
    priority: 2,
    when: { field: 'weight', operator: '<=', value: 10 },
    action: { department: 'REGULAR' }
  }
];

describe('validateParcelAgainstRules', () => {
  it('reports missing or invalid core numeric fields', () => {
    const issues = validateParcelAgainstRules(
      { id: 'P1', weight: Number.NaN, value: Number.NaN } as unknown as import('../src/core/config-types.js').Parcel,
      rules
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'weight' }),
        expect.objectContaining({ field: 'value' })
      ])
    );
  });

  it('reports non-boolean values for boolean operators on nested fields', () => {
    const issues = validateParcelAgainstRules(
      {
        id: 'P2',
        weight: 2,
        value: 200,
        delivery: { signatureRequired: 'no' }
      } as unknown as import('../src/core/config-types.js').Parcel,
      rules
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'delivery.signatureRequired'
        })
      ])
    );
  });

  it('returns no issues for a parcel satisfying known field contracts', () => {
    const issues = validateParcelAgainstRules(
      {
        id: 'P3',
        weight: 2,
        value: 200,
        delivery: { signatureRequired: false }
      } as unknown as import('../src/core/config-types.js').Parcel,
      rules
    );

    expect(issues).toHaveLength(0);
  });
});
