const port = Number(process.env.PORT ?? 0);
const readyDelayMs = Number(process.env.READY_DELAY_MS ?? 0);

if (readyDelayMs > 0) await Bun.sleep(readyDelayMs);

Bun.serve({
  port,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/health") return new Response("ok", { status: 200 });
    return new Response("root");
  },
});

console.log(`http-server: listening :${port} (NODE_ENV=${process.env.NODE_ENV ?? "?"})`);

export {};
