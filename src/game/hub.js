import * as THREE from 'three';
import { clamp, lerp, resolveCircle } from './physics.js';
import { getStats } from './progression.js';

const PORTALS = [
  { id: 'bellwright', x: -13, z: -6, color: 0x62efd1, name: 'The Unstrung Bell' },
  { id: 'archivist', x: 0, z: -16, color: 0xb59aff, name: 'The Stolen Minute' },
  { id: 'cartographer', x: 13, z: -6, color: 0xff9b91, name: 'The World Unmade' }
];

function stoneTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#334348';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4200; i++) {
    const shade = 35 + Math.random() * 40;
    ctx.fillStyle = `rgba(${shade},${shade + 10},${shade + 12},${Math.random() * 0.25})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, Math.random() * 3 + 1, Math.random() * 3 + 1);
  }
  ctx.strokeStyle = 'rgba(9,18,22,.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    let x = Math.random() * 256;
    let y = Math.random() * 256;
    ctx.moveTo(x, y);
    for (let j = 0; j < 4; j++) {
      x += Math.random() * 35 - 17;
      y += Math.random() * 35 - 17;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 5);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function labelSprite(text, color = '#d9f9f2') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.font = '32px Georgia';
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 48);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(5.4, 1, 1);
  return sprite;
}

export class RuinHub {
  constructor(canvas, callbacks, audio) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.audio = audio;
    this.active = false;
    this.time = 0;
    this.attackCooldown = 0;
    this.damageCooldown = 0;
    this.player = { x: 0, z: 10, health: 100, angle: Math.PI };
    this.obstacles = [];
    this.enemies = [];
    this.portalObjects = new Map();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a2029);
    this.scene.fog = new THREE.FogExp2(0x0a2029, 0.021);
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 140);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.28;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.buildWorld();
    this.resize();
  }

  buildWorld() {
    const scene = this.scene;
    const hemi = new THREE.HemisphereLight(0xa8e4e2, 0x171923, 2.15);
    scene.add(hemi);
    const moon = new THREE.DirectionalLight(0xd6edff, 3.8);
    moon.position.set(-12, 24, 9);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = moon.shadow.camera.bottom = -28;
    moon.shadow.camera.right = moon.shadow.camera.top = 28;
    moon.shadow.bias = -0.0005;
    scene.add(moon);
    const rim = new THREE.DirectionalLight(0x5de6ca, 1.2);
    rim.position.set(15, 8, -18);
    scene.add(rim);

    const texture = stoneTexture();
    const stone = new THREE.MeshStandardMaterial({ map: texture, color: 0xa5b3aa, roughness: 0.94, metalness: 0.05 });
    const darkStone = new THREE.MeshStandardMaterial({ map: texture, color: 0x344b50, roughness: 0.9 });
    const island = new THREE.Mesh(new THREE.CylinderGeometry(23, 20, 2.3, 64, 2), stone);
    island.position.y = -1.3;
    island.receiveShadow = true;
    island.castShadow = true;
    scene.add(island);
    const under = new THREE.Mesh(new THREE.ConeGeometry(20, 15, 48), darkStone);
    under.position.y = -9.5;
    under.rotation.x = Math.PI;
    scene.add(under);

    const water = new THREE.Mesh(
      new THREE.CircleGeometry(80, 80),
      new THREE.MeshPhysicalMaterial({ color: 0x071e29, roughness: 0.22, metalness: 0.4, transparent: true, opacity: 0.8 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -2.55;
    scene.add(water);
    this.water = water;

    const ringMaterial = new THREE.MeshStandardMaterial({ color: 0x89c7b9, emissive: 0x3fb49f, emissiveIntensity: 1.8, roughness: 0.4 });
    for (const radius of [4.3, 9.5, 19.8]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.035, radius + 0.035, 96), ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.025;
      scene.add(ring);
    }
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2;
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.65), ringMaterial);
      rune.position.set(Math.sin(angle) * 9.5, 0.035, Math.cos(angle) * 9.5);
      rune.rotation.y = angle;
      scene.add(rune);
    }

    const dais = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.8, 0.55, 12), darkStone);
    base.position.y = 0.25;
    base.receiveShadow = true;
    dais.add(base);
    const inset = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.7, 0.25, 12), stone);
    inset.position.y = 0.62;
    dais.add(inset);
    const lens = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), ringMaterial);
    lens.position.y = 1.75;
    lens.scale.y = 1.6;
    dais.add(lens);
    const light = new THREE.PointLight(0x6fffe0, 12, 10, 2);
    light.position.y = 2;
    dais.add(light);
    scene.add(dais);
    this.lens = lens;
    this.obstacles.push({ x: 0, z: 0, radius: 2.8 });

    const pillarGeometry = new THREE.CylinderGeometry(0.58, 0.75, 5.4, 8);
    const capGeometry = new THREE.BoxGeometry(1.7, 0.35, 1.7);
    const pillarPositions = [[-8, 4], [8, 4], [-8, -7], [8, -7], [-17, 5], [17, 5], [-6, 15], [6, 15]];
    for (const [x, z] of pillarPositions) {
      const height = 0.75 + Math.random() * 0.35;
      const pillar = new THREE.Mesh(pillarGeometry, stone);
      pillar.position.set(x, 2.7 * height, z);
      pillar.scale.y = height;
      pillar.rotation.y = Math.random();
      pillar.castShadow = pillar.receiveShadow = true;
      scene.add(pillar);
      const cap = new THREE.Mesh(capGeometry, darkStone);
      cap.position.set(x, 5.35 * height, z);
      cap.rotation.y = pillar.rotation.y;
      cap.castShadow = true;
      scene.add(cap);
      this.obstacles.push({ x, z, radius: 0.85 });
    }

    for (let i = 0; i < 42; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 19 + Math.random() * 3;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + Math.random() * 0.7, 0), darkStone);
      rock.position.set(Math.sin(angle) * radius, Math.random() * 0.3, Math.cos(angle) * radius);
      rock.scale.set(1, 0.5 + Math.random(), 1);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      scene.add(rock);
    }

    for (const portal of PORTALS) this.buildPortal(portal, stone, darkStone);
    this.buildCharacter();
    this.buildEnemies();
    this.buildParticles();
    this.buildSky();
  }

  buildPortal(data, stone, darkStone) {
    const group = new THREE.Group();
    group.position.set(data.x, 0, data.z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.6, 0.45, 10), darkStone);
    base.position.y = 0.2;
    base.receiveShadow = true;
    group.add(base);
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.65, 4.3, 0.85), stone);
      pillar.position.set(side * 1.55, 2.3, 0);
      pillar.rotation.z = side * -0.08;
      pillar.castShadow = true;
      group.add(pillar);
    }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.58, 0.34, 8, 32, Math.PI), stone);
    arch.position.y = 4.25;
    arch.rotation.z = 0;
    group.add(arch);
    const material = new THREE.MeshBasicMaterial({ color: data.color, transparent: true, opacity: 0.18, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const veil = new THREE.Mesh(new THREE.CircleGeometry(1.42, 40), material);
    veil.position.y = 2.75;
    group.add(veil);
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.025, 6, 64), new THREE.MeshBasicMaterial({ color: data.color, transparent: true, opacity: 0.8 }));
    orbit.position.y = 2.75;
    group.add(orbit);
    const glow = new THREE.PointLight(data.color, 8, 8, 2);
    glow.position.y = 2.5;
    group.add(glow);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.45, 14, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: data.color, transparent: true, opacity: 0.12, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    beam.position.y = 9;
    group.add(beam);
    const label = labelSprite(data.name, `#${data.color.toString(16).padStart(6, '0')}`);
    label.position.set(0, 5.65, 0);
    group.add(label);
    this.scene.add(group);
    this.portalObjects.set(data.id, { group, veil, orbit, glow, data });
    this.obstacles.push({ x: data.x - 1.55, z: data.z, radius: 0.55 }, { x: data.x + 1.55, z: data.z, radius: 0.55 });
  }

  buildCharacter() {
    const group = new THREE.Group();
    const cloakMaterial = new THREE.MeshStandardMaterial({ color: 0x183c48, roughness: 0.75 });
    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x75f3dc, emissive: 0x2a9e91, emissiveIntensity: 1.1 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xe9d7bd, roughness: 0.8 });
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.5, 10, 1, true), cloakMaterial);
    cloak.position.y = 0.82;
    cloak.castShadow = true;
    group.add(cloak);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.55, 4, 8), cloakMaterial);
    body.position.y = 1.3;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), skin);
    head.position.y = 2.02;
    head.castShadow = true;
    group.add(head);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), cloakMaterial);
    hood.position.y = 2.08;
    group.add(hood);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.055, 6, 20), trimMaterial);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.72;
    group.add(scarf);
    const sword = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.2, 0.025), trimMaterial);
    blade.position.y = 0.6;
    sword.add(blade);
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.08), trimMaterial);
    sword.add(hilt);
    sword.position.set(0.55, 1.1, 0);
    sword.rotation.z = -0.35;
    group.add(sword);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.035;
    group.add(shadow);
    this.scene.add(group);
    this.character = group;
    this.sword = sword;
    this.cloak = cloak;
  }

  buildEnemies() {
    const positions = [[-6, 9], [7, 10], [-15, -1], [15, 0], [-5, -10], [6, -11]];
    for (const [x, z] of positions) {
      const group = new THREE.Group();
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), new THREE.MeshStandardMaterial({ color: 0x371d4b, emissive: 0xb74b9b, emissiveIntensity: 1.8, roughness: 0.25 }));
      core.castShadow = true;
      group.add(core);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.035, 6, 24), new THREE.MeshBasicMaterial({ color: 0xff79bd }));
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      const light = new THREE.PointLight(0xf357ac, 3, 4);
      group.add(light);
      group.position.set(x, 1.1, z);
      this.scene.add(group);
      this.enemies.push({ group, core, ring, x, z, spawnX: x, spawnZ: z, health: 42, alive: true, cooldown: 0, phase: Math.random() * 6 });
    }
  }

  buildParticles() {
    const count = 420;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 29;
      positions[i * 3] = Math.sin(angle) * radius;
      positions[i * 3 + 1] = Math.random() * 12;
      positions[i * 3 + 2] = Math.cos(angle) * radius;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0x8fffe5, size: 0.055, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false });
    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  buildSky() {
    const count = 500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = 55 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.45;
      positions[i * 3] = Math.sin(theta) * Math.cos(phi) * radius;
      positions[i * 3 + 1] = Math.sin(phi) * radius;
      positions[i * 3 + 2] = Math.cos(theta) * Math.cos(phi) * radius;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xc6f7ff, size: 0.18, transparent: true, opacity: 0.8 })));
    const moon = new THREE.Mesh(new THREE.SphereGeometry(4, 32, 24), new THREE.MeshBasicMaterial({ color: 0xb9e5e3 }));
    moon.position.set(-30, 27, -55);
    this.scene.add(moon);
  }

  enter(state) {
    this.active = true;
    this.player.x = 0;
    this.player.z = 10;
    this.player.health = getStats(state).maxHealth;
    this.character.position.set(0, 0, 10);
    this.updateUnlocks(state);
  }

  setTitle() {
    this.active = false;
  }

  updateUnlocks(state) {
    for (const [id, portal] of this.portalObjects) {
      const unlocked = state.unlocked.includes(id);
      const complete = state.completed.includes(id);
      portal.veil.material.opacity = unlocked ? 0.25 : 0.035;
      portal.glow.intensity = unlocked ? 9 : 0.5;
      portal.orbit.material.color.setHex(complete ? 0xf5d78b : portal.data.color);
    }
    this.lens.material.emissiveIntensity = state.artifact ? 4 : 1.2;
  }

  resize() {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(dt, input, state) {
    this.time += dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.damageCooldown = Math.max(0, this.damageCooldown - dt);
    const stats = getStats(state);
    this.player.health = Math.min(stats.maxHealth, this.player.health + dt * 2.2);
    if (this.active) {
      let dx = Number(input.down('KeyD', 'ArrowRight')) - Number(input.down('KeyA', 'ArrowLeft'));
      let dz = Number(input.down('KeyS', 'ArrowDown')) - Number(input.down('KeyW', 'ArrowUp'));
      const length = Math.hypot(dx, dz) || 1;
      dx /= length;
      dz /= length;
      const speed = 5.2 + Math.min(1, (state.level - 1) * 0.1);
      this.player.x += dx * speed * dt;
      this.player.z += dz * speed * dt;
      const radius = Math.hypot(this.player.x, this.player.z);
      if (radius > 21.2) {
        this.player.x *= 21.2 / radius;
        this.player.z *= 21.2 / radius;
      }
      for (const obstacle of this.obstacles) Object.assign(this.player, resolveCircle(this.player, obstacle, 0.45));
      if (dx || dz) {
        const target = Math.atan2(dx, dz);
        let difference = target - this.player.angle;
        difference = Math.atan2(Math.sin(difference), Math.cos(difference));
        this.player.angle += difference * Math.min(1, dt * 12);
        this.character.position.y = Math.abs(Math.sin(this.time * 10)) * 0.07;
        this.cloak.rotation.z = Math.sin(this.time * 10) * 0.04;
      } else {
        this.character.position.y = Math.sin(this.time * 2.5) * 0.025;
      }
      if ((input.consume('KeyJ') || input.consume('Space')) && this.attackCooldown <= 0) this.attack(state);
      this.updateEnemies(dt, state);
      this.updateInteraction(input, state);
      this.character.position.x = this.player.x;
      this.character.position.z = this.player.z;
      this.character.rotation.y = this.player.angle;
      this.sword.rotation.z = lerp(this.sword.rotation.z, -0.35, Math.min(1, dt * 9));
      this.callbacks.onHud({ health: this.player.health, maxHealth: stats.maxHealth, focus: stats.maxFocus, maxFocus: stats.maxFocus, prompt: this.prompt || '' });
    } else {
      this.character.rotation.y += dt * 0.1;
    }
    this.animateWorld(dt);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  animateWorld(dt) {
    this.lens.rotation.y += dt * 0.7;
    this.lens.position.y = 1.75 + Math.sin(this.time * 1.5) * 0.12;
    this.particles.rotation.y += dt * 0.012;
    const positions = this.particles.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      let y = positions.getY(i) + dt * (0.08 + (i % 7) * 0.015);
      if (y > 12) y = 0;
      positions.setY(i, y);
    }
    positions.needsUpdate = true;
    this.water.material.opacity = 0.78 + Math.sin(this.time * 0.4) * 0.04;
    for (const portal of this.portalObjects.values()) {
      portal.orbit.rotation.z += dt * 0.35;
      portal.veil.material.opacity += Math.sin(this.time * 2 + portal.data.x) * dt * 0.015;
    }
  }

  updateCamera(dt) {
    let target;
    let desired;
    if (this.active) {
      target = new THREE.Vector3(this.player.x, 1, this.player.z - 1.5);
      desired = new THREE.Vector3(this.player.x, 15.5, this.player.z + 13);
    } else {
      const angle = this.time * 0.035 + 0.4;
      target = new THREE.Vector3(0, 1.5, -3);
      desired = new THREE.Vector3(Math.sin(angle) * 25, 14, Math.cos(angle) * 25);
    }
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * (this.active ? 5 : 1.2)));
    this.camera.lookAt(target);
  }

  attack(state) {
    this.attackCooldown = 0.42;
    this.sword.rotation.z = -2.4;
    this.audio.sfx('attack');
    let hit = false;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const distance = Math.hypot(enemy.x - this.player.x, enemy.z - this.player.z);
      if (distance > 2.6) continue;
      enemy.health -= getStats(state).damage;
      enemy.group.scale.set(1.35, 0.7, 1.35);
      hit = true;
      if (enemy.health <= 0) {
        enemy.alive = false;
        enemy.group.visible = false;
        this.audio.sfx('enemy');
        this.callbacks.onReward({ xp: 38, crystals: 2, enemy: true });
      }
    }
    if (hit) this.audio.sfx('hit');
  }

  updateEnemies(dt, state) {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.cooldown = Math.max(0, enemy.cooldown - dt);
      enemy.phase += dt;
      enemy.ring.rotation.z += dt * 1.8;
      enemy.group.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 8);
      const dx = this.player.x - enemy.x;
      const dz = this.player.z - enemy.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 8 && distance > 1.15) {
        enemy.x += (dx / distance) * dt * 2.15;
        enemy.z += (dz / distance) * dt * 2.15;
      } else if (distance >= 8) {
        enemy.x = lerp(enemy.x, enemy.spawnX + Math.sin(enemy.phase * 0.5) * 1.2, dt);
        enemy.z = lerp(enemy.z, enemy.spawnZ + Math.cos(enemy.phase * 0.5) * 1.2, dt);
      }
      if (distance < 1.35 && enemy.cooldown <= 0 && this.damageCooldown <= 0) {
        enemy.cooldown = 1.3;
        this.damageCooldown = 0.65;
        this.player.health -= 12;
        this.callbacks.onDamage();
        this.audio.sfx('hit');
        if (this.player.health <= 0) this.callbacks.onDefeat('A waking wound pulled you out of the ruins.');
      }
      enemy.group.position.set(enemy.x, 1.15 + Math.sin(enemy.phase * 3) * 0.22, enemy.z);
    }
  }

  updateInteraction(input, state) {
    let nearest = null;
    let distance = Infinity;
    for (const portal of PORTALS) {
      const current = Math.hypot(this.player.x - portal.x, this.player.z - portal.z);
      if (current < distance) { nearest = portal; distance = current; }
    }
    const centerDistance = Math.hypot(this.player.x, this.player.z);
    this.prompt = '';
    if (centerDistance < 4.6) {
      this.prompt = state.artifact ? 'E  Return the Somnus Lens' : 'E  Listen to the empty dais';
      if (input.consume('KeyE')) {
        if (state.artifact) this.callbacks.onWin();
        else this.callbacks.onDialogue('The Somnus Dais', 'Three hollows wait in the stone. Follow the dreamers’ memories; only their shared truth can wake the Lens.');
      }
    } else if (nearest && distance < 3.6) {
      const unlocked = state.unlocked.includes(nearest.id);
      const complete = state.completed.includes(nearest.id);
      this.prompt = `E  ${unlocked ? (complete ? 'Revisit' : 'Enter') : 'Inspect'} ${nearest.name}`;
      if (input.consume('KeyE')) {
        if (unlocked) this.callbacks.onEnterDream(nearest.id);
        else this.callbacks.onDialogue('A sealed threshold', 'This arch has no reflection. Another dreamer’s memory will show you the way here.');
      }
    }
  }
}
