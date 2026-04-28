import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Copy,
  Eye,
  FileUp,
  Home,
  Menu,
  Search,
  ShieldCheck,
  UserCircle2,
  X,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "./components/layout/site-header";
import { APP_NAME } from "@/lib/app-meta";
import AIUsageDocs from "../docs/ai-usage.mdx";

type View = "landing" | "login" | "docs" | "dashboard";
type DashboardPage =
  | "single"
  | "batch"
  | "analytics"
  | "rules"
  | "trace"
  | "seed";
type Role = "admin" | "operator";
type AuthMode = "login" | "register";

type UserProfile = { id: string; name: string; email: string; role: Role };
type AuditRow = {
  id: string;
  fileId: string;
  source: "single" | "batch" | "config";
  step: string;
  createdAt: string;
  message: string;
  parcelIds?: string[];
  route?: string;
  details?: Record<string, unknown>;
};
type HistoryResponse = {
  singles: Array<{
    fileId: string;
    createdAt: string;
    input: { id: string; weight: number; value: number };
    results: { parcelId: string; route: string; approvals: string[] };
  }>;
  batches: Array<{
    fileId: string;
    createdAt: string;
    input: Array<{ id: string; weight: number; value: number }>;
    results: Array<{ parcelId: string; route: string; approvals: string[] }>;
  }>;
  audits: AuditRow[];
};
type ConfigResponse = {
  currentVersion: number;
  currentConfig: unknown | null;
  versions: Array<{
    changeId: string;
    version: number;
    createdAt: string;
    checksum: string;
    config: unknown;
  }>;
};
type LoginForm = { email: string; password: string; name: string; role: Role };

const loginSeed: LoginForm = {
  email: "admin@routeparcels.local",
  password: "admin123",
  name: "Admin User",
  role: "admin",
};
const defaultSingle = JSON.stringify(
  {
    id: "P-100",
    weight: 2,
    value: 1500,
    destinationCountry: "DE",
    isFragile: true,
  },
  null,
  2,
);
const defaultConfig = JSON.stringify(
  {
    rules: [
      {
        name: "insurance",
        type: "approval",
        priority: 50,
        when: { field: "value", operator: ">", value: 1000 },
        action: { approval: "INSURANCE" },
      },
      {
        name: "fragile",
        type: "approval",
        priority: 40,
        when: { field: "isFragile", operator: "is_true" },
        action: { approval: "FRAGILE_HANDLING" },
      },
      {
        name: "regular",
        type: "route",
        priority: 5,
        when: { field: "weight", operator: "<=", value: 10 },
        action: { department: "REGULAR" },
      },
    ],
  },
  null,
  2,
);

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(payload?.error ?? "Request failed");
  return payload as T;
}

function formatTime(value: string) {
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
    if (next)
      localStorage.setItem("route-parcels-profile", JSON.stringify(next));
    else localStorage.removeItem("route-parcels-profile");
  };
  return [profile, save] as const;
}

