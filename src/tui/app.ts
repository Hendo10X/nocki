import type { Orchestrator } from "../core/orchestrator.ts";
import type { LogEntry, ProcessEntry, ServiceStatus } from "../types.ts";
import { BOLD, DIM, FG, RESET, colorize } from "../util/colors.ts";

const STATUS_SYMBOL: Record<ServiceStatus, { symbol: string; color: string; label: string }> = {
  pending: { symbol: "○", color: FG.grey, label: "pending" },
  starting: { symbol: "◐", color: FG.yellow, label: "starting" },
  healthy: { symbol: "●", color: FG.green, label: "healthy" },
  crashed: { symbol: "●", color: FG.red, label: "crashed" },
  degraded: { symbol: "◌", color: FG.grey, label: "degraded" },
  stopped: { symbol: "—", color: FG.grey, label: "stopped" },
};

const SIDEBAR_WIDTH = 18;

type Mode = "unified" | "focus" | "search";

export class Tui {
  private logs: LogEntry[] = [];
  private selected = 0;
  private mode: Mode = "unified";
  private focusService: string | null = null;
  private searchTerm = "";
  private searchInput = "";
  private running = false;
  private renderQueued = false;
  private unsubscribe: (() => void) | null = null;
  private serviceNames: string[];
  private resolveExit: (() => void) | null = null;

  constructor(private readonly orch: Orchestrator) {
    this.serviceNames = orch.entries().map((e) => e.service.name);
    this.logs = orch.bus.history();
  }

  async run(): Promise<void> {
    this.running = true;
    this.enterAltScreen();
    this.unsubscribe = this.orch.onChange(() => this.scheduleRender());

    void (async () => {
      for await (const entry of this.orch.bus.subscribe()) {
        if (!entry.service && !entry.line) continue;
        this.logs.push(entry);
        if (this.logs.length > 10_000) this.logs.shift();
        this.scheduleRender();
      }
    })();

    this.setupInput();
    this.render();

    await new Promise<void>((resolve) => {
      this.resolveExit = resolve;
    });
  }

  private setupInput(): void {
    const stdin = process.stdin;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.on("data", (key: string) => this.onKey(key));
  }

  private onKey(key: string): void {
    if (this.mode === "search") {
      this.onSearchKey(key);
      return;
    }

    const current = () => this.serviceNames[this.selected];

    switch (key) {
      case "\x03":
      case "q":
        void this.quit();
        return;
      case "\x1b[A":
        this.selected = Math.max(0, this.selected - 1);
        this.scheduleRender();
        return;
      case "\x1b[B":
        this.selected = Math.min(this.serviceNames.length - 1, this.selected + 1);
        this.scheduleRender();
        return;
      case "\r":
      case "\n":
        this.mode = "focus";
        this.focusService = current();
        this.scheduleRender();
        return;
      case "\x1b":
        this.mode = "unified";
        this.focusService = null;
        this.searchTerm = "";
        this.scheduleRender();
        return;
      case "r":
        void this.orch.restart(current()).catch(() => {});
        return;
      case "k":
        void this.orch.kill(current()).catch(() => {});
        return;
      case "f":
        if (this.focusService === current() && this.mode === "focus") {
          this.mode = "unified";
          this.focusService = null;
        } else {
          this.mode = "focus";
          this.focusService = current();
        }
        this.scheduleRender();
        return;
      case "/":
        this.mode = "search";
        this.searchInput = "";
        this.scheduleRender();
        return;
    }
  }

  private onSearchKey(key: string): void {
    switch (key) {
      case "\x03":
        void this.quit();
        return;
      case "\x1b":
        this.mode = "unified";
        this.searchInput = "";
        this.scheduleRender();
        return;
      case "\r":
      case "\n":
        this.searchTerm = this.searchInput;
        this.mode = "unified";
        this.scheduleRender();
        return;
      case "\x7f":
      case "\b":
        this.searchInput = this.searchInput.slice(0, -1);
        this.scheduleRender();
        return;
      default:
        if (key >= " " && key.length === 1) {
          this.searchInput += key;
          this.scheduleRender();
        }
    }
  }

  private async quit(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    this.unsubscribe?.();
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
    this.leaveAltScreen();
    process.stdout.write("Stopping services...\n");
    await this.orch.stopAll();
    this.resolveExit?.();
  }

  private scheduleRender(): void {
    if (this.renderQueued || !this.running) return;
    this.renderQueued = true;
    queueMicrotask(() => {
      this.renderQueued = false;
      if (this.running) this.render();
    });
  }

