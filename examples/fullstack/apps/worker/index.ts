console.log("worker: connected to queue");

let job = 4820;
setInterval(() => {
  job += 1;
  console.log(`worker: processing job #${job}`);
}, 1500);
