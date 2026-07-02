import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  WorkflowSquare01Icon,
  Activity03Icon,
  RefreshIcon,
  TerminalIcon,
  ArrowRight01Icon,
  GithubIcon,
} from "@hugeicons/core-free-icons";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { BootTerminal } from "@/components/boot-terminal";
import { InstallCommand } from "@/components/install-command";
import { DownloadButtons } from "@/components/download-buttons";
import { CodeBlock } from "@/components/code-block";
import { StatusDot } from "@/components/status-dot";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { site } from "@/lib/site";

const FEATURES = [
  {
    icon: WorkflowSquare01Icon,
    title: "Boot ordering",
    body: "Declare depends_on once. nocki builds a dependency graph, detects cycles, and starts services in the right order — parallelising what it can.",
  },
  {
    icon: Activity03Icon,
    title: "Health-gated startup",
    body: "HTTP, TCP, or command health checks. A service isn't “up” until it's actually ready, and dependents wait for it.",
  },
  {
    icon: RefreshIcon,
    title: "Supervision & recovery",
    body: "Restart policies with a rolling ceiling. When a service gives up, every dependent is flagged degraded with the root cause.",
  },
  {
    icon: TerminalIcon,
    title: "Unified logs",
    body: "Every service's output in one colour-coded stream — filter, search, and focus, all from a clean terminal UI.",
  },
];

const CONFIG = `version: 1

services:
  cache:
    cmd: redis-server
    health_check:
      tcp: 6379

  api:
    cmd: bun run dev
    depends_on: [cache]
    health_check:
      http: http://localhost:3001/health
    restart:
      policy: on-failure

  web:
    cmd: bun run dev
    depends_on: [api]`;

const COMMANDS = `nocki start          # boot everything, in dependency order
nocki status         # health of every service
nocki restart api    # restart one service
nocki logs web -f    # follow a single service's logs`;

export default function Home() {
  return (
    <div className="relative min-h-dvh">
      {/* backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-grid opacity-60 [mask-image:radial-gradient(70%_50%_at_50%_0%,black,transparent)]" />
        <div className="absolute inset-x-0 top-0 h-[520px] glow" />
      </div>

      <SiteNav />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-5 pt-16 pb-10 sm:pt-24">
        <div className="mx-auto max-w-2xl text-center">
          <Link
            href={site.releases}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 font-mono text-xs text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
          >
            <StatusDot status="healthy" />
            {site.version} — self-contained binary, no runtime
          </Link>

          <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">
            Your development environment should{" "}
            <span className="text-healthy">start itself.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
            nocki is a local process orchestrator. Describe your services once —
            it handles boot ordering, health checks, supervision, and unified
            logs, all in your terminal.
          </p>

          <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-3">
            <InstallCommand command={site.install} className="w-full" />
            <div className="flex items-center gap-3">
              <Link
                href="/docs"
                className={cn(buttonVariants({ size: "lg" }), "h-11 px-5 text-sm font-medium")}
              >
                Get started
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} strokeWidth={2} />
              </Link>
              <a
                href={site.repo}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-5 text-sm")}
              >
                <HugeiconsIcon icon={GithubIcon} size={18} strokeWidth={1.8} />
                GitHub
              </a>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-14 max-w-3xl">
          <BootTerminal />
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-healthy">What it does</p>
        <h2 className="mt-3 max-w-lg font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          One file replaces the startup ritual.
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-background p-6 sm:p-8">
              <div className="grid size-10 place-items-center rounded-lg border border-border bg-card text-healthy">
                <HugeiconsIcon icon={f.icon} size={20} strokeWidth={1.8} />
              </div>
              <h3 className="mt-4 font-display text-lg font-medium">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Config */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
          <div className="lg:sticky lg:top-24">
            <p className="font-mono text-xs uppercase tracking-widest text-healthy">nocki.yaml</p>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Committed, version-controlled, obvious.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              A single file at your project root describes every service and how
              they relate. New teammates run one command and get a working
              environment — no tribal knowledge, no boot-order bugs.
            </p>
            <div className="mt-6">
              <CodeBlock code={COMMANDS} lang="bash" filename="terminal" />
            </div>
          </div>
          <CodeBlock code={CONFIG} lang="yaml" filename="nocki.yaml" />
        </div>
      </section>

      {/* Download */}
      <section id="download" className="mx-auto max-w-5xl px-5 py-16">
        <div className="rounded-3xl border border-border bg-card/40 p-8 ring-top sm:p-12">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Install nocki
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              One command, or grab the binary for your platform. macOS and Linux;
              Windows via WSL2.
            </p>
          </div>
          <div className="mx-auto mt-8 max-w-md">
            <InstallCommand command={site.install} />
          </div>
          <div className="mx-auto mt-8 max-w-xl">
            <DownloadButtons />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
