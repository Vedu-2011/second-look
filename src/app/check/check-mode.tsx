"use client";
import { useState } from "react";
import { Button } from "@/components/button";
import { CheckFlow } from "./check-flow";
import { BottleFlow } from "./bottle-flow";

export function CheckMode() {
  const [mode, setMode] = useState<"one" | "bottle">("one");
  return <><div role="group" aria-label="Choose how many pills to check" className="mb-8 flex flex-col gap-2 rounded-[var(--radius-card)] bg-foil p-2 sm:flex-row"><Button className="flex-1" variant={mode === "one" ? "ink" : "ghost"} aria-pressed={mode === "one"} onClick={() => setMode("one")}>Check one pill</Button><Button className="flex-1" variant={mode === "bottle" ? "ink" : "ghost"} aria-pressed={mode === "bottle"} onClick={() => setMode("bottle")}>Check the whole bottle</Button></div>{mode === "one" ? <CheckFlow /> : <BottleFlow />}</>;
}
