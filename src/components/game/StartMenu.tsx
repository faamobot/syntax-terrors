"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";

type StartMenuProps = {
  onStart: () => void;
  highScore: number;
};

const ZombieIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16 text-accent">
        <path d="M10 18v-5h4v5"/>
        <path d="M7 18a5 5 0 0 0 10 0"/>
        <path d="M12 3a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2s2-.9 2-2V5a2 2 0 0 0-2-2Z"/>
        <path d="M12 13a3 3 0 0 0-3 3"/>
        <path d="M12 13a3 3 0 0 1 3 3"/>
        <path d="M7 5c.5-1.2 1.5-2 3-2"/>
        <path d="M17 5c-.5-1.2-1.5-2-3-2"/>
    </svg>
)

export function StartMenu({ onStart, highScore }: StartMenuProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background">
      <Card className="w-[450px] text-center border-primary-foreground/20">
        <CardHeader className="items-center">
            <ZombieIcon />
          <CardTitle className="text-6xl font-bold tracking-tighter">
            ZOMBIE RAMPAGE
          </CardTitle>
          <CardDescription className="text-lg">A hackathon 3D shooter.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="text-muted-foreground">
                <p>WASD to Move | Shift to Sprint | Mouse to Aim | F to Shoot</p>
            </div>
            <Button onClick={onStart} size="lg" className="w-full text-lg py-6">
                Start Game
            </Button>
        </CardContent>
        <CardFooter className="flex-col gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
                <Trophy className="w-4 h-4"/>
                <span>High Score: {highScore}</span>
            </div>
            <p className="text-xs text-muted-foreground/50">Press 'Esc' to pause at any time.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
