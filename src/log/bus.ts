import type { LogEntry } from "../types.ts";

type Subscriber = {
  enqueue: (entry: LogEntry) => void;
  wake: () => void;
};

export class LogBus {
  private subscribers = new Set<Subscriber>();
  private buffer: LogEntry[] = [];
  private closed = false;

  constructor(private readonly bufferSize = 5000) {}

  emit(entry: LogEntry): void {
    if (this.closed) return;
    this.buffer.push(entry);
    if (this.buffer.length > this.bufferSize) this.buffer.shift();
    for (const sub of this.subscribers) sub.enqueue(entry);
  }

  system(service: string, line: string): void {
    this.emit({ service, stream: "system", line, timestamp: new Date() });
  }

  history(): LogEntry[] {
    return [...this.buffer];
  }

  async *subscribe(): AsyncGenerator<LogEntry> {
    const queue: LogEntry[] = [];
    let notify: (() => void) | null = null;

    const sub: Subscriber = {
      enqueue: (entry) => {
        queue.push(entry);
        notify?.();
      },
      wake: () => notify?.(),
    };
    this.subscribers.add(sub);

    try {
      while (true) {
        if (queue.length === 0) {
          if (this.closed) break;
          await new Promise<void>((resolve) => {
            notify = resolve;
          });
          notify = null;
          continue;
        }
        yield queue.shift()!;
      }
    } finally {
      this.subscribers.delete(sub);
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;

    for (const sub of this.subscribers) sub.wake();
  }
}
