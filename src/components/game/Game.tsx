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

type Zombie = THREE.Group & {
  speed: number;
  health: number;
  type: 'walker' | 'runner' | 'brute';
  originalColor: THREE.Color;
  isZombie: true;
  lastMoanTime: number;
};

type Bullet = THREE.Mesh & {
  velocity: THREE.Vector3;
  spawnTime: number;
};

const ARENA_SIZE = 100;

function createHumanoidZombie(type: 'walker' | 'runner' | 'brute'): THREE.Group {
  const zombieGroup = new THREE.Group();
  const torsoColor = new THREE.Color(0x0d5223);
  const skinColor = new THREE.Color(0x5a6e5a);

  const scale = type === 'brute' ? 1.25 : 1;

  const torsoGeo = new THREE.BoxGeometry(1 * scale, 1.2 * scale, 0.5 * scale);
  const torsoMat = new THREE.MeshStandardMaterial({ color: torsoColor, roughness: 0.8, metalness: 0.1 });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.castShadow = true;
  torso.receiveShadow = true;
  zombieGroup.add(torso);

  const headGeo = new THREE.BoxGeometry(0.6 * scale, 0.6 * scale, 0.6 * scale);
  const headMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.9 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1 * scale;
  head.castShadow = true;
  head.receiveShadow = true;
  zombieGroup.add(head);

  const limbSize = { x: 0.25 * scale, y: 1.2 * scale, z: 0.25 * scale };
  const limbMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.9 });

  // Arms
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(limbSize.x, limbSize.y, limbSize.z), limbMat);
  leftArm.position.set(-0.75 * scale, 0, 0);
  leftArm.castShadow = true;
  leftArm.receiveShadow = true;
  zombieGroup.add(leftArm);

  const rightArm = leftArm.clone();
  rightArm.position.x = 0.75 * scale;
  zombieGroup.add(rightArm);

  // Legs
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(limbSize.x, limbSize.y, limbSize.z), limbMat);
  leftLeg.position.set(-0.3 * scale, -1.2 * scale, 0);
  leftLeg.castShadow = true;
  leftLeg.receiveShadow = true;
  zombieGroup.add(leftLeg);

  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.3 * scale;
  zombieGroup.add(rightLeg);

  return zombieGroup;
}


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
  score,
  zombiesRemaining,
  toast,
  containerRef,
}: GameProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameLoopRef = useRef<number>();
  const waveRef = useRef(wave);
  waveRef.current = wave;
  
  const audioContextRef = useRef<AudioContext | null>(null);

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

  const playSound = useCallback((type: 'shoot' | 'playerDamage' | 'zombieDamage' | 'zombieMoan') => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    
    if (type === 'shoot') {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, now);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
    } else if (type === 'playerDamage') {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(100, now);
        oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.2);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
        oscillator.start(now);
        oscillator.stop(now + 0.2);
    } else if (type === 'zombieDamage') {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(400, now);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        oscillator.start(now);
        oscillator.stop(now + 0.08);
    } else if (type === 'zombieMoan') {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.type = 'sawtooth';
        const startFreq = 80 + Math.random() * 20;
        oscillator.frequency.setValueAtTime(startFreq, now);
        oscillator.frequency.exponentialRampToValueAtTime(startFreq - 20, now + 1.5);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 1.5);
        oscillator.start(now);
        oscillator.stop(now + 1.5);
    }
  }, []);

  const startNewWave = useCallback(async (waveNumber: number) => {
    const { current: data } = gameData;
    
    try {
      const waveData = await generateZombieWave({
        waveNumber: waveNumber,
        difficulty: 'normal',
      });

      setWave(waveNumber);
      setZombiesRemaining(waveData.zombies.length);
      
      if(waveData.messageToPlayer) {
        setWaveMessage(waveData.messageToPlayer);
        setTimeout(() => setWaveMessage(''), 4000);
      }
      
      data.zombies.forEach(zombie => {
        data.scene.remove(zombie);
      });
      data.zombies = [];
      
      const isPositionValid = (position: THREE.Vector3) => {
        const tempZombieBox = new THREE.Box3(
            new THREE.Vector3(position.x - 1, position.y, position.z - 1),
            new THREE.Vector3(position.x + 1, position.y + 2, position.z + 1)
        );

        for (const obstacle of data.obstacles) {
            const obstacleBox = new THREE.Box3().setFromObject(obstacle);
            if (tempZombieBox.intersectsBox(obstacleBox)) {
                return false;
            }
        }
        return true;
      };

      waveData.zombies.forEach((zombieData: ZombieData) => {
        const zombie = createHumanoidZombie(zombieData.type) as Zombie;
        
        let position: THREE.Vector3;
        do {
            const x = (Math.random() - 0.5) * (ARENA_SIZE - 6);
            const z = (Math.random() - 0.5) * (ARENA_SIZE - 6);
            position = new THREE.Vector3(x, 1.2, z);
        } while (!isPositionValid(position));
        
        zombie.position.copy(position);
        
        zombie.castShadow = true;
        zombie.health = zombieData.health;
        zombie.speed = zombieData.speed;
        zombie.type = zombieData.type;
        zombie.isZombie = true;
        zombie.lastMoanTime = 0;
        
        zombie.traverse(child => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material instanceof THREE.MeshStandardMaterial) {
              (zombie as any).originalColor = child.material.color.clone();
            }
          }
        });
        
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
    
    data.scene.remove(zombie);
    zombie.traverse(child => {
        if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
        }
    });

    data.zombies = data.zombies.filter(z => z !== zombie);
    setScore(s => s + 100);

    const newRemaining = data.zombies.length;
    setZombiesRemaining(newRemaining);

    if (newRemaining <= 0) {
        setWave(w => w + 1);
    }
  }, [setScore, setZombiesRemaining, setWave]);
  
  const applyDamage = useCallback((zombie: Zombie, damage: number) => {
    playSound('zombieDamage');
    zombie.health -= damage;
    const damageColor = new THREE.Color(0xff0000);

    zombie.traverse(child => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.color.set(damageColor);
        }
    });

    setTimeout(() => {
        zombie.traverse(child => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
                child.material.color.copy((zombie as any).originalColor);
            }
        });
    }, 150);

    if (zombie.health <= 0) {
      despawnZombie(zombie);
    }
  }, [despawnZombie, playSound]);
  
  const handleShoot = useCallback(() => {
    const { current: data } = gameData;
    const time = performance.now();
    if (time - data.lastShotTime < 200) return;
    data.lastShotTime = time;
    playSound('shoot');

    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
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
    
    const intersects = raycaster.intersectObjects(data.zombies, true);

    if (intersects.length > 0) {
      let hitObject = intersects[0].object;
      let targetZombie: Zombie | null = null;
      
      let current: THREE.Object3D | null = hitObject;
      while (current) {
        if ((current as any).isZombie) {
            targetZombie = current as Zombie;
            break;
        }
        current = current.parent;
      }

      if (targetZombie && intersects[0].distance < 100) { 
          applyDamage(targetZombie, 20);
      }
    }
  }, [applyDamage, playSound]);

  useEffect(() => {
    if (gameState === 'playing' && !audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    } else if (gameState !== 'playing' && audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
  }, [gameState]);


  useEffect(() => {
    if (wave > 0 && gameState === 'playing' && zombiesRemaining === 0) {
      startNewWave(wave);
    }
  }, [wave, gameState, zombiesRemaining, startNewWave]);


  useEffect(() => {
    if (!mountRef.current) return;

    const { current: data } = gameData;
    const mount = mountRef.current;
    
    data.renderer = new THREE.WebGLRenderer({ antialias: true });
    data.renderer.setSize(window.innerWidth, window.innerHeight);
    data.renderer.shadowMap.enabled = true;
    data.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
    mount.appendChild(data.renderer.domElement);
    
    data.scene.background = new THREE.Color(0x87CEEB);
    data.scene.fog = new THREE.Fog(0xcccccc, 10, ARENA_SIZE * 0.85);

    data.camera.position.y = 1.6;

    data.player.position.y = 1;
    data.player.castShadow = true;
    data.player.add(data.camera);
    data.scene.add(data.player);
    
    function createAK47() {
      const ak47 = new THREE.Group();
      const metalMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.4 });
      const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.6 });

      // Body
      const bodyGeo = new THREE.BoxGeometry(0.1, 0.15, 0.6);
      const body = new THREE.Mesh(bodyGeo, metalMaterial);
      body.position.z = -0.2;
      ak47.add(body);

      // Barrel
      const barrelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 16);
      const barrel = new THREE.Mesh(barrelGeo, metalMaterial);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.z = -0.75;
      ak47.add(barrel);

      // Stock
      const stockGeo = new THREE.BoxGeometry(0.08, 0.12, 0.4);
      const stock = new THREE.Mesh(stockGeo, woodMaterial);
      stock.position.z = 0.3;
      stock.position.y = -0.05;
      stock.rotation.x = 0.2;
      ak47.add(stock);

      // Handguard
      const handguardGeo = new THREE.BoxGeometry(0.09, 0.08, 0.4);
      const handguard = new THREE.Mesh(handguardGeo, woodMaterial);
      handguard.position.z = -0.4;
      handguard.position.y = 0.02;
      ak47.add(handguard);

      // Magazine
      const magazineGeo = new THREE.BoxGeometry(0.08, 0.3, 0.2);
      const magazine = new THREE.Mesh(magazineGeo, metalMaterial);
      magazine.position.z = -0.15;
      magazine.position.y = -0.18;
      magazine.rotation.x = -0.3;
      ak47.add(magazine);

      // Sight
      const sightGeo = new THREE.BoxGeometry(0.02, 0.05, 0.02);
      const frontSight = new THREE.Mesh(sightGeo, metalMaterial);
      frontSight.position.set(0, 0.08, -0.9);
      ak47.add(frontSight);
      const rearSight = new THREE.Mesh(sightGeo, metalMaterial);
      rearSight.position.set(0, 0.1, -0.05);
      ak47.add(rearSight);
      
      ak47.position.set(0.3, -0.3, -0.8);
      ak47.rotation.y = -0.1; // Slight angle
      
      return ak47;
    }

    const gun = createAK47();
    data.camera.add(gun);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    data.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 250;
    directionalLight.shadow.camera.left = -ARENA_SIZE/2;
    directionalLight.shadow.camera.right = ARENA_SIZE/2;
    directionalLight.shadow.camera.top = ARENA_SIZE/2;
    directionalLight.shadow.camera.bottom = -ARENA_SIZE/2;
    data.scene.add(directionalLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE),
      new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.9, metalness: 0 }) // Sandy color
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    data.scene.add(floor);
    
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.1, roughness: 0.8 });
    const wallY = 2.5;
    const wallDepth = 1;
    const halfArena = ARENA_SIZE / 2;
    
    const wall1 = new THREE.Mesh(new THREE.BoxGeometry(ARENA_SIZE, 5, wallDepth), wallMaterial);
    wall1.position.z = -halfArena; wall1.position.y = wallY; wall1.receiveShadow = true; wall1.castShadow = true;
    data.scene.add(wall1);
    const wall2 = new THREE.Mesh(new THREE.BoxGeometry(ARENA_SIZE, 5, wallDepth), wallMaterial);
    wall2.position.z = halfArena; wall2.position.y = wallY; wall2.receiveShadow = true; wall2.castShadow = true;
    data.scene.add(wall2);
    const wall3 = new THREE.Mesh(new THREE.BoxGeometry(wallDepth, 5, ARENA_SIZE), wallMaterial);
    wall3.position.x = -halfArena; wall3.position.y = wallY; wall3.receiveShadow = true; wall3.castShadow = true;
    data.scene.add(wall3);
    const wall4 = new THREE.Mesh(new THREE.BoxGeometry(wallDepth, 5, ARENA_SIZE), wallMaterial);
    wall4.position.x = halfArena; wall4.position.y = wallY; wall4.receiveShadow = true; wall4.castShadow = true;
    data.scene.add(wall4);

    const concreteMaterial = new THREE.MeshStandardMaterial({ color: 0xa9a9a9, roughness: 0.7, metalness: 0.1 });
    const darkWoodMaterial = new THREE.MeshStandardMaterial({ color: 0x6B4F35, roughness: 0.8 });

    const createObstacle = (
      position: THREE.Vector3,
      size: THREE.Vector3,
      material: THREE.Material,
      rotation: number = 0
    ) => {
      const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
      const obstacle = new THREE.Mesh(geometry, material);
      obstacle.position.copy(position);
      obstacle.rotation.y = rotation;
      obstacle.castShadow = true;
      obstacle.receiveShadow = true;
      data.scene.add(obstacle);
      data.obstacles.push(obstacle);
      return obstacle;
    };
    
    // Central command building
    createObstacle(new THREE.Vector3(0, 2, 0), new THREE.Vector3(12, 4, 15), concreteMaterial);
    
    // Barracks
    createObstacle(new THREE.Vector3(-30, 1.5, 20), new THREE.Vector3(20, 3, 8), darkWoodMaterial);
    createObstacle(new THREE.Vector3(30, 1.5, -20), new THREE.Vector3(20, 3, 8), darkWoodMaterial, Math.PI / 4);

    // Watchtowers
    const createWatchtower = (position: THREE.Vector3) => {
        for (let i = 0; i < 4; i++) {
            const leg = createObstacle(new THREE.Vector3(), new THREE.Vector3(0.5, 6, 0.5), darkWoodMaterial);
            leg.position.set(position.x + (i % 2 === 0 ? -2 : 2), position.y - 3, position.z + (i < 2 ? -2 : 2));
        }
        const platform = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 5), darkWoodMaterial);
        platform.position.set(position.x, position.y + 0.25, position.z);
        platform.castShadow = true;
        platform.receiveShadow = true;
        data.scene.add(platform);
        data.obstacles.push(platform);
    }
    createWatchtower(new THREE.Vector3(40, 3, 40));
    createWatchtower(new THREE.Vector3(-40, 3, -40));

    // Jersey barriers for cover
    const barrierGeo = new THREE.BoxGeometry(2, 1.5, 6);
    const barrierMat = concreteMaterial.clone();
    
    const barrierPositions = [
        { x: -15, z: 10, rot: 0.1 },
        { x: -12, z: 15, rot: 0.1 },
        { x: 15, z: -10, rot: -0.2 },
        { x: 18, z: -15, rot: -0.2 },
        { x: 25, z: 25, rot: Math.PI / 5 },
        { x: -25, z: -25, rot: -Math.PI / 5 },
    ];
    
    barrierPositions.forEach(pos => {
        const barrier = new THREE.Mesh(barrierGeo, barrierMat);
        barrier.position.set(pos.x, 0.75, pos.z);
        barrier.rotation.y = pos.rot;
        barrier.castShadow = true;
        barrier.receiveShadow = true;
        data.scene.add(barrier);
        data.obstacles.push(barrier);
    });

    // Barrels
    const barrelGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
    const barrelMat = new THREE.MeshStandardMaterial({color: 0x8B4513, roughness: 0.6, metalness: 0.4});
    const barrelPositions = [{x: 10, z: 10}, {x: 10.5, z: 10.5}, {x: 10.2, z: 9.5}, {x: -20, z: 5}, {x: -20.5, z: 4.5}];
    barrelPositions.forEach(pos => {
      const barrel = new THREE.Mesh(barrelGeo, barrelMat);
      barrel.position.set(pos.x, 0.5, pos.z);
      barrel.castShadow = true;
      barrel.receiveShadow = true;
      data.scene.add(barrel);
      data.obstacles.push(barrel);
    })

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
        if (!data.renderer) return;
        data.camera.aspect = window.innerWidth / window.innerHeight;
        data.camera.updateProjectionMatrix();
        data.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);
    
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
      
      // Separate axis collision detection
      const playerCollider = new THREE.Box3().setFromObject(data.player);
      const playerHeight = (playerCollider.max.y - playerCollider.min.y);

      // Vertical collision
      data.player.position.y += data.playerVelocity.y * delta;
      data.onGround = false;

      if (data.player.position.y < playerHeight / 2) {
          data.player.position.y = playerHeight / 2;
          data.playerVelocity.y = 0;
          data.onGround = true;
      }

      data.obstacles.forEach(obstacle => {
          const obstacleCollider = new THREE.Box3().setFromObject(obstacle);
          const currentCollider = new THREE.Box3().setFromObject(data.player);

          if (currentCollider.intersectsBox(obstacleCollider)) {
            const penetration = new THREE.Vector3();
            currentCollider.getCenter(penetration).sub(obstacleCollider.getCenter(new THREE.Vector3()));
            
            // Check vertical collision (landing on top)
            if (data.playerVelocity.y <= 0 && penetration.y > 0 && Math.abs(penetration.y) > Math.abs(penetration.x) && Math.abs(penetration.y) > Math.abs(penetration.z)) {
              data.player.position.y = obstacleCollider.max.y + playerHeight / 2;
              data.playerVelocity.y = 0;
              data.onGround = true;
            }
          }
      });
      
      // Horizontal collision
      data.player.position.x += data.playerVelocity.x * delta;
      data.player.position.z += data.playerVelocity.z * delta;

      data.obstacles.forEach(obstacle => {
        const obstacleCollider = new THREE.Box3().setFromObject(obstacle);
        const currentCollider = new THREE.Box3().setFromObject(data.player);
        if (currentCollider.intersectsBox(obstacleCollider)) {
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
    });

      const playerRadius = 0.5;
      const halfSize = ARENA_SIZE / 2 - playerRadius;
      data.player.position.x = THREE.MathUtils.clamp(data.player.position.x, -halfSize, halfSize);
      data.player.position.z = THREE.MathUtils.clamp(data.player.position.z, -halfSize, halfSize);

      data.zombies.forEach(zombie => {
        const zombiePrevPosition = zombie.position.clone();
        
        // Simple animation
        const bob = Math.sin(time * 0.005 * zombie.speed * 50);
        zombie.children[2].rotation.x = bob * 0.4; // left arm
        zombie.children[3].rotation.x = -bob * 0.4; // right arm
        zombie.children[4].rotation.x = -bob * 0.6; // left leg
        zombie.children[5].rotation.x = bob * 0.6; // right leg

        // Ambient sound
        const timeSinceMoan = time - zombie.lastMoanTime;
        if (timeSinceMoan > 5000 + Math.random() * 5000) { // Moan every 5-10 seconds
            playSound('zombieMoan');
            zombie.lastMoanTime = time;
        }

        zombie.lookAt(data.player.position);
        const distance = zombie.position.distanceTo(data.player.position);

        if (distance > 2) {
            zombie.translateZ(zombie.speed);
        } else {
            const now = performance.now();
            if (now - data.lastDamageTime > 1000) { 
                data.lastDamageTime = now;
                setHealth(h => {
                    const newHealth = Math.max(0, h - 10);
                    if (newHealth > 0) {
                        playSound('playerDamage');
                    }
                    return newHealth;
                });
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

        if(time - bullet.spawnTime > 2000) {
            data.scene.remove(bullet);
            bullet.geometry.dispose();
            (bullet.material as THREE.Material).dispose();
            data.bullets.splice(index, 1);
        }
      });

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
      
      data.scene.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if(Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            (child.material as THREE.Material).dispose();
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
