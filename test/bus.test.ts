import { expect, test, describe } from "bun:test";
import { LogBus } from "../src/log/bus.ts";

describe("LogBus", () => {
  test("delivers emitted entries to a subscriber", async () => {
    const bus = new LogBus();
    const received: string[] = [];

    const consumer = (async () => {
      for await (const entry of bus.subscribe()) received.push(entry.line);
    })();

    bus.system("api", "one");
    bus.system("api", "two");

    await Bun.sleep(10);
    bus.close();
    await consumer;

    expect(received).toEqual(["one", "two"]);
  });

  test("keeps a bounded history for late subscribers", () => {
    const bus = new LogBus(3);
    for (const line of ["a", "b", "c", "d"]) bus.system("svc", line);
    expect(bus.history().map((e) => e.line)).toEqual(["b", "c", "d"]);
  });

  test("close ends iteration", async () => {
    const bus = new LogBus();
    const consumer = (async () => {
      let count = 0;
      for await (const _ of bus.subscribe()) count++;
      return count;
    })();
    bus.system("a", "x");
    await Bun.sleep(5);
    bus.close();
    expect(await consumer).toBe(1);
  });
});
