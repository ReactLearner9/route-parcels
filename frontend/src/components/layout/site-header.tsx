import { APP_NAME } from '@/lib/app-meta';
import { Button } from '@/components/ui/button';
import { Home, LogOut, UserCircle2, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type HeaderNavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  badgeCount?: number;
};

type SiteHeaderProps = {
  profile: { name: string; role: string } | null;
  onHome: () => void;
  onLogin: () => void;
  onLogout: () => void;
  navItems?: HeaderNavItem[];
  activeNavKey?: string;
  onNavigate?: (key: string) => void;
};

export function SiteHeader({
  profile,
  onHome,
  onLogin,
  onLogout,
  navItems = [],
  activeNavKey,
  onNavigate,
}: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const roleBadgeClass =
    profile?.role === 'admin'
      ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
      : 'border-sky-400/30 bg-sky-400/10 text-sky-200';

  return (
    <header className="sticky top-0 z-30 border-b border-white/8 bg-slate-950/70 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <button className="flex items-center gap-3 text-left" onClick={onHome} type="button">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 shadow-lg shadow-emerald-950/20">
              <Home className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.34em] text-emerald-300">{APP_NAME}</p>
              <p className="text-xs text-slate-400">Routing parcels with traceable decisions</p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            {!profile ? (
              <Button variant="ghost" onClick={onLogin}>Login</Button>
            ) : (
              <div className="relative" ref={menuRef}>
                <Button
                  variant="ghost"
                  className="rounded-full px-1.5 py-1.5 text-slate-100 hover:bg-transparent"
                  onClick={() => setMenuOpen((current) => !current)}
                  aria-label="Open account menu"
                >
                  <UserCircle2 className="h-7 w-7 text-emerald-300" />
                </Button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/35 backdrop-blur-xl">
                    <div className="px-4 py-3 text-sm font-semibold text-white">
                      {profile.name}
                    </div>
                    <div className="border-t border-white/10 px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${roleBadgeClass}`}
                      >
                        {profile.role}
                      </span>
                    </div>
                    <button className="flex w-full items-center gap-3 border-t border-white/10 px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-white/5" onClick={() => { setMenuOpen(false); onLogout(); }}>
                      <LogOut className="h-4 w-4 text-emerald-300" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {profile && navItems.length > 0 && onNavigate ? (
          <div className="overflow-x-auto">
            <nav className="inline-flex min-w-full items-center gap-2 rounded-3xl border border-white/10 bg-white/4 p-2">
              {navItems.map(({ key, label, icon: Icon, badgeCount }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onNavigate(key)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    activeNavKey === key
                      ? 'bg-white text-slate-950 shadow-lg shadow-black/15'
                      : 'text-slate-300 hover:bg-white/6 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                  {typeof badgeCount === "number" && badgeCount > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 py-0.5 text-[11px] font-bold text-slate-950">
                      {badgeCount}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        ) : null}
      </div>
    </header>
  );
}
