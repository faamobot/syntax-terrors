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
  const [zombiesRemaining, setZombiesRemaining] = useState(0);
  const [health, setHealth] = useState(100);
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
  }, []);

  const handleTakeDamage = useCallback(() => {
    setWasDamaged(true);
    setTimeout(() => setWasDamaged(false), 500);
  }, []);

  const startGame = () => {
    setScore(0);
    setWave(0); // This will be incremented to 1 by the game component
    setHealth(100);
    setZombiesRemaining(0);
    setGameState('playing');
    setWaveMessage('');
  };

  const pauseGame = useCallback(() => {
    if (gameState === 'playing') {
      setGameState('paused');
    }
  }, [gameState]);

  const resumeGame = () => {
    if (mainRef.current) {
        mainRef.current.requestPointerLock();
    }
    setGameState('playing');
  };
  
  const gameOver = useCallback(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('zombie-rampage-highscore', score.toString());
    }
    setGameState('gameover');
  }, [score, highScore]);

  const handleClick = () => {
    // This is the only place we should request pointer lock.
    // It must be in a direct response to a user click.
    if (gameState === 'playing' && document.pointerLockElement !== mainRef.current) {
        mainRef.current?.requestPointerLock();
    }
  }

  return (
    <main 
      ref={mainRef}
      onClick={handleClick}
      className="relative w-screen h-screen bg-background text-foreground font-headline overflow-hidden"
    >
      {(gameState === 'playing' || gameState === 'paused') && (
        <HUD 
          score={score} 
          wave={wave} 
          health={health}
          waveMessage={waveMessage}
          zombiesRemaining={zombiesRemaining}
        />
      )}
      
      {gameState === 'playing' && <Crosshair />}
      {wasDamaged && <DamageOverlay />}

      {gameState === 'start' && <StartMenu onStart={startGame} highScore={highScore} />}
      {gameState === 'gameover' && <GameOverMenu score={score} wave={wave} onRestart={startGame} />}
      {gameState === 'paused' && <PauseMenu onResume={resumeGame} onRestart={startGame} />}
      
      {gameState === 'playing' && (
        <Game
          gameState={gameState}
          setScore={setScore}
          setWave={setWave}
          setHealth={setHealth}
          setZombiesRemaining={setZombiesRemaining}
          onGameOver={gameOver}
          onPause={pauseGame}
          onTakeDamage={handleTakeDamage}
          setWaveMessage={setWaveMessage}
          wave={wave}
          score={score}
          health={health}
          toast={toast}
          containerRef={mainRef}
          zombiesRemaining={zombiesRemaining}
        />
      )}
    </main>
  );
}
