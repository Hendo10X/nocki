const port = Number(process.env.PORT ?? 6399);

Bun.listen({
  hostname: "localhost",
  port,
  socket: {
    open(socket) {
      socket.write("PONG\n");
      socket.end();
    },
    data() {},
    error() {},
  },
});

console.log(`cache: accepting connections on tcp localhost:${port}`);

setInterval(() => {}, 1 << 30);
