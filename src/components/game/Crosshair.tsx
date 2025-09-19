"use client";

export function Crosshair() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <div className="h-1 w-6 bg-primary-foreground/70 rounded-full" />
      <div className="absolute h-6 w-1 bg-primary-foreground/70 rounded-full" />
    </div>
  );
}
