import { configSchema, type ConfigRule, type RoutingConfig } from '../core/config-types.js';
import { validateConfig, withFallbackRouteRule } from '../core/rule-validator.js';
import {
  getApprovalConfigDb,
  getCurrentApprovalConfig,
  getCurrentRoutingConfig,
  getRoutingConfigDb,
} from '../config/store.js';
import type { ValidationIssueRow } from './parcel-service.js';
import { logAuditEvent } from '../utils/audit-logger.js';
import { recordConfigChangeInfo } from './alert-service.js';

type MulterFile = Express.Multer.File;

type ConfigValidationReport = {
  valid: boolean;
  issues: ValidationIssueRow[];
};

type ConfigSection = 'approval' | 'route';

function normalizeActor(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : 'system';
}

function shouldCreateConfigAlert(actor: string) {
  return actor !== 'system';
}

function explainConfigIssue(issue: { path: PropertyKey[]; message: string }): Omit<ValidationIssueRow, 'rowNo'> {
  const field = issue.path.map(String).join('.') || 'config';
  if (field.includes('when.operator')) {
    return {
      field,
      reason: 'This rule uses a condition that the system does not understand.',
    };
  }
  if (field.includes('action.department')) {
    return {
      field,
      reason: 'A route rule is missing the department it should send parcels to.',
    };
  }
  if (field.includes('action.approval')) {
    return {
      field,
      reason: 'An approval rule is missing the approval name.',
    };
  }
  return {
    field,
    reason: issue.message,
  };
}

export function parseConfigFile(file: MulterFile): RoutingConfig {
  const text = file.buffer.toString('utf8');
  const parsed = JSON.parse(text);
  const result = configSchema.safeParse(parsed);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}

