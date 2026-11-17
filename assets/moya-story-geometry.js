/** Pure world-space geometry shared by the photographs and their thread. */
export const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export function journeyTiming(count, hold = 1.2, delay = 0) {
  const intro = 1.5 + delay;
  const travel = 0.85;
  const step = hold + travel;
  return { intro, hold, travel, step, duration: intro + Math.max(0, count - 1) * step + hold };
}

export function project(x, y, z, camera, width, height, mobile) {
  const focal = 1000;
  const eyeX = -width * (mobile ? 0.38 : 0.28) * Math.cos(Math.PI * camera);
  const depth = z - (camera * 1800 - focal);
  if (depth < 90) return null;
  const scale = focal / depth;
  return { x: width * 0.5 + (x - eyeX) * scale, y: height * 0.32 + y * scale, scale, depth };
}

export function photoSize(ratio, width, height, mobile) {
  const w = Math.min(width * (mobile ? 0.96 : 0.72), height * (mobile ? 0.56 : 0.86) * ratio);
  return { width: w, height: w / ratio };
}

export const photoCenterY = (size, height, mobile) => mobile ? -height * 0.26 + size.height / 2 : height * 0.2;

export function photoPose(index, size, camera, width, height, mobile) {
  const side = index % 2 === 0 ? -1 : 1;
  const centerX = side * width * (mobile ? 0.4 : 0.36);
  const centerY = photoCenterY(size, height, mobile);
  const yaw = side * 0.085, pitch = -0.025;
  const corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([u, v]) => {
    const x = u * size.width, y = v * size.height;
    return project(centerX + x * Math.cos(yaw), centerY + y * Math.cos(pitch), index * 1800 - x * Math.sin(yaw) + y * Math.sin(pitch), camera, width, height, mobile);
  });
  return {
    corners,
    marker: project(centerX, centerY + size.height / 2 + 25, index * 1800, camera, width, height, mobile),
  };
}

// A homography is required here: ordinary rotate/scale aliases cannot map all
// four projected corners to the same world-space plane as the thread.
export function planeTransform(corners, width, height) {
  if (!corners.every(Boolean)) return null;
  const [p0, p1, p2, p3] = corners;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  const denominator = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(denominator) < 0.000001) return null;
  const g = (dx3 * dy2 - dx2 * dy3) / denominator;
  const h = (dx1 * dy3 - dx3 * dy1) / denominator;
  return `matrix3d(${(p1.x - p0.x + g * p1.x) / width},${(p1.y - p0.y + g * p1.y) / width},0,${g / width},${(p3.x - p0.x + h * p3.x) / height},${(p3.y - p0.y + h * p3.y) / height},0,${h / height},0,0,1,0,${p0.x},${p0.y},0,1)`;
}

export function createRoute(count, width, floor, mobile) {
  const segments = [];
  for (let u = -2; u < count + 1; u += 0.038) {
    const points = [];
    for (let s = 0; s <= 3; s++) {
      const t = u + s * 0.024 / 3;
      points.push([width * (-(mobile ? 0.4 : 0.36) * Math.cos(Math.PI * t) + 0.18 * Math.sin(Math.PI * t)), floor, t * 1800]);
    }
    segments.push(points);
  }
  return segments;
}

export function projectRoute(segments, camera, width, height, mobile) {
  // Three depth bands preserve perspective without hundreds of DOM writes.
  const paths = ['', '', ''];
  for (const segment of segments) {
    const points = segment.map(([x, y, z]) => project(x, y, z, camera, width, height, mobile));
    if (!points.every(Boolean)) continue;
    const band = points[0].scale < 0.6 ? 0 : points[0].scale < 1.2 ? 1 : 2;
    paths[band] += points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
  }
  return paths;
}
