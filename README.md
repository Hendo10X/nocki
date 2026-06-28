# nocki

**Your development environment should start itself.**

`nocki` is a CLI tool and process orchestrator purpose-built for local
development. Describe your services and their relationships once in a
`nocki.yaml`, and nocki handles boot ordering, health verification, process
supervision, crash recovery, and log aggregation — presenting everything
through a clean terminal UI.

It is **not** a production process manager, a container runtime, a deployment
tool, or a build system. It manages local processes, nothing more.

> Built on [Bun](https://bun.sh). The name is `nocki` (the package `mise` is
> already taken by the Rust version manager).

---

## Why

Modern apps are many services — a frontend, an API, workers, a cache, a
database. Today developers juggle terminal tabs, ad-hoc shell scripts, or
misuse `docker-compose`/PM2. The cost is invisible but compounding: startup
rituals, boot-order bugs, and onboarding friction.

nocki replaces all of that with one committed file and one command.

## Quick start

```sh
bun install
bun run src/index.ts init        # scaffold a nocki.yaml
bun run src/index.ts validate    # check it and print boot order
bun run src/index.ts start       # boot everything with the TUI
```

Build a single self-contained binary:

```sh
bun run build        # -> dist/nocki
./dist/nocki start
```

## Configuration: `nocki.yaml`

Lives at the project root and is committed to version control.

```yaml
version: 1
services:
  redis:
    cmd: redis-server
    port: 6379
    health_check:
      tcp: 6379
      timeout: 10s

  api:
    cmd: bun run dev
    cwd: ./apps/api
    depends_on: [redis]
    health_check:
      http: http://localhost:3001/health
      timeout: 30s
    restart:
      policy: on-failure
      max_attempts: 3
      window: 60s
    env:
      NODE_ENV: development

  worker:
    cmd: bun run worker
    cwd: ./apps/worker
    depends_on: [api]
    restart:
      policy: always

  web:
    cmd: bun run dev
    cwd: ./apps/web
    depends_on: [api]
```

### Health checks

| Type   | Description                                  | Example                            |
| ------ | -------------------------------------------- | ---------------------------------- |
| `http` | Poll an HTTP endpoint until 2xx              | `http: http://localhost:3001/health` |
| `tcp`  | Attempt a TCP socket connection              | `tcp: 6379`                        |
| `cmd`  | Run a shell command, pass on exit 0          | `cmd: redis-cli ping`              |
| `none` | No check — healthy on spawn (default)        | _(omit health_check)_              |

`timeout` and `interval` accept durations like `10s`, `500ms`, `2m`, `1h`
(bare numbers are seconds). Defaults: 30s timeout, 1s interval.

### Restart policies

| Policy       | Behavior                              |
| ------------ | ------------------------------------- |
| `always`     | Restart on any exit                   |
| `on-failure` | Restart only on non-zero exit code    |
| `never`      | Do not restart (default)              |

`max_attempts` and `window` define a **rolling restart ceiling**. If a service
exceeds `max_attempts` restarts within `window`, it is marked **degraded** and
restart attempts cease.

## How it works

The boot pipeline is a sequence of discrete modules with no shared mutable
state between them:

```
Config Parse → Graph Build → Cycle Detection → Topological Sort
            → Sequenced Boot → Health Watch → Supervision Loop
```

- **Dependency graph** — `depends_on` declarations form a DAG. A topological
  sort produces **boot levels**; services in the same level start in parallel.
- **Cycle detection** runs before the sort and fails fast with the exact cycle
  (`a → b → a`).
- **Sequenced boot** spawns a level, polls health checks, and blocks
  progression until every service in the level is healthy. If one fails, boot
  aborts and reports which downstream services were therefore not started.
- **Supervision** applies restart policies with the rolling ceiling.
- **Crash propagation** — when a service exhausts its restart ceiling, every
  service that transitively depends on it is marked degraded with the root
  cause (`worker degraded — upstream dependency api is unhealthy`). This is the
  behavior no other local-dev tool provides.
- **Log bus** — all stdout/stderr flows through a central async bus, rendered
  with per-service colors and persisted to `.nocki/logs/<session>/<service>.log`.

## Commands

| Command              | Description                                          |
| -------------------- | ---------------------------------------------------- |
| `nocki start`        | Start all services per `nocki.yaml`                  |
| `nocki start <svc>`  | Start a single service and its dependencies          |
| `nocki stop`         | Stop all running services                            |
| `nocki restart <svc>`| Restart a named service                              |
| `nocki status`       | Print status of all services (non-interactive)       |
| `nocki logs <svc>`   | Print/tail logs for a service (pipe-friendly)        |
| `nocki validate`     | Parse and validate `nocki.yaml` without starting     |
| `nocki init`         | Scaffold a `nocki.yaml` interactively                |

Useful flags: `-c/--config <path>`, `--no-tui` (stream logs to stdout),
`--ci` (headless; exit 1 if boot fails), `-f/--follow` (logs), `--json`
(status). `nocki status` exits `2` if any service is degraded or crashed, for
scripting.

`status`, `stop`, and `restart` talk to a running `nocki start` instance over a
Unix control socket at `.nocki/control.sock`.

## TUI

```
┌─────────────────────────────────────────────────────────────┐
│  nocki                              all  ↑↓ navigate  q quit  │
├──────────────┬──────────────────────────────────────────────┤
│ ›● redis     │  [redis]   Ready to accept connections        │
│  ● api       │  [api]     Server listening on port 3001      │
│  ● worker    │  [worker]  Connected to queue                 │
│  ◐ web       │  [web]     ▸ compiling...                     │
├──────────────┴──────────────────────────────────────────────┤
│  r restart  k kill  f filter  / search  enter focus  q quit  │
└─────────────────────────────────────────────────────────────┘
```

| Symbol      | Meaning                          |
| ----------- | -------------------------------- |
| `●` green   | Healthy                          |
| `◐` yellow  | Starting / awaiting health check |
| `●` red     | Crashed                          |
| `◌` grey    | Degraded (incl. upstream failure)|
| `—` grey    | Stopped                          |

Keys: `↑/↓` navigate · `enter` focus a service's logs · `esc` back to unified
view · `r` restart · `k` kill · `f` filter to selected service · `/` search ·
`q` quit (stops all services).

## Development

```sh
bun test            # unit tests for the pure pipeline (config, graph, durations, log bus)
bun run typecheck   # tsc --noEmit
```

### Project layout

```
src/
  index.ts            CLI entry + command dispatch
  types.ts            shared data model (PRD §4–5)
  config/parse.ts     YAML parse + validation
  graph/graph.ts      DAG build, cycle detection, topo sort, traversal
  health/check.ts     http / tcp / cmd / none probes + polling
  process/spawn.ts    Bun.spawn wrapper, stdout/stderr → log bus
  log/bus.ts          async pub/sub log bus
  log/persist.ts      per-session log file persistence
  core/orchestrator.ts boot sequencer + supervision + crash propagation
  control/            Unix-socket control server & client
  tui/app.ts          terminal UI
  cli/                one-shot command implementations
```

## Status

Implements the v0.1 core plus the v0.2 reliability features (health checks,
health-gated boot, restart policies, crash propagation) and several v0.3/v1.0
items (log persistence, search/filter, `init`, `validate`, `status`,
single-service start). Targets macOS/Linux; Windows via WSL2 is on the roadmap.

## License

MIT
