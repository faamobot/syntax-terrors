'use client';

import React, { useRef, useEffect, useCallback, SetStateAction, Dispatch } from 'react';
import * as THREE from 'three';
import { generateZombieWave } from '@/ai/flows/generate-zombie-wave';
import type { GameState } from '@/app/page';
import { useToast } from '@/hooks/use-toast';

type GameProps = {
  gameState: GameState;
  setScore: Dispatch<SetStateAction<number>>;
  setWave: Dispatch<SetStateAction<number>>;
  setHealth: Dispatch<SetStateAction<number>>;
  setAmmo: Dispatch<SetStateAction<number>>;
  setTotalAmmo: Dispatch<SetStateAction<number>>;
  ammo: number;
  totalAmmo: number;
  setIsReloading: Dispatch<SetStateAction<boolean>>;
  onGameOver: () => void;
  onPause: () => void;
  onTakeDamage: () => void;
  setWaveMessage: Dispatch<SetStateAction<string>>;
  wave: number;
  score: number;
  health: number;
  toast: ReturnType<typeof useToast>['toast'];
};

type Zombie = THREE.Mesh & {
  speed: number;
  health: number;
};

export default function Game({
  gameState,
  setScore,
  setWave,
  setHealth,
  setAmmo,
  setTotalAmmo,
  ammo,
  totalAmmo,
  setIsReloading,
  onGameOver,
  onPause,
  onTakeDamage,
  setWaveMessage,
  wave,
  score,
  health,
  toast,
}: GameProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameLoopRef = useRef<number>();

  const gameData = useRef({
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000),
    renderer: null as THREE.WebGLRenderer | null,
    player: new THREE.Mesh(
      new THREE.CapsuleGeometry(0.5, 1),
      new THREE.MeshStandardMaterial({ color: 0xeeeeee, visible: false })
    ),
    zombies: [] as Zombie[],
    bullets: [] as THREE.Mesh[],
    
    input: {
      forward: false,
      backward: false,
      left: false,
      right: false,
      reloading: false,
    },
    
    playerVelocity: new THREE.Vector3(),
    playerOnGround: true,
    
    lastShotTime: 0,
    lastDamageTime: 0,
    waveInProgress: false,
  });

  const startNewWave = useCallback(async () => {
    if (gameData.current.waveInProgress) return;
    gameData.current.waveInProgress = true;
    
    const currentWave = wave + 1; // Use the upcoming wave number
    setWave(currentWave);
    
    const waveData = await generateZombieWave({
      waveNumber: currentWave,
      playerScore: score,
      timeSurvived: 0, // Simplified for hackathon
      playerHealth: health,
    });
    
    if(waveData.messageToPlayer) {
      setWaveMessage(waveData.messageToPlayer);
      setTimeout(() => setWaveMessage(''), 4000);
    }

    const arenaSize = 48;
    for (let i = 0; i < waveData.zombieCount; i++) {
        const zombieMaterial = new THREE.MeshStandardMaterial({ color: 0x803333 });
        const zombie = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), zombieMaterial) as Zombie;
        zombie.position.set(
            (Math.random() - 0.5) * arenaSize,
            1,
            (Math.random() - 0.5) * arenaSize
        );
        zombie.health = 100 * waveData.zombieHealthMultiplier;
        zombie.speed = 0.03 * waveData.zombieSpeedMultiplier;
        gameData.current.scene.add(zombie);
        gameData.current.zombies.push(zombie);
    }
    
    // Wave is in progress as long as there are zombies
    gameData.current.waveInProgress = waveData.zombieCount > 0;

  }, [wave, score, health, setWave, setWaveMessage]);

  useEffect(() => {
    if (!mountRef.current) return;

    const { current: data } = gameData;
    const mount = mountRef.current;
    
    data.renderer = new THREE.WebGLRenderer({ antialias: true });
    data.renderer.setSize(window.innerWidth, window.innerHeight);
    data.renderer.shadowMap.enabled = true;
    mount.appendChild(data.renderer.domElement);

    data.camera.position.z = 5;
    data.camera.position.y = 1.6;

    data.player.position.y = 1;
    data.player.castShadow = true;
    data.player.add(data.camera);
    data.scene.add(data.player);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    data.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 5);
    directionalLight.castShadow = true;
    data.scene.add(directionalLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    data.scene.add(floor);
    
    // Walls
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const wall1 = new THREE.Mesh(new THREE.BoxGeometry(50, 5, 1), wallMaterial);
    wall1.position.z = -25; wall1.position.y = 2.5; wall1.receiveShadow = true;
    data.scene.add(wall1);
    const wall2 = new THREE.Mesh(new THREE.BoxGeometry(50, 5, 1), wallMaterial);
    wall2.position.z = 25; wall2.position.y = 2.5; wall2.receiveShadow = true;
    data.scene.add(wall2);
    const wall3 = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 50), wallMaterial);
    wall3.position.x = -25; wall3.position.y = 2.5; wall3.receiveShadow = true;
    data.scene.add(wall3);
    const wall4 = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 50), wallMaterial);
    wall4.position.x = 25; wall4.position.y = 2.5; wall4.receiveShadow = true;
    data.scene.add(wall4);


    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': data.input.forward = true; break;
        case 'KeyS': data.input.backward = true; break;
        case 'KeyA': data.input.left = true; break;
        case 'KeyD': data.input.right = true; break;
        case 'KeyR': 
          if (!data.input.reloading && totalAmmo > 0) {
            data.input.reloading = true;
            setIsReloading(true);
            setTimeout(() => {
              const ammoNeeded = 15 - ammo;
              const ammoToReload = Math.min(ammoNeeded, totalAmmo);
              setAmmo(prev => prev + ammoToReload);
              setTotalAmmo(prev => prev - ammoToReload);
              data.input.reloading = false;
              setIsReloading(false);
            }, 1500);
          }
          break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
       switch (e.code) {
        case 'KeyW': data.input.forward = false; break;
        case 'KeyS': data.input.backward = false; break;
        case 'KeyA': data.input.left = false; break;
        case 'KeyD': data.input.right = false; break;
      }
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (gameState !== 'playing' || document.pointerLockElement !== mount) return;
      data.player.rotation.y -= e.movementX * 0.002;
      const newPitch = data.camera.rotation.x - e.movementY * 0.002;
      data.camera.rotation.x = THREE.MathUtils.clamp(newPitch, -Math.PI / 2, Math.PI / 2);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (gameState !== 'playing' || data.input.reloading || ammo <= 0 || document.pointerLockElement !== mount) return;
      
      const time = performance.now();
      if (time - data.lastShotTime < 200) return; // Fire rate
      data.lastShotTime = time;

      setAmmo(prev => prev - 1);
      
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(), data.camera);
      
      const intersects = raycaster.intersectObjects(data.zombies);
      if (intersects.length > 0) {
        const zombie = intersects[0].object as Zombie;
        zombie.health -= 50; // Damage
        if (zombie.health <= 0) {
          data.scene.remove(zombie);
          data.zombies = data.zombies.filter(z => z !== zombie);
          setScore(s => s + 100);
        }
      }
    };
    
    const handleClick = () => {
        if (gameState === 'playing' && document.pointerLockElement !== mount) {
            mount.requestPointerLock();
        }
    }

    const handleResize = () => {
        data.camera.aspect = window.innerWidth / window.innerHeight;
        data.camera.updateProjectionMatrix();
        data.renderer?.setSize(window.innerWidth, window.innerHeight);
    }
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleMouseDown);
    mount.addEventListener('click', handleClick);
    window.addEventListener('resize', handleResize);
    
    // Initial "wave" to set things up (will spawn 0 zombies)
    (async () => {
      setWave(0);
      const waveData = await generateZombieWave({
          waveNumber: 0,
          playerScore: 0,
          timeSurvived: 0,
          playerHealth: 100,
      });
      if(waveData.messageToPlayer) {
          setWaveMessage(waveData.messageToPlayer);
          setTimeout(() => setWaveMessage(''), 4000);
      }
      gameData.current.waveInProgress = false; // Wave 0 has no zombies
    })();


    const clock = new THREE.Clock();
    const animate = () => {
      gameLoopRef.current = requestAnimationFrame(animate);
      if (gameState !== 'playing' || !data.renderer) return;

      const delta = clock.getDelta();
      
      const speed = 5.0;
      const moveDirection = new THREE.Vector3();
      if (data.input.forward) moveDirection.z -= 1;
      if (data.input.backward) moveDirection.z += 1;
      if (data.input.left) moveDirection.x -= 1;
      if (data.input.right) moveDirection.x += 1;
      
      if (moveDirection.lengthSq() > 0) {
        moveDirection.normalize().applyQuaternion(data.player.quaternion);
        data.playerVelocity.add(moveDirection.multiplyScalar(speed * delta));
      }
      
      data.player.position.add(data.playerVelocity);
      data.playerVelocity.multiplyScalar(1 - 10 * delta); // friction

      // Clamp player position
      data.player.position.x = THREE.MathUtils.clamp(data.player.position.x, -24, 24);
      data.player.position.z = THREE.MathUtils.clamp(data.player.position.z, -24, 24);

      // Zombie AI
      data.zombies.forEach(zombie => {
        zombie.lookAt(data.player.position);
        const distance = zombie.position.distanceTo(data.player.position);
        if (distance > 1.5) {
            zombie.translateZ(zombie.speed);
        } else {
            const time = performance.now();
            if (time - data.lastDamageTime > 1000) { // 1 sec cooldown
                data.lastDamageTime = time;
                setHealth(h => Math.max(0, h - 10));
                onTakeDamage();
            }
        }
      });
      
      // Game over check
      if(health <= 10) { // accounting for the state update delay
        onGameOver();
      }

      // Wave cleared check
      if (data.zombies.length === 0 && data.waveInProgress) {
        gameData.current.waveInProgress = false;
      }
      if (data.zombies.length === 0 && !data.waveInProgress && wave > 0) {
        startNewWave();
      }
      // Special handling for wave 0 to start wave 1
      if(wave === 0 && data.zombies.length === 0 && !data.waveInProgress) {
        startNewWave();
      }

      data.renderer.render(data.scene, data.camera);
    };
    
    animate();

    return () => {
      cancelAnimationFrame(gameLoopRef.current || 0);
      if (mount && data.renderer && mount.contains(data.renderer.domElement)) {
        mount.removeChild(data.renderer.domElement);
      }
      data.renderer?.dispose();

      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mousedown', handleMouseDown);
      mount?.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);

      data.zombies.forEach(z => data.scene.remove(z));
      data.zombies = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPointerLockChange = () => {
      if (document.pointerLockElement !== mountRef.current) {
        if (gameState === 'playing') {
          onPause();
        }
      }
    };

    const onPointerLockError = () => {
      toast({
        title: 'Pointer Lock Failed',
        description: 'Could not lock the mouse. Please click the screen to enable.',
        variant: 'destructive',
      });
    };

    document.addEventListener('pointerlockchange', onPointerLockChange, false);
    document.addEventListener('pointerlockerror', onPointerLockError, false);
    
    if (gameState !== 'playing') {
       if (document.pointerLockElement === mountRef.current) {
        document.exitPointerLock();
      }
    }
    
    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange, false);
      document.removeEventListener('pointerlockerror', onPointerLockError, false);
    }
  }, [gameState, onPause, toast]);
  
  useEffect(() => {
    if(health <= 0) {
      onGameOver();
    }
  }, [health, onGameOver]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && gameState === 'playing') {
        onPause();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [gameState, onPause]);

  return <div ref={mountRef} className="absolute inset-0 z-0" />;
}
