import { expect, test, describe } from "bun:test";
import { parseDuration, formatDuration, DurationError } from "../src/util/duration.ts";

describe("parseDuration", () => {
  test("parses unit suffixes", () => {
    expect(parseDuration("500ms")).toBe(500);
    expect(parseDuration("10s")).toBe(10_000);
    expect(parseDuration("2m")).toBe(120_000);
    expect(parseDuration("1h")).toBe(3_600_000);
  });

  test("treats bare strings and numbers as seconds", () => {
    expect(parseDuration("30")).toBe(30_000);
    expect(parseDuration(30)).toBe(30_000);
  });

  test("allows whitespace and decimals", () => {
    expect(parseDuration("1.5s")).toBe(1500);
    expect(parseDuration("  250 ms ")).toBe(250);
  });

  test("rejects garbage", () => {
    expect(() => parseDuration("soon")).toThrow(DurationError);
    expect(() => parseDuration("10x")).toThrow(DurationError);
    expect(() => parseDuration(-5)).toThrow(DurationError);
  });
});

describe("formatDuration", () => {
  test("formats by magnitude", () => {
    expect(formatDuration(350)).toBe("350ms");
    expect(formatDuration(1500)).toBe("1.5s");
    expect(formatDuration(90_000)).toBe("1.5m");
  });
});
