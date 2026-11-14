// Phase 12 live smoke (PAID: one label read + one 10-pill check, about $0.03). Take the PAID-API LOCK first.
// Reads the real label photo through /api/read-label, then checks the real pills through the label id (no label photo
// sent with the pills). Usage: node scripts/phase12-live.mjs <preview url> --paid
import fs from "node:fs/promises";
import {fileURLToPath} from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const [base] = process.argv.slice(2);
if (!base || !process.argv.includes("--paid")) { console.error("Usage: node scripts/phase12-live.mjs <preview url> --paid"); process.exit(1); }
const file = async (path, type) => new Blob([await fs.readFile(root + path)], {type});

const labelForm = new FormData(); labelForm.set("labelImage", await file("test-images/real/bottle/label.jpg", "image/jpeg"), "label.jpg");
const read = await fetch(base + "/api/read-label", {method: "POST", body: labelForm});
const label = await read.json();
console.log("read-label", read.status, JSON.stringify({photos: label.photos, label: label.label, missing: label.missing, conflicts: label.conflicts, exit: label.exit}));
if (!read.ok) process.exit(1);

const form = new FormData();
form.set("labelId", label.labelId); form.set("labelToken", label.labelToken); form.set("labelChoices", "{}");
form.set("checkId", crypto.randomUUID().replace(/-/g, ""));
form.set("bottleImage", await file("test-images/real/bottle/pills.jpg", "image/jpeg"), "pills.jpg");
const response = await fetch(base + "/api/check-bottle", {method: "POST", body: form});
const lines = (await response.text()).trim().split("\n").map(l => JSON.parse(l));
const last = lines.at(-1);
if (last.type !== "result") { console.log("check", response.status, JSON.stringify(last)); process.exit(1); }
const r = last.result, usd = r.usage.reduce((s, u) => s + (u.estimatedUsd ?? 0), 0);
console.log("check", response.status, JSON.stringify({label: r.label, verdict: r.decision.verdict, title: r.decision.title, pills: r.pills.length, aiCalls: r.usage.length, checkUsd: Number(usd.toFixed(4)), shareId: last.shareId}));
