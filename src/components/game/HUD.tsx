"use client";

import { Heart, Target, Waves, Shell } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

type HUDProps = {
  health: number;
  score: number;
  wave: number;
  ammo: number;
  totalAmmo: number;
  isReloading: boolean;
  waveMessage: string;
};

export function HUD({ health, score, wave, ammo, totalAmmo, isReloading, waveMessage }: HUDProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-10 p-4 lg:p-8 text-primary-foreground font-mono">
      {/* Top Left: Score & Wave */}
      <div className="absolute top-4 left-4 lg:top-8 lg:left-8 flex flex-col gap-4">
        <div className="flex items-center gap-2 bg-black/30 p-2 rounded-md">
          <Target className="h-6 w-6 text-accent" />
          <span className="text-2xl font-bold">{score.toString().padStart(6, '0')}</span>
        </div>
        <div className="flex items-center gap-2 bg-black/30 p-2 rounded-md">
          <Waves className="h-6 w-6 text-accent" />
          <span className="text-2xl font-bold">WAVE {wave}</span>
        </div>
      </div>

      {/* Bottom Left: Health */}
      <div className="absolute bottom-4 left-4 lg:bottom-8 lg:left-8 w-64">
        <div className="flex items-center gap-2">
          <Heart className="h-8 w-8 text-accent" fill="hsl(var(--accent))"/>
          <div className='w-full'>
            <span className="text-2xl font-bold">{health}</span>
            <Progress value={health} className="h-4 bg-primary border border-accent" indicatorClassName="bg-accent" />
          </div>
        </div>
      </div>

      {/* Bottom Right: Ammo */}
      <div className="absolute bottom-4 right-4 lg:bottom-8 lg:right-8 flex items-end gap-2 text-right">
        <Shell className="h-8 w-8 text-accent" />
        <div>
          <p className="text-4xl font-bold leading-none">
            {isReloading ? 'RELOADING' : ammo}
          </p>
          <p className="text-xl">/ {totalAmmo}</p>
        </div>
      </div>

      {/* Center: Wave Message */}
      {waveMessage && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-full max-w-2xl text-center">
            <p className="text-3xl lg:text-5xl font-bold text-accent animate-pulse">
                {waveMessage}
            </p>
        </div>
      )}
    </div>
  );
}

// Custom indicator class for Progress
import { cn } from "@/lib/utils";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import React from 'react';

const OriginalProgress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root> & { indicatorClassName?: string },
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }
>(({ className, value, indicatorClassName, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn("h-full w-full flex-1 bg-primary transition-all", indicatorClassName)}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
OriginalProgress.displayName = ProgressPrimitive.Root.displayName

// Override Progress to accept indicatorClassName
(Progress as any) = OriginalProgress;
