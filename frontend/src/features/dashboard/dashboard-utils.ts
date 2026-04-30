import type { ConfigRule, ValidationIssue } from "@/features/app/types";

export function groupIssues(issues: ValidationIssue[]) {
  const groups = new Map<number, ValidationIssue[]>();
  for (const issue of issues) {
    const rowNo = issue.rowNo || 1;
    groups.set(rowNo, [...(groups.get(rowNo) ?? []), issue]);
  }
  return [...groups.entries()].map(([rowNo, groupIssues]) => ({
    rowNo,
    issues: groupIssues,
  }));
}

export function cleanIssueField(field: string) {
  return field.replace(/^row\s+\d+\s+/i, "").replace(/^\d+\s+/, "");
}

export function detectLikelyJsonField(source: string) {
  const singleQuotedValueMatch = [...source.matchAll(/"([^"]+)"\s*:\s*'/g)].at(
    -1,
  );
  if (singleQuotedValueMatch?.[1]) return singleQuotedValueMatch[1];

  const trailingKeyMatch = [...source.matchAll(/"([^"]+)"\s*:\s*$/gm)].at(-1);
  if (trailingKeyMatch?.[1]) return trailingKeyMatch[1];

  return "json";
}

export function formatSingleJsonParseReason(source: string, error: unknown) {
  if (/"[^"]+"\s*:\s*'/.test(source)) {
    return "Invalid JSON: single quotes are not allowed. Use double quotes for keys and string values.";
  }

  if (/,\s*[}\]]/.test(source)) {
    return "Remove the trailing comma before the closing bracket or brace.";
  }

  if (!source.trim().startsWith("{") || !source.trim().endsWith("}")) {
    return "The single parcel input must be a valid JSON object wrapped in curly braces.";
  }

  return error instanceof Error
    ? "The single parcel input is not valid JSON."
    : "Invalid input.";
}

export function formatConfigIssueField(issue: ValidationIssue) {
  const normalizedField = cleanIssueField(issue.field);

  if (normalizedField.includes("action.approval")) return "action.approval";
  if (normalizedField.includes("action.department")) return "action.department";
  if (normalizedField.includes("when.operator")) return "when.operator";

  if (normalizedField === "rules") {
    if (/^Approval\s+.+\s+is already present\.$/.test(issue.reason)) {
      return "action.approval";
    }
    if (
      /^This editor accepts only\s+(approval|route)\s+rules\.$/.test(
        issue.reason,
      )
    ) {
      return "type";
    }
  }

  return normalizedField;
}

export function stripMetadata(rule: ConfigRule): ConfigRule {
  const {
    createdBy,
    createdAt,
    lastModifiedBy,
    lastModifiedAt,
    ...businessRule
  } = rule;
  void createdBy;
  void createdAt;
  void lastModifiedBy;
  void lastModifiedAt;
  return businessRule as ConfigRule;
}
