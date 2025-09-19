"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skull, RotateCw } from "lucide-react";

type GameOverMenuProps = {
  score: number;
  wave: number;
  onRestart: () => void;
};

export function GameOverMenu({ score, wave, onRestart }: GameOverMenuProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-[350px] text-center border-accent">
        <CardHeader>
          <div className="flex justify-center items-center gap-4">
            <Skull className="w-12 h-12 text-accent" />
            <CardTitle className="text-4xl font-bold">Game Over</CardTitle>
          </div>
          <CardDescription>The horde has overwhelmed you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-muted-foreground">Final Score</p>
            <p className="text-3xl font-semibold">{score}</p>
          </div>
           <div>
            <p className="text-muted-foreground">Waves Survived</p>
            <p className="text-3xl font-semibold">{wave}</p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button onClick={onRestart} size="lg">
            <RotateCw className="mr-2 h-4 w-4" /> Try Again
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