function parseSectionConfig(file: MulterFile, section: ConfigSection): RoutingConfig {
  const text = file.buffer.toString('utf8');
  const parsed = JSON.parse(text) as { rules?: unknown[] };
  if (section === 'approval' && Array.isArray(parsed.rules) && parsed.rules.length === 0) {
    return { rules: [] };
  }
  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

function buildSectionConfig(config: RoutingConfig, section: ConfigSection): RoutingConfig {
  return {
    rules: config.rules.filter((rule) => rule.type === section),
  };
}

function getSectionIdentifiers(section: ConfigSection, rules: ConfigRule[]) {
  return section === 'approval'
    ? {
        approvalNames: rules
          .filter((rule): rule is Extract<ConfigRule, { type: 'approval' }> => rule.type === 'approval')
          .map((rule) => rule.action.approval)
      }
    : {
        departments: rules
          .filter((rule): rule is Extract<ConfigRule, { type: 'route' }> => rule.type === 'route')
          .map((rule) => rule.action.department)
      };
}

function stripRuleMetadata(rule: ConfigRule): ConfigRule {
  const { createdBy, createdAt, lastModifiedBy, lastModifiedAt, ...businessRule } = rule;
  void createdBy;
  void createdAt;
  void lastModifiedBy;
  void lastModifiedAt;
  return businessRule as ConfigRule;
}

function ruleIdentity(rule: ConfigRule) {
  return rule.type === 'approval'
    ? `approval:${rule.action.approval}`
    : `route:${rule.priority}`;
}

function ruleBusinessSignature(rule: ConfigRule) {
  return JSON.stringify(stripRuleMetadata(rule));
}

function summarizeConfigCrudChange(
  previousRules: ConfigRule[],
  nextRules: ConfigRule[],
): { action: 'created' | 'updated' | 'deleted' | 'changed'; count: number } | null {
  const previousByIdentity = new Map(
    previousRules.map((rule) => [ruleIdentity(rule), ruleBusinessSignature(rule)]),
  );
  const nextByIdentity = new Map(
    nextRules.map((rule) => [ruleIdentity(rule), ruleBusinessSignature(rule)]),
  );

  let created = 0;
  let updated = 0;
  let deleted = 0;

  for (const [identity, signature] of nextByIdentity) {
    const previousSignature = previousByIdentity.get(identity);
    if (!previousSignature) {
      created += 1;
      continue;
    }
    if (previousSignature !== signature) {
      updated += 1;
    }
  }

  for (const identity of previousByIdentity.keys()) {
    if (!nextByIdentity.has(identity)) {
      deleted += 1;
    }
  }

  if (created > 0 && updated === 0 && deleted === 0) {
    return { action: 'created', count: created };
  }
  if (updated > 0 && created === 0 && deleted === 0) {
    return { action: 'updated', count: updated };
  }
  if (deleted > 0 && created === 0 && updated === 0) {
    return { action: 'deleted', count: deleted };
  }

  const changedCount = created + updated + deleted;
  if (changedCount === 0) return null;
  return { action: 'changed', count: changedCount };
}

function annotateRules(
  nextRules: ConfigRule[],
  previousRules: ConfigRule[],
  actor: string,
  timestamp: string
): ConfigRule[] {
  const previousByIdentity = new Map(previousRules.map((rule) => [ruleIdentity(rule), rule]));

  return nextRules.map((rule) => {
    const previousRule = previousByIdentity.get(ruleIdentity(rule));
    const createdBy = previousRule?.createdBy ?? rule.createdBy ?? actor;
    const createdAt = previousRule?.createdAt ?? rule.createdAt ?? timestamp;
    const unchanged = previousRule && ruleBusinessSignature(previousRule) === ruleBusinessSignature(rule);

    return {
      ...rule,
      createdBy,
      createdAt,
      lastModifiedBy: unchanged ? (previousRule.lastModifiedBy ?? createdBy) : actor,
      lastModifiedAt: unchanged ? (previousRule.lastModifiedAt ?? createdAt) : timestamp
    };
  });
}

function findDuplicateApprovalName(rules: RoutingConfig['rules']) {
  const seen = new Set<string>();
  for (const rule of rules) {
    if (rule.type !== 'approval') continue;
    const name = (rule as { action: { approval: string } }).action.approval;
    if (seen.has(name)) return name;
    seen.add(name);
  }
  return null;
}

async function validateSectionFile(file: MulterFile, section: ConfigSection): Promise<ConfigValidationReport> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(file.buffer.toString('utf8'));
  } catch {
    return {
      valid: false,
      issues: [
        {
          rowNo: 1,
          field: 'file',
          reason: 'The config file is not valid JSON.',
        },
      ],
    };
  }

  const parsedRules = (parsed as { rules?: unknown[] }).rules;
  if (section === 'approval' && Array.isArray(parsedRules) && parsedRules.length === 0) {
    return { valid: true, issues: [] };
  }

  const schemaResult = configSchema.safeParse(parsed);
  if (!schemaResult.success) {
    return {
      valid: false,
      issues: schemaResult.error.issues.map((issue) => ({
        rowNo: typeof issue.path[1] === 'number' ? Number(issue.path[1]) + 1 : 1,
        ...explainConfigIssue(issue),
      })),
    };
  }

  const sectionConfig = buildSectionConfig(schemaResult.data, section);
  const mismatchedRule = schemaResult.data.rules.find((rule) => rule.type !== section);
  if (mismatchedRule) {
    return {
      valid: false,
      issues: [
        {
          rowNo: 1,
          field: 'rules',
          reason: `This editor accepts only ${section} rules.`,
        },
      ],
    };
  }

  if (section === 'approval') {
    const duplicateInFile = findDuplicateApprovalName(sectionConfig.rules);
    if (duplicateInFile) {
      return {
        valid: false,
        issues: [
        {
          rowNo: 1,
          field: 'rules',
          reason: `Approval ${duplicateInFile} is already present.`,
        },
      ],
      };
    }
  }

  if (section === 'approval' && sectionConfig.rules.length === 0) {
    return { valid: true, issues: [] };
  }

  try {
    validateConfig(sectionConfig);
  } catch (error) {
    return {
      valid: false,
      issues: [
        {
          rowNo: 1,
          field: 'rules',
          reason: error instanceof Error ? error.message : 'The config is invalid.',
        },
      ],
    };
  }

  return { valid: true, issues: [] };
}

export async function validateUploadedConfig(file: MulterFile): Promise<ConfigValidationReport> {
  return validateSectionFile(file, 'route');
}

