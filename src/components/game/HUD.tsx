"use client";

import { Heart, Target, Waves, Users } from 'lucide-react';
import { cn } from "@/lib/utils";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import React from 'react';

// Custom Progress component that accepts an indicatorClassName
const CustomProgress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
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
CustomProgress.displayName = "CustomProgress";


type HUDProps = {
  health: number;
  score: number;
  wave: number;
  waveMessage: string;
  playerMessage: string;
  zombiesRemaining: number;
};

export function HUD({ health, score, wave, waveMessage, playerMessage, zombiesRemaining }: HUDProps) {
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
         <div className="flex items-center gap-2 bg-black/30 p-2 rounded-md">
          <Users className="h-6 w-6 text-accent" />
          <span className="text-2xl font-bold">REMAINING: {zombiesRemaining}</span>
        </div>
      </div>

      {/* Bottom Left: Health */}
      <div className="absolute bottom-4 left-4 lg:bottom-8 lg:left-8 w-64">
        <div className="flex items-center gap-2">
          <Heart className="h-8 w-8 text-accent" fill="hsl(var(--accent))"/>
          <div className='w-full'>
            <span className="text-2xl font-bold">{health}</span>
            <CustomProgress value={health} className="h-4 bg-primary border border-accent" indicatorClassName="bg-accent" />
          </div>
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

      {/* Center Bottom: Player Message */}
      {playerMessage && (
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-full max-w-2xl text-center">
            <p className="text-2xl lg:text-4xl font-bold text-yellow-400 animate-pulse">
                {playerMessage}
            </p>
        </div>
      )}
    </div>
  );
}
