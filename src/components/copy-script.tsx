"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/button";

export function CopyScript({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return <Button variant="secondary" size="sm" onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }}>
    {copied ? <Check aria-hidden /> : <Copy aria-hidden />}{copied ? "Copied" : "Copy what to say"}
  </Button>;
}