function copyText(text: string) {
  return navigator.clipboard.writeText(text);
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
  onGoDocs,
  onGoDashboard,
}: {
  profile: UserProfile | null;
  onGoLogin: () => void;
  onGoDocs: () => void;
  onGoDashboard: () => void;
}) {
  const [stats, setStats] = useState({
    parcelsProcessed: 0,
    filesProcessed: 0,
    activeRoutes: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const history = await api<HistoryResponse>("/api/history");
        const parcelsProcessed =
          history.singles.length +
          history.batches.reduce(
            (total, batch) => total + batch.input.length,
            0,
          );
        const filesProcessed = history.singles.length + history.batches.length;
        const activeRoutes = new Set([
          ...history.singles.map((entry) => entry.results.route),
          ...history.batches.flatMap((entry) =>
            entry.results.map((result) => result.route),
          ),
        ]).size;
        setStats({ parcelsProcessed, filesProcessed, activeRoutes });
      } catch {
        setStats({ parcelsProcessed: 0, filesProcessed: 0, activeRoutes: 0 });
      }
    };

    void loadStats();
  }, []);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col gap-10 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8">
      <section className="min-h-[78vh] rounded-[2rem] border border-emerald-400/20 bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900 p-6 sm:p-10">
        <div className="relative flex h-full flex-col justify-between gap-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_28%)]" />
          <div className="relative flex flex-1 flex-col justify-between gap-10">
            <div>
              <p className="mt-6 text-xs uppercase tracking-[0.5em] text-emerald-300">
                {APP_NAME}
              </p>
              <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-7xl">
                A modern platform for routing, review, and traceability.
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
                Route Parcels gives operators and admins a clean place to import
                parcels, manage rules, inspect audit logs, and trace every file
                or parcel without leaving the app.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={profile ? onGoDashboard : onGoLogin}>
                <Home className="h-4 w-4" />
                <span className="ml-2">{profile ? "Home" : "Get started"}</span>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="min-h-[42vh] rounded-[2rem] border border-white/10 bg-white/5 p-6 sm:p-10">
        <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">
          Live Analytics
        </p>
        <h2 className="mt-4 text-3xl font-semibold text-white sm:text-5xl">
          Simple operational totals
        </h2>
        <div className="mt-8 flex flex-col gap-4">
          {[
            {
              label: "Parcels processed",
              value: stats.parcelsProcessed.toLocaleString(),
            },
            {
              label: "Files processed",
              value: stats.filesProcessed.toLocaleString(),
            },
            {
              label: "Active routes",
              value: stats.activeRoutes.toLocaleString(),
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-3xl border border-white/10 bg-slate-950/70 px-5 py-6"
            >
              <p className="text-sm uppercase tracking-[0.35em] text-slate-400">
                {stat.label}
              </p>
              <p className="mt-3 text-4xl font-semibold text-white">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="min-h-[48vh] rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 sm:p-10">
        <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">
          Stack
        </p>
        <h2 className="mt-4 text-3xl font-semibold text-white sm:text-5xl">
          Built with the original library brands
        </h2>
        <div className="mt-8 flex flex-col gap-4">
          <StackRow
            label="React"
            icon={
              <BrandIcon
                src="https://cdn.simpleicons.org/react"
                alt="React logo"
              />
            }
            description="UI layer and component runtime"
          />
          <StackRow
            label="Vite"
            icon={
              <BrandIcon
                src="https://cdn.simpleicons.org/vite"
                alt="Vite logo"
              />
            }
            description="Fast frontend build tooling"
          />
          <StackRow
            label="Tailwind CSS"
            icon={
              <BrandIcon
                src="https://cdn.simpleicons.org/tailwindcss"
                alt="Tailwind CSS logo"
              />
            }
            description="Utility-first styling system"
          />
          <StackRow
            label="Express"
            icon={
              <BrandIcon
                src="https://cdn.simpleicons.org/express/ffffff"
                alt="Express logo"
              />
            }
            description="Backend API server"
          />
          <StackRow
            label="TypeScript"
            icon={
              <BrandIcon
                src="https://cdn.simpleicons.org/typescript"
                alt="TypeScript logo"
              />
            }
            description="Shared type-safe application code"
          />
          <StackRow
            label="Zod"
            icon={
              <BrandIcon src="https://cdn.simpleicons.org/zod" alt="Zod logo" />
            }
            description="Input validation and schemas"
          />
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 sm:p-10">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">
            Users
          </p>
          <h2 className="mt-4 text-3xl font-semibold text-white sm:text-5xl">
            Who uses Route Parcels
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <CapabilityCard
              icon={<UserCircle2 className="h-6 w-6" />}
              title="Operators"
              items={[
                "Import single parcels",
                "Upload batch files",
                "Trace parcel and file IDs",
              ]}
            />
            <CapabilityCard
              icon={<ShieldCheck className="h-6 w-6" />}
              title="Admins"
              items={[
                "Validate and apply configs",
                "Review analytics",
                "Inspect config audit data",
              ]}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 sm:p-10">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">
            Trace and Analytics
          </p>
          <h2 className="mt-4 text-3xl font-semibold text-white sm:text-5xl">
            Keep every parcel visible
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <CapabilityCard
              icon={<Search className="h-6 w-6" />}
              title="Analytics"
              items={[
                "Filter audits",
                "Open config data",
                "Jump to trace instantly",
              ]}
            />
            <CapabilityCard
              icon={<Eye className="h-6 w-6" />}
              title="Trace"
              items={[
                "Open parcel history",
                "Inspect full trace payload",
                "Copy trace data",
              ]}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function StackRow({
  label,
  description,
  icon,
}: {
  label: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/5 px-5 py-5">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-slate-950">
        {icon}
      </div>
      <div>
        <p className="text-lg font-semibold text-white">{label}</p>
        <p className="mt-1 text-sm text-slate-300">{description}</p>
      </div>
    </div>
  );
}

function CapabilityCard({
  icon,
  title,
  items,
}: {
  icon: ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 px-6 py-8 text-left">
      <div className="flex items-center gap-3 text-emerald-300">
        {icon}
        <p className="text-lg font-semibold text-white">{title}</p>
      </div>
      <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-300" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BrandIcon({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className="h-7 w-7 object-contain"
      loading="lazy"
    />
  );
}

function LoginPage({
  onLogin,
}: {
  onLogin: (form: LoginForm, mode: AuthMode) => Promise<void>;
}) {
  const [form, setForm] = useState<LoginForm>(loginSeed);
  const [mode, setMode] = useState<AuthMode>("login");
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Card className="border-emerald-400/20">
        <p className="text-xs uppercase tracking-[0.45em] text-emerald-300">
          {mode === "login" ? "Login" : "Register"}
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">
          {mode === "login" ? "Sign in to continue" : "Create your account"}
        </h1>
        <p className="mt-3 text-sm text-slate-300">
          {mode === "login"
            ? "Use your existing account."
            : "Create a profile and sign in immediately after registration."}
        </p>
        <form
          className="mt-6 grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              setError(null);
              await onLogin(form, mode);
            } catch (loginError) {
              setError(
                loginError instanceof Error
                  ? loginError.message
                  : "Login failed",
              );
            }
          }}
        >
          {mode === "register" && (
            <select
              className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-emerald-400"
              value={form.role}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  role: event.target.value as Role,
                }))
              }
            >
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
            </select>
          )}
          {mode === "register" && (
            <input
              className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-emerald-400"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Name"
            />
          )}
          <input
            className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-emerald-400"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
            placeholder="Email"
          />
          <PasswordField
            value={form.password}
            onChange={(value) =>
              setForm((current) => ({ ...current, password: value }))
            }
          />
          <div className="flex gap-3">
            <Button type="submit">
              {mode === "login" ? "Login" : "Register"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setMode((current) =>
                  current === "login" ? "register" : "login",
                )
              }
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

function DocsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Card>
        <AIUsageDocs />
      </Card>
    </main>
  );
}

function Dashboard({
  profile,
  onLogout,
}: {
  profile: UserProfile;
  onLogout: () => void;
}) {
  const [page, setPage] = useState<DashboardPage>("single");
  const [menuOpen, setMenuOpen] = useState(true);
  const [history, setHistory] = useState<HistoryResponse>({
    singles: [],
    batches: [],
    audits: [],
  });
  const [configState, setConfigState] = useState<ConfigResponse | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<
    "all" | "single" | "batch" | "config"
  >("all");
  const [traceData, setTraceData] = useState<unknown>(null);
  const [traceId, setTraceId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [singleText, setSingleText] = useState(defaultSingle);
  const [configText, setConfigText] = useState(defaultConfig);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchFileName, setBatchFileName] = useState<string | null>(null);
  const [modalData, setModalData] = useState<{
    title: string;
    data: unknown;
  } | null>(null);

  const menuItems = [
    { key: "single", label: "Import Single", icon: FileUp },
    { key: "batch", label: "Import Batch", icon: FileUp },
    { key: "analytics", label: "Analytics", icon: Search },
    { key: "rules", label: "Config", icon: ShieldCheck },
    { key: "trace", label: "Trace", icon: UserCircle2 },
    { key: "seed", label: "Seed Data", icon: ShieldCheck },
  ] as const;

  const refreshHistory = async () => {
    setHistoryLoading(true);
    try {
      setHistory(await api<HistoryResponse>("/api/history"));
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : "Unable to load history",
      );
      toast.error("Unable to load history");
    } finally {
      setHistoryLoading(false);
    }
  };
  useEffect(() => {
    void refreshHistory();
  }, []);
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setConfigState(await api<ConfigResponse>("/api/config"));
      } catch {
        setConfigState(null);
      }
    };
    void loadConfig();
  }, []);

  const filteredAudits = useMemo(
    () =>
      history.audits.filter((row) => {
        const matchesSearch =
          !search ||
          [row.fileId, row.message, row.step, ...(row.parcelIds ?? [])].some(
            (value) => value.toLowerCase().includes(search.toLowerCase()),
          );
        return (
          matchesSearch &&
          row.source !== "config" &&
          (sourceFilter === "all" || row.source === sourceFilter)
        );
      }),
    [history.audits, search, sourceFilter],
  );

  const parseWorker = () =>
    new Worker(new URL("./workers/batch-parser.worker.ts", import.meta.url), {
      type: "module",
    });
  const copyAndToast = async (text: string) => {
    await copyText(text);
    toast.success("Copied to clipboard");
  };

  const validateSingle = async () => {
    const response = await fetch("/api/upload/validate/single", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(JSON.parse(singleText)),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data?.error ?? "Single validation failed");
    toast.success("Single JSON is valid");
  };

  const routeSingle = async () => {
    const result = await api<{
      fileId: string;
      result: { parcelId: string; route: string; approvals: string[] };
    }>("/api/upload/single", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(JSON.parse(singleText)),
    });
    setStatus(
      `Single parcel routed: ${result.result.parcelId} -> ${result.result.route}`,
    );
    toast.success(`Single parcel routed to ${result.result.route}`);
    await refreshHistory();
  };

  const validateBatch = async () => {
    if (!batchFile) return toast.error("Choose a batch file first");
    const formData = new FormData();
    formData.append("batchFile", batchFile, batchFile.name);
    const response = await fetch("/api/upload/validate/batch", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error ?? "Batch validation failed");
    toast.success("Batch file is valid");
  };

  const routeBatchFile = async () => {
    if (!batchFile) return toast.error("Choose a batch file first");
    const text = await batchFile.text();
    const payload = await new Promise<{
      parcels: Array<Record<string, unknown>>;
    }>((resolve, reject) => {
      const worker = parseWorker();
      worker.onmessage = (
        event: MessageEvent<{
          ok: boolean;
          payload?: { parcels: Array<Record<string, unknown>> };
          error?: string;
        }>,
      ) => {
        if (event.data.ok && event.data.payload) resolve(event.data.payload);
        else reject(new Error(event.data.error ?? "Invalid batch file"));
        worker.terminate();
      };
      worker.onerror = () => {
        reject(new Error("Batch parser worker failed"));
        worker.terminate();
      };
      worker.postMessage({ text });
    });
    const formData = new FormData();
    formData.append(
      "batchFile",
      new Blob([JSON.stringify(payload)], { type: "application/json" }),
      batchFile.name,
    );
    const response = await fetch("/api/upload/batch", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error ?? "Batch upload failed");
    setStatus(`Batch processed: ${data.fileId}`);
    toast.success(`Batch uploaded as ${data.fileId}`);
    await refreshHistory();
  };

  const uploadConfig = async (
    endpoint: "/api/config/validate" | "/api/config/apply",
  ) => {
    const formData = new FormData();
    formData.append(
      "configFile",
      new File([configText], "config.json", { type: "application/json" }),
    );
    const response = await fetch(endpoint, { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error ?? "Config request failed");
    toast.success(
      endpoint.endsWith("validate")
        ? "Config validated"
        : `Config applied version ${data.version}`,
    );
    await refreshHistory();
    setConfigState(await api<ConfigResponse>("/api/config"));
  };

  const seedData = async () => {
    await api("/api/seed", { method: "POST" });
    toast.success("Backend seeded");
    await refreshHistory();
    setConfigState(await api<ConfigResponse>("/api/config"));
  };

  const runTrace = async (identifier = traceId) => {
    const data = await api(
      `/api/history/trace/${encodeURIComponent(identifier)}`,
    );
    setTraceData(data);
    toast.success("Trace loaded");
  };

  const openConfigDetails = async () => {
    const data = await api("/api/config");
    setModalData({ title: "Config database", data });
  };

  return (
    <div
      className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8"
      style={{
        gridTemplateColumns: menuOpen
          ? "280px minmax(0, 1fr)"
          : "88px minmax(0, 1fr)",
      }}
    >
      <aside className="rounded-3xl border border-white/10 bg-slate-950/90 p-4 transition-all">
        <div className="flex items-center justify-between gap-3">
          <div className={menuOpen ? "block" : "hidden"}>
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">
              Dashboard
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>
        <nav className="mt-5 flex flex-col gap-2">
          {menuItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setPage(key)}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${page === key ? "bg-emerald-400/15 text-emerald-300" : "text-slate-200 hover:bg-white/5"}`}
            >
              <Icon className="h-4 w-4" />
              <span className={menuOpen ? "inline" : "hidden"}>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="space-y-6">
        <header className="flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">
              Hello
            </p>
            <h1 className="text-lg font-semibold text-white">
              Welcome back, {profile.name}
            </h1>
          </div>
        </header>

        {status && (
          <p className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
            {status}
          </p>
        )}

        {page === "single" && (
          <Card>
            <h2 className="text-2xl font-semibold text-white">Import Single</h2>
            <p className="mt-2 text-sm text-slate-300">
              Paste a single parcel JSON body, validate it through the backend,
              then route it.
            </p>
            <label className="mt-4 mb-2 block text-sm text-slate-200">
              Single parcel JSON
            </label>
            <textarea
              value={singleText}
              onChange={(event) => setSingleText(event.target.value)}
              className="min-h-72 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 font-mono text-sm text-slate-100 outline-none focus:border-emerald-400"
            />
            <div className="mt-3 flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => void validateSingle()}>
                Validate
              </Button>
              <Button onClick={() => void routeSingle()}>Route Single</Button>
            </div>
          </Card>
        )}

        {page === "batch" && (
          <Card>
            <h2 className="text-2xl font-semibold text-white">Import Batch</h2>
            <p className="mt-2 text-sm text-slate-300">
              Select a JSON file containing parcels, validate it, then apply it.
            </p>
            <div className="mt-4 space-y-3">
              <input
                type="file"
                accept="application/json"
                className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-500 file:px-4 file:py-2 file:font-medium file:text-slate-950 hover:file:bg-emerald-400"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setBatchFile(file);
                  setBatchFileName(file?.name ?? null);
                }}
              />
              <p className="text-sm text-slate-300">
                Selected file: {batchFileName ?? "none"}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  onClick={() => void validateBatch()}
                  disabled={!batchFile}
                >
                  Validate
                </Button>
                <Button
                  onClick={() => void routeBatchFile()}
                  disabled={!batchFile}
                >
                  Apply
                </Button>
              </div>
            </div>
          </Card>
        )}

        {page === "analytics" && (
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-white">Analytics</h2>
                <p className="mt-2 text-sm text-slate-300">
                  Search, filter, and trace audit rows.
                </p>
              </div>
              <Button variant="secondary" onClick={() => void refreshHistory()}>
                Refresh
              </Button>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search parcel, file, step, or message"
                className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-emerald-400"
              />
              <select
                value={sourceFilter}
                onChange={(event) =>
                  setSourceFilter(event.target.value as typeof sourceFilter)
                }
                className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 pr-10 text-sm outline-none focus:border-emerald-400"
              >
                <option value="all">All sources</option>
                <option value="single">Single</option>
                <option value="batch">Batch</option>
                <option value="config">Config</option>
              </select>
            </div>
            <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Parcel ID</th>
                    <th className="px-4 py-3">File ID</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Step</th>
                    <th className="px-4 py-3">Open</th>
                    <th className="px-4 py-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAudits.map((row) => (
                    <tr key={row.id} className="border-t border-white/5">
                      <td className="px-4 py-3 font-mono text-xs text-emerald-300">
                        <button
                          type="button"
                          className="group inline-flex items-center gap-2"
                          title="Copy parcel ID"
                          onClick={async () => {
                            const parcelId = row.parcelIds?.[0];
                            if (!parcelId) return;
                            await copyAndToast(parcelId);
                          }}
                        >
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 font-medium text-emerald-200 underline decoration-2 decoration-emerald-300 underline-offset-4 transition group-hover:bg-emerald-400/20 group-hover:text-white">
                            {row.parcelIds?.[0] ?? "-"}
                          </span>
                          <Copy className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">
                        {row.fileId}
                      </td>
                      <td className="px-4 py-3 text-slate-200">{row.source}</td>
                      <td className="px-4 py-3 text-slate-200">{row.step}</td>
                      <td className="px-4 py-3">
                        {row.source === "config" && row.details ? (
                          <Button variant="ghost" onClick={openConfigDetails}>
                            <Eye className="h-4 w-4" />
                            <span className="ml-2">Details</span>
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            className="border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20"
                            onClick={async () => {
                              setPage("trace");
                              setTraceId(row.parcelIds?.[0] ?? row.fileId);
                              await runTrace(row.parcelIds?.[0] ?? row.fileId);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                            <span className="ml-2">Trace</span>
                          </Button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {formatTime(row.createdAt)}
                      </td>
                    </tr>
                  ))}
                  {filteredAudits.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-slate-400" colSpan={6}>
                        {historyLoading
                          ? "Loading..."
                          : (historyError ?? "No rows match your filters.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {page === "analytics" && configState && (
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  Config Analytics
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  Configuration changes are tracked separately with their own
                  change IDs.
                </p>
              </div>
              <Button variant="secondary" onClick={() => void seedData()}>
                Seed data
              </Button>
            </div>
            <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Change ID</th>
                    <th className="px-4 py-3">Version</th>
                    <th className="px-4 py-3">Checksum</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {configState.versions.map((version) => (
                    <tr
                      key={version.changeId}
                      className="border-t border-white/5"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-emerald-300">
                        {version.changeId}
                      </td>
                      <td className="px-4 py-3 text-slate-200">
                        {version.version}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">
                        {version.checksum}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {formatTime(version.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {page === "rules" && profile.role === "admin" && (
          <Card>
            <h2 className="text-2xl font-semibold text-white">
              Config Manager
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Upload updated routing rules as JSON. Validate first, then apply.
            </p>
            <textarea
              value={configText}
              onChange={(event) => setConfigText(event.target.value)}
              className="mt-4 min-h-72 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 font-mono text-sm text-slate-100 outline-none focus:border-emerald-400"
            />
            <div className="mt-3 flex gap-3">
              <Button onClick={() => void uploadConfig("/api/config/validate")}>
                Validate Config
              </Button>
              <Button
                variant="secondary"
                onClick={() => void uploadConfig("/api/config/apply")}
              >
                Apply Config
              </Button>
            </div>
          </Card>
        )}

        {page === "trace" && (
          <Card>
            <h2 className="text-2xl font-semibold text-white">Trace</h2>
            <p className="mt-2 text-sm text-slate-300">
              Trace a parcel or file ID from analytics or directly from here.
            </p>
            <div className="mt-4 flex gap-3">
              <input
                value={traceId}
                onChange={(event) => setTraceId(event.target.value)}
                placeholder="Parcel ID or file ID"
                className="flex-1 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-emerald-400"
              />
              <Button onClick={() => void runTrace()}>Trace</Button>
            </div>
            <div className="mt-4 flex gap-3">
              <Button
                variant="secondary"
                onClick={async () => {
                  if (!traceData) return;
                  await copyAndToast(JSON.stringify(traceData, null, 2));
                }}
                disabled={!traceData}
              >
                <Copy className="h-4 w-4" />
                <span className="ml-2">Copy data</span>
              </Button>
            </div>
            <pre className="mt-4 max-h-[28rem] overflow-auto rounded-2xl border border-white/10 bg-slate-950 p-4 text-xs leading-6 text-slate-200">
              {traceData
                ? JSON.stringify(traceData, null, 2)
                : "Trace result will appear here."}
            </pre>
          </Card>
        )}

        {page === "seed" && (
          <Card>
            <h2 className="text-2xl font-semibold text-white">Seed Data</h2>
            <p className="mt-2 text-sm text-slate-300">
              Reset the backend database and reseed auth, config, parcel, and
              batch data.
            </p>
            <div className="mt-4 flex gap-3">
              <Button onClick={() => void seedData()}>Seed backend data</Button>
            </div>
          </Card>
        )}
      </section>

      {modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-white">
                {modalData.title}
              </h3>
              <Button variant="ghost" onClick={() => setModalData(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <pre className="mt-4 max-h-[60vh] overflow-auto rounded-2xl border border-white/10 bg-slate-900 p-4 text-xs leading-6 text-slate-200">
              {JSON.stringify(modalData.data, null, 2)}
            </pre>
            <div className="mt-4 flex gap-3">
              <Button
                onClick={async () => {
                  await copyAndToast(JSON.stringify(modalData.data, null, 2));
                }}
              >
                <Copy className="h-4 w-4" />
                <span className="ml-2">Copy data</span>
              </Button>
              <Button variant="secondary" onClick={() => setModalData(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [profile, setProfile] = useStoredProfile();
  const [view, setView] = useState<View>(() =>
    profile ? "dashboard" : "landing",
  );
  useEffect(() => {
    const handler = () => {
      const hash = window.location.hash.replace("#", "") as View;
      if (hash && ["landing", "login", "docs", "dashboard"].includes(hash))
        setView(hash);
    };
    handler();
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const go = (next: View) => {
    setView(next);
    window.location.hash = next;
  };
  const login = async (form: LoginForm, mode: AuthMode) => {
    const endpoint =
      mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const user = await api<UserProfile>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        mode === "login"
          ? { email: form.email, password: form.password }
          : form,
      ),
    });
    setProfile(user);
    toast.success(mode === "login" ? "Logged in" : "Registered and logged in");
    go("dashboard");
  };
  const logout = () => {
    setProfile(null);
    toast.success("Logged out");
    go("login");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <Toaster richColors position="bottom-center" closeButton />
      <SiteHeader
        profile={profile}
        onHome={() => go("landing")}
        onLogin={() => go("login")}
        onDocs={() => go("docs")}
        onDashboard={() => go(profile ? "dashboard" : "login")}
        onLogout={logout}
      />
      {view === "landing" && (
        <LandingPage
          profile={profile}
          onGoLogin={() => go("login")}
          onGoDocs={() => go("docs")}
          onGoDashboard={() => go(profile ? "dashboard" : "login")}
        />
      )}
      {view === "login" && <LoginPage onLogin={login} />}
      {view === "docs" && <DocsPage />}
      {view === "dashboard" && profile && (
        <Dashboard profile={profile} onLogout={logout} />
      )}
      {!profile && view === "dashboard" && <LoginPage onLogin={login} />}
    </div>
  );
}

export default App;
