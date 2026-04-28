import { APP_NAME } from '@/lib/app-meta';
import { Button } from '@/components/ui/button';
import { BookOpenText, ChevronDown, Home, LogOut, UserCircle2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type SiteHeaderProps = {
  profile: { name: string; role: string } | null;
  onHome: () => void;
  onLogin: () => void;
  onDocs: () => void;
  onDashboard: () => void;
  onLogout: () => void;
};

export function SiteHeader({ profile, onHome, onLogin, onDocs, onDashboard, onLogout }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };

    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-emerald-400/15 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <button className="flex items-center gap-3 text-left" onClick={onHome} type="button">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
            <Home className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-300">{APP_NAME}</p>
            <p className="text-xs text-slate-400">Parcel routing dashboard.</p>
          </div>
        </button>

        <div className="flex items-center gap-3">
          {!profile ? (
            <>
              <Button variant="ghost" onClick={onLogin}>Login</Button>
              <Button variant="secondary" onClick={onDocs}>
                <BookOpenText className="h-4 w-4" />
                <span className="ml-2">Docs</span>
              </Button>
            </>
          ) : (
            <div className="relative" ref={menuRef}>
              <Button variant="ghost" onClick={() => setMenuOpen((value) => !value)}>
                <UserCircle2 className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">{profile.name}</span>
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
                  <button className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-200 hover:bg-white/5" onClick={() => { setMenuOpen(false); onDashboard(); }}>
                    <UserCircle2 className="h-4 w-4 text-emerald-300" />
                    Profile
                  </button>
                  <button className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-200 hover:bg-white/5" onClick={() => { setMenuOpen(false); onLogout(); }}>
                    <LogOut className="h-4 w-4 text-emerald-300" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
