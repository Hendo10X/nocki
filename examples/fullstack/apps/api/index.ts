const PORT = Number(process.env.PORT ?? 3001);
const READY_DELAY_MS = Number(process.env.READY_DELAY_MS ?? 1500);

console.log(`api: booting (NODE_ENV=${process.env.NODE_ENV ?? "?"})`);

await Bun.sleep(READY_DELAY_MS);

const handler = {
  port: PORT,
  fetch(req: Request) {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }
    console.log(`api: ${req.method} ${url.pathname} 200`);
    return new Response("api root");
  },
};

// Real dev servers retry binding rather than crash if the port is briefly
// still held (e.g. just after a restart). Mirror that behavior here.
for (let attempt = 1; ; attempt++) {
  try {
    Bun.serve(handler);
    break;
  } catch (err) {
    if (attempt >= 20) throw err;
    console.log(`api: port ${PORT} busy, retrying...`);
    await Bun.sleep(250);
  }
}

console.log(`api: listening on http://localhost:${PORT}`);
