export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function moveAndCollide(body, platforms, dt, gravity = 1) {
  body.grounded = false;
  body.hitWall = false;
  body.x += body.vx * dt;
  for (const platform of platforms) {
    if (!overlaps(body, platform)) continue;
    if (body.vx > 0) body.x = platform.x - body.w;
    else if (body.vx < 0) body.x = platform.x + platform.w;
    body.vx = 0;
    body.hitWall = true;
  }

  const oldY = body.y;
  body.y += body.vy * dt;
  for (const platform of platforms) {
    if (!overlaps(body, platform)) continue;
    if (body.vy >= 0 && oldY + body.h <= platform.y + 2) {
      body.y = platform.y - body.h;
      body.vy = 0;
      if (gravity > 0) body.grounded = true;
    } else if (body.vy <= 0 && oldY >= platform.y + platform.h - 2) {
      body.y = platform.y + platform.h;
      body.vy = 0;
      if (gravity < 0) body.grounded = true;
    } else {
      const up = body.y + body.h - platform.y;
      const down = platform.y + platform.h - body.y;
      if (up < down) body.y -= up;
      else body.y += down;
      body.vy = 0;
    }
  }
  return body;
}

export function resolveCircle(point, obstacle, radius) {
  const dx = point.x - obstacle.x;
  const dz = point.z - obstacle.z;
  const distance = Math.hypot(dx, dz);
  const minimum = obstacle.radius + radius;
  if (distance >= minimum) return point;
  if (distance < 0.001) return { x: obstacle.x + minimum, z: obstacle.z };
  return {
    x: obstacle.x + (dx / distance) * minimum,
    z: obstacle.z + (dz / distance) * minimum
  };
}

export function updateRewindBuffer(buffer, snapshot, interval) {
  buffer.push({ ...snapshot });
  const capacity = Math.max(2, Math.ceil(5 / interval));
  if (buffer.length > capacity) buffer.splice(0, buffer.length - capacity);
  return buffer;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, amount) {
  return a + (b - a) * amount;
}
