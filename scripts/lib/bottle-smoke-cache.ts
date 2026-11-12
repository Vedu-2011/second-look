import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PillReading, LabelReading } from "@/lib/verdict-engine";
import type { AiPillGroupReading } from "@/lib/ai/schemas";
type Reading = PillReading | LabelReading | AiPillGroupReading;

export const SONNET_INPUT_USD_PER_M = 2, SONNET_OUTPUT_USD_PER_M = 10;
export function smokeBound(inputTokens: number, maxOutputTokens = 1200) {
  if (!Number.isFinite(inputTokens) || inputTokens < 0) throw new Error("Invalid token count");
  // Reserve BOTH production attempts, max output incl reasoning, and substantial input headroom.
  return 2 * ((Math.ceil(inputTokens * 1.1) + 4096) * SONNET_INPUT_USD_PER_M + maxOutputTokens * SONNET_OUTPUT_USD_PER_M) / 1e6;
}
export function smokeKey(bytes: Buffer, model: string, prompt: string) {
  return createHash("sha256").update(bytes).update("\0" + model + "\0" + prompt).digest("hex");
}
type Usage = { inputTokens: number; outputTokens: number; model: string; usd: number };
type Entry = { key: string; reserved: number; status: "pending" | "done" | "failed"; usage: Usage[]; reading?: Reading };
type Ledger = { version: 1; budgetUsd: number; entries: Entry[] };

/** One process owns this ledger (caller holds a filesystem lock). Writes are synchronous and atomic. */
export class SmokeLedger {
  private ledger: Ledger;
  constructor(private file: string, budgetUsd = 1) {
    if (!(budgetUsd > 0 && budgetUsd <= 1)) throw new Error("Smoke budget must be greater than zero and at most $1.");
    mkdirSync(path.dirname(file), { recursive: true });
    try { this.ledger = JSON.parse(readFileSync(file, "utf8")); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Cannot read usage ledger; refusing paid calls."); this.ledger = { version: 1, budgetUsd, entries: [] }; }
    const nonnegative = (n: number) => Number.isFinite(n) && n >= 0;
    const invalid = this.ledger.version !== 1 || !Number.isFinite(this.ledger.budgetUsd) || this.ledger.budgetUsd <= 0 || this.ledger.budgetUsd > 1 || !Array.isArray(this.ledger.entries)
      || this.ledger.entries.some((e) => !e || typeof e.key !== "string" || !e.key || !Number.isFinite(e.reserved) || e.reserved <= 0 || !["pending", "done", "failed"].includes(e.status) || !Array.isArray(e.usage)
        || e.usage.some((u) => !u || u.model !== "claude-sonnet-5-5" || !nonnegative(u.inputTokens) || !nonnegative(u.outputTokens) || !nonnegative(u.usd) || Math.abs(u.usd - (u.inputTokens * 2 + u.outputTokens * 10) / 1e6) > 1e-10)
        || (e.status === "done" && !e.reading))
      || new Set(this.ledger.entries.map((e) => e.key)).size !== this.ledger.entries.length;
    if (invalid) throw new Error("Invalid usage ledger; refusing paid calls.");
    this.ledger.budgetUsd = Math.min(this.ledger.budgetUsd, budgetUsd);
  }
  private save() { const temp = this.file + ".tmp"; writeFileSync(temp, JSON.stringify(this.ledger, null, 2) + "\n"); renameSync(temp, this.file); }
  spent() { return this.ledger.entries.reduce((sum, e) => sum + e.usage.reduce((n, u) => n + u.usd, 0), 0); }
  committed() { return this.ledger.entries.reduce((sum, e) => sum + (e.status === "done" ? e.usage.reduce((n, u) => n + u.usd, 0) : e.reserved), 0); }
  cached(key: string) {
    const entry = this.ledger.entries.find((e) => e.key === key);
    if (entry && entry.status !== "done") throw new Error(`Crop ${key.slice(0, 12)} has an incomplete/failed reservation. No automatic paid retry; inspect ${this.file}.`);
    return entry?.reading;
  }
  /** Read-only lookup in an older ledger: only finished readings count. */
  done(key: string) { return this.ledger.entries.find((e) => e.key === key && e.status === "done")?.reading; }
  reserve(key: string, bound: number) {
    if (this.ledger.entries.some((e) => e.key === key)) throw new Error("Crop already reserved");
    if (!(bound > 0) || this.committed() + bound > this.ledger.budgetUsd) throw new Error("Stopped before calling AI: the conservative smoke budget would exceed $1 (or the configured lower cap).");
    this.ledger.entries.push({ key, reserved: bound, status: "pending", usage: [] }); this.save();
  }
  usage(key: string, model: string, inputTokens: number, outputTokens: number) {
    if (model !== "claude-sonnet-5-5") throw new Error("Unpriced smoke model");
    const entry = this.ledger.entries.find((e) => e.key === key); if (!entry || entry.status !== "pending") throw new Error("Usage without pending reservation");
    entry.usage.push({ model, inputTokens, outputTokens, usd: (inputTokens * 2 + outputTokens * 10) / 1e6 }); this.save();
    if (entry.usage.reduce((n, u) => n + u.usd, 0) > entry.reserved) throw new Error("AI response exceeded reserved bound; stop and inspect ledger.");
  }
  finish(key: string, reading: Reading) { const entry = this.ledger.entries.find((e) => e.key === key)!; entry.reading = reading; entry.status = "done"; this.save(); }
  fail(key: string) { const entry = this.ledger.entries.find((e) => e.key === key); if (entry) { entry.status = "failed"; this.save(); } }
  summary() { return { budgetUsd: this.ledger.budgetUsd, recordedSpendUsd: this.spent(), committedUsd: this.committed(), responses: this.ledger.entries.reduce((n, e) => n + e.usage.length, 0), uniqueReadings: this.ledger.entries.filter((e) => e.status === "done").length }; }
}
