"use client";

import { cn } from "@/lib/utils";

export function DamageOverlay() {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-40 animate-pulse",
        "bg-accent/50"
      )}
      style={{
        animationName: "damage-flash",
        animationDuration: "0.5s",
        animationTimingFunction: "ease-out",
        animationIterationCount: "1",
      }}
    />
  );
}
