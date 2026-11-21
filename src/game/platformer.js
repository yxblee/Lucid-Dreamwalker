import { createDream } from './levels.js';
import { clamp, lerp, moveAndCollide, overlaps, updateRewindBuffer } from './physics.js';
import { getStats } from './progression.js';

const VIEW_W = 1280;
const VIEW_H = 720;

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export class DreamPlatformer {
  constructor(canvas, id, state, callbacks, audio) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.level = createDream(id);
    this.state = state;
    this.callbacks = callbacks;
    this.audio = audio;
    this.stats = getStats(state);
    this.player = {
      x: this.level.spawn.x, y: this.level.spawn.y, w: 32, h: 48,
      vx: 0, vy: 0, grounded: false, facing: 1, health: this.stats.maxHealth,
      focus: this.stats.maxFocus, jumps: 0, invulnerable: 0, attack: 0
    };
    this.gravity = 1;
    this.camera = { x: 0, shake: 0 };
    this.worldTime = 0;
    this.elapsed = 0;
    this.remaining = this.level.timeLimit;
    this.memories = 0;
    this.dreamCrystals = 0;
    this.particles = [];
    this.rewindBuffer = [];
    this.rewindClock = 0;
    this.slideTime = 0;
    this.jumpBuffer = 0;
    this.coyoteTime = 0;
    this.gravityCooldown = 0;
    this.timeActive = false;
    this.completed = false;
    this.checkpoint = { ...this.level.spawn };
    this.message = '';
    this.messageTime = 0;
    this.random = seededRandom(id.length * 731);
    this.stars = Array.from({ length: 150 }, () => ({ x: this.random() * this.level.width, y: this.random() * 540, size: this.random() * 2 + 0.4, depth: this.random() * 0.6 + 0.15 }));
    for (const platform of this.level.platforms) {
      platform.baseX = platform.x;
      platform.baseY = platform.y;
      platform.previousX = platform.x;
      platform.previousY = platform.y;
      platform.angle = 0;
      platform.disabled = false;
      platform.phase = this.random() * 2;
    }
    this.resize();
    this.emitHud();
  }

  resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(this.canvas.clientWidth * ratio);
    this.canvas.height = Math.floor(this.canvas.clientHeight * ratio);
  }

  update(dt, input) {
    if (this.completed) return;
    this.elapsed += dt;
    this.remaining -= dt;
    this.messageTime = Math.max(0, this.messageTime - dt);
    this.player.invulnerable = Math.max(0, this.player.invulnerable - dt);
    this.player.attack = Math.max(0, this.player.attack - dt);
    this.gravityCooldown = Math.max(0, this.gravityCooldown - dt);
    this.camera.shake = Math.max(0, this.camera.shake - dt * 18);

    if (this.remaining <= 0) {
      this.defeat('The last grain fell. The dream folded in on itself.');
      return;
    }

    const wantsSlow = input.down('KeyQ') && this.state.abilities.time && this.player.focus > 0;
    if (wantsSlow && !this.timeActive) this.audio.sfx('time');
    this.timeActive = wantsSlow;
    if (wantsSlow) this.player.focus = Math.max(0, this.player.focus - dt * 24);
    else this.player.focus = Math.min(this.stats.maxFocus, this.player.focus + dt * this.stats.focusRegen);
    const worldDt = dt * (wantsSlow ? 0.28 : 1);
    this.worldTime += worldDt;

    if (input.consume('KeyR')) this.rewind();
    if (input.consume('KeyG') && this.gravityCooldown <= 0) this.flipGravity();
    this.updatePlatforms(worldDt);
    this.updatePlayer(dt, input);
    this.updateEnemies(worldDt);
    this.updateCollectibles();
    this.updateParticles(dt);
    this.updateCheckpoint();

    this.rewindClock += dt;
    if (this.rewindClock >= 0.1) {
      this.rewindClock = 0;
      updateRewindBuffer(this.rewindBuffer, {
        x: this.player.x, y: this.player.y, vx: this.player.vx, vy: this.player.vy,
        gravity: this.gravity, worldTime: this.worldTime, health: this.player.health
      }, 0.1);
    }

    if (overlaps(this.player, this.level.exit)) {
      if (this.memories === 3) this.finish();
      else if (this.messageTime <= 0) this.showMessage(`The gate needs ${3 - this.memories} more ${3 - this.memories === 1 ? 'memory' : 'memories'}.`);
    }
    if (this.player.y > 830 || this.player.y < -180) this.respawn(true);
    this.camera.x = lerp(this.camera.x, clamp(this.player.x - 390 + this.player.vx * 0.25, 0, this.level.width - VIEW_W), 1 - Math.exp(-dt * 4.5));
    this.emitHud();
    this.render();
  }

  updatePlatforms(dt) {
    for (const p of this.level.platforms) {
      p.previousX = p.x;
      p.previousY = p.y;
      if (p.motion) {
        const wave = Math.sin(this.worldTime * p.motion.speed + p.phase);
        p.x = p.baseX + (p.motion.axis === 'x' ? wave * p.motion.amount : 0);
        p.y = p.baseY + (p.motion.axis === 'y' ? wave * p.motion.amount : 0);
      }
      if (p.vanish) p.disabled = (this.worldTime + p.phase) % p.vanish.period > p.vanish.on;
      if (p.rotate) p.angle = Math.sin(this.worldTime * 0.85 + p.phase) * 0.32 * p.rotate;
      p.dx = p.x - p.previousX;
      p.dy = p.y - p.previousY;
      if (this.player.grounded && !p.disabled) {
        const standingY = this.gravity > 0 ? Math.abs(this.player.y + this.player.h - p.previousY) < 4 : Math.abs(this.player.y - (p.previousY + p.h)) < 4;
        if (standingY && this.player.x + this.player.w > p.previousX && this.player.x < p.previousX + p.w) {
          this.player.x += p.dx;
          this.player.y += p.dy;
        }
      }
    }
  }

  updatePlayer(dt, input) {
    const p = this.player;
    const direction = Number(input.down('KeyD', 'ArrowRight')) - Number(input.down('KeyA', 'ArrowLeft'));
    if (direction) p.facing = direction;

    if ((input.consume('ShiftLeft') || input.consume('ShiftRight')) && this.state.abilities.slide && p.grounded && this.slideTime <= 0) {
      this.slideTime = 0.5;
      const bottom = p.y + p.h;
      if (this.gravity > 0) { p.h = 27; p.y = bottom - p.h; }
      else { const top = p.y; p.h = 27; p.y = top; }
      p.vx = p.facing * 460;
      this.audio.sfx('slide');
      this.burst(p.x + p.w / 2, p.y + p.h / 2, '#a9f7e8', 8, 120);
    }
    if (this.slideTime > 0) {
      this.slideTime -= dt;
      p.vx = p.facing * 410;
      if (this.slideTime <= 0) {
        const bottom = p.y + p.h;
        const top = p.y;
        p.h = 48;
        if (this.gravity > 0) p.y = bottom - p.h;
        else p.y = top;
      }
    } else {
      const target = direction * Math.min(340, this.stats.speed);
      p.vx = lerp(p.vx, target, 1 - Math.exp(-dt * (p.grounded ? 16 : 7)));
    }

    if (p.grounded) this.coyoteTime = 0.11;
    else this.coyoteTime = Math.max(0, this.coyoteTime - dt);
    if (input.consume('Space') || input.consume('KeyW') || input.consume('ArrowUp')) this.jumpBuffer = 0.13;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.jumpBuffer > 0) {
      const canJump = p.grounded || this.coyoteTime > 0 || (this.state.abilities.doubleJump && p.jumps < 2);
      if (canJump) { this.jump(); this.jumpBuffer = 0; }
    }
    const flying = input.down('KeyF') && this.state.abilities.fly && p.focus > 0;
    if (flying) {
      p.vy = lerp(p.vy, -this.gravity * 285, dt * 8);
      p.focus = Math.max(0, p.focus - dt * 22);
      if (Math.random() < 0.4) this.burst(p.x + p.w / 2, p.y + p.h / 2, '#7ee8fa', 1, 60);
    } else {
      p.vy += this.gravity * 1750 * dt;
      p.vy = clamp(p.vy, -900, 900);
    }

    if (input.consume('KeyJ')) this.attack();
    const solids = this.getSolids();
    moveAndCollide(p, solids, dt, this.gravity);
    p.x = clamp(p.x, 0, this.level.width - p.w);
    if (p.grounded) p.jumps = 0;

    for (const hazard of this.level.hazards) {
      const hitbox = { x: hazard.x + 4, y: hazard.y + 3, w: hazard.w - 8, h: hazard.h - 3 };
      if (overlaps(p, hitbox)) this.hurt(24, hazard.x + hazard.w / 2);
    }
  }

  getSolids() {
    return [
      ...this.level.platforms.filter((p) => !p.disabled),
      ...this.level.gates,
      ...this.level.walls.filter((wall) => !wall.broken)
    ];
  }

  jump() {
    const p = this.player;
    const grounded = p.grounded || this.coyoteTime > 0;
    const canDouble = this.state.abilities.doubleJump && p.jumps < 2;
    if (!grounded && !canDouble) return;
    if (grounded) p.jumps = 0;
    else if (p.jumps === 0) p.jumps = 1;
    p.vy = -this.gravity * (p.jumps === 0 ? 600 : 555);
    p.grounded = false;
    this.coyoteTime = 0;
    p.jumps += 1;
    this.audio.sfx(p.jumps > 1 ? 'double' : 'jump');
    this.burst(p.x + p.w / 2, p.y + (this.gravity > 0 ? p.h : 0), '#8ef5df', p.jumps > 1 ? 12 : 6, 130);
  }

  flipGravity() {
    this.gravity *= -1;
    this.player.grounded = false;
    this.player.vy = this.gravity * 90;
    this.player.jumps = 0;
    this.gravityCooldown = 0.35;
    this.camera.shake = 5;
    this.audio.sfx('gravity');
    this.burst(this.player.x + 16, this.player.y + 24, '#b8fff1', 22, 240);
  }

  attack() {
    const p = this.player;
    p.attack = 0.22;
    this.audio.sfx('attack');
    const strike = { x: p.facing > 0 ? p.x + p.w : p.x - 72, y: p.y - 16, w: 72, h: p.h + 32 };
    for (const enemy of this.level.enemies) {
      if (!enemy.alive || !overlaps(strike, enemy)) continue;
      enemy.health -= this.stats.damage;
      enemy.flash = 0.15;
      this.audio.sfx('hit');
      this.burst(enemy.x + 19, enemy.y + 19, '#ff9fc7', 12, 210);
      if (enemy.health <= 0) {
        enemy.alive = false;
        this.audio.sfx('enemy');
        this.callbacks.onReward({ xp: 42, crystals: 1, enemy: true });
      }
    }
    for (const wall of this.level.walls) {
      if (wall.broken || !overlaps(strike, wall)) continue;
      wall.broken = true;
      this.camera.shake = 12;
      this.audio.sfx('break');
      this.burst(wall.x + wall.w / 2, wall.y + wall.h / 2, '#e7c991', 34, 340);
      this.showMessage('The remembered wall was only an idea.');
    }
  }

  updateEnemies(dt) {
    for (const enemy of this.level.enemies) {
      if (!enemy.alive) continue;
      enemy.flash = Math.max(0, (enemy.flash || 0) - dt);
      enemy.x += enemy.direction * dt * 62;
      if (Math.abs(enemy.x - enemy.originX) > enemy.range) enemy.direction *= -1;
      enemy.y += Math.sin(this.worldTime * 3 + enemy.originX) * dt * 5;
      if (overlaps(this.player, enemy)) this.hurt(18, enemy.x + enemy.w / 2);
    }
  }

  updateCollectibles() {
    for (const item of this.level.collectibles) {
      if (item.taken || !overlaps(this.player, item)) continue;
      item.taken = true;
      if (item.kind === 'crystal') {
        this.dreamCrystals += 1;
        this.audio.sfx('crystal');
        this.callbacks.onReward({ xp: 5, crystals: 1 });
        this.burst(item.x + 11, item.y + 14, '#f8d782', 15, 180);
      } else {
        this.memories += 1;
        this.audio.sfx('memory');
        this.camera.shake = 8;
        this.burst(item.x + 17, item.y + 17, this.level.palette[2], 35, 260);
        const messages = {
          bellwright: ['“I tuned every bell but my own.”', '“Ilex kept the note I could not.”', '“The song was a map, not a farewell.”'],
          archivist: ['“A minute vanished from every record.”', '“Sera begged me to erase her route.”', '“The theft was a promise of protection.”'],
          cartographer: ['“I drew a world with no way home.”', '“Mara’s song opened the final road.”', '“The Lens belongs to the one who wakes.”']
        };
        this.showMessage(messages[this.level.id][this.memories - 1]);
      }
    }
  }

  updateCheckpoint() {
    for (const point of this.level.checkpoints) {
      if (Math.abs(this.player.x - point.x) < 45 && this.checkpoint.x < point.x) {
        this.checkpoint = { x: point.x, y: point.y };
        this.player.health = Math.min(this.stats.maxHealth, this.player.health + 35);
        this.showMessage('A waking thread anchors you here.');
        this.audio.sfx('memory');
      }
    }
  }

  hurt(amount, sourceX) {
    const p = this.player;
    if (p.invulnerable > 0) return;
    p.health -= amount;
    p.invulnerable = 1;
    p.vx = p.x + p.w / 2 < sourceX ? -280 : 280;
    p.vy = -this.gravity * 260;
    this.camera.shake = 12;
    this.audio.sfx('hit');
    this.callbacks.onDamage();
    this.burst(p.x + p.w / 2, p.y + p.h / 2, '#ff7f91', 18, 250);
    if (p.health <= 0) this.defeat('The dream grew darker. Follow your thread back and try again.');
  }

  respawn(damage = false) {
    if (damage) {
      this.player.health -= 20;
      this.callbacks.onDamage();
      if (this.player.health <= 0) { this.defeat('You slipped beyond the edge of the dream.'); return; }
    }
    Object.assign(this.player, { x: this.checkpoint.x, y: this.checkpoint.y, vx: 0, vy: 0, invulnerable: 1.2 });
    this.gravity = 1;
    this.camera.x = clamp(this.player.x - 390, 0, this.level.width - VIEW_W);
    this.rewindBuffer.length = 0;
    this.camera.shake = 10;
    this.showMessage('Your waking thread pulls you back.');
  }

  rewind() {
    if (!this.state.abilities.time) { this.showMessage('The Archivist’s gift is not yours yet.'); return; }
    if (this.player.focus < 35 || this.rewindBuffer.length < 12) { this.showMessage('Not enough focus to rewind.'); return; }
    const index = Math.max(0, this.rewindBuffer.length - 22);
    const snapshot = this.rewindBuffer[index];
    Object.assign(this.player, { x: snapshot.x, y: snapshot.y, vx: snapshot.vx, vy: snapshot.vy, health: Math.max(this.player.health, snapshot.health) });
    this.gravity = snapshot.gravity;
    this.worldTime = snapshot.worldTime;
    this.player.focus -= 35;
    this.player.invulnerable = 1;
    this.rewindBuffer.length = 0;
    this.camera.shake = 7;
    this.audio.sfx('rewind');
    this.burst(this.player.x + 16, this.player.y + 24, '#b8a0ff', 42, 320);
    this.showMessage('Two seconds return to you.');
  }

  finish() {
    this.completed = true;
    this.audio.sfx('portal');
    this.burst(this.player.x + 16, this.player.y + 24, '#fff1b8', 70, 380);
    this.callbacks.onComplete(this.level.id, { crystals: this.dreamCrystals, time: this.elapsed, remaining: this.remaining });
  }

  defeat(reason) {
    if (this.completed) return;
    this.completed = true;
    this.callbacks.onDefeat(reason);
  }

  showMessage(message) {
    this.message = message;
    this.messageTime = 3.6;
    this.callbacks.onMessage(message);
  }

  burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = Math.random() * speed;
      this.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life: 0.4 + Math.random() * 0.7, maxLife: 1.1, color, size: 1 + Math.random() * 4 });
    }
    if (this.particles.length > 450) this.particles.splice(0, this.particles.length - 450);
  }

  updateParticles(dt) {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.98;
      particle.vy *= 0.98;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  emitHud() {
    this.callbacks.onHud({
      health: Math.max(0, this.player.health), maxHealth: this.stats.maxHealth,
      focus: this.player.focus, maxFocus: this.stats.maxFocus,
      memories: this.memories, remaining: this.remaining, gravity: this.gravity,
      timeActive: this.timeActive, crystals: this.dreamCrystals
    });
  }

  render() {
    const ctx = this.ctx;
    const sx = this.canvas.width / VIEW_W;
    const sy = this.canvas.height / VIEW_H;
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    this.drawBackground(ctx);
    const shakeX = (Math.random() - 0.5) * this.camera.shake;
    const shakeY = (Math.random() - 0.5) * this.camera.shake;
    ctx.save();
    ctx.translate(-this.camera.x + shakeX, shakeY);
    this.drawWorldDetails(ctx);
    for (const p of this.level.platforms) this.drawPlatform(ctx, p);
    for (const gate of this.level.gates) this.drawGate(ctx, gate);
    for (const wall of this.level.walls) if (!wall.broken) this.drawWall(ctx, wall);
    for (const hazard of this.level.hazards) this.drawHazard(ctx, hazard);
    this.drawExit(ctx);
    for (const item of this.level.collectibles) if (!item.taken) this.drawCollectible(ctx, item);
    for (const enemy of this.level.enemies) if (enemy.alive) this.drawEnemy(ctx, enemy);
    for (const point of this.level.checkpoints) this.drawCheckpoint(ctx, point);
    this.drawPlayer(ctx);
    for (const particle of this.particles) {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    this.drawAtmosphere(ctx);
  }

  drawBackground(ctx) {
    const colors = this.level.palette;
    const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.65, colors[1]);
    gradient.addColorStop(1, '#080d18');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const glow = ctx.createRadialGradient(850, 240, 20, 850, 240, 450);
    glow.addColorStop(0, `${colors[2]}25`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    for (const star of this.stars) {
      const x = star.x - this.camera.x * star.depth;
      if (x < -10 || x > VIEW_W + 10) continue;
      ctx.globalAlpha = 0.25 + Math.sin(this.worldTime * 1.5 + star.x) * 0.18;
      ctx.fillStyle = colors[2];
      ctx.fillRect(x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(4,8,18,.28)';
    ctx.beginPath();
    ctx.moveTo(0, 570);
    for (let x = 0; x <= VIEW_W; x += 90) ctx.lineTo(x, 450 + Math.sin(x * 0.008 + this.camera.x * 0.0008) * 90);
    ctx.lineTo(VIEW_W, 720);
    ctx.lineTo(0, 720);
    ctx.fill();
  }

  drawWorldDetails(ctx) {
    const start = Math.floor(this.camera.x / 500) * 500 - 500;
    const end = this.camera.x + VIEW_W + 500;
    ctx.lineWidth = 2;
    if (this.level.id === 'bellwright') {
      for (let x = start; x < end; x += 500) {
        ctx.strokeStyle = 'rgba(114,241,209,.10)';
        ctx.beginPath();
        ctx.arc(x + 250, 240, 110, Math.PI, 0);
        ctx.lineTo(x + 360, 510);
        ctx.moveTo(x + 140, 240);
        ctx.lineTo(x + 140, 510);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 250, 40);
        ctx.lineTo(x + 250, 130);
        ctx.stroke();
        ctx.fillStyle = 'rgba(243,207,122,.08)';
        ctx.beginPath();
        ctx.arc(x + 250, 155, 22, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.level.id === 'archivist') {
      for (let x = start; x < end; x += 430) {
        ctx.strokeStyle = 'rgba(184,160,255,.12)';
        ctx.beginPath();
        ctx.arc(x + 200, 260, 120, 0, Math.PI * 2);
        ctx.arc(x + 200, 260, 88, 0, Math.PI * 2);
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * Math.PI * 2;
          ctx.moveTo(x + 200 + Math.sin(a) * 100, 260 + Math.cos(a) * 100);
          ctx.lineTo(x + 200 + Math.sin(a) * 115, 260 + Math.cos(a) * 115);
        }
        ctx.stroke();
        ctx.save();
        ctx.translate(x + 200, 260);
        ctx.rotate(this.worldTime * 0.1);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -78);
        ctx.moveTo(0, 0);
        ctx.lineTo(55, 20);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      for (let x = start; x < end; x += 380) {
        ctx.strokeStyle = 'rgba(126,232,250,.11)';
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const px = x + i * 60;
          const py = 220 + Math.sin(i * 1.7 + this.worldTime * 0.12) * 100;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
        for (let i = 0; i < 5; i++) {
          ctx.strokeRect(x + i * 72, 350 + Math.sin(i + this.worldTime * 0.15) * 30, 48, 48);
        }
      }
    }
  }

  drawPlatform(ctx, p) {
    if (p.x + p.w < this.camera.x - 100 || p.x > this.camera.x + VIEW_W + 100) return;
    const colors = this.level.palette;
    ctx.save();
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate(p.angle || 0);
    ctx.globalAlpha = p.disabled ? 0.14 : 1;
    const gradient = ctx.createLinearGradient(0, -p.h / 2, 0, p.h / 2);
    gradient.addColorStop(0, colors[1]);
    gradient.addColorStop(1, '#0a1320');
    ctx.fillStyle = gradient;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.fillStyle = colors[2];
    ctx.globalAlpha *= 0.75;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, 3);
    ctx.globalAlpha *= 0.4;
    for (let x = -p.w / 2 + 18; x < p.w / 2; x += 44) {
      ctx.beginPath();
      ctx.moveTo(x, -p.h / 2 + 7);
      ctx.lineTo(x + 8, -p.h / 2 + 13);
      ctx.lineTo(x, -p.h / 2 + 19);
      ctx.lineTo(x - 8, -p.h / 2 + 13);
      ctx.closePath();
      ctx.strokeStyle = colors[2];
      ctx.stroke();
    }
    if (p.vanish && !p.disabled) {
      const left = p.vanish.on - ((this.worldTime + p.phase) % p.vanish.period);
      if (left < 0.65 && Math.floor(left * 12) % 2 === 0) ctx.globalAlpha = 0.25;
    }
    ctx.restore();
  }

  drawHazard(ctx, h) {
    ctx.fillStyle = '#ff7688';
    ctx.shadowColor = '#ff405f';
    ctx.shadowBlur = 12;
    const count = Math.max(1, Math.floor(h.w / 24));
    const width = h.w / count;
    for (let i = 0; i < count; i++) {
      ctx.beginPath();
      if (h.direction === 'down') {
        ctx.moveTo(h.x + i * width, h.y);
        ctx.lineTo(h.x + (i + 0.5) * width, h.y + h.h);
        ctx.lineTo(h.x + (i + 1) * width, h.y);
      } else {
        ctx.moveTo(h.x + i * width, h.y + h.h);
        ctx.lineTo(h.x + (i + 0.5) * width, h.y);
        ctx.lineTo(h.x + (i + 1) * width, h.y + h.h);
      }
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  drawCollectible(ctx, item) {
    const bob = Math.sin(this.worldTime * 3 + item.x) * 7;
    const x = item.x + item.w / 2;
    const y = item.y + item.h / 2 + bob;
    ctx.save();
    ctx.translate(x, y);
    if (item.kind === 'crystal') {
      ctx.rotate(this.worldTime * 0.7);
      ctx.shadowColor = '#f6d47c';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffe7a6';
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.lineTo(10, -3);
      ctx.lineTo(6, 13);
      ctx.lineTo(-6, 13);
      ctx.lineTo(-10, -3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff9dc';
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(3, 7);
      ctx.lineTo(-5, 10);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.rotate(this.worldTime * 0.35);
      ctx.shadowColor = this.level.palette[2];
      ctx.shadowBlur = 25;
      ctx.strokeStyle = this.level.palette[2];
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.strokeRect(-13, -13, 26, 26);
      }
      ctx.fillStyle = '#f5ffff';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawEnemy(ctx, enemy) {
    const x = enemy.x + enemy.w / 2;
    const y = enemy.y + enemy.h / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = '#ff5dac';
    ctx.shadowBlur = 20;
    ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : '#ba4e94';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2;
      const radius = i % 2 ? 14 : 22;
      const px = Math.cos(angle + this.worldTime) * radius;
      const py = Math.sin(angle + this.worldTime) * radius;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe1f2';
    ctx.fillRect(-7, -3, 4, 3);
    ctx.fillRect(3, -3, 4, 3);
    if (enemy.health < enemy.maxHealth) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#170d20';
      ctx.fillRect(-20, -32, 40, 4);
      ctx.fillStyle = '#ff8fbd';
      ctx.fillRect(-20, -32, 40 * enemy.health / enemy.maxHealth, 4);
    }
    ctx.restore();
  }

  drawGate(ctx, gate) {
    ctx.fillStyle = '#201c38';
    ctx.fillRect(gate.x, gate.y, gate.w, gate.h);
    ctx.strokeStyle = '#b8a0ff';
    ctx.lineWidth = 2;
    for (let y = gate.y + 8; y < gate.y + gate.h; y += 13) {
      ctx.beginPath();
      ctx.moveTo(gate.x + 7, y);
      ctx.lineTo(gate.x + gate.w - 7, y);
      ctx.stroke();
    }
    if (this.level.id === 'archivist' && gate.x - this.camera.x < VIEW_W && gate.x - this.camera.x > 0) {
      ctx.fillStyle = '#d4c8ff';
      ctx.font = '16px sans-serif';
      ctx.fillText('Shift — slide', gate.x - 38, gate.y - 14);
    }
  }

  drawWall(ctx, wall) {
    ctx.fillStyle = '#594c54';
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.strokeStyle = '#f0cc88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wall.x + 8, wall.y);
    ctx.lineTo(wall.x + 31, wall.y + 45);
    ctx.lineTo(wall.x + 13, wall.y + 90);
    ctx.lineTo(wall.x + 38, wall.y + 140);
    ctx.lineTo(wall.x + 22, wall.y + wall.h);
    ctx.stroke();
    if (wall.x - this.camera.x < VIEW_W && wall.x - this.camera.x > 0) {
      ctx.fillStyle = '#f0d9aa';
      ctx.font = '16px sans-serif';
      ctx.fillText('J — shatter', wall.x - 32, wall.y - 15);
    }
  }

  drawExit(ctx) {
    const exit = this.level.exit;
    const unlocked = this.memories === 3;
    const x = exit.x + exit.w / 2;
    const y = exit.y + exit.h / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = unlocked ? '#ffe7a0' : this.level.palette[2];
    ctx.shadowBlur = unlocked ? 35 : 14;
    ctx.strokeStyle = unlocked ? '#ffe7a0' : this.level.palette[2];
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate(this.worldTime * (i % 2 ? -0.25 : 0.2) + i);
      ctx.beginPath();
      ctx.ellipse(0, 0, 25 + i * 8, 48 + i * 5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = unlocked ? 'rgba(255,239,177,.24)' : 'rgba(107,157,180,.12)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 25, 48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f4f4e9';
    ctx.font = '17px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(unlocked ? 'Waking gate' : `${this.memories} / 3 memories`, 0, -82);
    ctx.restore();
  }

  drawCheckpoint(ctx, point) {
    const active = this.checkpoint.x >= point.x;
    ctx.strokeStyle = active ? '#f4d995' : 'rgba(155,215,214,.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(point.x + 20, 620);
    ctx.lineTo(point.x + 20, 525);
    ctx.stroke();
    ctx.fillStyle = active ? '#ffe9a9' : '#8ac6c2';
    ctx.beginPath();
    ctx.arc(point.x + 20, 520, active ? 7 : 4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPlayer(ctx) {
    const p = this.player;
    if (p.invulnerable > 0 && Math.floor(p.invulnerable * 14) % 2 === 0) return;
    const x = p.x + p.w / 2;
    const y = p.y + p.h / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(p.facing, this.gravity);
    const running = Math.abs(p.vx) > 30 && p.grounded;
    const stride = running ? Math.sin(this.elapsed * 16) * 6 : 0;
    ctx.strokeStyle = '#d9e6df';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, p.h / 2 - 11);
    ctx.lineTo(-7 + stride, p.h / 2);
    ctx.moveTo(5, p.h / 2 - 11);
    ctx.lineTo(7 - stride, p.h / 2);
    ctx.stroke();
    ctx.shadowColor = this.level.palette[2];
    ctx.shadowBlur = 13;
    const cloak = ctx.createLinearGradient(0, -20, 0, 22);
    cloak.addColorStop(0, '#b6fff0');
    cloak.addColorStop(0.25, '#3caaac');
    cloak.addColorStop(1, '#173449');
    ctx.fillStyle = cloak;
    ctx.beginPath();
    ctx.moveTo(-10, -11);
    ctx.quadraticCurveTo(-20 - p.vx * 0.012, 4, -15 - p.vx * 0.018, p.h / 2 - 5);
    ctx.lineTo(13, p.h / 2 - 5);
    ctx.quadraticCurveTo(18, 0, 10, -11);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#efd9bd';
    ctx.beginPath();
    ctx.arc(0, -p.h / 2 + 10, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#163242';
    ctx.beginPath();
    ctx.arc(-1, -p.h / 2 + 7, 10, Math.PI, Math.PI * 2);
    ctx.lineTo(9, -p.h / 2 + 8);
    ctx.fill();
    ctx.fillStyle = '#13222a';
    ctx.fillRect(4, -p.h / 2 + 10, 2, 2);
    ctx.strokeStyle = '#fff0ad';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-9, -8);
    ctx.quadraticCurveTo(-26 - p.vx * 0.03, -2, -32 - p.vx * 0.04, 7 + Math.sin(this.elapsed * 5) * 4);
    ctx.stroke();
    if (p.attack > 0) {
      ctx.strokeStyle = '#fff4c7';
      ctx.lineWidth = 5;
      ctx.shadowColor = '#ffe493';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(8, 0, 52, -1.2, 1.15);
      ctx.stroke();
      ctx.strokeStyle = '#d8fff7';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(6, -5);
      ctx.lineTo(52, -28);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawAtmosphere(ctx) {
    if (this.timeActive) {
      ctx.fillStyle = 'rgba(105,80,180,.13)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.strokeStyle = 'rgba(200,183,255,.18)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.arc(VIEW_W / 2, VIEW_H / 2, 100 + i * 75 + Math.sin(this.elapsed * 2) * 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    const vignette = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 250, VIEW_W / 2, VIEW_H / 2, 760);
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(1, 'rgba(0,3,12,.62)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = 'rgba(220,255,249,.45)';
    ctx.font = '15px sans-serif';
    if (this.elapsed < 10) {
      const instructions = {
        bellwright: 'Space — jump   ·   G — invert gravity   ·   J — strike',
        archivist: 'Shift — slide   ·   Hold Q — slow time   ·   R — rewind two seconds',
        cartographer: 'G — gravity   ·   F — fly   ·   Q / R — time   ·   J — shatter'
      };
      ctx.fillText(instructions[this.level.id], 42, 680);
    }
  }
}
