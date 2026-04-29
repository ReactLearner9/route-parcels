import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  BookOpenText,
  CheckCircle2,
  Copy,
  Eraser,
  Eye,
  FileText,
  FileUp,
  Home,
  LogOut,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "./components/layout/site-header";
import { APP_NAME } from "@/lib/app-meta";
import AIUsageDocs from "../docs/ai-usage.mdx";

type View = "landing" | "login" | "docs" | "dashboard";
type Role = "admin" | "operator";
type AuthMode = "login" | "register";
type DashboardPage = "single" | "batch" | "analytics" | "rules" | "seed";
type RouteStatus = "processed" | "approval pending" | "defaulted" | "errored";
type DashboardNavItem = { key: DashboardPage; label: string; icon: typeof Search };

type UserProfile = { id: string; username: string; role: Role };
type LoginForm = { username: string; password: string; role: Role };

type ValidationIssue = {
  rowNo: number;
  field: string;
  reason: string;
};

type ValidationReport = {
  valid: boolean;
  issues: ValidationIssue[];
};

type RoutingResult = {
  parcelId: string;
  route: string;
  approvals: string[];
  toBeRouted: string;
  routedTo: string;
  status?: RouteStatus;
  reason?: string;
};

type SingleRouteOutcome = {
  status: RouteStatus;
  createdAt?: string;
  importedBy?: string;
  result: RoutingResult;
};

type BatchRouteOutcome = {
  status: RouteStatus;
  batchId?: string;
  createdAt?: string;
  importedBy?: string;
  results: RoutingResult[];
};

type StoredParcelRecord = {
  batchId?: string;
  source: "single" | "batch";
  createdAt: string;
  importedBy: string;
  input: unknown;
  results: RoutingResult | RoutingResult[];
};

type AuditRow = {
  id: string;
  batchId: string;
  source: "single" | "batch" | "config";
  step: string;
  createdAt: string;
  actor?: string;
  message: string;
  parcelIds?: string[];
  route?: string;
  details?: Record<string, unknown>;
};

type HistoryResponse = {
  singles: StoredParcelRecord[];
  batches: StoredParcelRecord[];
  audits: AuditRow[];
};

type TraceResponse = {
  single: StoredParcelRecord | null;
  batch: StoredParcelRecord | null;
};

type Condition = {
  field: string;
  operator: ">" | "<" | ">=" | "<=" | "==" | "is_true" | "is_false";
  value?: unknown;
};

type ApprovalRule = {
  type: "approval";
  when: Condition;
  action: { approval: string };
  createdBy?: string;
  createdAt?: string;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
};

type RouteRule = {
  type: "route";
  priority: number;
  when: Condition;
  action: { department: string };
  createdBy?: string;
  createdAt?: string;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
};

type ConfigRule = ApprovalRule | RouteRule;
type ConfigResponse = {
  approvalConfig?: { rules: ApprovalRule[] } | null;
  routingConfig?: { rules: RouteRule[] } | null;
  currentConfig?: { rules: ConfigRule[] } | null;
};

type ConfigModalState = {
  section: "approval" | "route";
  mode: "new" | "edit";
  index?: number;
};

type SeedConfirmState = {
  action: "all" | "config";
  title: string;
  message: string;
  confirmLabel: string;
};

type UiLogEvent = {
  user: string;
  sessionId?: string;
  screen: string;
  functionality: string;
  feature: "single-import" | "batch-import" | "analytics" | "config" | "seed";
  phase: "started" | "ended";
  status?: "passed" | "failed" | "success" | "not_found" | "found";
  timestamp?: string;
  durationMs?: number;
  details?: Record<string, unknown>;
};

const pageSize = 20;
const issuePageSize = 10;
const defaultSingle = JSON.stringify({ weight: 2, value: 1500 }, null, 2);
const defaultApprovalRule = JSON.stringify(
  {
    type: "approval",
    when: { field: "value", operator: ">", value: 1000 },
    action: { approval: "INSURANCE" },
  },
  null,
  2,
);
const defaultRoutingRule = JSON.stringify(
  {
    type: "route",
    priority: 1,
    when: { field: "weight", operator: "<=", value: 1 },
    action: { department: "MAIL" },
  },
  null,
  2,
);

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? "Request failed");
  return payload as T;
}

function formatTime(value?: string) {
  if (!value) return "n/a";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function useStoredProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const raw = localStorage.getItem("route-parcels-profile");
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  });

  const save = (next: UserProfile | null) => {
    setProfile(next);
    if (next) localStorage.setItem("route-parcels-profile", JSON.stringify(next));
    else localStorage.removeItem("route-parcels-profile");
  };

  return [profile, save] as const;
}

function PasswordField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="relative">
      <input
        className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 pr-12 text-sm outline-none focus:border-emerald-400"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Password"
        type={revealed ? "text" : "password"}
      />
      <button
        type="button"
        onClick={() => setRevealed((current) => !current)}
        className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 transition hover:text-white"
        aria-label={revealed ? "Hide password" : "Show password"}
      >
        <Eye className="h-4 w-4" />
      </button>
    </div>
  );
}

