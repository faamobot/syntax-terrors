'use client';

import React, { useRef, useEffect, useCallback, SetStateAction, Dispatch } from 'react';
import * as THREE from 'three';
import { generateZombieWave, ZombieData } from '@/ai/flows/generate-zombie-wave';
import type { GameState } from '@/app/page';
import { useToast } from '@/hooks/use-toast';

type GameProps = {
  gameState: GameState;
  setScore: Dispatch<SetStateAction<number>>;
  setWave: Dispatch<SetStateAction<number>>;
  setHealth: Dispatch<SetStateAction<number>>;
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
  type: 'walker' | 'runner' | 'brute';
  originalColor: THREE.Color;
};

const ARENA_SIZE = 100;

export default function Game({
  gameState,
  setScore,
  setWave,
  setHealth,
  onGameOver,
  onPause,
  onTakeDamage,
  setWaveMessage,
  wave,
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
    obstacles: [] as THREE.Mesh[],
    
    input: {
      forward: false,
      backward: false,
      left: false,
      right: false,
      shoot: false,
      jump: false,
      sprint: false,
      arrowUp: false,
      arrowDown: false,
      arrowLeft: false,
      arrowRight: false,
    },
    
    playerVelocity: new THREE.Vector3(),
    onGround: true,
    
    lastShotTime: 0,
    lastDamageTime: 0,
    waveInProgress: false,
  });

  const startNewWave = useCallback(async () => {
    const { current: data } = gameData;
    if (data.waveInProgress) return;
    data.waveInProgress = true;
    
    const currentWave = wave + 1;
    setWave(currentWave);
    
    try {
      const waveData = await generateZombieWave({
        waveNumber: currentWave,
        difficulty: 'normal',
      });
      
      if(waveData.messageToPlayer) {
        setWaveMessage(waveData.messageToPlayer);
        setTimeout(() => setWaveMessage(''), 4000);
      }
      
      const zombieColor = new THREE.Color(0x0d5223);
      const zombieTypes = {
        walker: { geometry: new THREE.BoxGeometry(1, 2, 1) },
        runner: { geometry: new THREE.BoxGeometry(0.8, 1.8, 0.8) },
        brute: { geometry: new THREE.BoxGeometry(1.5, 2.5, 1.5) },
      };

      waveData.zombies.forEach((zombieData: ZombieData) => {
        const typeInfo = zombieTypes[zombieData.type];
        const zombieMaterial = new THREE.MeshStandardMaterial({ color: zombieColor });
        const zombie = new THREE.Mesh(typeInfo.geometry, zombieMaterial) as Zombie;
        
        zombie.position.set(
            (Math.random() - 0.5) * (ARENA_SIZE - 2),
            typeInfo.geometry.parameters.height / 2,
            (Math.random() - 0.5) * (ARENA_SIZE - 2)
        );
        
        zombie.castShadow = true;
        zombie.health = zombieData.health;
        zombie.speed = zombieData.speed;
        zombie.type = zombieData.type;
        zombie.originalColor = zombieColor.clone();
        
        data.scene.add(zombie);
        data.zombies.push(zombie);
      });
      
      if (waveData.zombies.length === 0 && currentWave > 0) {
         startNewWave();
      }
      
    } catch (e) {
      console.error("Failed to generate zombie wave:", e);
      toast({
        title: "Error",
        description: "Could not generate next zombie wave. Please try again.",
        variant: "destructive",
      });
    } finally {
        setTimeout(() => {
          if (gameData.current) {
            gameData.current.waveInProgress = false;
          }
        }, 2000);
    }

  }, [wave, setWave, setWaveMessage, toast]);

  const despawnZombie = useCallback((zombie: Zombie) => {
    const { current: data } = gameData;
    data.scene.remove(zombie);
    data.zombies = data.zombies.filter(z => z !== zombie);
    setScore(s => s + 100);

    if (data.zombies.length === 0 && !data.waveInProgress) {
      startNewWave();
    }
  }, [setScore, startNewWave]);

  const applyDamage = useCallback((zombie: Zombie, damage: number) => {
    zombie.health -= damage;

    (zombie.material as THREE.MeshStandardMaterial).color.set(0xff0000);
    setTimeout(() => {
      if(zombie.material) {
         (zombie.material as THREE.MeshStandardMaterial).color.set(zombie.originalColor);
      }
    }, 150);

    if (zombie.health <= 0) {
      despawnZombie(zombie);
    }
  }, [despawnZombie]);
  
  const handleShoot = useCallback(() => {
    const { current: data } = gameData;
    const time = performance.now();
    if (time - data.lastShotTime < 200) return;
    data.lastShotTime = time;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(), data.camera);
    
    const intersects = raycaster.intersectObjects(data.zombies);

    if (intersects.length > 0) {
      const zombie = intersects[0].object as Zombie;
      applyDamage(zombie, 20);
    }
  }, [applyDamage]);


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
      new THREE.MeshStandardMaterial({ color: 0xc2b280 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    data.scene.add(floor);
    
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
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

    const obstacleColors = [0x556B2F, 0x8B4513, 0x6B8E23];
    
    for (let i = 0; i < 15; i++) {
        const sizeX = Math.random() * 4 + 2;
        const sizeY = Math.random() * 2 + 0.5;
        const sizeZ = Math.random() * 4 + 2;
        const geometry = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
        const material = new THREE.MeshStandardMaterial({ color: obstacleColors[Math.floor(Math.random() * obstacleColors.length)] });
        const obstacle = new THREE.Mesh(geometry, material);
        obstacle.position.set(
            (Math.random() - 0.5) * (ARENA_SIZE - 10),
            sizeY / 2,
            (Math.random() - 0.5) * (ARENA_SIZE - 10)
        );
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;
        data.scene.add(obstacle);
        data.obstacles.push(obstacle);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': data.input.forward = true; break;
        case 'KeyS': data.input.backward = true; break;
        case 'KeyA': data.input.left = true; break;
        case 'KeyD': data.input.right = true; break;
        case 'KeyF': data.input.shoot = true; break;
        case 'Space': data.input.jump = true; break;
        case 'ShiftLeft': data.input.sprint = true; break;
        case 'ArrowUp': data.input.arrowUp = true; break;
        case 'ArrowDown': data.input.arrowDown = true; break;
        case 'ArrowLeft': data.input.arrowLeft = true; break;
        case 'ArrowRight': data.input.arrowRight = true; break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
       switch (e.code) {
        case 'KeyW': data.input.forward = false; break;
        case 'KeyS': data.input.backward = false; break;
        case 'KeyA': data.input.left = false; break;
        case 'KeyD': data.input.right = false; break;
        case 'KeyF': data.input.shoot = false; break;
        case 'Space': data.input.jump = false; break;
        case 'ShiftLeft': data.input.sprint = true; break;
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

    const handleResize = () => {
        data.camera.aspect = window.innerWidth / window.innerHeight;
        data.camera.updateProjectionMatrix();
        data.renderer?.setSize(window.innerWidth, window.innerHeight);
    }
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);
    
    startNewWave();


    const clock = new THREE.Clock();
    const animate = () => {
      gameLoopRef.current = requestAnimationFrame(animate);
      if (gameState !== 'playing' || !data.renderer) return;

      const delta = clock.getDelta();
      
      const baseSpeed = 5.0;
      const sprintSpeed = 10.0;
      const currentSpeed = data.input.sprint ? sprintSpeed : baseSpeed;

      const moveDirection = new THREE.Vector3();
      if (data.input.forward) moveDirection.z -= 1;
      if (data.input.backward) moveDirection.z += 1;
      if (data.input.left) moveDirection.x -= 1;
      if (data.input.right) moveDirection.x += 1;
      
      const playerSpeed = data.onGround ? currentSpeed : currentSpeed * 0.3;
      if (moveDirection.lengthSq() > 0) {
        moveDirection.normalize().applyQuaternion(data.player.quaternion);
        data.playerVelocity.x = moveDirection.x * playerSpeed;
        data.playerVelocity.z = moveDirection.z * playerSpeed;
      } else {
        data.playerVelocity.x *= 0.9; // friction
        data.playerVelocity.z *= 0.9; // friction
      }

      if (data.input.shoot) {
        handleShoot();
      }
      if (data.input.jump && data.onGround) {
        data.playerVelocity.y = 8.0; // Jump force
        data.onGround = false;
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

      // Gravity
      data.playerVelocity.y -= 20.0 * delta; 
      
      const prevPosition = data.player.position.clone();
      const playerCollider = new THREE.Box3().setFromObject(data.player);
      const playerHeight = (playerCollider.max.y - playerCollider.min.y);

      // Update player position based on velocity
      data.player.position.x += data.playerVelocity.x * delta;
      data.player.position.y += data.playerVelocity.y * delta;
      data.player.position.z += data.playerVelocity.z * delta;

      // --- Collision Detection and Resolution ---
      data.onGround = false;
      const playerHalfHeight = playerHeight / 2;
      
      // 1. Ground collision
      if (data.player.position.y < playerHalfHeight) {
          data.player.position.y = playerHalfHeight;
          data.playerVelocity.y = 0;
          data.onGround = true;
      }

      // 2. Obstacle collision
      data.obstacles.forEach(obstacle => {
          const obstacleCollider = new THREE.Box3().setFromObject(obstacle);
          const currentCollider = new THREE.Box3().setFromObject(data.player);

          if (currentCollider.intersectsBox(obstacleCollider)) {
              // Check for landing on top first
              if (prevPosition.y >= obstacleCollider.max.y && data.playerVelocity.y <= 0) {
                  data.player.position.y = obstacleCollider.max.y + playerHalfHeight;
                  data.playerVelocity.y = 0;
                  data.onGround = true;
              } else { // Side collision
                  const penetration = new THREE.Vector3();
                  currentCollider.getCenter(penetration).sub(obstacleCollider.getCenter(new THREE.Vector3()));
          
                  const playerSize = currentCollider.getSize(new THREE.Vector3());
                  const obstacleSize = obstacleCollider.getSize(new THREE.Vector3());
          
                  const overlapX = (playerSize.x + obstacleSize.x) / 2 - Math.abs(penetration.x);
                  const overlapZ = (playerSize.z + obstacleSize.z) / 2 - Math.abs(penetration.z);
                  
                  if (overlapX < overlapZ) {
                      data.player.position.x += penetration.x > 0 ? overlapX : -overlapX;
                      data.playerVelocity.x = 0;
                  } else {
                      data.player.position.z += penetration.z > 0 ? overlapZ : -overlapZ;
                      data.playerVelocity.z = 0;
                  }
              }
          }
      });


      const playerRadius = 0.5;
      const halfSize = ARENA_SIZE / 2 - playerRadius;
      data.player.position.x = THREE.MathUtils.clamp(data.player.position.x, -halfSize, halfSize);
      data.player.position.z = THREE.MathUtils.clamp(data.player.position.z, -halfSize, halfSize);

      data.zombies.forEach(zombie => {
        const zombieHeight = (zombie.geometry as THREE.BoxGeometry).parameters.height;
        zombie.position.y = zombieHeight / 2; // Keep zombie on the ground

        zombie.lookAt(data.player.position);
        const distance = zombie.position.distanceTo(data.player.position);
        
        const zombieCollider = new THREE.Box3().setFromObject(zombie);
        let collidedWithObstacle = false;

        data.obstacles.forEach(obstacle => {
            const obstacleCollider = new THREE.Box3().setFromObject(obstacle);
            if (zombieCollider.intersectsBox(obstacleCollider)) {
                collidedWithObstacle = true;
                const penetration = new THREE.Vector3();
                zombieCollider.getCenter(penetration).sub(obstacleCollider.getCenter(new THREE.Vector3()));

                const zombieSize = zombieCollider.getSize(new THREE.Vector3());
                const obstacleSize = obstacleCollider.getSize(new THREE.Vector3());

                const overlapX = (zombieSize.x + obstacleSize.x) / 2 - Math.abs(penetration.x);
                const overlapZ = (zombieSize.z + obstacleSize.z) / 2 - Math.abs(penetration.z);

                if (overlapX < overlapZ) {
                    zombie.position.x += (penetration.x > 0 ? 1 : -1) * 0.1;
                } else {
                    zombie.position.z += (penetration.z > 0 ? 1 : -1) * 0.1;
                }
            }
        });

        if (distance > 1.5 && !collidedWithObstacle) {
            zombie.translateZ(zombie.speed);
        } else if (distance <= 1.5) {
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
      window.removeEventListener('resize', handleResize);

      data.zombies.forEach(z => data.scene.remove(z));
      data.zombies = [];
      data.obstacles = [];
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

    