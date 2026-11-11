import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SmokeLedger, smokeBound, smokeKey } from "../../../scripts/lib/bottle-smoke-cache";
import { SAMPLE_RESULTS } from "@/lib/sample-results";

describe("bottle smoke durable budget and cache", () => {
  const file = () => path.join(mkdtempSync(path.join(os.tmpdir(), "sl-bottle-budget-")), "ledger.json");
  it("hashes actual crop bytes, model and prompt separately", () => {
    const a = smokeKey(Buffer.from("crop"), "sonnet", "prompt");
    expect(smokeKey(Buffer.from("crop"), "sonnet", "prompt")).toBe(a);
    expect(smokeKey(Buffer.from("other crop"), "sonnet", "prompt")).not.toBe(a);
    expect(smokeKey(Buffer.from("crop"), "other model", "prompt")).not.toBe(a);
    expect(smokeKey(Buffer.from("crop"), "sonnet", "new prompt")).not.toBe(a);
  });
  it("reserves both attempts before calls, logs both responses and reuses finished readings on retry", () => {
    const filename = file(), ledger = new SmokeLedger(filename); const bound = smokeBound(1000);
    expect(bound).toBeGreaterThan(2 * (1000 * 2 + 1200 * 10) / 1e6);
    ledger.reserve("crop", bound); ledger.usage("crop", "claude-sonnet-5-5", 1000, 1200); ledger.usage("crop", "claude-sonnet-5-5", 1000, 100);
    ledger.finish("crop", SAMPLE_RESULTS[0].result.pill);
    const retry = new SmokeLedger(filename); expect(retry.cached("crop")).toEqual(SAMPLE_RESULTS[0].result.pill); expect(retry.summary().responses).toBe(2); expect(retry.spent()).toBeCloseTo(.017);
  });
  it("retains incomplete reservations across crashes and refuses duplicate paid retry", () => {
    const filename = file(); const ledger = new SmokeLedger(filename); ledger.reserve("in-flight", .6);
    const retry = new SmokeLedger(filename); expect(() => retry.cached("in-flight")).toThrow("No automatic paid retry"); expect(() => retry.reserve("new", .5)).toThrow("before calling AI"); expect(retry.spent()).toBe(0);
  });
  it("fails closed on a corrupted persisted cap or counter", () => {
    const filename = file(); writeFileSync(filename, JSON.stringify({ version: 1, entries: [], budgetUsd: "bad" }));
    expect(() => new SmokeLedger(filename)).toThrow("refusing paid calls");
    writeFileSync(filename, JSON.stringify({ version: 1, entries: [{ key: "x", reserved: null, status: "pending", usage: [] }], budgetUsd: 1 }));
    expect(() => new SmokeLedger(filename)).toThrow("refusing paid calls");
  });
  it("never allows a cap above $1, treats unknown failures as reserved, and supports lower caps", () => {
    expect(() => new SmokeLedger(file(), 1.01)).toThrow("at most $1");
    const ledger = new SmokeLedger(file(), .1); ledger.reserve("x", .06); ledger.fail("x"); expect(() => ledger.reserve("y", .05)).toThrow("before calling AI");
  });
});