function LandingPage({
  profile,
  onGoLogin,
  onGoDashboard,
}: {
  profile: UserProfile | null;
  onGoLogin: () => void;
  onGoDashboard: () => void;
}) {
  const [stats, setStats] = useState({
    parcelsRouted: 0,
    filesImported: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const history = await api<HistoryResponse>("/api/history");
        const singleResults = history.singles.map((record) => record.results as RoutingResult);
        const batchResults = history.batches.flatMap((record) =>
          Array.isArray(record.results) ? record.results : [],
        );
        const allResults = [...singleResults, ...batchResults];
        setStats({
          parcelsRouted: allResults.length,
          filesImported: history.batches.length,
        });
      } catch {
        setStats({
          parcelsRouted: 0,
          filesImported: 0,
        });
      }
    };

    void loadStats();
  }, []);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.16),transparent_24%),linear-gradient(135deg,rgba(7,18,16,0.96),rgba(14,25,32,0.96))] px-6 py-8 shadow-[0_30px_90px_rgba(0,0,0,0.28)] sm:px-8 sm:py-10">
        <p className="text-xs uppercase tracking-[0.5em] text-emerald-300">
          {APP_NAME}
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
          A modern platform for routing, review, and traceability.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
          Import parcels, validate rule-driven data, and use built-in analytics from a polished routing dashboard.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={profile ? onGoDashboard : onGoLogin}>
            <Home className="h-4 w-4" />
            <span>{profile ? "Dashboard" : "Get started"}</span>
          </Button>
        </div>
        <div className="mt-7 grid max-w-2xl gap-3 sm:grid-cols-2">
          <LandingStat label="Parcels Routed" value={stats.parcelsRouted} />
          <LandingStat label="Files Imported" value={stats.filesImported} />
        </div>
      </section>
      <section className="space-y-6 rounded-[2rem] border border-white/10 bg-slate-950/45 p-6 backdrop-blur-xl sm:p-7">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Features</p>
          <h2 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
            Everything needed to move parcels cleanly
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FeatureCard
            icon={<BadgeCheck className="h-5 w-5" />}
            title="Import Single"
            text="Quickly paste one parcel, check it, and route it without worrying about duplicate clicks."
          />
          <FeatureCard
            icon={<FileUp className="h-5 w-5" />}
            title="Import Batch"
            text="Upload a batch file, review it, and send the parcels through in one flow."
          />
          <FeatureCard
            icon={<Search className="h-5 w-5" />}
            title="Analytics Search"
            text="Look up parcels or batch files and see the routing history in clear table views."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Config"
            text="Admins can create and update routing rules from one place, with validation keeping changes tidy."
          />
        </div>
      </section>
      <section className="space-y-6">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Users</p>
          <h2 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
            Who uses the system and what they can do
          </h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <UserCard
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Admins"
            items={[
              "Create and modify approval rules",
              "Create and modify routing rules",
              "Reset seeded config data when needed",
            ]}
          />
          <UserCard
            icon={<Users className="h-6 w-6" />}
            title="Users"
            items={[
              "Import and route a single parcel",
              "Upload and import batch parcel files",
              "Review validation issues before routing",
            ]}
          />
        </div>
      </section>
      <section className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Stack</p>
        </div>
        <StackCarousel />
      </section>
    </main>
  );
}

function LandingStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/55 px-5 py-4 backdrop-blur-xl">
      <p className="text-2xl font-semibold text-white sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.25em] text-emerald-200">{label}</p>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Card className="flex h-full min-h-56 flex-col items-start justify-between text-left">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 shadow-lg shadow-emerald-950/20">
        {icon}
      </div>
      <div className="mt-10 min-w-0">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
      </div>
    </Card>
  );
}

function UserCard({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <Card className="flex h-full flex-col items-start text-left">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 shadow-lg shadow-emerald-950/20">
        {icon}
      </div>
      <h3 className="mt-4 text-xl font-semibold text-white">{title}</h3>
      <ul className="mt-5 w-full max-w-sm space-y-3 text-sm leading-6 text-slate-300">
        {items.map((item) => (
          <li key={item} className="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-3">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function StackCarousel() {
  const items = [
    { label: "React", src: "https://cdn.simpleicons.org/react" },
    { label: "Vite", src: "https://cdn.simpleicons.org/vite" },
    { label: "Tailwind CSS", src: "https://cdn.simpleicons.org/tailwindcss" },
    { label: "Express", src: "https://cdn.simpleicons.org/express/ffffff" },
    { label: "TypeScript", src: "https://cdn.simpleicons.org/typescript" },
    { label: "Zod", src: "https://cdn.simpleicons.org/zod" },
    { label: "Pino", src: "https://cdn.simpleicons.org/pino" },
    { label: "LowDB", src: "https://cdn.simpleicons.org/json/ffffff" },
  ];
  const track = [...items, ...items];

  return (
    <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 py-6">
      <div className="stack-marquee flex w-max gap-4 px-4">
        {track.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className="flex min-w-[15rem] items-center justify-center gap-4 rounded-3xl border border-white/10 bg-slate-950/80 px-5 py-4"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-slate-950">
              <img src={item.src} alt={`${item.label} logo`} className="h-7 w-7 object-contain" loading="lazy" />
            </div>
            <p className="text-lg font-semibold text-white">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoginPage({
  onLogin,
}: {
  onLogin: (form: LoginForm, mode: AuthMode) => Promise<void>;
}) {
  const [form, setForm] = useState<LoginForm>({
    username: "",
    password: "",
    role: "admin",
  });
  const [mode, setMode] = useState<AuthMode>("login");
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.14),transparent_30%),linear-gradient(160deg,rgba(8,17,15,0.96),rgba(15,23,42,0.88))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.28)] sm:p-8">
        <p className="text-xs uppercase tracking-[0.45em] text-emerald-300">Access</p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
          {mode === "login" ? "Sign in and keep parcels moving." : "Create an account for your routing workspace."}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
          Use the same streamlined workspace for imports, validation, trace history, and configuration changes.
        </p>
      </section>
      <Card className="border-emerald-400/16">
        <p className="text-xs uppercase tracking-[0.45em] text-emerald-300">{mode === "login" ? "Login" : "Register"}</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">
          {mode === "login" ? "Welcome back" : "Set up your account"}
        </h2>
        <form
          className="mt-6 grid gap-3.5"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              setError(null);
              await onLogin(form, mode);
            } catch (loginError) {
              setError(loginError instanceof Error ? loginError.message : "Login failed");
            }
          }}
        >
          {mode === "register" && (
            <select
              className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-emerald-400"
              value={form.role}
              onChange={(event) =>
                setForm((current) => ({ ...current, role: event.target.value as Role }))
              }
            >
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
            </select>
          )}
          <input
            className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-emerald-400"
            value={form.username}
            onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
            placeholder="Username"
          />
          <PasswordField
            value={form.password}
            onChange={(value) => setForm((current) => ({ ...current, password: value }))}
          />
            <div className="flex flex-wrap gap-3 pt-1">
              <Button type="submit">{mode === "login" ? "Login" : "Register"}</Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setMode((current) => (current === "login" ? "register" : "login"))}
              >
                {mode === "login" ? "Register" : "Switch to login"}
              </Button>
            </div>
          {error && <p className="text-sm text-rose-300">{error}</p>}
        </form>
      </Card>
    </main>
  );
}

