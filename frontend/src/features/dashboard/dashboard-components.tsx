import { useEffect, useState, type ReactNode } from "react";
import {
  Copy,
  Eraser,
  FileSearch,
  Info,
  Pencil,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  Condition,
  ConfigRule,
  AlertRecord,
  RouteStatus,
  RoutingResult,
  UserProfile,
  ValidationIssue,
} from "@/features/app/types";
import {
  cleanIssueField,
  formatConfigIssueField,
} from "@/features/dashboard/dashboard-utils";

function formatTime(value?: string) {
  if (!value) return "n/a";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function DashboardNav({ profile }: { profile: UserProfile }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-5 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)] backdrop-blur-xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">
            Dashboard
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-white">
            Welcome back, {profile.username}
          </h1>
        </div>
        <Badge tone={profile.role === "admin" ? "amber" : "sky"}>
          {profile.role}
        </Badge>
      </div>
    </section>
  );
}

export function SectionTitle({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="text-[1.7rem] font-semibold tracking-tight text-white">
        {title}
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-slate-300">{text}</p>
    </div>
  );
}

export function TryNewButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      onClick={onClick}
      className="bg-emerald-300 text-emerald-950 hover:bg-emerald-400"
    >
      Try New
    </Button>
  );
}

export function RouteResultsTable({
  rows,
  batchId,
  importedBy,
  createdAt,
  copyAndToast,
  onViewParcel,
  compact = false,
  emptyText = "No records",
}: {
  rows: RoutingResult[];
  batchId?: string | null;
  importedBy?: string;
  createdAt?: string;
  copyAndToast: (text: string) => Promise<void>;
  onViewParcel?: (parcelId: string) => void | Promise<void>;
  compact?: boolean;
  emptyText?: string;
}) {
  return (
    <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/35">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-slate-300">
          <tr>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Batch ID</th>
            <th className="px-4 py-3">Parcel ID</th>
            <th className="px-4 py-3">To Be Routed</th>
            <th className="px-4 py-3">Routed To</th>
            <th className="px-4 py-3">Approvals</th>
            <th className="px-4 py-3">Imported By</th>
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Parcel Input</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr className="border-t border-white/5">
              <td colSpan={9} className="px-4 py-6 text-center text-slate-400">
                {emptyText}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr
              key={`${row.parcelId}-${row.route}-${compact ? "compact" : "full"}`}
              className="border-t border-white/5"
            >
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-4 py-3">
                {batchId ? (
                  <CopyButton value={batchId} onCopy={copyAndToast} />
                ) : (
                  <NaBadge />
                )}
              </td>
              <td className="px-4 py-3">
                <CopyButton value={row.parcelId} onCopy={copyAndToast} />
              </td>
              <td className="px-4 py-3">{renderRouteValue(row.toBeRouted)}</td>
              <td className="px-4 py-3">{renderRouteValue(row.routedTo)}</td>
              <td className="px-4 py-3">
                {row.approvals.length ? (
                  <ul className="space-y-2">
                    {row.approvals.map((approval) => (
                      <li key={approval}>
                        <Badge tone="amber">{approval}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <NaBadge />
                )}
              </td>
              <td className="px-4 py-3">{importedBy || <NaBadge />}</td>
              <td className="px-4 py-3 text-slate-300">
                {formatTime(createdAt)}
              </td>
              <td className="px-4 py-3">
                <Button
                  variant="ghost"
                  onClick={() => void onViewParcel?.(row.parcelId)}
                  aria-label={`View input for ${row.parcelId}`}
                >
                  <FileSearch className="h-4 w-4 text-emerald-300" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ValidationTable({
  issues,
  pagedGroups,
  groupColumnLabel = "Parcel No",
  groupBadgeLabel = "Parcel",
}: {
  issues: ValidationIssue[];
  pagedGroups: Array<{ rowNo: number; issues: ValidationIssue[] }>;
  groupColumnLabel?: string;
  groupBadgeLabel?: string;
}) {
  return (
    <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/35">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-slate-300">
          <tr>
            <th className="w-36 px-4 py-3">{groupColumnLabel}</th>
            <th className="w-56 px-4 py-3">Field</th>
            <th className="px-4 py-3">Reason</th>
            <th className="w-36 px-4 py-3">Issue Count</th>
          </tr>
        </thead>
        <tbody>
          {issues.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                No validation issues
              </td>
            </tr>
          )}
          {pagedGroups.map((group, groupIndex) => {
            const groupTone = groupIndex % 2 === 0 ? "amber" : "emerald";
            const rowClass =
              groupTone === "amber" ? "bg-amber-400/10" : "bg-emerald-400/10";
            return group.issues.map((issue, issueIndex) => (
              <tr
                key={`${group.rowNo}-${issue.field}-${issue.reason}-${issueIndex}`}
                className={`border-t border-white/5 ${rowClass}`}
              >
                {issueIndex === 0 && (
                  <td
                    rowSpan={group.issues.length}
                    className="px-4 py-3 align-top"
                  >
                    <Badge tone={groupTone}>
                      {groupBadgeLabel} {group.rowNo}
                    </Badge>
                  </td>
                )}
                <td className="px-4 py-3 align-top">
                  <Badge tone={groupTone}>{cleanIssueField(issue.field)}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-200">
                  <span className="block max-w-[34rem] whitespace-normal break-words leading-6">
                    {issue.reason}
                  </span>
                </td>
                {issueIndex === 0 && (
                  <td
                    rowSpan={group.issues.length}
                    className="px-4 py-3 align-top"
                  >
                    <Badge tone={groupTone}>
                      {group.issues.length}{" "}
                      {group.issues.length === 1 ? "issue" : "issues"}
                    </Badge>
                  </td>
                )}
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ConfigValidationTable({
  issues,
}: {
  issues: ValidationIssue[];
}) {
  return (
    <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/35">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-slate-300">
          <tr>
            <th className="w-64 px-4 py-3">Field</th>
            <th className="px-4 py-3">Reason</th>
          </tr>
        </thead>
        <tbody>
          {issues.length === 0 && (
            <tr>
              <td colSpan={2} className="px-4 py-6 text-center text-slate-400">
                No validation issues
              </td>
            </tr>
          )}
          {issues.map((issue, index) => (
            <tr
              key={`${issue.field}-${issue.reason}-${index}`}
              className="border-t border-white/5"
            >
              <td className="px-4 py-3 align-top">
                <Badge tone="amber">{formatConfigIssueField(issue)}</Badge>
              </td>
              <td className="px-4 py-3 text-slate-200">
                <span className="block whitespace-normal break-words leading-6">
                  {issue.reason}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SearchPanel({
  title,
  label,
  value,
  setValue,
  loading,
  onSearch,
  onClear,
  children,
}: {
  title: string;
  label: string;
  value: string;
  setValue: (value: string) => void;
  loading: boolean;
  onSearch: () => void;
  onClear: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/8 bg-slate-950/35 p-4">
      <h3 className="mb-3 text-base font-semibold text-white sm:text-lg">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={label}
          className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-emerald-400"
        />
        <Button
          variant="secondary"
          onClick={onSearch}
          disabled={loading}
          aria-label="Search"
        >
          <Search className="h-4 w-4 text-emerald-300" />
        </Button>
        <Button variant="secondary" onClick={onClear} aria-label="Clear">
          <Eraser className="h-4 w-4 text-rose-300" />
        </Button>
      </div>
      {children}
    </section>
  );
}

export function ConfigTable({
  title,
  rules,
  section,
  onEdit,
  onDelete,
}: {
  title: string;
  rules: ConfigRule[];
  section: "approval" | "route";
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  return (
    <section className="mt-7">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <span className="text-sm text-slate-400">
          {rules.length === 1 ? "1 rule" : `${rules.length} rules`}
        </span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/35">
        {" "}
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-slate-300">
            <tr>
              {section === "approval" && <th className="px-4 py-3">S.No</th>}
              {section === "route" && <th className="px-4 py-3">Priority</th>}
              <th className="px-4 py-3">
                {section === "approval" ? "Approval" : "Department"}
              </th>
              <th className="px-4 py-3">Condition</th>
              <th className="px-4 py-3">Created By</th>
              <th className="px-4 py-3">Last Modified By</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Edit</th>
              <th className="px-4 py-3">Delete</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, index) => (
              <tr
                key={`${rule.type}-${index}`}
                className="border-t border-white/5"
              >
                {section === "approval" && (
                  <td className="px-4 py-3 text-slate-300">{index + 1}</td>
                )}
                {section === "route" && (
                  <td className="px-4 py-3">
                    {rule.type === "route" &&
                    rule.priority === Number.MAX_SAFE_INTEGER ? (
                      "inf"
                    ) : rule.type === "route" ? (
                      rule.priority
                    ) : (
                      <NaBadge />
                    )}
                  </td>
                )}
                <td className="px-4 py-3">
                  {rule.type === "approval" ? (
                    <Badge tone="amber">{rule.action.approval}</Badge>
                  ) : (
                    <Badge tone="emerald">{rule.action.department}</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <ConditionView condition={rule.when} />
                </td>
                <td className="px-4 py-3">{rule.createdBy ?? <NaBadge />}</td>
                <td className="px-4 py-3">
                  {rule.lastModifiedBy ?? <NaBadge />}
                </td>
                <td className="px-4 py-3 text-slate-300">
                  {formatTime(rule.lastModifiedAt ?? rule.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <Button
                    variant="ghost"
                    onClick={() => onEdit(index)}
                    aria-label="Edit rule"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </td>
                <td className="px-4 py-3">
                  {rule.type === "route" &&
                  rule.priority === Number.MAX_SAFE_INTEGER &&
                  rule.action.department === "MANUAL_REVIEW" ? (
                    <NaBadge />
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={() => void onDelete(index)}
                      aria-label="Delete rule"
                    >
                      <Trash2 className="h-4 w-4 text-rose-300" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  No rules
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AlertsTable({
  alerts,
  onMarkRead,
  pendingAlertId,
  closingAlertIds,
}: {
  alerts: AlertRecord[];
  onMarkRead: (alertId: string) => void;
  pendingAlertId?: string | null;
  closingAlertIds?: string[];
}) {
  return (
    <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/35">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-slate-300">
          <tr>
            <th className="px-4 py-3">S.No</th>
            <th className="px-4 py-3">Alert</th>
            <th className="px-4 py-3">Reason</th>
            <th className="px-4 py-3">Level</th>
            <th className="px-4 py-3">Timestamp</th>
            <th className="px-4 py-3">Read</th>
          </tr>
        </thead>
        <tbody>
          {alerts.length === 0 && (
            <tr className="border-t border-white/5">
              <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                No alerts yet
              </td>
            </tr>
          )}
          {alerts.map((alert, index) => {
            const isPending = pendingAlertId === alert.id;
            const isClosing = closingAlertIds?.includes(alert.id) ?? false;
            return (
              <tr
                key={alert.id}
                className={`border-t border-white/5 transition-opacity duration-900 ${
                  isClosing
                    ? "opacity-0"
                    : "opacity-100"
                }`}
              >
                <td className="px-4 py-3 text-slate-300">{index + 1}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                      alert.level === "alert"
                        ? "bg-amber-400/15 text-amber-200"
                        : "bg-sky-400/15 text-sky-200"
                    }`}
                  >
                    {alert.level === "alert" ? (
                      <TriangleAlert className="h-3.5 w-3.5" />
                    ) : (
                      <Info className="h-3.5 w-3.5" />
                    )}
                    <span>{alert.name}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-200">
                  <span className="block max-w-[34rem] whitespace-normal break-words leading-6">
                    {alert.reason}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={alert.level === "alert" ? "amber" : "sky"}>
                    {alert.level}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-300">
                  {formatTime(alert.triggeredAt)}
                </td>
                <td className="px-4 py-3">
                  <label className="inline-flex items-center gap-2 text-slate-300">
                    <input
                      type="checkbox"
                      checked={false}
                      disabled={isPending || isClosing}
                      onChange={() => onMarkRead(alert.id)}
                      className="h-4 w-4 rounded border-white/20 bg-slate-900 text-emerald-400 disabled:cursor-not-allowed"
                    />
                    <span className="text-xs">
                      {isPending ? "Saving..." : "Mark Read"}
                    </span>
                  </label>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ConditionView({ condition }: { condition: Condition }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
        {condition.field}
      </span>
      <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
        {condition.operator}
      </span>
      {"value" in condition && condition.value !== undefined && (
        <span className="rounded-full bg-fuchsia-400/10 px-3 py-1 text-xs font-medium text-fuchsia-200">
          {String(condition.value)}
        </span>
      )}
    </span>
  );
}

export function Pager({
  page,
  pageCount,
  onPrev,
  onNext,
}: {
  page: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [pageInput, setPageInput] = useState(String(page));

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  return (
    <div className="mt-4 flex items-center justify-end gap-3 text-sm text-slate-300">
      <span>
        Page {page} of {pageCount}
      </span>
      <div className="flex items-center gap-2">
        <input
          value={pageInput}
          onChange={(event) => setPageInput(event.target.value)}
          inputMode="numeric"
          className="w-20 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-right text-sm text-white outline-none focus:border-emerald-400"
          aria-label="Go to page"
        />
        <Button
          variant="secondary"
          onClick={() => {
            const parsedPage = Number(pageInput);
            if (!Number.isFinite(parsedPage)) {
              setPageInput(String(page));
              return;
            }
            const nextPage = Math.min(
              pageCount,
              Math.max(1, Math.trunc(parsedPage)),
            );
            setPageInput(String(nextPage));
            if (nextPage === page) return;
            if (nextPage < page) {
              for (let current = page; current > nextPage; current -= 1) {
                onPrev();
              }
              return;
            }
            for (let current = page; current < nextPage; current += 1) {
              onNext();
            }
          }}
        >
          Go to page
        </Button>
      </div>
      <Button variant="secondary" onClick={onPrev} disabled={page <= 1}>
        Prev
      </Button>
      <Button variant="secondary" onClick={onNext} disabled={page >= pageCount}>
        Next
      </Button>
    </div>
  );
}

function StatusBadge({ status }: { status?: RouteStatus }) {
  if (status === "approval pending")
    return <Badge tone="amber">approval pending</Badge>;
  if (status === "defaulted") return <Badge tone="sky">defaulted</Badge>;
  if (status === "errored") return <Badge tone="rose">errored</Badge>;
  return <Badge tone="emerald">processed</Badge>;
}

function Badge({
  tone,
  children,
}: {
  tone: "amber" | "emerald" | "sky" | "rose";
  children: ReactNode;
}) {
  const className = {
    amber: "bg-amber-400/15 text-amber-200",
    emerald: "bg-emerald-400/15 text-emerald-200",
    sky: "bg-sky-400/15 text-sky-200",
    rose: "bg-rose-400/15 text-rose-200",
  }[tone];
  return (
    <span
      className={`mr-1 inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

function NaBadge() {
  return (
    <span className="inline-flex rounded-full bg-slate-500/20 px-3 py-1 text-xs font-medium text-slate-200">
      n/a
    </span>
  );
}

function CopyButton({
  value,
  onCopy,
}: {
  value: string;
  onCopy: (value: string) => Promise<void>;
}) {
  return (
    <button
      type="button"
      onClick={() => void onCopy(value)}
      className="group inline-flex items-center gap-2 font-mono text-xs text-emerald-300"
    >
      <span>{value}</span>
      <Copy className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
    </button>
  );
}

function renderRouteValue(value?: string) {
  if (!value || value === "n/a") return <NaBadge />;
  return <Badge tone="sky">{value}</Badge>;
}
