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
  containerRef: React.RefObject<HTMLDivElement>;
};

type Zombie = THREE.Mesh & {
  speed: number;
  health: number;
};

const ARENA_SIZE = 100;

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
  containerRef
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
      arrowUp: false,
      arrowDown: false,
      arrowLeft: false,
      arrowRight: false,
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
    
    const currentWave = wave + 1;
    setWave(currentWave);
    
    try {
      const waveData = await generateZombieWave({
        waveNumber: currentWave,
        playerScore: score,
        timeSurvived: 0, 
        playerHealth: health,
      });
      
      if(waveData.messageToPlayer) {
        setWaveMessage(waveData.messageToPlayer);
        setTimeout(() => setWaveMessage(''), 4000);
      }

      for (let i = 0; i < waveData.zombieCount; i++) {
          const zombieMaterial = new THREE.MeshStandardMaterial({ color: 0x0d5223 });
          const zombie = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), zombieMaterial) as Zombie;
          zombie.position.set(
              (Math.random() - 0.5) * (ARENA_SIZE - 2),
              1,
              (Math.random() - 0.5) * (ARENA_SIZE - 2)
          );
          zombie.health = 100 * waveData.zombieHealthMultiplier;
          zombie.speed = 0.03 * waveData.zombieSpeedMultiplier;
          gameData.current.scene.add(zombie);
          gameData.current.zombies.push(zombie);
      }
      
      if (waveData.zombieCount === 0 && currentWave > 0) {
        gameData.current.waveInProgress = false;
        // If the API for some reason returns 0 zombies for a later wave, immediately try to start the next one.
        // This prevents the game from getting stuck.
        startNewWave();
      } else {
        gameData.current.waveInProgress = false;
      }
      
    } catch (e) {
      console.error("Failed to generate zombie wave:", e);
      toast({
        title: "Error",
        description: "Could not generate next zombie wave. Please try again.",
        variant: "destructive",
      });
      gameData.current.waveInProgress = false;
    }

  }, [wave, score, health, setWave, setWaveMessage, toast]);

  useEffect(() => {
    if (!mountRef.current) return;

    const { current: data } = gameData;
    const mount = mountRef.current;
    
    data.renderer = new THREE.WebGLRenderer({ antialias: true });
    data.renderer.setSize(window.innerWidth, window.innerHeight);
    data.renderer.shadowMap.enabled = true;
    mount.appendChild(data.renderer.domElement);

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
      new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE),
      new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    data.scene.add(floor);
    
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const wallY = 2.5;
    const wallDepth = 1;
    const halfArena = ARENA_SIZE / 2;
    
    const wall1 = new THREE.Mesh(new THREE.BoxGeometry(ARENA_SIZE, 5, wallDepth), wallMaterial);
    wall1.position.z = -halfArena; wall1.position.y = wallY; wall1.receiveShadow = true;
    data.scene.add(wall1);
    const wall2 = new THREE.Mesh(new THREE.BoxGeometry(ARENA_SIZE, 5, wallDepth), wallMaterial);
    wall2.position.z = halfArena; wall2.position.y = wallY; wall2.receiveShadow = true;
    data.scene.add(wall2);
    const wall3 = new THREE.Mesh(new THREE.BoxGeometry(wallDepth, 5, ARENA_SIZE), wallMaterial);
    wall3.position.x = -halfArena; wall3.position.y = wallY; wall3.receiveShadow = true;
    data.scene.add(wall3);
    const wall4 = new THREE.Mesh(new THREE.BoxGeometry(wallDepth, 5, ARENA_SIZE), wallMaterial);
    wall4.position.x = halfArena; wall4.position.y = wallY; wall4.receiveShadow = true;
    data.scene.add(wall4);

    const obstacleGeometries = [
      new THREE.SphereGeometry(2, 16, 16),
      new THREE.ConeGeometry(2, 4, 16),
      new THREE.CylinderGeometry(1.5, 1.5, 3, 16),
      new THREE.BoxGeometry(3, 3, 3),
    ];
    
    for (let i = 0; i < 8; i++) {
        const geometry = obstacleGeometries[Math.floor(Math.random() * obstacleGeometries.length)];
        const material = new THREE.MeshStandardMaterial({ color: 0xADD8E6 });
        const obstacle = new THREE.Mesh(geometry, material);
        obstacle.position.set(
            (Math.random() - 0.5) * (ARENA_SIZE - 10),
            geometry.parameters.height ? geometry.parameters.height / 2 : 1.5,
            (Math.random() - 0.5) * (ARENA_SIZE - 10)
        );
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;
        data.scene.add(obstacle);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': data.input.forward = true; break;
        case 'KeyS': data.input.backward = true; break;
        case 'KeyA': data.input.left = true; break;
        case 'KeyD': data.input.right = true; break;
        case 'ArrowUp': data.input.arrowUp = true; break;
        case 'ArrowDown': data.input.arrowDown = true; break;
        case 'ArrowLeft': data.input.arrowLeft = true; break;
        case 'ArrowRight': data.input.arrowRight = true; break;
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
        case 'KeyS': data.input.backward = true; break;
        case 'KeyA': data.input.left = true; break;
        case 'KeyD': data.input.right = true; break;
        case 'ArrowUp': data.input.arrowUp = true; break;
        case 'ArrowDown': data.input.arrowDown = true; break;
        case 'ArrowLeft': data.input.arrowLeft = true; break;
        case 'ArrowRight': data.input.arrowRight = true; break;
      }
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (gameState !== 'playing' || document.pointerLockElement !== containerRef.current) return;
      data.player.rotation.y -= e.movementX * 0.002;
      const newPitch = data.camera.rotation.x - e.movementY * 0.002;
      data.camera.rotation.x = THREE.MathUtils.clamp(newPitch, -Math.PI / 2, Math.PI / 2);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (gameState !== 'playing' || data.input.reloading || ammo <= 0 || document.pointerLockElement !== containerRef.current) return;
      
      const time = performance.now();
      if (time - data.lastShotTime < 200) return; 
      data.lastShotTime = time;

      setAmmo(prev => prev - 1);
      
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(), data.camera);
      
      const intersects = raycaster.intersectObjects(data.zombies);
      if (intersects.length > 0) {
        const zombie = intersects[0].object as Zombie;
        zombie.health -= 50; 
        if (zombie.health <= 0) {
          data.scene.remove(zombie);
          data.zombies = data.zombies.filter(z => z !== zombie);
          setScore(s => s + 100);

          if (data.zombies.length === 0) {
            startNewWave();
          }
        }
      }
    };

    const handleResize = () => {
        data.camera.aspect = window.innerWidth / window.innerHeight;
        data.camera.updateProjectionMatrix();
        data.renderer?.setSize(window.innerWidth, window.innerHeight);
    }
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('resize', handleResize);
    
    startNewWave();


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
      
      const rotationSpeed = 1.5 * delta;
      if (data.input.arrowLeft) data.player.rotation.y += rotationSpeed;
      if (data.input.arrowRight) data.player.rotation.y -= rotationSpeed;
      if (data.input.arrowUp) {
        const newPitch = data.camera.rotation.x + rotationSpeed;
        data.camera.rotation.x = THREE.MathUtils.clamp(newPitch, -Math.PI / 2, Math.PI / 2);
      }
      if (data.input.arrowDown) {
        const newPitch = data.camera.rotation.x - rotationSpeed;
        data.camera.rotation.x = THREE.MathUtils.clamp(newPitch, -Math.PI / 2, Math.PI / 2);
      }

      data.player.position.add(data.playerVelocity);
      data.playerVelocity.multiplyScalar(1 - 10 * delta); 

      const halfSize = ARENA_SIZE / 2 - 1;
      data.player.position.x = THREE.MathUtils.clamp(data.player.position.x, -halfSize, halfSize);
      data.player.position.z = THREE.MathUtils.clamp(data.player.position.z, -halfSize, halfSize);

      data.zombies.forEach(zombie => {
        zombie.lookAt(data.player.position);
        const distance = zombie.position.distanceTo(data.player.position);
        if (distance > 1.5) {
            zombie.translateZ(zombie.speed);
        } else {
            const time = performance.now();
            if (time - data.lastDamageTime > 1000) { 
                data.lastDamageTime = time;
                setHealth(h => Math.max(0, h - 10));
                onTakeDamage();
            }
        }
      });
      
      if(health <= 0) { 
        onGameOver();
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
      window.removeEventListener('resize', handleResize);

      data.zombies.forEach(z => data.scene.remove(z));
      data.zombies = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPointerLockChange = () => {
      if (document.pointerLockElement !== containerRef.current) {
        if (gameState === 'playing') {
          onPause();
        }
      }
    };

    const onPointerLockError = () => {
      toast({
        title: "Pointer Lock Error",
        description: "Could not lock the mouse cursor. This can happen if the window is not in focus.",
        variant: "destructive",
      });
    };

    document.addEventListener('pointerlockchange', onPointerLockChange, false);
    document.addEventListener('pointerlockerror', onPointerLockError, false);
    
    if (gameState !== 'playing' && document.pointerLockElement === containerRef.current) {
        document.exitPointerLock();
    }
    
    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange, false);
      document.removeEventListener('pointerlockerror', onPointerLockError, false);
    }
  }, [gameState, onPause, containerRef, toast]);
  
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

    