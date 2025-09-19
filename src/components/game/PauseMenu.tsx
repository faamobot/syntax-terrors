"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Pause, Play, RotateCw } from "lucide-react";

type PauseMenuProps = {
  onResume: () => void;
  onRestart: () => void;
};

export function PauseMenu({ onResume, onRestart }: PauseMenuProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-[350px] text-center">
        <CardHeader>
          <div className="flex justify-center items-center gap-4">
            <Pause className="w-10 h-10 text-primary-foreground" />
            <CardTitle className="text-4xl font-bold">Paused</CardTitle>
          </div>
          <CardDescription>Take a breather. The horde is waiting.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button onClick={onResume} size="lg">
            <Play className="mr-2 h-4 w-4" /> Resume
          </Button>
          <Button onClick={onRestart} variant="secondary">
            <RotateCw className="mr-2 h-4 w-4" /> Restart
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
