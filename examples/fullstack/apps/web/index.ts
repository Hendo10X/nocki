const PORT = Number(process.env.PORT ?? 3000);

Bun.serve({
  port: PORT,
  fetch() {
    return new Response("<h1>web</h1>", {
      headers: { "content-type": "text/html" },
    });
  },
});

console.log(`web: dev server ready on http://localhost:${PORT}`);
