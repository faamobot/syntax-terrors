'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Game from '@/components/game/Game';
import { StartMenu } from '@/components/game/StartMenu';
import { GameOverMenu } from '@/components/game/GameOverMenu';
import { PauseMenu } from '@/components/game/PauseMenu';
import { HUD } from '@/components/game/HUD';
import { Crosshair } from '@/components/game/Crosshair';
import { DamageOverlay } from '@/components/game/DamageOverlay';
import { useToast } from '@/hooks/use-toast';

export type GameState = 'start' | 'playing' | 'paused' | 'gameover';

export default function Home() {
  const [gameState, setGameState] = useState<GameState>('start');
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(0);
  const [health, setHealth] = useState(100);
  const [ammo, setAmmo] = useState(15);
  const [totalAmmo, setTotalAmmo] = useState(60);
  const [isReloading, setIsReloading] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [wasDamaged, setWasDamaged] = useState(false);
  const [waveMessage, setWaveMessage] = useState('');
  const mainRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const storedHighScore = localStorage.getItem('zombie-rampage-highscore');
    if (storedHighScore) {
      setHighScore(parseInt(storedHighScore, 10));
    }
    
    const preventContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', preventContextMenu);

    const handlePointerLockError = () => {
      toast({
        title: 'Pointer Lock Failed',
        description: 'Could not lock the mouse. Please click the screen to enable.',
        variant: 'destructive',
      });
    };
    document.addEventListener('pointerlockerror', handlePointerLockError);

    return () => {
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('pointerlockerror', handlePointerLockError);
    };
  }, [toast]);

  const handleTakeDamage = useCallback(() => {
    setWasDamaged(true);
    setTimeout(() => setWasDamaged(false), 500);
  }, []);

  const startGame = () => {
    setScore(0);
    setWave(0);
    setHealth(100);
    setAmmo(15);
    setTotalAmmo(60);
    setIsReloading(false);
    setGameState('playing');
    setWaveMessage('');
  };

  const pauseGame = useCallback(() => {
    if (gameState === 'playing') {
      setGameState('paused');
    }
  }, [gameState]);

  const resumeGame = () => {
    setGameState('playing');
  };
  
  const gameOver = useCallback(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('zombie-rampage-highscore', score.toString());
    }
    setGameState('gameover');
  }, [score, highScore]);

  return (
    <main 
      ref={mainRef}
      className="relative w-screen h-screen bg-background text-foreground font-headline overflow-hidden"
      onClick={() => {
        if (gameState === 'playing' && document.pointerLockElement !== mainRef.current) {
          mainRef.current?.requestPointerLock();
        }
      }}
    >
      {(gameState === 'playing' || gameState === 'paused') && (
        <HUD 
          score={score} 
          wave={wave} 
          health={health} 
          ammo={ammo} 
          totalAmmo={totalAmmo} 
          isReloading={isReloading}
          waveMessage={waveMessage}
        />
      )}
      
      {gameState === 'playing' && <Crosshair />}
      {wasDamaged && <DamageOverlay />}

      {gameState === 'start' && <StartMenu onStart={startGame} highScore={highScore} />}
      {gameState === 'gameover' && <GameOverMenu score={score} wave={wave} onRestart={startGame} />}
      {gameState === 'paused' && <PauseMenu onResume={resumeGame} onRestart={startGame} />}
      
      {(gameState === 'playing' || gameState === 'paused') && (
        <Game
          gameState={gameState}
          setScore={setScore}
          setWave={setWave}
          setHealth={setHealth}
          setAmmo={setAmmo}
          setTotalAmmo={setTotalAmmo}
          ammo={ammo}
          totalAmmo={totalAmmo}
          setIsReloading={setIsReloading}
          onGameOver={gameOver}
          onPause={pauseGame}
          onTakeDamage={handleTakeDamage}
          setWaveMessage={setWaveMessage}
          wave={wave}
          score={score}
          health={health}
        />
      )}
    </main>
  );
}
