console.log(`longrunner: up (${process.env.LABEL ?? "svc"})`);
setInterval(() => {}, 1 << 30);

export {};
