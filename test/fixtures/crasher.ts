const liveMs = Number(process.env.LIVE_MS ?? 200);
const exitCode = Number(process.env.EXIT_CODE ?? 1);

console.log("crasher: up");
await Bun.sleep(liveMs);
console.log(`crasher: exiting ${exitCode}`);
process.exit(exitCode);

export {};
