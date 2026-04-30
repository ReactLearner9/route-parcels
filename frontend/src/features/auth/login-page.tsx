import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AuthMode, LoginForm, Role } from "@/features/app/types";

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
        {revealed ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

export function LoginPage({
  onLogin,
}: {
  onLogin: (form: LoginForm, mode: AuthMode) => Promise<void>;
}) {
  const [form, setForm] = useState<LoginForm>({
    username: "",
    password: "",
    role: "",
  });
  const [mode, setMode] = useState<AuthMode>("login");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    role?: string;
    username?: string;
    password?: string;
  }>({});

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.14),transparent_30%),linear-gradient(160deg,rgba(8,17,15,0.96),rgba(15,23,42,0.88))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.28)] sm:p-8">
        <p className="text-xs uppercase tracking-[0.45em] text-emerald-300">
          Access
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
          {mode === "login"
            ? "Sign in and keep parcels moving."
            : "Create an account for your routing workspace."}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
          Use the same streamlined workspace for imports, validation, trace
          history, and configuration changes.
        </p>
      </section>
      <Card className="border-emerald-400/16">
        <p className="text-xs uppercase tracking-[0.45em] text-emerald-300">
          {mode === "login" ? "Login" : "Register"}
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-white">
          {mode === "login" ? "Welcome back" : "Set up your account"}
        </h2>
        <form
          className="mt-6 grid gap-3.5"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              setError(null);
              const nextFieldErrors: {
                role?: string;
                username?: string;
                password?: string;
              } = {};
              if (mode === "register" && !form.role) {
                nextFieldErrors.role = "Role is required";
              }
              if (!form.username.trim()) {
                nextFieldErrors.username = "Username is required";
              }
              if (!form.password.trim()) {
                nextFieldErrors.password = "Password is required";
              } else if (form.password.length <= 6) {
                nextFieldErrors.password =
                  "Password must be more than 6 characters";
              }
              setFieldErrors(nextFieldErrors);
              if (Object.keys(nextFieldErrors).length > 0) return;
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
            <div className="relative">
              <select
                className="w-full appearance-none rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 pr-10 text-sm outline-none focus:border-emerald-400"
                value={form.role}
                onChange={(event) => {
                  setFieldErrors((current) => ({
                    ...current,
                    role: undefined,
                  }));
                  setForm((current) => ({
                    ...current,
                    role: event.target.value as Role,
                  }));
                }}
              >
                <option value="" disabled>
                  Select role
                </option>
                <option value="operator">Operator</option>
                <option value="admin">Admin</option>
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                ▼
              </span>
            </div>
          )}
          {mode === "register" && fieldErrors.role && (
            <p className="-mt-2 text-sm text-rose-300">{fieldErrors.role}</p>
          )}
          <input
            className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-emerald-400"
            value={form.username}
            onChange={(event) => {
              setFieldErrors((current) => ({
                ...current,
                username: undefined,
              }));
              setForm((current) => ({
                ...current,
                username: event.target.value,
              }));
            }}
            placeholder="Username"
          />
          {fieldErrors.username && (
            <p className="-mt-2 text-sm text-rose-300">{fieldErrors.username}</p>
          )}
          <PasswordField
            value={form.password}
            onChange={(value) => {
              setFieldErrors((current) => ({
                ...current,
                password: undefined,
              }));
              setForm((current) => ({ ...current, password: value }));
            }}
          />
          {fieldErrors.password && (
            <p className="-mt-2 text-sm text-rose-300">{fieldErrors.password}</p>
          )}
          <div className="flex flex-wrap gap-3 pt-1">
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
