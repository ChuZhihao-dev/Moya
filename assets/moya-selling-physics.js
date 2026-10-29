export function sellingTarget(position, velocity, step, count, strength = 1) {
  if (step <= 0 || count < 2) return 0;
  const momentum = Math.max(-step * 1.25, Math.min(step * 1.25, velocity * 240 * strength));
  return Math.max(0, Math.min(count - 1, Math.round((position + momentum) / step)));
}

export function sellingSpring(position, velocity, target, delta, duration = 520) {
  const scale = 520 / Math.max(200, duration);
  const dt = Math.min(0.032, delta);
  const acceleration = (target - position) * 180 * scale * scale - velocity * 24 * scale;
  const nextVelocity = velocity + acceleration * dt;
  return { position: position + nextVelocity * dt, velocity: nextVelocity };
}
