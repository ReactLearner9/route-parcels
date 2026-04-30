import { useEffect, useState } from "react";
import {
  BadgeCheck,
  BellRing,
  FileText,
  FileUp,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { SiteHeader } from "@/components/layout/site-header";
import { LandingPage } from "@/features/landing/landing-page";
import { LoginPage } from "@/features/auth/login-page";
import { Dashboard } from "@/features/dashboard/dashboard";
import { useStoredProfile } from "@/hooks/use-stored-profile";
import { api } from "@/lib/api";
import type {
  AlertUnreadCountResponse,
  AuthMode,
  DashboardNavItem,
  DashboardPage,
  LoginForm,
  UserProfile,
  View,
} from "@/features/app/types";

function getHeaderNavItems(
  view: View,
  profile: UserProfile | null,
  alertUnreadCount: number,
): DashboardNavItem[] {
  if (view !== "dashboard" || !profile) return [];

  return profile.role === "admin"
    ? [
        { key: "analytics", label: "Analytics", icon: Search },
        { key: "rules", label: "Config", icon: ShieldCheck },
        { key: "seed", label: "Seed", icon: FileText },
        {
          key: "alerts",
          label: "Alerts",
          icon: BellRing,
          badgeCount: alertUnreadCount,
        },
      ]
    : [
        { key: "single", label: "Single", icon: BadgeCheck },
        { key: "batch", label: "Batch", icon: FileUp },
        { key: "analytics", label: "Analytics", icon: Search },
        { key: "seed", label: "Seed", icon: FileText },
        {
          key: "alerts",
          label: "Alerts",
          icon: BellRing,
          badgeCount: alertUnreadCount,
        },
      ];
}

export default function App() {
  const [view, setView] = useState<View>("landing");
  const [profile, setProfile] = useStoredProfile();
  const [headerDashboardPage, setHeaderDashboardPage] = useState<DashboardPage>(
    profile?.role === "admin" ? "analytics" : "single",
  );
  const [alertUnreadCount, setAlertUnreadCount] = useState(0);
  const headerNavItems = getHeaderNavItems(view, profile, alertUnreadCount);
  const [lastAlertToastAt, setLastAlertToastAt] = useState(0);

  useEffect(() => {
    if (!profile) return;
    setHeaderDashboardPage(profile.role === "admin" ? "analytics" : "single");
  }, [profile?.role]);

  useEffect(() => {
    if (!profile || view !== "dashboard") {
      setAlertUnreadCount(0);
      setLastAlertToastAt(0);
      return;
    }

    let active = true;

    const loadUnreadAlerts = async () => {
      try {
        const response = await api<AlertUnreadCountResponse>(
          "/api/alerts/unread-count",
        );
        if (!active) return;
        setAlertUnreadCount(response.unreadCount);
        const now = Date.now();
        if (
          response.unreadCount > 0 &&
          now - lastAlertToastAt >= 5 * 60 * 1000
        ) {
          toast.warning(
            `${response.unreadCount} alert${response.unreadCount === 1 ? "" : "s"} pending review`,
          );
          setLastAlertToastAt(now);
        }
      } catch {
        if (!active) return;
        setAlertUnreadCount(0);
      }
    };

    void loadUnreadAlerts();
    const intervalId = window.setInterval(() => {
      void loadUnreadAlerts();
    }, 60 * 1000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [lastAlertToastAt, profile?.id, view]);

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
      {view === "dashboard" && profile && (
        <Dashboard
          profile={profile}
          page={headerDashboardPage}
          onPageChange={setHeaderDashboardPage}
          onAlertUnreadCountChange={setAlertUnreadCount}
        />
      )}
    </div>
  );
}
