import { z } from 'zod';

export const routeDepartmentSchema = z.string().min(1);
export const approvalSchema = z.string().min(1);

export const conditionOperatorSchema = z.enum([
  '>',
  '<',
  '>=',
  '<=',
  '==',
  'is_true',
  'is_false'
]);

export const conditionSchema = z.object({
  field: z.string().min(1),
  operator: conditionOperatorSchema,
  value: z.unknown().optional()
});

export const ruleMetadataSchema = z.object({
  createdBy: z.string().min(1).optional(),
  createdAt: z.string().optional(),
  lastModifiedBy: z.string().min(1).optional(),
  lastModifiedAt: z.string().optional()
});

export const routeRuleSchema = z.object({
  type: z.literal('route'),
  priority: z.number().int().positive(),
  when: conditionSchema,
  action: z.object({
    department: routeDepartmentSchema
  })
}).merge(ruleMetadataSchema);

export const approvalRuleSchema = z.object({
  type: z.literal('approval'),
  when: conditionSchema,
  action: z.object({
    approval: approvalSchema
  })
}).merge(ruleMetadataSchema);

export const configRuleSchema = z.union([routeRuleSchema, approvalRuleSchema]);

export const configSchema = z.object({
  rules: z.array(configRuleSchema)
});

export type RouteDepartment = z.infer<typeof routeDepartmentSchema>;
export type Approval = z.infer<typeof approvalSchema>;
export type ConditionOperator = z.infer<typeof conditionOperatorSchema>;
export type Condition = z.infer<typeof conditionSchema>;
export type RouteRule = z.infer<typeof routeRuleSchema>;
export type ApprovalRule = z.infer<typeof approvalRuleSchema>;
export type ConfigRule = z.infer<typeof configRuleSchema>;
export type RoutingConfig = z.infer<typeof configSchema>;
export type ApprovalRuleList = ApprovalRule[];
export type RouteRuleList = RouteRule[];

export type Parcel = {
  id: string;
  weight: number;
  value: number;
  [key: string]: unknown;
};

export type RoutingResult = {
  parcelId: string;
  route: RouteDepartment;
  approvals: Approval[];
  toBeRouted: RouteDepartment | 'n/a';
  routedTo: RouteDepartment | 'n/a';
  status?: 'processed' | 'approval pending' | 'defaulted' | 'errored';
  reason?: string;
};
