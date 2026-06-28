const port = Number(process.env.PORT ?? 0);

Bun.listen({
  hostname: "127.0.0.1",
  port,
  socket: {
    open(socket) {
      socket.write("ok\n");
      socket.end();
    },
    data() {},
    error() {},
  },
});

console.log(`tcp-listener: bound :${port}`);

setInterval(() => {}, 1 << 30);

export {};
