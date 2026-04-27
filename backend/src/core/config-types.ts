import { z } from 'zod';

export const routeDepartmentSchema = z.string().min(1);
export const approvalSchema = z.string().min(1);

export const conditionOperatorSchema = z.enum([
  '>',
  '<',
  '>=',
  '<=',
  '==',
  'exists',
  'not_exists',
  'is_true',
  'is_false'
]);

export const conditionSchema = z.object({
  field: z.string().min(1),
  operator: conditionOperatorSchema,
  value: z.unknown().optional()
});

export const routeRuleSchema = z.object({
  name: z.string().min(1),
  type: z.literal('route'),
  priority: z.number().int(),
  when: conditionSchema,
  action: z.object({
    department: routeDepartmentSchema
  })
});

export const approvalRuleSchema = z.object({
  name: z.string().min(1),
  type: z.literal('approval'),
  priority: z.number().int(),
  when: conditionSchema,
  action: z.object({
    approval: approvalSchema
  })
});

export const configRuleSchema = z.union([routeRuleSchema, approvalRuleSchema]);

export const configSchema = z.object({
  rules: z.array(configRuleSchema).min(1)
});

export type RouteDepartment = z.infer<typeof routeDepartmentSchema>;
export type Approval = z.infer<typeof approvalSchema>;
export type ConditionOperator = z.infer<typeof conditionOperatorSchema>;
export type Condition = z.infer<typeof conditionSchema>;
export type RouteRule = z.infer<typeof routeRuleSchema>;
export type ApprovalRule = z.infer<typeof approvalRuleSchema>;
export type ConfigRule = z.infer<typeof configRuleSchema>;
export type RoutingConfig = z.infer<typeof configSchema>;

export type Parcel = {
  id: string;
  weight: number;
  value: number;
  destinationCountry?: string;
  [key: string]: unknown;
};

export type RoutingResult = {
  parcelId: string;
  route: RouteDepartment;
  approvals: Approval[];
};
