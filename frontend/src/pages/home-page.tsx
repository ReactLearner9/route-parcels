import AiUsageDoc from '../../docs/ai-usage.mdx';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { APP_NAME, APP_TAGLINE } from '@/lib/app-meta';

export function HomePage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950">
          <p className="text-sm uppercase tracking-[0.35em] text-sky-300">Full-Stack TypeScript</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{APP_NAME}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">{APP_TAGLINE}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button as="a" href="#docs">
              View AI Usage
            </Button>
            <Button variant="secondary" as="a" href="#project-structure">
              See Structure
            </Button>
          </div>
        </Card>

        <Card className="flex flex-col justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Stack Snapshot</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              <li>Backend: Node, Express, TypeScript, Zod, Pino, Multer</li>
              <li>Frontend: React, Vite, Tailwind, MDX, shadcn/ui starter</li>
              <li>Testing: Vitest and Supertest</li>
            </ul>
          </div>
        </Card>
      </section>

      <section id="project-structure" className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <h2 className="text-xl font-semibold">What this scaffold gives you</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            A clean starting point with a backend API, a frontend app, shared TypeScript conventions, and a
            documentation flow for AI prompts.
          </p>
        </Card>

        <Card id="docs">
          <h2 className="text-xl font-semibold">AI Usage</h2>
          <div className="mt-4 space-y-4 text-sm leading-6 text-slate-200">
            <AiUsageDoc />
          </div>
        </Card>
      </section>
    </main>
  );
}