  private render(): void {
    const { columns, rows } = this.dimensions();
    const lines: string[] = [];

    lines.push(this.renderHeader(columns));
    lines.push(this.renderDivider(columns));

    const bodyRows = Math.max(1, rows - 4);
    const logWidth = columns - SIDEBAR_WIDTH - 3;
    const sidebar = this.renderSidebar(bodyRows);
    const logPane = this.renderLogPane(bodyRows, logWidth);

    for (let i = 0; i < bodyRows; i++) {
      const left = padVisible(sidebar[i] ?? "", SIDEBAR_WIDTH);
      const right = logPane[i] ?? "";
      lines.push(`${left}${colorize(FG.grey, "│")} ${right}`);
    }

    lines.push(this.renderDivider(columns));
    lines.push(this.renderFooter(columns));

    process.stdout.write("\x1b[H" + lines.join("\r\n") + "\x1b[J");
  }

  private renderHeader(columns: number): string {
    const title = `${BOLD}${colorize(FG.cyan, "nocki")}${RESET}`;
    const modeLabel =
      this.mode === "focus" && this.focusService
        ? `focus:${this.focusService}`
        : this.searchTerm
          ? `search:"${this.searchTerm}"`
          : "all";
    const right = `${DIM}${modeLabel}   ↑↓ navigate  enter focus  q quit${RESET}`;
    const used = stripAnsi(title).length + stripAnsi(right).length;
    const gap = Math.max(1, columns - used);
    return `${title}${" ".repeat(gap)}${right}`;
  }

  private renderSidebar(bodyRows: number): string[] {
    const out: string[] = [];
    const entries = this.orch.entries();
    for (let i = 0; i < entries.length && i < bodyRows; i++) {
      out.push(this.renderServiceRow(entries[i], i === this.selected));
    }
    return out;
  }

  private renderServiceRow(entry: ProcessEntry, selected: boolean): string {
    const status = this.orch.effectiveStatus(entry);
    const { symbol, color } = STATUS_SYMBOL[status];
    const name = entry.service.name;
    const svcColor = this.orch.colors.get(name) ?? FG.white;
    const marker = selected ? `${BOLD}›${RESET}` : " ";
    const restarts = entry.restarts > 0 ? ` ${DIM}↻${entry.restarts}${RESET}` : "";
    const label = selected
      ? `${BOLD}${colorize(svcColor, name)}${RESET}`
      : colorize(svcColor, name);
    return `${marker}${colorize(color, symbol)} ${label}${restarts}`;
  }

  private renderLogPane(bodyRows: number, width: number): string[] {
    let visible = this.logs;

    if (this.mode === "focus" && this.focusService) {
      visible = visible.filter((l) => l.service === this.focusService);
    }
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      visible = visible.filter((l) => l.line.toLowerCase().includes(term));
    }

    const slice = visible.slice(-bodyRows);
    return slice.map((entry) => this.formatLogLine(entry, width));
  }

  private formatLogLine(entry: LogEntry, width: number): string {
    const svcColor = this.orch.colors.get(entry.service) ?? FG.white;
    const tag = entry.service ? `${colorize(svcColor, `[${entry.service}]`)} ` : "";
    let line = entry.line;
    if (entry.stream === "stderr") line = colorize(FG.red, line);
    if (entry.stream === "system") line = `${DIM}${line}${RESET}`;

    const prefixLen = entry.service ? entry.service.length + 3 : 0;
    const maxLine = Math.max(10, width - prefixLen);
    return `${tag}${truncateVisible(line, maxLine)}`;
  }

  private renderFooter(columns: number): string {
    if (this.mode === "search") {
      return `${colorize(FG.cyan, "/")}${this.searchInput}${colorize(FG.grey, "▌")}  ${DIM}(enter to apply, esc to cancel)${RESET}`;
    }
    const keys = "r restart  k kill  f filter  / search  enter focus  esc back  q quit";
    return truncateVisible(`${DIM}${keys}${RESET}`, columns);
  }

  private renderDivider(columns: number): string {
    return colorize(FG.grey, "─".repeat(Math.max(1, columns)));
  }

  private dimensions(): { columns: number; rows: number } {
    return {
      columns: process.stdout.columns ?? 100,
      rows: process.stdout.rows ?? 30,
    };
  }

  private enterAltScreen(): void {
    process.stdout.write("\x1b[?1049h\x1b[?25l\x1b[2J\x1b[H");
  }

  private leaveAltScreen(): void {
    process.stdout.write("\x1b[?25h\x1b[?1049l");
  }
}

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

function visibleLength(s: string): number {
  return stripAnsi(s).length;
}

function padVisible(s: string, width: number): string {
  const len = visibleLength(s);
  return len >= width ? s : s + " ".repeat(width - len);
}

function truncateVisible(s: string, max: number): string {
  if (visibleLength(s) <= max) return s;
  let visible = 0;
  let out = "";
  let i = 0;
  while (i < s.length && visible < max - 1) {
    if (s[i] === "\x1b") {
      const match = /^\x1b\[[0-9;]*m/.exec(s.slice(i));
      if (match) {
        out += match[0];
        i += match[0].length;
        continue;
      }
    }
    out += s[i];
    visible++;
    i++;
  }
  return out + "…" + RESET;
}
