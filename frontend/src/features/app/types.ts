import type { LucideIcon } from "lucide-react";

export type View = "landing" | "login" | "dashboard";
export type Role = "admin" | "operator";
export type AuthMode = "login" | "register";
export type DashboardPage = "single" | "batch" | "analytics" | "rules" | "seed";
export type RouteStatus = "processed" | "approval pending" | "defaulted" | "errored";

export type DashboardNavItem = {
  key: DashboardPage;
  label: string;
  icon: LucideIcon;
};

export type UserProfile = { id: string; username: string; role: Role };
export type LoginForm = { username: string; password: string; role: Role | "" };

export type ValidationIssue = {
  rowNo: number;
  field: string;
  reason: string;
};

export type ValidationReport = {
  valid: boolean;
  issues: ValidationIssue[];
};

export type RoutingResult = {
  parcelId: string;
  route: string;
  approvals: string[];
  toBeRouted: string;
  routedTo: string;
  status?: RouteStatus;
  reason?: string;
};

export type SingleRouteOutcome = {
  status: RouteStatus;
  createdAt?: string;
  importedBy?: string;
  result: RoutingResult;
};

export type BatchRouteOutcome = {
  status: RouteStatus;
  batchId?: string;
  createdAt?: string;
  importedBy?: string;
  results: RoutingResult[];
};

export type StoredParcelRecord = {
  batchId: string | null;
  createdAt: string;
  importedBy: string;
  input: { id?: string; [key: string]: unknown };
  result: RoutingResult;
};

export type ParcelListResponse = {
  records: StoredParcelRecord[];
};

export type ParcelCountResponse = {
  parcelCount: number;
  batchCount: number;
};

export type Condition = {
  field: string;
  operator: ">" | "<" | ">=" | "<=" | "==" | "is_true" | "is_false";
  value?: unknown;
};

export type ApprovalRule = {
  type: "approval";
  when: Condition;
  action: { approval: string };
  createdBy?: string;
  createdAt?: string;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
};

export type RouteRule = {
  type: "route";
  priority: number;
  when: Condition;
  action: { department: string };
  createdBy?: string;
  createdAt?: string;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
};

export type ConfigRule = ApprovalRule | RouteRule;

export type ConfigResponse = {
  approvalConfig?: { rules: ApprovalRule[] } | null;
  routingConfig?: { rules: RouteRule[] } | null;
  currentConfig?: { rules: ConfigRule[] } | null;
};

export type ConfigModalState = {
  section: "approval" | "route";
  mode: "new" | "edit";
  index?: number;
};

export type SeedConfirmState = {
  action: "all" | "config";
  title: string;
  message: string;
  confirmLabel: string;
};

export type ParcelInputModalState = {
  parcelId: string;
  input: unknown;
};

export type UiLogEvent = {
  user: string;
  sessionId?: string;
  screen: string;
  functionality: string;
  feature: "single-import" | "batch-import" | "analytics" | "config" | "seed";
  phase?: "started" | "ended";
  status?: "passed" | "failed" | "success" | "not_found" | "found";
  timestamp?: string;
  durationMs?: number;
  details?: Record<string, unknown>;
};

export const pageSize = 20;
export const issuePageSize = 10;
export const defaultSingle = JSON.stringify({ weight: 2, value: 1500 }, null, 2);
export const defaultApprovalRule = JSON.stringify(
  {
    type: "approval",
    when: { field: "value", operator: ">", value: 1000 },
    action: { approval: "INSURANCE" },
  },
  null,
  2,
);
export const defaultRoutingRule = JSON.stringify(
  {
    type: "route",
    priority: 1,
    when: { field: "weight", operator: "<=", value: 1 },
    action: { department: "MAIL" },
  },
  null,
  2,
);
