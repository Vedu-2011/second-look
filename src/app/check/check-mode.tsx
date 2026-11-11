"use client";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/button";
import { CheckFlow } from "./check-flow";
import { BottleFlow } from "./bottle-flow";

// Pour and snap is the default: most people check the pills they just poured out. One pill is one tap away
// (and /check#one opens it directly).
export function CheckMode() {
  const hash = useSyncExternalStore(onHashChange, () => window.location.hash, () => "");
  const [chosen, setMode] = useState<"one" | "bottle" | null>(null);
  const mode = chosen ?? (hash === "#one" ? "one" : "bottle");
  return <><div role="group" aria-label="Choose how many pills to check" className="mb-8 flex flex-col gap-2 rounded-[var(--radius-card)] bg-foil p-2 sm:flex-row"><Button className="flex-1 text-lg" variant={mode === "bottle" ? "ink" : "ghost"} aria-pressed={mode === "bottle"} onClick={() => setMode("bottle")}>Check my pills</Button><Button className="flex-1 text-lg" variant={mode === "one" ? "ink" : "ghost"} aria-pressed={mode === "one"} onClick={() => setMode("one")}>Check one pill</Button></div>{mode === "one" ? <CheckFlow /> : <BottleFlow />}</>;
}
function onHashChange(change: () => void) {
  window.addEventListener("hashchange", change);
  return () => window.removeEventListener("hashchange", change);
}
