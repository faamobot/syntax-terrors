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
  setZombiesRemaining: Dispatch<SetStateAction<number>>;
  onGameOver: () => void;
  onPause: () => void;
  onTakeDamage: () => void;
  setWaveMessage: Dispatch<SetStateAction<string>>;
  wave: number;
  score: number;
  health: number;
  zombiesRemaining: number;
  toast: ReturnType<typeof useToast>['toast'];
  containerRef: React.RefObject<HTMLDivElement>;
};

type Zombie = THREE.Mesh & {
  speed: number;
  health: number;
  type: 'walker' | 'runner' | 'brute';
  originalColor: THREE.Color;
};

type Bullet = THREE.Mesh & {
  velocity: THREE.Vector3;
  spawnTime: number;
};

const ARENA_SIZE = 100;

export default function Game({
  gameState,
  setScore,
  setWave,
  setHealth,
  setZombiesRemaining,
  onGameOver,
  onPause,
  onTakeDamage,
  setWaveMessage,
  wave,
  health,
  zombiesRemaining,
  toast,
  containerRef
}: GameProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameLoopRef = useRef<number>();
  const waveRef = useRef(wave);
  waveRef.current = wave;
  
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
    bullets: [] as Bullet[],
    
    input: {
      forward: false,
      backward: false,
      left: false,
      right: false,
      shoot: false,
      jump: false,
      sprint: false,
      lookUp: false,
      lookDown: false,
      lookLeft: false,
      lookRight: false,
    },
    
    playerVelocity: new THREE.Vector3(),
    onGround: true,
    
    lastShotTime: 0,
    lastDamageTime: 0,
  });

  const startNewWave = useCallback(async (waveNumber: number) => {
    const { current: data } = gameData;
    
    try {
      setWave(waveNumber);
      const waveData = await generateZombieWave({
        waveNumber: waveNumber,
        difficulty: 'normal',
      });
      
      setZombiesRemaining(waveData.zombies.length);
      
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

      // Clear old zombies before adding new ones
      data.zombies.forEach(zombie => {
        zombie.geometry.dispose();
        if (Array.isArray(zombie.material)) {
            zombie.material.forEach(material => material.dispose());
        } else {
            zombie.material.dispose();
        }
        data.scene.remove(zombie);
      });
      data.zombies = [];

      waveData.zombies.forEach((zombieData: ZombieData) => {
        const typeInfo = zombieTypes[zombieData.type];
        const zombieMaterial = new THREE.MeshStandardMaterial({ color: zombieColor });
        const zombie = new THREE.Mesh(typeInfo.geometry, zombieMaterial) as Zombie;
        
        const positionX = (Math.random() - 0.5) * (ARENA_SIZE - 2);
        const positionZ = (Math.random() - 0.5) * (ARENA_SIZE - 2);
        zombie.position.set(
          positionX,
          typeInfo.geometry.parameters.height / 2,
          positionZ
        );
        
        zombie.castShadow = true;
        zombie.health = zombieData.health;
        zombie.speed = zombieData.speed;
        zombie.type = zombieData.type;
        zombie.originalColor = zombieColor.clone();
        
        data.scene.add(zombie);
        data.zombies.push(zombie);
      });
      
    } catch (e) {
      console.error("Failed to generate zombie wave:", e);
      toast({
        title: "Error",
        description: "Could not generate next zombie wave. Please try again.",
        variant: "destructive",
      });
    }
  }, [setWaveMessage, toast, setZombiesRemaining, setWave]);

  const despawnZombie = useCallback((zombie: Zombie) => {
    const { current: data } = gameData;
    zombie.geometry.dispose();
    if (Array.isArray(zombie.material)) {
        zombie.material.forEach(material => material.dispose());
    } else {
        zombie.material.dispose();
    }
    data.scene.remove(zombie);
    data.zombies = data.zombies.filter(z => z !== zombie);
    setScore(s => s + 100);

    setZombiesRemaining(prev => {
        const newCount = prev - 1;
        if (newCount === 0) {
            startNewWave(waveRef.current + 1);
        }
        return newCount;
    });
  }, [setScore, setZombiesRemaining, startNewWave]);

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

    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const bulletGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial) as Bullet;
    
    const vector = new THREE.Vector3();
    data.camera.getWorldDirection(vector);

    bullet.position.copy(data.player.position).add(vector.multiplyScalar(0.8));
    bullet.position.y += 1.5;

    bullet.velocity = vector.clone().multiplyScalar(150);
    bullet.spawnTime = time;

    data.scene.add(bullet);
    data.bullets.push(bullet);

    const raycaster = new THREE.Raycaster(
        bullet.position.clone(),
        vector.normalize()
    );
    
    const intersects = raycaster.intersectObjects(data.zombies);

    if (intersects.length > 0) {
      const zombie = intersects[0].object as Zombie;
      if (intersects[0].distance < 100) { // Limit range
          applyDamage(zombie, 20);
      }
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
    
    const gunGeo = new THREE.BoxGeometry(0.1, 0.2, 0.5); 
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const gun = new THREE.Mesh(gunGeo, gunMat);
    gun.position.set(0.3, -0.3, -0.8);
    data.camera.add(gun);

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

    const obstacleMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });

    const createObstacle = (
      position: THREE.Vector3,
      size: THREE.Vector3,
      rotation: number = 0
    ) => {
      const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
      const obstacle = new THREE.Mesh(geometry, obstacleMaterial);
      obstacle.position.copy(position);
      obstacle.rotation.y = rotation;
      obstacle.castShadow = true;
      obstacle.receiveShadow = true;
      data.scene.add(obstacle);
      data.obstacles.push(obstacle);
    };

    // Central building
    createObstacle(new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(10, 3, 10));

    // Outer walls/barriers
    createObstacle(new THREE.Vector3(-20, 1, 25), new THREE.Vector3(20, 2, 2), Math.PI / 4);
    createObstacle(new THREE.Vector3(20, 1, -25), new THREE.Vector3(20, 2, 2), Math.PI / 4);
    
    // Smaller cover objects
    createObstacle(new THREE.Vector3(15, 0.75, 15), new THREE.Vector3(4, 1.5, 6));
    createObstacle(new THREE.Vector3(-15, 0.75, -15), new THREE.Vector3(6, 1.5, 4));
    createObstacle(new THREE.Vector3(30, 1, 0), new THREE.Vector3(2, 2, 8));
    createObstacle(new THREE.Vector3(-30, 1, 0), new THREE.Vector3(2, 2, 8));

    // Jersey barriers
    const barrierGeo = new THREE.BoxGeometry(2, 1.5, 6);
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0xa9a9a9 });

    const barrier1 = new THREE.Mesh(barrierGeo, barrierMat);
    barrier1.position.set(-10, 0.75, 20);
    barrier1.castShadow = true;
    barrier1.receiveShadow = true;
    data.scene.add(barrier1);
    data.obstacles.push(barrier1);

    const barrier2 = new THREE.Mesh(barrierGeo, barrierMat);
    barrier2.position.set(-10, 0.75, 13);
    barrier2.castShadow = true;
    barrier2.receiveShadow = true;
    data.scene.add(barrier2);
    data.obstacles.push(barrier2);
    
    const barrier3 = new THREE.Mesh(barrierGeo, barrierMat);
    barrier3.position.set(10, 0.75, -20);
    barrier3.rotation.y = Math.PI/2;
    barrier3.castShadow = true;
    barrier3.receiveShadow = true;
    data.scene.add(barrier3);
    data.obstacles.push(barrier3);

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': data.input.forward = true; break;
        case 'KeyS': data.input.backward = true; break;
        case 'KeyA': data.input.left = true; break;
        case 'KeyD': data.input.right = true; break;
        case 'ArrowUp': data.input.lookUp = true; break;
        case 'ArrowDown': data.input.lookDown = true; break;
        case 'ArrowLeft': data.input.lookLeft = true; break;
        case 'ArrowRight': data.input.lookRight = true; break;
        case 'KeyF': data.input.shoot = true; break;
        case 'Space': data.input.jump = true; break;
        case 'ShiftLeft': data.input.sprint = true; break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
       switch (e.code) {
        case 'KeyW': data.input.forward = false; break;
        case 'KeyS': data.input.backward = false; break;
        case 'KeyA': data.input.left = false; break;
        case 'KeyD': data.input.right = false; break;
        case 'ArrowUp': data.input.lookUp = false; break;
        case 'ArrowDown': data.input.lookDown = false; break;
        case 'ArrowLeft': data.input.lookLeft = false; break;
        case 'ArrowRight': data.input.lookRight = false; break;
        case 'KeyF': data.input.shoot = false; break;
        case 'Space': data.input.jump = false; break;
        case 'ShiftLeft': data.input.sprint = false; break;
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
    
    startNewWave(1);

    const clock = new THREE.Clock();
    const animate = () => {
      gameLoopRef.current = requestAnimationFrame(animate);
      if (gameState !== 'playing' || !data.renderer) return;

      const delta = clock.getDelta();
      const time = performance.now();
      
      const cameraSpeed = 1.5 * delta;
      if (data.input.lookUp) data.camera.rotation.x += cameraSpeed;
      if (data.input.lookDown) data.camera.rotation.x -= cameraSpeed;
      if (data.input.lookLeft) data.player.rotation.y += cameraSpeed;
      if (data.input.lookRight) data.player.rotation.y -= cameraSpeed;
      data.camera.rotation.x = THREE.MathUtils.clamp(data.camera.rotation.x, -Math.PI / 2, Math.PI / 2);

      const baseSpeed = 8.0;
      const sprintSpeed = 12.0;
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
        data.playerVelocity.y = 12.0; // Jump force
        data.onGround = false;
      }
      
      data.playerVelocity.y -= 20.0 * delta; 
      
      const prevPosition = data.player.position.clone();
      
      data.player.position.x += data.playerVelocity.x * delta;
      data.player.position.y += data.playerVelocity.y * delta;
      data.player.position.z += data.playerVelocity.z * delta;

      data.onGround = false;
      const playerCollider = new THREE.Box3().setFromObject(data.player);
      const playerHeight = (playerCollider.max.y - playerCollider.min.y);
      
      if (data.player.position.y < playerHeight / 2) {
          data.player.position.y = playerHeight / 2;
          data.playerVelocity.y = 0;
          data.onGround = true;
      }

      data.obstacles.forEach(obstacle => {
          const obstacleCollider = new THREE.Box3().setFromObject(obstacle);
          const currentCollider = new THREE.Box3().setFromObject(data.player);

          if (currentCollider.intersectsBox(obstacleCollider)) {
            const wasOnTop = prevPosition.y >= obstacleCollider.max.y;

            if (data.playerVelocity.y <= 0 && wasOnTop && currentCollider.min.y < obstacleCollider.max.y) {
              data.player.position.y = obstacleCollider.max.y + playerHeight / 2;
              data.playerVelocity.y = 0;
              data.onGround = true;
            } else if (!wasOnTop) {
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
        const zombiePrevPosition = zombie.position.clone();
        const zombieHeight = (zombie.geometry as THREE.BoxGeometry).parameters.height;
        zombie.position.y = zombieHeight / 2;

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
        
        const zombieCollider = new THREE.Box3().setFromObject(zombie);
        let corrected = false;
        data.obstacles.forEach(obstacle => {
            if (corrected) return;
            const obstacleCollider = new THREE.Box3().setFromObject(obstacle);
            if (zombieCollider.intersectsBox(obstacleCollider)) {
                zombie.position.copy(zombiePrevPosition);
                corrected = true;
            }
        });
      });
      
      data.bullets.forEach((bullet, index) => {
        bullet.position.x += bullet.velocity.x * delta;
        bullet.position.y += bullet.velocity.y * delta;
        bullet.position.z += bullet.velocity.z * delta;

        // Remove bullet after 2 seconds
        if(time - bullet.spawnTime > 2000) {
            data.scene.remove(bullet);
            bullet.geometry.dispose();
            (bullet.material as THREE.Material).dispose();
            data.bullets.splice(index, 1);
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
      
      data.scene.children.forEach(child => {
        if(child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if(Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      
      data.zombies = [];
      data.obstacles = [];
      data.bullets = [];
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
