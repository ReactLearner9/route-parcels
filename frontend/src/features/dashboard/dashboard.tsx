import { useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  BadgeCheck,
  CheckCircle2,
  FileText,
  FileUp,
  Plus,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import type {
  AlertRecord,
  AlertsResponse,
  BatchRouteOutcome,
  AlertUnreadCountResponse,
  ConfigModalState,
  ConfigResponse,
  ConfigRule,
  DashboardNavItem,
  DashboardPage,
  ParcelInputModalState,
  ParcelListResponse,
  RoutingResult,
  SeedConfirmState,
  SingleRouteOutcome,
  StoredParcelRecord,
  UiLogEvent,
  UserProfile,
  ValidationIssue,
  ValidationReport,
} from "@/features/app/types";
import {
  defaultApprovalRule,
  defaultRoutingRule,
  defaultSingle,
  issuePageSize,
  pageSize,
} from "@/features/app/types";
import {
  ConfigTable,
  ConfigValidationTable,
  DashboardNav,
  Pager,
  RouteResultsTable,
  SearchPanel,
  SectionTitle,
  TryNewButton,
  ValidationTable,
  AlertsTable,
} from "@/features/dashboard/dashboard-components";
import {
  detectLikelyJsonField,
  formatSingleJsonParseReason,
  groupIssues,
  stripMetadata,
} from "@/features/dashboard/dashboard-utils";
import {
  ConfigRuleModal,
  ParcelInputDataModal,
  SeedConfirmModal,
} from "@/features/dashboard/dashboard-modals";

async function logUiEvent(event: UiLogEvent) {
  void event;
}

export function Dashboard({
  profile,
  page,
  onPageChange,
  onAlertUnreadCountChange,
}: {
  profile: UserProfile;
  page: DashboardPage;
  onPageChange: (page: DashboardPage) => void;
  onAlertUnreadCountChange: (count: number) => void;
}) {
  const [configState, setConfigState] = useState<ConfigResponse | null>(null);
  const [singleText, setSingleText] = useState(defaultSingle);
  const [singleValidated, setSingleValidated] = useState(false);
  const [singleOutcome, setSingleOutcome] = useState<SingleRouteOutcome | null>(
    null,
  );
  const [singleLocked, setSingleLocked] = useState(false);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchValidated, setBatchValidated] = useState(false);
  const [batchOutcome, setBatchOutcome] = useState<BatchRouteOutcome | null>(
    null,
  );
  const [batchLocked, setBatchLocked] = useState(false);
  const [batchUploadPage, setBatchUploadPage] = useState(1);
  const [analyticsBatchPage, setAnalyticsBatchPage] = useState(1);
  const [batchIssuePage, setBatchIssuePage] = useState(1);
  const [failedRows, setFailedRows] = useState<ValidationIssue[]>([]);
  const [failedSection, setFailedSection] = useState<
    "single" | "batch" | "config" | null
  >(null);
  const [parcelSearchInput, setParcelSearchInput] = useState("");
  const [batchSearchInput, setBatchSearchInput] = useState("");
  const [selectedParcelId, setSelectedParcelId] = useState("");
  const [selectedSingleRecord, setSelectedSingleRecord] =
    useState<StoredParcelRecord | null>(null);
  const [selectedSingleResult, setSelectedSingleResult] =
    useState<RoutingResult | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedBatchRecords, setSelectedBatchRecords] = useState<
    StoredParcelRecord[]
  >(
    [],
  );
  const [singleSearchLoading, setSingleSearchLoading] = useState(false);
  const [batchSearchLoading, setBatchSearchLoading] = useState(false);
  const [seedDataLoading, setSeedDataLoading] = useState(false);
  const [seedBatchPage, setSeedBatchPage] = useState(1);
  const [seededBatchRecords, setSeededBatchRecords] = useState<StoredParcelRecord[]>([]);
  const [configModal, setConfigModal] = useState<ConfigModalState | null>(null);
  const [configModalText, setConfigModalText] = useState("");
  const [modalMessage, setModalMessage] = useState<string | null>(null);
  const [configModalIssues, setConfigModalIssues] = useState<ValidationIssue[]>(
    [],
  );
  const [configModalValidated, setConfigModalValidated] = useState(false);
  const [seedConfirm, setSeedConfirm] = useState<SeedConfirmState | null>(null);
  const [parcelInputModal, setParcelInputModal] = useState<ParcelInputModalState | null>(null);
  const [parcelInputLoading, setParcelInputLoading] = useState(false);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [pendingReadAlertId, setPendingReadAlertId] = useState<string | null>(null);
  const [closingAlertIds, setClosingAlertIds] = useState<string[]>([]);
  const batchFileInputRef = useRef<HTMLInputElement | null>(null);

  const visiblePages = useMemo<DashboardNavItem[]>(
    () =>
      profile.role === "admin"
        ? [
            { key: "analytics", label: "Analytics", icon: Search },
            { key: "rules", label: "Config", icon: ShieldCheck },
            { key: "seed", label: "Seed", icon: FileText },
            { key: "alerts", label: "Alerts", icon: BellRing },
          ]
        : [
            { key: "single", label: "Single", icon: BadgeCheck },
            { key: "batch", label: "Batch", icon: FileUp },
            { key: "analytics", label: "Analytics", icon: Search },
            { key: "seed", label: "Seed", icon: FileText },
            { key: "alerts", label: "Alerts", icon: BellRing },
          ],
    [profile.role],
  );

  useEffect(() => {
    if (!visiblePages.some((entry) => entry.key === page))
      onPageChange(visiblePages[0].key);
  }, [page, visiblePages]);

  const refreshConfig = async () => {
    try {
      setConfigState(await api<ConfigResponse>("/api/config"));
    } catch {
      setConfigState(null);
    }
  };

  useEffect(() => {
    void refreshConfig();
  }, []);

  const refreshUnreadAlertCount = async () => {
    try {
      const response = await api<AlertUnreadCountResponse>(
        "/api/alerts/unread-count",
      );
      onAlertUnreadCountChange(response.unreadCount);
    } catch {
      onAlertUnreadCountChange(0);
    }
  };

  const loadAlerts = async () => {
    setAlertsLoading(true);
    try {
      const response = await api<AlertsResponse>("/api/alerts");
      setAlerts(response.alerts);
      onAlertUnreadCountChange(response.alerts.length);
    } catch {
      setAlerts([]);
      onAlertUnreadCountChange(0);
      toast.error("Unable to load alerts");
    } finally {
      setAlertsLoading(false);
    }
  };

  const markAlertRead = async (alertId: string) => {
    setPendingReadAlertId(alertId);
    try {
      const response = await api<{ alertId: string; removed: boolean }>(
        `/api/alerts/${encodeURIComponent(alertId)}/read`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ readBy: profile.username }),
        },
      );
      setClosingAlertIds((current) => [...current, response.alertId]);
      window.setTimeout(() => {
        setAlerts((current) =>
          current.filter((alert) => alert.id !== response.alertId),
        );
        setClosingAlertIds((current) =>
          current.filter((currentId) => currentId !== response.alertId),
        );
      }, 450);
      toast.success("Alert marked as read");
      await refreshUnreadAlertCount();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update alert");
    } finally {
      setPendingReadAlertId(null);
    }
  };

  useEffect(() => {
    if (page !== "alerts") return;
    void loadAlerts();
    const intervalId = window.setInterval(() => {
      void loadAlerts();
    }, 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [page]);

  const approvalRules = configState?.approvalConfig?.rules ?? [];
  const routingRules = configState?.routingConfig?.rules ?? [];
  const selectedSingle = selectedSingleResult;
  const batchResultPageCount = Math.max(
    1,
    Math.ceil((batchOutcome?.results.length ?? 0) / pageSize),
  );
  const batchResultSlice = (batchOutcome?.results ?? []).slice(
    (batchUploadPage - 1) * pageSize,
    batchUploadPage * pageSize,
  );
  const analyticsBatchResults = selectedBatchRecords.map((record) => record.result);
  const analyticsBatchPageCount = Math.max(
    1,
    Math.ceil(analyticsBatchResults.length / pageSize),
  );
  const analyticsBatchSlice = analyticsBatchResults.slice(
    (analyticsBatchPage - 1) * pageSize,
    analyticsBatchPage * pageSize,
  );
  const seededBatch = seededBatchRecords[0] ?? null;
  const seededBatchResults = seededBatchRecords.map((record) => record.result);
  const seededBatchPageCount = Math.max(
    1,
    Math.ceil(seededBatchResults.length / pageSize),
  );
  const seededBatchSlice = seededBatchResults.slice(
    (seedBatchPage - 1) * pageSize,
    seedBatchPage * pageSize,
  );
  const groupedIssues = groupIssues(failedRows);
  const issuePageCount = Math.max(
    1,
    Math.ceil(groupedIssues.length / issuePageSize),
  );
  const issueGroupsSlice = groupedIssues.slice(
    (batchIssuePage - 1) * issuePageSize,
    batchIssuePage * issuePageSize,
  );
  const validateSingle = async () => {
    const startedAt = performance.now();
    await logUiEvent({
      user: profile.username,
      screen: "Import Single",
      functionality: "single_validate",
      feature: "single-import",
      phase: "started",
    });
    try {
      const parsed = JSON.parse(singleText) as Record<string, unknown>;
      const report = await api<ValidationReport>(
        "/api/upload/validate/single",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...parsed, importedBy: profile.username }),
        },
      );
      setSingleValidated(report.valid);
      setSingleOutcome(null);
      if (report.valid) {
        setFailedRows([]);
        setFailedSection(null);
        toast.success("Single parcel is valid");
      } else {
        setFailedRows(report.issues);
        setFailedSection("single");
        toast.error("Single parcel needs changes");
      }
      await logUiEvent({
        user: profile.username,
        screen: "Import Single",
        functionality: "single_validate",
        feature: "single-import",
        phase: "ended",
        status: report.valid ? "passed" : "failed",
        durationMs: Math.round(performance.now() - startedAt),
      });
    } catch (error) {
      setFailedRows([
        {
          rowNo: 1,
          field: detectLikelyJsonField(singleText),
          reason: formatSingleJsonParseReason(singleText, error),
        },
      ]);
      setFailedSection("single");
      setSingleValidated(false);
      toast.error("Single parcel validation failed");
      await logUiEvent({
        user: profile.username,
        screen: "Import Single",
        functionality: "single_validate",
        feature: "single-import",
        phase: "ended",
        status: "failed",
        durationMs: Math.round(performance.now() - startedAt),
      });
    }
  };

  const routeSingle = async () => {
    const startedAt = performance.now();
    await logUiEvent({
      user: profile.username,
      screen: "Import Single",
      functionality: "single_import",
      feature: "single-import",
      phase: "started",
    });
    try {
      const parsed = JSON.parse(singleText) as Record<string, unknown>;
      const outcome = await api<SingleRouteOutcome>("/api/upload/single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed, importedBy: profile.username }),
      });
      setSingleOutcome(outcome);
      setSingleLocked(true);
      setFailedRows([]);
      setFailedSection(null);
      toast.success("Single parcel routed");
      await logUiEvent({
        user: profile.username,
        screen: "Import Single",
        functionality: "single_import",
        feature: "single-import",
        phase: "ended",
        status: "success",
        durationMs: Math.round(performance.now() - startedAt),
        details: {
          generatedParcelId: outcome.result.parcelId,
          ruleMatched: outcome.result.route,
          approvals: outcome.result.approvals,
        },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Single routing failed",
      );
      await logUiEvent({
        user: profile.username,
        screen: "Import Single",
        functionality: "single_import",
        feature: "single-import",
        phase: "ended",
        status: "failed",
        durationMs: Math.round(performance.now() - startedAt),
      });
    }
  };

  const validateBatch = async () => {
    if (!batchFile) {
      toast.error("Choose a batch file first");
      return;
    }

    const startedAt = performance.now();
    await logUiEvent({
      user: profile.username,
      screen: "Import Batch",
      functionality: "batch_validate",
      feature: "batch-import",
      phase: "started",
    });

    try {
      const formData = new FormData();
      formData.append("batchFile", batchFile, batchFile.name);
      formData.append("importedBy", profile.username);
      const report = await api<ValidationReport>("/api/upload/validate/batch", {
        method: "POST",
        body: formData,
      });
      setBatchValidated(report.valid);
      setBatchOutcome(null);
      setBatchIssuePage(1);
      if (report.valid) {
        setFailedRows([]);
        setFailedSection(null);
        toast.success("Batch file is valid");
      } else {
        setFailedRows(report.issues);
        setFailedSection("batch");
        toast.error("Batch file needs changes");
      }

      let totalCount = 0;
      try {
        const text = await batchFile.text();
        const parsed = JSON.parse(text) as { parcels?: unknown[] };
        totalCount = Array.isArray(parsed.parcels) ? parsed.parcels.length : 0;
      } catch {
        totalCount = 0;
      }
      const failedCount = new Set(report.issues.map((issue) => issue.rowNo))
        .size;
      const passedCount = Math.max(0, totalCount - failedCount);
      await logUiEvent({
        user: profile.username,
        screen: "Import Batch",
        functionality: "batch_validate",
        feature: "batch-import",
        phase: "ended",
        status: report.valid ? "passed" : "failed",
        durationMs: Math.round(performance.now() - startedAt),
        details: { count: totalCount, failedCount, passedCount },
      });
    } catch (error) {
      setFailedRows([
        {
          rowNo: 1,
          field: "file",
          reason: error instanceof Error ? error.message : "Invalid batch file",
        },
      ]);
      setFailedSection("batch");
      setBatchValidated(false);
      toast.error("Batch validation failed");
      await logUiEvent({
        user: profile.username,
        screen: "Import Batch",
        functionality: "batch_validate",
        feature: "batch-import",
        phase: "ended",
        status: "failed",
        durationMs: Math.round(performance.now() - startedAt),
        details: { count: 0, failedCount: 0, passedCount: 0 },
      });
    }
  };

  const routeBatch = async () => {
    if (!batchFile) return;

    const startedAt = performance.now();
    await logUiEvent({
      user: profile.username,
      screen: "Import Batch",
      functionality: "batch_import",
      feature: "batch-import",
      phase: "started",
    });

    try {
      const formData = new FormData();
      formData.append("batchFile", batchFile, batchFile.name);
      formData.append("importedBy", profile.username);
      const outcome = await api<BatchRouteOutcome>("/api/upload/batch", {
        method: "POST",
        body: formData,
      });
      setBatchOutcome(outcome);
      setBatchLocked(true);
      setBatchUploadPage(1);
      setFailedRows([]);
      setFailedSection(null);
      toast.success("Batch routed");
      await logUiEvent({
        user: profile.username,
        screen: "Import Batch",
        functionality: "batch_import",
        feature: "batch-import",
        phase: "ended",
        status: "success",
        durationMs: Math.round(performance.now() - startedAt),
        details: {
          generatedBatchId: outcome.batchId,
          importedCount: outcome.results.length,
        },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Batch routing failed",
      );
      await logUiEvent({
        user: profile.username,
        screen: "Import Batch",
        functionality: "batch_import",
        feature: "batch-import",
        phase: "ended",
        status: "failed",
        durationMs: Math.round(performance.now() - startedAt),
      });
    }
  };

  const resetSingle = () => {
    setSingleValidated(false);
    setSingleOutcome(null);
    setSingleLocked(false);
    if (failedSection === "single") {
      setFailedRows([]);
      setFailedSection(null);
    }
  };

  const resetBatch = () => {
    setBatchValidated(false);
    setBatchOutcome(null);
    setBatchLocked(false);
    setBatchFile(null);
    setBatchUploadPage(1);
    setBatchIssuePage(1);
    if (failedSection === "batch") {
      setFailedRows([]);
      setFailedSection(null);
    }
    if (batchFileInputRef.current) batchFileInputRef.current.value = "";
  };

  const searchSingle = async () => {
    const startedAt = performance.now();
    const identifier = parcelSearchInput.trim();
    await logUiEvent({
      user: profile.username,
      screen: "Analytics",
      functionality: "single_search",
      feature: "analytics",
      phase: "started",
      details: { searchId: identifier },
    });
    setSingleSearchLoading(true);
    try {
      const response = await api<ParcelListResponse>(
        `/api/parcels?parcelId=${encodeURIComponent(identifier)}`,
      );
      setSelectedParcelId(identifier);
      const record = response.records[0] ?? null;
      setSelectedSingleRecord(record);
      setSelectedSingleResult(record ? record.result : null);
      const found = Boolean(record);
      await logUiEvent({
        user: profile.username,
        screen: "Analytics",
        functionality: "single_search",
        feature: "analytics",
        phase: "ended",
        status: found ? "found" : "not_found",
        durationMs: Math.round(performance.now() - startedAt),
        details: { searchId: identifier },
      });
    } catch {
      await logUiEvent({
        user: profile.username,
        screen: "Analytics",
        functionality: "single_search",
        feature: "analytics",
        phase: "ended",
        status: "failed",
        durationMs: Math.round(performance.now() - startedAt),
        details: { searchId: identifier },
      });
    } finally {
      setSingleSearchLoading(false);
    }
  };

  const searchBatch = async () => {
    const startedAt = performance.now();
    const identifier = batchSearchInput.trim();
    await logUiEvent({
      user: profile.username,
      screen: "Analytics",
      functionality: "batch_search",
      feature: "analytics",
      phase: "started",
      details: { searchId: identifier },
    });
    setBatchSearchLoading(true);
    try {
      setSelectedBatchRecords([]);
      const response = await api<ParcelListResponse>(
        `/api/parcels?batchId=${encodeURIComponent(identifier)}`,
      );
      setSelectedBatchId(identifier);
      setSelectedBatchRecords(response.records);
      setAnalyticsBatchPage(1);
      const batchRecordCount = response.records.length;
      await logUiEvent({
        user: profile.username,
        screen: "Analytics",
        functionality: "batch_search",
        feature: "analytics",
        phase: "ended",
        status: response.records.length ? "found" : "not_found",
        durationMs: Math.round(performance.now() - startedAt),
        details: { searchId: identifier, recordCount: batchRecordCount },
      });
    } catch {
      await logUiEvent({
        user: profile.username,
        screen: "Analytics",
        functionality: "batch_search",
        feature: "analytics",
        phase: "ended",
        status: "failed",
        durationMs: Math.round(performance.now() - startedAt),
        details: { searchId: identifier },
      });
    } finally {
      setBatchSearchLoading(false);
    }
  };

  const loadSeededData = async () => {
    setSeedDataLoading(true);
    try {
      const response = await api<ParcelListResponse>(
        "/api/parcels?importedBy=system",
      );
      const seededGrouped = response.records.reduce<Map<string, StoredParcelRecord[]>>(
        (groups, record) => {
          if (!record.batchId) return groups;
          const list = groups.get(record.batchId) ?? [];
          list.push(record);
          groups.set(record.batchId, list);
          return groups;
        },
        new Map(),
      );
      const latestBatchRecords = [...seededGrouped.values()]
        .sort((a, b) => {
          const left = a[0]?.createdAt ?? "";
          const right = b[0]?.createdAt ?? "";
          return right.localeCompare(left);
        })[0] ?? [];
      setSeededBatchRecords(latestBatchRecords);
      setSeedBatchPage(1);
    } catch {
      toast.error("Unable to load seeded data");
    } finally {
      setSeedDataLoading(false);
    }
  };

  const copyAndToast = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const closeConfigModal = () => {
    setConfigModal(null);
    setConfigModalText("");
    setModalMessage(null);
    setConfigModalIssues([]);
    setConfigModalValidated(false);
    if (failedSection === "config") {
      setFailedRows([]);
      setFailedSection(null);
    }
  };

  const closeParcelInputModal = () => {
    setParcelInputModal(null);
    setParcelInputLoading(false);
  };

  const openParcelInputModal = async (parcelId: string) => {
    setParcelInputLoading(true);
    try {
      const response = await api<ParcelListResponse>(
        `/api/parcels?parcelId=${encodeURIComponent(parcelId)}`,
      );
      const record = response.records[0];
      if (!record) {
        toast.error("Parcel input not found");
        return;
      }
      setParcelInputModal({ parcelId, input: record.input });
    } catch {
      toast.error("Unable to load parcel input");
    } finally {
      setParcelInputLoading(false);
    }
  };

  const submitConfig = async (
    section: "approval" | "route",
    mode: "validate" | "apply",
    rules: ConfigRule[],
    actionType?: "add" | "edit" | "delete",
  ) => {
    const startedAt = performance.now();
    const configAction =
      mode === "apply"
        ? actionType === "delete"
          ? "rule_delete"
          : actionType === "edit"
            ? "rule_modify"
            : "rule_add"
        : "rule_validate";
    await logUiEvent({
      user: profile.username,
      screen: "Config",
      functionality: configAction,
      feature: "config",
      phase: "started",
      details: { ruleType: section },
    });
    const endpoint = `/api/config/${section === "approval" ? "approval" : "routing"}/${mode}`;
    const formData = new FormData();
    formData.append(
      "configFile",
      new File([JSON.stringify({ rules }, null, 2)], "config.json", {
        type: "application/json",
      }),
    );
    formData.append("modifiedBy", profile.username);
    const report = await api<{
      valid?: boolean;
      issues?: ValidationIssue[];
      applied?: boolean;
    }>(endpoint, {
      method: "POST",
      body: formData,
    });

    if (report.issues?.length) {
      setFailedRows(report.issues);
      setFailedSection("config");
      setConfigModalIssues(report.issues);
      setModalMessage(null);
      setConfigModalValidated(false);
      await logUiEvent({
        user: profile.username,
        screen: "Config",
        functionality: configAction,
        feature: "config",
        phase: "ended",
        status: "failed",
        durationMs: Math.round(performance.now() - startedAt),
        details: { ruleType: section },
      });
      return false;
    }

    if (mode === "apply") {
      toast.success("Config applied");
      closeConfigModal();
      await refreshConfig();
    } else {
      setModalMessage("Rule is valid");
      setConfigModalValidated(true);
      toast.success("Config is valid");
    }
    setFailedRows([]);
    setFailedSection(null);
    setConfigModalIssues([]);
    await logUiEvent({
      user: profile.username,
      screen: "Config",
      functionality: configAction,
      feature: "config",
      phase: "ended",
      status: "success",
      durationMs: Math.round(performance.now() - startedAt),
      details: { ruleType: section },
    });
    return true;
  };

  const openConfigModal = (
    section: "approval" | "route",
    mode: "new" | "edit",
    index?: number,
  ) => {
    const rules = section === "approval" ? approvalRules : routingRules;
    const selected =
      typeof index === "number" ? stripMetadata(rules[index]) : null;
    setConfigModal({ section, mode, index });
    setConfigModalText(
      selected
        ? JSON.stringify(selected, null, 2)
        : section === "approval"
          ? defaultApprovalRule
          : defaultRoutingRule,
    );
    setModalMessage(null);
    setConfigModalIssues([]);
    setConfigModalValidated(false);
    if (failedSection === "config") {
      setFailedRows([]);
      setFailedSection(null);
    }
  };

  const applyConfigModal = async (mode: "validate" | "apply") => {
    if (!configModal) return;
    try {
      const parsed = JSON.parse(configModalText) as ConfigRule;
      const currentRules =
        configModal.section === "approval" ? approvalRules : routingRules;
      const businessRules = currentRules.map((rule) => stripMetadata(rule));
      const nextRules =
        configModal.mode === "edit" && typeof configModal.index === "number"
          ? businessRules.map((rule, index) =>
              index === configModal.index ? parsed : rule,
            )
          : [...businessRules, parsed];
      if (mode === "apply") {
        const valid = await submitConfig(
          configModal.section,
          "validate",
          nextRules,
          configModal.mode === "edit" ? "edit" : "add",
        );
        if (!valid) return;
      }
      await submitConfig(
        configModal.section,
        mode,
        nextRules,
        configModal.mode === "edit" ? "edit" : "add",
      );
    } catch (error) {
      const issues = [
        {
          rowNo: 1,
          field: "json",
          reason: error instanceof Error ? error.message : "Invalid input",
        },
      ];
      setFailedRows(issues);
      setConfigModalIssues(issues);
      setFailedSection("config");
      setModalMessage(null);
      setConfigModalValidated(false);
    }
  };

  const deleteConfigRule = async (
    section: "approval" | "route",
    index: number,
  ) => {
    const currentRules = section === "approval" ? approvalRules : routingRules;
    const nextRules = currentRules
      .map((rule) => stripMetadata(rule))
      .filter((_, ruleIndex) => ruleIndex !== index);
    const valid = await submitConfig(section, "validate", nextRules, "delete");
    if (!valid) return;
    await submitConfig(section, "apply", nextRules, "delete");
    toast.success("Rule deleted");
  };

  const seedData = async (action: "all" | "config") => {
    const startedAt = performance.now();
    await logUiEvent({
      user: profile.username,
      screen: "Seed",
      functionality: "seed_execute",
      feature: "seed",
      phase: "started",
      details: { seedType: action === "config" ? "config" : "parcel" },
    });
    try {
      await api("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      toast.success("Backend seeded");
      await refreshConfig();
      if (profile.role === "operator" && page === "seed") {
        await loadSeededData();
      }
      await logUiEvent({
        user: profile.username,
        screen: "Seed",
        functionality: "seed_execute",
        feature: "seed",
        phase: "ended",
        status: "success",
        durationMs: Math.round(performance.now() - startedAt),
        details: { seedType: action === "config" ? "config" : "parcel" },
      });
    } finally {
      setSeedConfirm(null);
    }
  };

  const promptSeedConfirm = (action: "all" | "config") => {
    setSeedConfirm(
      action === "all"
        ? {
            action,
            title: "Reset Parcel Data?",
            message:
              "This will wipe the current single parcel and batch lowdb records and replace them with seeded demo data.",
            confirmLabel: "Reset parcel and batch data",
          }
        : {
            action,
            title: "Reset Config Data?",
            message:
              "This will wipe the current approval and routing config records and replace them with the seeded configuration.",
            confirmLabel: "Reset config data",
          },
    );
  };

  useEffect(() => {
    if (page === "seed" && profile.role === "operator") {
      void loadSeededData();
    }
  }, [page, profile.role]);

  useEffect(() => {
    if (page !== "rules") return;
    void logUiEvent({
      user: profile.username,
      screen: "Config",
      functionality: "rules_count",
      feature: "config",
      phase: "ended",
      status: "success",
      details: {
        approvalRulesCount: approvalRules.length,
        routingRulesCount: routingRules.length,
      },
    });
  }, [page, approvalRules.length, routingRules.length, profile.username]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (parcelInputModal) closeParcelInputModal();
      if (configModal) closeConfigModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [parcelInputModal, configModal]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <DashboardNav profile={profile} />

      {page === "single" && (
        <Card className="space-y-3.5">
          <SectionTitle
            title="Import Single"
            text="Paste one parcel JSON body, validate it, then route it."
          />
          <textarea
            value={singleText}
            onChange={(event) => {
              setSingleText(event.target.value);
              setSingleOutcome(null);
              setSingleValidated(false);
              setSingleLocked(false);
            }}
            className="mt-4 max-h-64 min-h-64 w-full resize-none overflow-auto rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-3 font-mono text-sm text-slate-100 outline-none focus:border-emerald-400"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => void validateSingle()}>
              <CheckCircle2 className="h-4 w-4" />
              <span className="ml-2">Validate</span>
            </Button>
            <Button
              onClick={() => void routeSingle()}
              disabled={
                singleLocked ||
                !singleValidated ||
                (failedSection === "single" && failedRows.length > 0)
              }
            >
              <FileUp className="h-4 w-4" />
              <span className="ml-2">Route Single</span>
            </Button>
            {(singleOutcome ||
              (failedSection === "single" && failedRows.length > 0) ||
              singleValidated) && <TryNewButton onClick={resetSingle} />}
          </div>
          {failedSection === "single" && failedRows.length > 0 && (
            <ValidationTable issues={failedRows} pagedGroups={groupedIssues} />
          )}
          {singleOutcome && (
            <RouteResultsTable
              rows={[singleOutcome.result]}
              batchId={null}
              importedBy={singleOutcome.importedBy}
              createdAt={singleOutcome.createdAt}
              copyAndToast={copyAndToast}
              onViewParcel={openParcelInputModal}
            />
          )}
        </Card>
      )}

      {page === "batch" && (
        <Card className="space-y-3.5">
          <SectionTitle
            title="Import Batch"
            text="Select a JSON file containing parcels, validate it, then apply it."
          />
          <div className="mt-4 space-y-2.5">
            <input
              ref={batchFileInputRef}
              type="file"
              accept="application/json"
              className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-500 file:px-4 file:py-2 file:font-medium file:text-slate-950 hover:file:bg-emerald-400"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setBatchFile(file);
                setBatchValidated(false);
                setBatchOutcome(null);
                setBatchLocked(false);
                setBatchUploadPage(1);
                if (failedSection === "batch") {
                  setFailedRows([]);
                  setFailedSection(null);
                }
              }}
            />
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => void validateBatch()}
                disabled={!batchFile}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span className="ml-2">Validate</span>
              </Button>
              <Button
                onClick={() => void routeBatch()}
                disabled={
                  !batchFile ||
                  batchLocked ||
                  !batchValidated ||
                  (failedSection === "batch" && failedRows.length > 0)
                }
              >
                <FileUp className="h-4 w-4" />
                <span className="ml-2">Apply</span>
              </Button>
              {(batchFile ||
                batchOutcome ||
                (failedSection === "batch" && failedRows.length > 0) ||
                batchValidated) && <TryNewButton onClick={resetBatch} />}
            </div>
          </div>
          {failedSection === "batch" && failedRows.length > 0 && (
            <>
              <ValidationTable
                issues={failedRows}
                pagedGroups={issueGroupsSlice}
              />
              {groupedIssues.length > issuePageSize && (
                <Pager
                  page={batchIssuePage}
                  pageCount={issuePageCount}
                  onPrev={() =>
                    setBatchIssuePage((current) => Math.max(1, current - 1))
                  }
                  onNext={() =>
                    setBatchIssuePage((current) =>
                      Math.min(issuePageCount, current + 1),
                    )
                  }
                />
              )}
            </>
          )}
          {batchOutcome && (
            <>
              <RouteResultsTable
                rows={batchResultSlice}
                batchId={batchOutcome.batchId}
                importedBy={batchOutcome.importedBy}
                createdAt={batchOutcome.createdAt}
                copyAndToast={copyAndToast}
                onViewParcel={openParcelInputModal}
              />
              {batchOutcome.results.length > pageSize && (
                <Pager
                  page={batchUploadPage}
                  pageCount={batchResultPageCount}
                  onPrev={() =>
                    setBatchUploadPage((current) => Math.max(1, current - 1))
                  }
                  onNext={() =>
                    setBatchUploadPage((current) =>
                      Math.min(batchResultPageCount, current + 1),
                    )
                  }
                />
              )}
            </>
          )}
        </Card>
      )}

      {page === "analytics" && (
        <Card className="space-y-4">
          <SectionTitle
            title="Analytics"
            text="Search by parcel id or batch id to trace routed records."
          />
          <div className="mt-5 space-y-6">
            <SearchPanel
              title="Single"
              label="Search parcel id"
              value={parcelSearchInput}
              setValue={setParcelSearchInput}
              loading={singleSearchLoading}
              onSearch={searchSingle}
              onClear={() => {
                setParcelSearchInput("");
                setSelectedParcelId("");
                setSelectedSingleRecord(null);
                setSelectedSingleResult(null);
              }}
            >
              <RouteResultsTable
                rows={selectedSingle ? [selectedSingle] : []}
                batchId={selectedSingleRecord?.batchId}
                importedBy={selectedSingleRecord?.importedBy}
                createdAt={selectedSingleRecord?.createdAt}
                copyAndToast={copyAndToast}
                onViewParcel={openParcelInputModal}
                compact
                emptyText={
                  selectedParcelId
                    ? "No parcel found"
                    : "Search a parcel ID to populate this table"
                }
              />
            </SearchPanel>
            <SearchPanel
              title="Batch"
              label="Search batch id"
              value={batchSearchInput}
              setValue={setBatchSearchInput}
              loading={batchSearchLoading}
              onSearch={searchBatch}
              onClear={() => {
                setBatchSearchInput("");
                setSelectedBatchId("");
                setSelectedBatchRecords([]);
                setAnalyticsBatchPage(1);
              }}
            >
              <RouteResultsTable
                rows={selectedBatchRecords.length ? analyticsBatchSlice : []}
                batchId={selectedBatchRecords[0]?.batchId ?? null}
                importedBy={selectedBatchRecords[0]?.importedBy}
                createdAt={selectedBatchRecords[0]?.createdAt}
                copyAndToast={copyAndToast}
                onViewParcel={openParcelInputModal}
                compact
                emptyText={
                  selectedBatchId
                    ? "No batch found"
                    : "Search a batch ID to populate this table"
                }
              />
              {selectedBatchRecords.length > 0 && analyticsBatchResults.length > pageSize && (
                <Pager
                  page={analyticsBatchPage}
                  pageCount={analyticsBatchPageCount}
                  onPrev={() =>
                    setAnalyticsBatchPage((current) => Math.max(1, current - 1))
                  }
                  onNext={() =>
                    setAnalyticsBatchPage((current) =>
                      Math.min(analyticsBatchPageCount, current + 1),
                    )
                  }
                />
              )}
            </SearchPanel>
          </div>
        </Card>
      )}

      {page === "rules" && (
        <Card className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle
              title="Config Manager"
              text="Manage approval and routing rules."
            />
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => openConfigModal("approval", "new")}>
                <Plus className="h-4 w-4" />
                <span className="ml-2">New Approval Rule</span>
              </Button>
              <Button onClick={() => openConfigModal("route", "new")}>
                <Plus className="h-4 w-4" />
                <span className="ml-2">New Routing Rule</span>
              </Button>
            </div>
          </div>
          <ConfigTable
            title="Approval Table View"
            rules={approvalRules}
            section="approval"
            onEdit={(index) => openConfigModal("approval", "edit", index)}
            onDelete={(index) => void deleteConfigRule("approval", index)}
          />
          <ConfigTable
            title="Routing Table View"
            rules={routingRules}
            section="route"
            onEdit={(index) => openConfigModal("route", "edit", index)}
            onDelete={(index) => void deleteConfigRule("route", index)}
          />
          {failedSection === "config" && failedRows.length > 0 && (
            <ConfigValidationTable issues={failedRows} />
          )}
        </Card>
      )}

      {page === "seed" && (
        <Card className="space-y-4">
          <SectionTitle
            title="Seed Data"
            text="Reset demo data for operators and admins."
          />
          <div className="mt-4 flex flex-wrap gap-3">
            {profile.role === "operator" && (
              <Button
                variant="destructive"
                onClick={() => promptSeedConfirm("all")}
              >
                Seed parcel and batch data
              </Button>
            )}
            {profile.role === "admin" && (
              <Button
                variant="destructive"
                onClick={() => promptSeedConfirm("config")}
              >
                Seed config data
              </Button>
            )}
          </div>
          {profile.role === "operator" && (
            <section className="mt-6">
              <h3 className="text-lg font-semibold text-white">
                Seeded Batch Table View
              </h3>
              {seedDataLoading && (
                <p className="mt-3 text-sm text-slate-400">
                  Loading seeded data...
                </p>
              )}
              {!seedDataLoading && (
                <>
                  <RouteResultsTable
                    rows={seededBatch ? seededBatchSlice : []}
                    batchId={seededBatch?.batchId}
                    importedBy={seededBatch?.importedBy}
                    createdAt={seededBatch?.createdAt}
                    copyAndToast={copyAndToast}
                    onViewParcel={openParcelInputModal}
                    compact
                    emptyText="No seeded batch data found"
                  />
                  {seededBatch && seededBatchResults.length > pageSize && (
                    <Pager
                      page={seedBatchPage}
                      pageCount={seededBatchPageCount}
                      onPrev={() =>
                        setSeedBatchPage((current) => Math.max(1, current - 1))
                      }
                      onNext={() =>
                        setSeedBatchPage((current) =>
                          Math.min(seededBatchPageCount, current + 1),
                        )
                      }
                    />
                  )}
                </>
              )}
            </section>
          )}
        </Card>
      )}

      {page === "alerts" && (
        <Card className="space-y-4">
          <SectionTitle
            title="Alerts"
            text="Review operational alerts, config change notices, and mark items as read."
          />
          {alertsLoading ? (
            <p className="text-sm text-slate-400">Loading alerts...</p>
          ) : (
            <AlertsTable
              alerts={alerts}
              onMarkRead={(alertId) => void markAlertRead(alertId)}
              pendingAlertId={pendingReadAlertId}
              closingAlertIds={closingAlertIds}
            />
          )}
        </Card>
      )}

      <ConfigRuleModal
        modal={configModal}
        value={configModalText}
        message={modalMessage}
        issues={configModalIssues}
        validated={configModalValidated}
        onChange={(value) => {
          setConfigModalText(value);
          setModalMessage(null);
          setConfigModalIssues([]);
          setConfigModalValidated(false);
          if (failedSection === "config") {
            setFailedRows([]);
            setFailedSection(null);
          }
        }}
        onClose={closeConfigModal}
        onValidate={() => void applyConfigModal("validate")}
        onApply={() => void applyConfigModal("apply")}
      />

      <SeedConfirmModal
        seedConfirm={seedConfirm}
        onClose={() => setSeedConfirm(null)}
        onConfirm={(action) => void seedData(action)}
      />

      <ParcelInputDataModal
        modal={parcelInputModal}
        loading={parcelInputLoading}
        onClose={closeParcelInputModal}
      />
    </main>
  );
}

