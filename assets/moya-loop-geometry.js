export const loopIndex = (value, count) => (count > 0 ? ((value % count) + count) % count : 0);

export function loopDelta(from, to, count) {
  if (count < 2) return 0;
  const delta = loopIndex(to - from, count);
  return delta > count / 2 ? delta - count : delta;
}

export function loopCardGeometry(distance, height, gap) {
  const fullWidth = (height * 398) / 265;
  const smallWidth = (fullWidth * 272) / 398;
  const focus = Math.max(0, 1 - Math.abs(distance));
  const growth = (fullWidth - smallWidth) / 2;
  return {
    x:
      distance * (smallWidth + gap) +
      Math.sign(distance) * growth * Math.min(1, Math.abs(distance)),
    width: smallWidth + (fullWidth - smallWidth) * focus,
    height: height * (272 / 398 + (1 - 272 / 398) * focus),
    opacity: 0.5 + focus * 0.5,
  };
}

export function loopRenderRadius(width, height, gap) {
  const fullWidth = (height * 398) / 265;
  const pitch = (height * 272) / 265 + gap;
  return Math.ceil((width / 2 + fullWidth / 2) / pitch);
}

export function loopRenderWindow(position, count, radius) {
  if (count < 2) return count ? [{ index: 0, distance: 0 }] : [];
  const center = Math.round(position);
  return Array.from({ length: radius * 2 + 1 }, (_, offset) => {
    const slot = center + offset - radius;
    return { index: loopIndex(slot, count), distance: slot - position };
  }).sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance));
}

export function horizontalWheelDelta(deltaX, deltaY, mode, shift, width) {
  const horizontal = shift && Math.abs(deltaX) < Math.abs(deltaY) ? deltaY : deltaX;
  if (!horizontal || (!shift && Math.abs(deltaX) <= Math.abs(deltaY))) return 0;
  return horizontal * (mode === 1 ? 16 : mode === 2 ? width : 1);
}
