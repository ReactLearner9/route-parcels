import { APP_NAME } from '@/lib/app-meta';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-sky-300">{APP_NAME}</p>
          <p className="text-xs text-slate-400">Scaffold first, business logic later.</p>
        </div>
        <a className="text-sm text-slate-300 transition-colors hover:text-white" href="#docs">
          AI Usage Docs
        </a>
      </div>
    </header>
  );
}
