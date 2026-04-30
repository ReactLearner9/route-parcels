import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  FileUp,
  Home,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { APP_NAME } from "@/lib/app-meta";
import { api } from "@/lib/api";
import type { ParcelCountResponse, UserProfile } from "@/features/app/types";

export function LandingPage({
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
        const counts = await api<ParcelCountResponse>("/api/parcels/count");
        setStats({
          parcelsRouted: counts.parcelCount,
          filesImported: counts.batchCount,
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
          Import parcels, validate rule-driven data, and use built-in analytics
          from a polished routing dashboard.
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
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">
            Features
          </p>
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
      <section className="space-y-6 rounded-[2rem] border border-white/10 bg-slate-950/45 p-6 backdrop-blur-xl sm:p-7">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">
            Users
          </p>
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
      <section className="space-y-4 rounded-[2rem] border border-white/10 bg-slate-950/45 p-6 backdrop-blur-xl sm:p-7">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">
            Stack
          </p>
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
      <p className="mt-1 text-xs uppercase tracking-[0.25em] text-emerald-200">
        {label}
      </p>
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
          <li
            key={item}
            className="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-3"
          >
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
    { label: "React", src: "/tech-icons/react.svg", href: "https://react.dev/" },
    { label: "Vite", src: "/tech-icons/vite.svg", href: "https://vite.dev/" },
    {
      label: "Tailwind CSS",
      src: "/tech-icons/tailwindcss.svg",
      href: "https://tailwindcss.com/",
    },
    {
      label: "Express",
      src: "/tech-icons/express.svg",
      href: "https://expressjs.com/",
    },
    {
      label: "Node.js",
      src: "/tech-icons/nodedotjs.svg",
      href: "https://nodejs.org/",
    },
    {
      label: "JavaScript",
      src: "/tech-icons/javascript.svg",
      href: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
    },
    {
      label: "TypeScript",
      src: "/tech-icons/typescript.svg",
      href: "https://www.typescriptlang.org/",
    },
    { label: "Zod", src: "/tech-icons/zod.svg", href: "https://zod.dev/" },
    {
      label: "Lucide React",
      src: "/tech-icons/lucide.svg",
      href: "https://lucide.dev/",
    },
    { label: "Pino", src: "/tech-icons/pino.svg", href: "https://getpino.io/" },
    { label: "LowDB", src: "/tech-icons/json.svg", href: "https://github.com/typicode/lowdb" },
  ];
  const track = [...items, ...items];

  return (
    <div className="overflow-hidden px-6 py-6 sm:px-8">
      <div className="stack-marquee flex w-max gap-4 px-6 sm:px-8">
        {track.map((item, index) => (
          <a
            key={`${item.label}-${index}`}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-[15rem] items-center justify-center gap-4 rounded-3xl border border-white/10 bg-white/5 px-5 py-4"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-slate-950">
              <img
                src={item.src}
                alt={`${item.label} logo`}
                className="h-7 w-7 object-contain"
                loading="lazy"
              />
            </div>
            <p className="text-lg font-semibold text-white">{item.label}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
