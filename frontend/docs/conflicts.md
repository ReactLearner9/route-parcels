# Conflicts

This document explains how the current routing system resolves conflicts and what happens in common edge cases.

## Conflict Types

### 1. Duplicate route priority

Two `route` rules cannot use the same `priority`.

Why this matters:
- Route selection must be deterministic.
- If two route rules share the same priority, the system cannot safely decide which one should win first.

What happens:
- Config validation fails.
- The config is not applied.

### 2. Duplicate rule logic

If two rules have the same:
- `type`
- `when`
- `action`

the config is rejected, even if the rule names differ.

Why this matters:
- Prevents accidental duplication of the same business logic.
- Keeps the configuration easier to reason about.

### 3. Multiple matching approval rules

This is allowed.

All matching approval rules are collected into the final parcel result.

Why this matters:
- Approvals are additive.
- More than one approval can apply to the same parcel.

### 4. Multiple matching route rules

This is allowed only when their priorities are different.

The system sorts route rules by priority and uses the first matching one.

Why this matters:
- Every parcel needs exactly one final route.
- Higher priority route rules win.

### 5. Invalid or malformed config

If the config has:
- an unsupported operator
- a missing field
- a non-array `rules` section
- an invalid rule shape

validation fails immediately.

Why this matters:
- Bad config should fail before it reaches production routing.

### 6. No matching route rule

If no route rule matches a parcel, the processor throws an error.

Why this matters:
- The system must not guess a destination.

## Sample Parcel Outcomes

### Example 1: Standard parcel with approvals

Parcel:

```ts
{
  id: 'P100',
  weight: 2,
  value: 2000,
  isFragile: true
}
```

Matching rules:
- `high-value-insurance` matches because `value > 1000`
- `fragile-check` matches because `isFragile === true`
- `regular-rule` matches because `weight <= 10`

Final outcome:

```ts
{
  parcelId: 'P100',
  route: 'REGULAR',
  approvals: ['INSURANCE', 'FRAGILE_HANDLING']
}
```

Why:
- Route comes from the best matching route rule.
- Approvals are accumulated from all matching approval rules.

### Example 2: New dynamic department

Example config rule:

```ts
{
  name: 'express-eu',
  type: 'route',
  priority: 20,
  when: { field: 'destinationCountry', operator: '==', value: 'DE' },
  action: { department: 'EXPRESS_EU' }
}
```

Parcel:

```ts
{
  id: 'P200',
  weight: 2,
  value: 50,
  destinationCountry: 'DE'
}
```

Final outcome:

```ts
{
  parcelId: 'P200',
  route: 'EXPRESS_EU',
  approvals: []
}
```

Why:
- The new department is accepted from config.
- The route rule matches and wins by priority.

### Example 3: New dynamic approval

Example config rule:

```ts
{
  name: 'customs-review',
  type: 'approval',
  priority: 60,
  when: { field: 'destinationCountry', operator: '==', value: 'BR' },
  action: { approval: 'CUSTOMS_REVIEW' }
}
```

Parcel:

```ts
{
  id: 'P300',
  weight: 3,
  value: 80,
  destinationCountry: 'BR'
}
```

Final outcome:

```ts
{
  parcelId: 'P300',
  route: 'REGULAR',
  approvals: ['CUSTOMS_REVIEW']
}
```

Why:
- The new approval is accepted from config.
- Approvals are added to the final result.

### Example 4: Route priority conflict

Bad config:

```ts
{
  name: 'mail-rule',
  type: 'route',
  priority: 10,
  when: { field: 'weight', operator: '<=', value: 1 },
  action: { department: 'MAIL' }
},
{
  name: 'express-rule',
  type: 'route',
  priority: 10,
  when: { field: 'destinationCountry', operator: '==', value: 'DE' },
  action: { department: 'EXPRESS_EU' }
}
```

Result:
- Validation fails.
- The config cannot be applied.

Why:
- Two route rules with the same priority would create ambiguity.

### Example 5: Duplicate logic conflict

Bad config:

```ts
{
  name: 'fragile-check-a',
  type: 'approval',
  priority: 40,
  when: { field: 'isFragile', operator: 'is_true' },
  action: { approval: 'FRAGILE_HANDLING' }
},
{
  name: 'fragile-check-b',
  type: 'approval',
  priority: 30,
  when: { field: 'isFragile', operator: 'is_true' },
  action: { approval: 'FRAGILE_HANDLING' }
}
```

Result:
- Validation fails.
- Duplicate rule detected.

Why:
- The system prevents the same business logic from being defined twice.

## Short Interview Summary

- Route conflicts are resolved by priority.
- Duplicate route priorities are rejected.
- Approval rules are additive.
- Duplicate logic is rejected.
- Invalid configs fail fast.
- If no route matches, the system throws instead of guessing.