async function applySectionFile(file: MulterFile, section: ConfigSection, modifiedBy = 'system', sessionId = 'backend') {
  const config = parseSectionConfig(file, section);
  const sectionConfig = buildSectionConfig(config, section);
  const actor = normalizeActor(modifiedBy);
    if (section === 'approval') {
    if (sectionConfig.rules.length === 0) {
      const approvalDb = await getApprovalConfigDb();
      const routingDb = await getRoutingConfigDb();
      const emptyConfig: RoutingConfig = { rules: [] };
      const previousRules = approvalDb.data.currentConfig?.rules ?? [];
      approvalDb.data.currentConfig = emptyConfig;
      await Promise.all([approvalDb.write(), routingDb.write()]);
      await logAuditEvent({
        user: actor,
        sessionId,
        screen: 'Config',
        functionality: 'rule_apply',
        feature: 'config',
        status: 'success',
        details: {
          section,
          action: 'deleted',
          ...getSectionIdentifiers(section, previousRules)
        }
      });
      const changeSummary = summarizeConfigCrudChange(previousRules, emptyConfig.rules);
      if (changeSummary && changeSummary.action !== 'changed' && shouldCreateConfigAlert(actor)) {
        await recordConfigChangeInfo({ section, actor, ...changeSummary });
      }

      return {
        config: emptyConfig
      };
    }
  }
  const normalized = validateConfig(sectionConfig);
  const approvalDb = await getApprovalConfigDb();
  const routingDb = await getRoutingConfigDb();
  const timestamp = new Date().toISOString();
  const previousRules = section === 'route'
    ? (routingDb.data.currentConfig?.rules ?? [])
    : (approvalDb.data.currentConfig?.rules ?? []);
  const storedConfig = section === 'route'
    ? {
        rules: annotateRules(
          withFallbackRouteRule(normalized).rules,
          previousRules,
          actor,
          timestamp
        )
      }
    : {
        rules: annotateRules(normalized.rules, previousRules, actor, timestamp)
      };
  if (section === 'approval') {
    approvalDb.data.currentConfig = storedConfig;
  } else {
    routingDb.data.currentConfig = storedConfig;
  }
  await Promise.all([approvalDb.write(), routingDb.write()]);
  const changeSummary = summarizeConfigCrudChange(previousRules, storedConfig.rules);
  await logAuditEvent({
    user: actor,
    sessionId,
    screen: 'Config',
    functionality: 'rule_apply',
    feature: 'config',
    status: 'success',
    details: {
      section,
      action: changeSummary?.action ?? 'unchanged',
      ...getSectionIdentifiers(section, storedConfig.rules)
    }
  });
  if (changeSummary && changeSummary.action !== 'changed' && shouldCreateConfigAlert(actor)) {
    await recordConfigChangeInfo({ section, actor, ...changeSummary });
  }

  return {
    config: storedConfig
  };
}

export async function validateUploadedApprovalConfig(file: MulterFile) {
  return validateSectionFile(file, 'approval');
}

export async function validateUploadedRoutingConfig(file: MulterFile) {
  return validateSectionFile(file, 'route');
}

export async function applyUploadedApprovalConfig(file: MulterFile, modifiedBy?: string, sessionId?: string) {
  return applySectionFile(file, 'approval', modifiedBy, sessionId);
}

export async function applyUploadedRoutingConfig(file: MulterFile, modifiedBy?: string, sessionId?: string) {
  return applySectionFile(file, 'route', modifiedBy, sessionId);
}

export async function getConfigState() {
  const [approvalDb, routingDb] = await Promise.all([
    getApprovalConfigDb(),
    getRoutingConfigDb()
  ]);
  const approvalConfig = approvalDb.data.currentConfig;
  const routingConfig = routingDb.data.currentConfig;
  const mergedRules = [
    ...(approvalConfig?.rules ?? []),
    ...(withFallbackRouteRule(routingConfig)?.rules ?? [])
  ];

  try {
    return {
      approvalConfig,
      routingConfig,
      currentConfig: mergedRules.length > 0 ? validateConfig({ rules: mergedRules }) : null
    };
  } catch {
    return {
      approvalConfig,
      routingConfig,
      currentConfig: null
    };
  }
}

export async function getAppliedConfig() {
  const [approvalConfig, routingConfig] = await Promise.all([
    getCurrentApprovalConfig(),
    getCurrentRoutingConfig()
  ]);
  const mergedRules = [
    ...(approvalConfig?.rules ?? []),
    ...(withFallbackRouteRule(routingConfig)?.rules ?? [])
  ];

  return mergedRules.length > 0 ? validateConfig({ rules: mergedRules }) : null;
}