async function logUiEvent(event: UiLogEvent) {
  try {
    const storedSessionId = sessionStorage.getItem("route-parcels-session-id");
    const sessionId = storedSessionId ?? `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    if (!storedSessionId) sessionStorage.setItem("route-parcels-session-id", sessionId);
    await fetch("/api/logs/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...event, sessionId, timestamp: event.timestamp ?? new Date().toISOString() }),
    });
  } catch {
    // Intentionally ignore logger transport failures.
  }
}

function DocsPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <Card className="border-white/10 bg-slate-950/55">
        <AIUsageDocs />
      </Card>
    </main>
  );
}

function Dashboard({
  profile,
  page,
  onPageChange,
}: {
  profile: UserProfile;
  page: DashboardPage;
  onPageChange: (page: DashboardPage) => void;
}) {
  const [history, setHistory] = useState<HistoryResponse>({ singles: [], batches: [], audits: [] });
  const [configState, setConfigState] = useState<ConfigResponse | null>(null);
  const [singleText, setSingleText] = useState(defaultSingle);
  const [singleValidated, setSingleValidated] = useState(false);
  const [singleOutcome, setSingleOutcome] = useState<SingleRouteOutcome | null>(null);
  const [singleLocked, setSingleLocked] = useState(false);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchValidated, setBatchValidated] = useState(false);
  const [batchOutcome, setBatchOutcome] = useState<BatchRouteOutcome | null>(null);
  const [batchLocked, setBatchLocked] = useState(false);
  const [batchUploadPage, setBatchUploadPage] = useState(1);
  const [analyticsBatchPage, setAnalyticsBatchPage] = useState(1);
  const [batchIssuePage, setBatchIssuePage] = useState(1);
  const [failedRows, setFailedRows] = useState<ValidationIssue[]>([]);
  const [failedSection, setFailedSection] = useState<"single" | "batch" | "config" | null>(null);
  const [parcelSearchInput, setParcelSearchInput] = useState("");
  const [batchSearchInput, setBatchSearchInput] = useState("");
  const [selectedParcelId, setSelectedParcelId] = useState("");
  const [selectedSingleRecord, setSelectedSingleRecord] = useState<StoredParcelRecord | null>(null);
  const [selectedSingleResult, setSelectedSingleResult] = useState<RoutingResult | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [singleSearchLoading, setSingleSearchLoading] = useState(false);
  const [batchSearchLoading, setBatchSearchLoading] = useState(false);
  const [seedDataLoading, setSeedDataLoading] = useState(false);
  const [seedBatchPage, setSeedBatchPage] = useState(1);
  const [configModal, setConfigModal] = useState<ConfigModalState | null>(null);
  const [configModalText, setConfigModalText] = useState("");
  const [modalMessage, setModalMessage] = useState<string | null>(null);
  const [configModalIssues, setConfigModalIssues] = useState<ValidationIssue[]>([]);
  const [configModalValidated, setConfigModalValidated] = useState(false);
  const [seedConfirm, setSeedConfirm] = useState<SeedConfirmState | null>(null);
  const batchFileInputRef = useRef<HTMLInputElement | null>(null);

  const visiblePages = useMemo<DashboardNavItem[]>(
    () =>
      profile.role === "admin"
        ? [
            { key: "analytics", label: "Analytics", icon: Search },
            { key: "rules", label: "Config", icon: ShieldCheck },
            { key: "seed", label: "Seed", icon: FileText },
          ]
        : [
            { key: "single", label: "Single", icon: BadgeCheck },
            { key: "batch", label: "Batch", icon: FileUp },
            { key: "analytics", label: "Analytics", icon: Search },
            { key: "seed", label: "Seed", icon: FileText },
          ],
    [profile.role],
  );

  useEffect(() => {
    if (!visiblePages.some((entry) => entry.key === page)) onPageChange(visiblePages[0].key);
  }, [page, visiblePages]);

  const refreshHistory = async () => {
    setHistory(await api<HistoryResponse>("/api/history"));
  };

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

  const approvalRules = configState?.approvalConfig?.rules ?? [];
  const routingRules = configState?.routingConfig?.rules ?? [];
  const selectedSingle = selectedSingleResult;
  const selectedBatch = history.batches.find((record) => {
    const batchId = record.batchId ?? "";
    const results = Array.isArray(record.results) ? record.results : [];
    return (
      batchId.toLowerCase() === selectedBatchId.toLowerCase() ||
      results.some((result) => result.parcelId.toLowerCase() === selectedBatchId.toLowerCase())
    );
  });
  const batchResultPageCount = Math.max(1, Math.ceil((batchOutcome?.results.length ?? 0) / pageSize));
  const batchResultSlice = (batchOutcome?.results ?? []).slice(
    (batchUploadPage - 1) * pageSize,
    batchUploadPage * pageSize,
  );
  const analyticsBatchResults = selectedBatch && Array.isArray(selectedBatch.results) ? selectedBatch.results : [];
  const analyticsBatchPageCount = Math.max(1, Math.ceil(analyticsBatchResults.length / pageSize));
  const analyticsBatchSlice = analyticsBatchResults.slice(
    (analyticsBatchPage - 1) * pageSize,
    analyticsBatchPage * pageSize,
  );
  const seededBatch = [...history.batches]
    .reverse()
    .find((record) => record.importedBy === "system" && Array.isArray(record.results));
  const seededBatchResults = seededBatch && Array.isArray(seededBatch.results) ? seededBatch.results : [];
  const seededBatchPageCount = Math.max(1, Math.ceil(seededBatchResults.length / pageSize));
  const seededBatchSlice = seededBatchResults.slice(
    (seedBatchPage - 1) * pageSize,
    seedBatchPage * pageSize,
  );
  const groupedIssues = groupIssues(failedRows);
  const issuePageCount = Math.max(1, Math.ceil(groupedIssues.length / issuePageSize));
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
      const report = await api<ValidationReport>("/api/upload/validate/single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
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
      toast.error(error instanceof Error ? error.message : "Single routing failed");
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
      const failedCount = new Set(report.issues.map((issue) => issue.rowNo)).size;
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
      setFailedRows([{ rowNo: 1, field: "file", reason: error instanceof Error ? error.message : "Invalid batch file" }]);
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
    if (!batchFile) {
      toast.error("Choose a batch file first");
      return;
    }

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
      toast.error(error instanceof Error ? error.message : "Batch routing failed");
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
      const trace = await api<TraceResponse>(`/api/history/trace/${encodeURIComponent(identifier)}`);
      setSelectedParcelId(identifier);
      const batchResults = trace.batch && Array.isArray(trace.batch.results) ? trace.batch.results : [];
      const batchInputs = trace.batch && Array.isArray(trace.batch.input) ? trace.batch.input : [];
      const inputId = identifier.toLowerCase();
      const matchingBatchResult = batchResults.find((result) => result.parcelId.toLowerCase() === inputId);
      const matchingBatchIndex = batchInputs.findIndex((parcel) => {
        const inputId = identifier.toLowerCase();
        return (parcel as { id?: string }).id?.toLowerCase() === inputId;
      });
      const matchingBatchInputResult =
        matchingBatchIndex >= 0 ? batchResults[matchingBatchIndex] ?? null : null;
      setSelectedSingleRecord(trace.single ?? trace.batch);
      setSelectedSingleResult(
        trace.single
          ? (trace.single.results as RoutingResult)
          : matchingBatchResult ??
            matchingBatchInputResult,
      );
      const found = Boolean(trace.single || matchingBatchResult || matchingBatchInputResult);
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
      toast.error("Unable to load analytics");
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
      const refreshed = await api<HistoryResponse>("/api/history");
      setHistory(refreshed);
      setSelectedBatchId(identifier);
      setAnalyticsBatchPage(1);
      const matched = refreshed.batches.find((record) => {
        const batchId = record.batchId ?? "";
        const results = Array.isArray(record.results) ? record.results : [];
        return (
          batchId.toLowerCase() === identifier.toLowerCase() ||
          results.some((result) => result.parcelId.toLowerCase() === identifier.toLowerCase())
        );
      });
      const batchRecordCount = matched && Array.isArray(matched.results) ? matched.results.length : 0;
      await logUiEvent({
        user: profile.username,
        screen: "Analytics",
        functionality: "batch_search",
        feature: "analytics",
        phase: "ended",
        status: matched ? "found" : "not_found",
        durationMs: Math.round(performance.now() - startedAt),
        details: { searchId: identifier, recordCount: batchRecordCount },
      });
    } catch {
      toast.error("Unable to load analytics");
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
      await refreshHistory();
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

  const submitConfig = async (section: "approval" | "route", mode: "validate" | "apply", rules: ConfigRule[]) => {
    const startedAt = performance.now();
    const configAction = mode === "apply" ? (configModal?.mode === "edit" ? "rule_modify" : "rule_add") : "rule_validate";
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
    formData.append("configFile", new File([JSON.stringify({ rules }, null, 2)], "config.json", { type: "application/json" }));
    if (mode === "apply") formData.append("modifiedBy", profile.username);
    const report = await api<{ valid?: boolean; issues?: ValidationIssue[]; applied?: boolean; checksum?: string }>(endpoint, {
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

  const openConfigModal = (section: "approval" | "route", mode: "new" | "edit", index?: number) => {
    const rules = section === "approval" ? approvalRules : routingRules;
    const selected = typeof index === "number" ? stripMetadata(rules[index]) : null;
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
      const currentRules = configModal.section === "approval" ? approvalRules : routingRules;
      const businessRules = currentRules.map((rule) => stripMetadata(rule));
      const nextRules =
        configModal.mode === "edit" && typeof configModal.index === "number"
          ? businessRules.map((rule, index) => (index === configModal.index ? parsed : rule))
          : [...businessRules, parsed];
      if (mode === "apply") {
        const valid = await submitConfig(configModal.section, "validate", nextRules);
        if (!valid) return;
      }
      await submitConfig(configModal.section, mode, nextRules);
    } catch (error) {
      const issues = [{ rowNo: 1, field: "json", reason: error instanceof Error ? error.message : "Invalid input" }];
      setFailedRows(issues);
      setConfigModalIssues(issues);
      setFailedSection("config");
      setModalMessage(null);
      setConfigModalValidated(false);
    }
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
            message: "This will wipe the current single parcel and batch lowdb records and replace them with seeded demo data.",
            confirmLabel: "Reset parcel and batch data",
          }
        : {
            action,
            title: "Reset Config Data?",
            message: "This will wipe the current approval and routing config records and replace them with the seeded configuration.",
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

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <DashboardNav profile={profile} />

      {page === "single" && (
        <Card className="space-y-3.5">
          <SectionTitle title="Import Single" text="Paste one parcel JSON body, validate it, then route it." />
          <textarea
            value={singleText}
            onChange={(event) => {
              setSingleText(event.target.value);
              setSingleOutcome(null);
              setSingleValidated(false);
              setSingleLocked(false);
            }}
            className="mt-4 max-h-64 min-h-64 w-full resize-none overflow-auto rounded-[1.4rem] border border-white/10 bg-slate-950/70 px-4 py-3 font-mono text-sm text-slate-100 outline-none focus:border-emerald-400"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => void validateSingle()}>
              <CheckCircle2 className="h-4 w-4" />
              <span className="ml-2">Validate</span>
            </Button>
            <Button
              onClick={() => void routeSingle()}
              disabled={singleLocked || !singleValidated || (failedSection === "single" && failedRows.length > 0)}
            >
              <FileUp className="h-4 w-4" />
              <span className="ml-2">Route Single</span>
            </Button>
            {(singleOutcome || (failedSection === "single" && failedRows.length > 0) || singleValidated) && (
              <TryNewButton onClick={resetSingle} />
            )}
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
            />
          )}
        </Card>
      )}

      {page === "batch" && (
        <Card className="space-y-3.5">
          <SectionTitle title="Import Batch" text="Select a JSON file containing parcels, validate it, then apply it." />
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
              <Button variant="secondary" onClick={() => void validateBatch()} disabled={!batchFile}>
                <CheckCircle2 className="h-4 w-4" />
                <span className="ml-2">Validate</span>
              </Button>
              <Button
                onClick={() => void routeBatch()}
                disabled={!batchFile || batchLocked || !batchValidated || (failedSection === "batch" && failedRows.length > 0)}
              >
                <FileUp className="h-4 w-4" />
                <span className="ml-2">Apply</span>
              </Button>
              {(batchFile || batchOutcome || (failedSection === "batch" && failedRows.length > 0) || batchValidated) && (
                <TryNewButton onClick={resetBatch} />
              )}
            </div>
          </div>
          {failedSection === "batch" && failedRows.length > 0 && (
            <>
              <ValidationTable issues={failedRows} pagedGroups={issueGroupsSlice} />
              {groupedIssues.length > issuePageSize && (
                <Pager
                  page={batchIssuePage}
                  pageCount={issuePageCount}
                  onPrev={() => setBatchIssuePage((current) => Math.max(1, current - 1))}
                  onNext={() => setBatchIssuePage((current) => Math.min(issuePageCount, current + 1))}
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
              />
              {(batchOutcome.results.length > pageSize) && (
                <Pager
                  page={batchUploadPage}
                  pageCount={batchResultPageCount}
                  onPrev={() => setBatchUploadPage((current) => Math.max(1, current - 1))}
                  onNext={() => setBatchUploadPage((current) => Math.min(batchResultPageCount, current + 1))}
                />
              )}
            </>
          )}
        </Card>
      )}

      {page === "analytics" && (
        <Card className="space-y-4">
          <SectionTitle title="Analytics" text="Search by parcel id or batch id to trace routed records." />
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
              compact
              emptyText={selectedParcelId ? "No parcel found" : "Search a parcel ID to populate this table"}
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
                setAnalyticsBatchPage(1);
              }}
            >
              <RouteResultsTable
                rows={selectedBatch ? analyticsBatchSlice : []}
                batchId={selectedBatch?.batchId}
                importedBy={selectedBatch?.importedBy}
                createdAt={selectedBatch?.createdAt}
                copyAndToast={copyAndToast}
                compact
                emptyText={selectedBatchId ? "No batch found" : "Search a batch ID to populate this table"}
              />
              {selectedBatch && analyticsBatchResults.length > pageSize && (
                <Pager
                  page={analyticsBatchPage}
                  pageCount={analyticsBatchPageCount}
                  onPrev={() => setAnalyticsBatchPage((current) => Math.max(1, current - 1))}
                  onNext={() => setAnalyticsBatchPage((current) => Math.min(analyticsBatchPageCount, current + 1))}
                />
              )}
            </SearchPanel>
          </div>
        </Card>
      )}

      {page === "rules" && (
        <Card className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle title="Config Manager" text="Manage approval and routing rules." />
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
          />
          <ConfigTable
            title="Routing Table View"
            rules={routingRules}
            section="route"
            onEdit={(index) => openConfigModal("route", "edit", index)}
          />
          {failedSection === "config" && failedRows.length > 0 && (
            <ConfigValidationTable issues={failedRows} />
          )}
        </Card>
      )}

      {page === "seed" && (
        <Card className="space-y-4">
          <SectionTitle title="Seed Data" text="Reset demo data for operators and admins." />
          <div className="mt-4 flex flex-wrap gap-3">
            {profile.role === "operator" && (
              <Button variant="destructive" onClick={() => promptSeedConfirm("all")}>
                Seed parcel and batch data
              </Button>
            )}
            {profile.role === "admin" && (
              <Button variant="destructive" onClick={() => promptSeedConfirm("config")}>
                Seed config data
              </Button>
            )}
          </div>
          {profile.role === "operator" && (
            <section className="mt-6">
              <h3 className="text-lg font-semibold text-white">Seeded Batch Table View</h3>
              {seedDataLoading && <p className="mt-3 text-sm text-slate-400">Loading seeded data...</p>}
              {!seedDataLoading && (
                <>
                  <RouteResultsTable
                    rows={seededBatch ? seededBatchSlice : []}
                    batchId={seededBatch?.batchId}
                    importedBy={seededBatch?.importedBy}
                    createdAt={seededBatch?.createdAt}
                    copyAndToast={copyAndToast}
                    compact
                    emptyText="No seeded batch data found"
                  />
                  {seededBatch && seededBatchResults.length > pageSize && (
                    <Pager
                      page={seedBatchPage}
                      pageCount={seededBatchPageCount}
                      onPrev={() => setSeedBatchPage((current) => Math.max(1, current - 1))}
                      onNext={() => setSeedBatchPage((current) => Math.min(seededBatchPageCount, current + 1))}
                    />
                  )}
                </>
              )}
            </section>
          )}
        </Card>
      )}

      {configModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {configModal.mode === "new" ? "New" : "Update"} {configModal.section === "approval" ? "Approval" : "Routing"} Rule
                </h3>
                <p className="mt-1 text-sm text-slate-400">Supported operators: &gt;, &lt;, &gt;=, &lt;=, ==, is_true, is_false</p>
              </div>
              <Button variant="ghost" onClick={closeConfigModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <textarea
              value={configModalText}
              onChange={(event) => {
                setConfigModalText(event.target.value);
                setModalMessage(null);
                setConfigModalIssues([]);
                setConfigModalValidated(false);
                if (failedSection === "config") {
                  setFailedRows([]);
                  setFailedSection(null);
                }
              }}
              className="mt-4 max-h-72 min-h-72 w-full resize-none overflow-auto rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 font-mono text-sm text-slate-100 outline-none focus:border-emerald-400"
            />
            {modalMessage && <p className="mt-3 text-sm text-emerald-300">{modalMessage}</p>}
            {configModalIssues.length > 0 && (
              <ConfigValidationTable issues={configModalIssues} />
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => void applyConfigModal("validate")}>Validate</Button>
              <Button onClick={() => void applyConfigModal("apply")} disabled={!configModalValidated}>
                {configModal.mode === "new" ? "Add" : "Update"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {seedConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-rose-400/30 bg-slate-950 p-5 shadow-2xl shadow-rose-950/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-rose-300">Confirm Reset</p>
                <h3 className="mt-2 text-lg font-semibold text-white">{seedConfirm.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{seedConfirm.message}</p>
              </div>
              <Button variant="ghost" onClick={() => setSeedConfirm(null)} aria-label="Close confirmation">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <Button variant="secondary" onClick={() => setSeedConfirm(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => void seedData(seedConfirm.action)}>
                {seedConfirm.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function DashboardNav({
  profile,
}: {
  profile: UserProfile;
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-5 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)] backdrop-blur-xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Dashboard</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Welcome back, {profile.username}</h1>
        </div>
        <Badge tone={profile.role === "admin" ? "amber" : "sky"}>
          {profile.role}
        </Badge>
      </div>
    </section>
  );
}

function SectionTitle({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="text-[1.7rem] font-semibold tracking-tight text-white">{title}</h2>
      <p className="mt-1.5 text-sm leading-6 text-slate-300">{text}</p>
    </div>
  );
}

function TryNewButton({ onClick }: { onClick: () => void }) {
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

function RouteResultsTable({
  rows,
  batchId,
  importedBy,
  createdAt,
  copyAndToast,
  compact = false,
  emptyText = "No records",
}: {
  rows: RoutingResult[];
  batchId?: string | null;
  importedBy?: string;
  createdAt?: string;
  copyAndToast: (text: string) => Promise<void>;
  compact?: boolean;
  emptyText?: string;
}) {
  return (
    <div className="mt-5 overflow-x-auto rounded-[1.35rem] border border-white/10 bg-slate-950/35">
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
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr className="border-t border-white/5">
              <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                {emptyText}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={`${row.parcelId}-${row.route}-${compact ? "compact" : "full"}`} className="border-t border-white/5">
              <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
              <td className="px-4 py-3">{batchId ? <CopyButton value={batchId} onCopy={copyAndToast} /> : <NaBadge />}</td>
              <td className="px-4 py-3"><CopyButton value={row.parcelId} onCopy={copyAndToast} /></td>
              <td className="px-4 py-3">{renderRouteValue(row.toBeRouted)}</td>
              <td className="px-4 py-3">{renderRouteValue(row.routedTo)}</td>
              <td className="px-4 py-3">{row.approvals.length ? row.approvals.map((approval) => <Badge key={approval} tone="amber">{approval}</Badge>) : <NaBadge />}</td>
              <td className="px-4 py-3">{importedBy || <NaBadge />}</td>
              <td className="px-4 py-3 text-slate-300">{formatTime(createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ValidationTable({
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
    <div className="mt-5 overflow-x-auto rounded-[1.35rem] border border-white/10 bg-slate-950/35">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-slate-300">
          <tr>
            <th className="w-[9rem] px-4 py-3">{groupColumnLabel}</th>
            <th className="w-[14rem] px-4 py-3">Field</th>
            <th className="px-4 py-3">Reason</th>
            <th className="w-[9rem] px-4 py-3">Issue Count</th>
          </tr>
        </thead>
        <tbody>
          {issues.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-slate-400">No validation issues</td>
            </tr>
          )}
          {pagedGroups.map((group, groupIndex) => {
            const groupTone = groupIndex % 2 === 0 ? "amber" : "emerald";
            const rowClass = groupTone === "amber" ? "bg-amber-400/10" : "bg-emerald-400/10";
            return group.issues.map((issue, issueIndex) => (
              <tr key={`${group.rowNo}-${issue.field}-${issue.reason}-${issueIndex}`} className={`border-t border-white/5 ${rowClass}`}>
                {issueIndex === 0 && (
                  <td rowSpan={group.issues.length} className="px-4 py-3 align-top">
                    <Badge tone={groupTone}>{groupBadgeLabel} {group.rowNo}</Badge>
                  </td>
                )}
                <td className="px-4 py-3 align-top">
                  <Badge tone={groupTone}>{cleanIssueField(issue.field)}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-200">
                  <span className="block max-w-[34rem] whitespace-normal break-words leading-6">{issue.reason}</span>
                </td>
                {issueIndex === 0 && (
                  <td rowSpan={group.issues.length} className="px-4 py-3 align-top">
                    <Badge tone={groupTone}>{group.issues.length} {group.issues.length === 1 ? "issue" : "issues"}</Badge>
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

function ConfigValidationTable({ issues }: { issues: ValidationIssue[] }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-[1.35rem] border border-white/10 bg-slate-950/35">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-slate-300">
          <tr>
            <th className="w-[16rem] px-4 py-3">Field</th>
            <th className="px-4 py-3">Reason</th>
          </tr>
        </thead>
        <tbody>
          {issues.length === 0 && (
            <tr>
              <td colSpan={2} className="px-4 py-6 text-center text-slate-400">No validation issues</td>
            </tr>
          )}
          {issues.map((issue, index) => (
            <tr key={`${issue.field}-${issue.reason}-${index}`} className="border-t border-white/5">
              <td className="px-4 py-3 align-top">
                <Badge tone="amber">{formatConfigIssueField(issue)}</Badge>
              </td>
              <td className="px-4 py-3 text-slate-200">
                <span className="block whitespace-normal break-words leading-6">{issue.reason}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SearchPanel({
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
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border border-white/8 bg-slate-950/35 p-4">
      <h3 className="mb-3 text-base font-semibold text-white sm:text-lg">{title}</h3>
      <div className="flex flex-wrap gap-2">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={label}
          className="min-w-0 flex-1 rounded-[1.15rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-emerald-400"
        />
        <Button variant="secondary" onClick={onSearch} disabled={loading} aria-label="Search">
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

function ConfigTable({
  title,
  rules,
  section,
  onEdit,
}: {
  title: string;
  rules: ConfigRule[];
  section: "approval" | "route";
  onEdit: (index: number) => void;
}) {
  return (
    <section className="mt-7">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <span className="text-sm text-slate-400">{rules.length === 1 ? "1 rule" : `${rules.length} rules`}</span>
      </div>
      <div className="overflow-x-auto rounded-[1.35rem] border border-white/10 bg-slate-950/35">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-slate-300">
            <tr>
              {section === "approval" && <th className="px-4 py-3">S.No</th>}
              {section === "route" && <th className="px-4 py-3">Priority</th>}
              <th className="px-4 py-3">{section === "approval" ? "Approval" : "Department"}</th>
              <th className="px-4 py-3">Condition</th>
              <th className="px-4 py-3">Created By</th>
              <th className="px-4 py-3">Last Modified By</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Edit</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, index) => (
              <tr key={`${rule.type}-${index}`} className="border-t border-white/5">
                {section === "approval" && <td className="px-4 py-3 text-slate-300">{index + 1}</td>}
                {section === "route" && (
                  <td className="px-4 py-3">{rule.type === "route" && rule.priority === Number.MAX_SAFE_INTEGER ? "∞" : rule.type === "route" ? rule.priority : <NaBadge />}</td>
                )}
                <td className="px-4 py-3">
                  {rule.type === "approval" ? <Badge tone="amber">{rule.action.approval}</Badge> : <Badge tone="emerald">{rule.action.department}</Badge>}
                </td>
                <td className="px-4 py-3"><ConditionView condition={rule.when} /></td>
                <td className="px-4 py-3">{rule.createdBy ?? <NaBadge />}</td>
                <td className="px-4 py-3">{rule.lastModifiedBy ?? <NaBadge />}</td>
                <td className="px-4 py-3 text-slate-300">{formatTime(rule.lastModifiedAt ?? rule.createdAt)}</td>
                <td className="px-4 py-3">
                  <Button variant="ghost" onClick={() => onEdit(index)} aria-label="Edit rule">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">No rules</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ConditionView({ condition }: { condition: Condition }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">{condition.field}</span>
      <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">{condition.operator}</span>
      {"value" in condition && condition.value !== undefined && (
        <span className="rounded-full bg-fuchsia-400/10 px-3 py-1 text-xs font-medium text-fuchsia-200">{String(condition.value)}</span>
      )}
    </span>
  );
}

function Pager({
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
  return (
    <div className="mt-4 flex items-center justify-end gap-3 text-sm text-slate-300">
      <span>Page {page} of {pageCount}</span>
      <Button variant="secondary" onClick={onPrev} disabled={page <= 1}>Prev</Button>
      <Button variant="secondary" onClick={onNext} disabled={page >= pageCount}>Next</Button>
    </div>
  );
}

function StatusBadge({ status }: { status?: RouteStatus }) {
  if (status === "approval pending") return <Badge tone="amber">approval pending</Badge>;
  if (status === "defaulted") return <Badge tone="sky">defaulted</Badge>;
  if (status === "errored") return <Badge tone="rose">errored</Badge>;
  return <Badge tone="emerald">processed</Badge>;
}

function Badge({
  tone,
  children,
}: {
  tone: "amber" | "emerald" | "sky" | "rose";
  children: React.ReactNode;
}) {
  const className = {
    amber: "bg-amber-400/15 text-amber-200",
    emerald: "bg-emerald-400/15 text-emerald-200",
    sky: "bg-sky-400/15 text-sky-200",
    rose: "bg-rose-400/15 text-rose-200",
  }[tone];
  return <span className={`mr-1 inline-flex rounded-full px-3 py-1 text-xs font-medium ${className}`}>{children}</span>;
}

function NaBadge() {
  return <span className="inline-flex rounded-full bg-slate-500/20 px-3 py-1 text-xs font-medium text-slate-200">n/a</span>;
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

function groupIssues(issues: ValidationIssue[]) {
  const groups = new Map<number, ValidationIssue[]>();
  for (const issue of issues) {
    const rowNo = issue.rowNo || 1;
    groups.set(rowNo, [...(groups.get(rowNo) ?? []), issue]);
  }
  return [...groups.entries()].map(([rowNo, groupIssues]) => ({ rowNo, issues: groupIssues }));
}

function cleanIssueField(field: string) {
  return field.replace(/^row\s+\d+\s+/i, "").replace(/^\d+\s+/, "");
}

function detectLikelyJsonField(source: string) {
  const singleQuotedValueMatch = [...source.matchAll(/"([^"]+)"\s*:\s*'/g)].at(-1);
  if (singleQuotedValueMatch?.[1]) return singleQuotedValueMatch[1];

  const trailingKeyMatch = [...source.matchAll(/"([^"]+)"\s*:\s*$/gm)].at(-1);
  if (trailingKeyMatch?.[1]) return trailingKeyMatch[1];

  return "json";
}

function formatSingleJsonParseReason(source: string, error: unknown) {
  if (/"[^"]+"\s*:\s*'/.test(source)) {
    return "Invalid JSON: single quotes are not allowed. Use double quotes for keys and string values.";
  }

  if (/,\s*[}\]]/.test(source)) {
    return "Remove the trailing comma before the closing bracket or brace.";
  }

  if (!source.trim().startsWith("{") || !source.trim().endsWith("}")) {
    return "The single parcel input must be a valid JSON object wrapped in curly braces.";
  }

  return error instanceof Error ? "The single parcel input is not valid JSON." : "Invalid input.";
}

function formatConfigIssueField(issue: ValidationIssue) {
  const normalizedField = cleanIssueField(issue.field);

  if (normalizedField.includes("action.approval")) return "action.approval";
  if (normalizedField.includes("action.department")) return "action.department";
  if (normalizedField.includes("when.operator")) return "when.operator";

  if (normalizedField === "rules") {
    if (/^Approval\s+.+\s+is already present\.$/.test(issue.reason)) {
      return "action.approval";
    }
    if (/^This editor accepts only\s+(approval|route)\s+rules\.$/.test(issue.reason)) {
      return "type";
    }
  }

  return normalizedField;
}

function stripMetadata(rule: ConfigRule): ConfigRule {
  const { createdBy, createdAt, lastModifiedBy, lastModifiedAt, ...businessRule } = rule;
  void createdBy;
  void createdAt;
  void lastModifiedBy;
  void lastModifiedAt;
  return businessRule as ConfigRule;
}

export default function App() {
  const [view, setView] = useState<View>("landing");
  const [profile, setProfile] = useStoredProfile();
  const headerNavItems: DashboardNavItem[] =
    view === "dashboard" && profile
      ? profile.role === "admin"
        ? [
            { key: "analytics", label: "Analytics", icon: Search },
            { key: "rules", label: "Config", icon: ShieldCheck },
            { key: "seed", label: "Seed", icon: FileText },
          ]
        : [
            { key: "single", label: "Single", icon: BadgeCheck },
            { key: "batch", label: "Batch", icon: FileUp },
            { key: "analytics", label: "Analytics", icon: Search },
            { key: "seed", label: "Seed", icon: FileText },
          ]
      : [];
  const [headerDashboardPage, setHeaderDashboardPage] = useState<DashboardPage>(
    profile?.role === "admin" ? "analytics" : "single",
  );

  useEffect(() => {
    if (!profile) return;
    setHeaderDashboardPage(profile.role === "admin" ? "analytics" : "single");
  }, [profile?.role]);

  const login = async (form: LoginForm, mode: AuthMode) => {
    const user = await api<UserProfile>(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setProfile(user);
    setView("dashboard");
    toast.success(`Welcome, ${user.username}`);
  };

  const logout = () => {
    setProfile(null);
    setView("landing");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader
        profile={profile ? { name: profile.username, role: profile.role } : null}
        onHome={() => setView("landing")}
        onLogin={() => setView("login")}
        onDocs={() => setView("docs")}
        onLogout={logout}
        navItems={headerNavItems}
        activeNavKey={view === "dashboard" ? headerDashboardPage : undefined}
        onNavigate={(key) => {
          setView("dashboard");
          setHeaderDashboardPage(key as DashboardPage);
        }}
      />
      <Toaster richColors position="top-center" duration={3500} />
      {view === "landing" && (
        <LandingPage
          profile={profile}
          onGoLogin={() => setView("login")}
          onGoDashboard={() => setView("dashboard")}
        />
      )}
      {view === "login" && <LoginPage onLogin={login} />}
      {view === "docs" && <DocsPage />}
      {view === "dashboard" && profile && (
        <Dashboard
          profile={profile}
          page={headerDashboardPage}
          onPageChange={setHeaderDashboardPage}
        />
      )}
    </div>
  );
}
