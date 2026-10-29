/* Canvas studies adapted from the supplied MoYa reference; values are illustrative. */
const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const pi = Math.PI;
export function createStudyRenderer(study) {
  const kind = study.dataset.study;
  const motion = { matches: false };
  let touchAt = -0.6,
    touchU = 0,
    touchV = 0,
    helloAt = -0.6;
  let restOffset = 0,
    breathAngle = 0,
    previousBreathTime = 0,
    nextMetric = 0;
  const readouts = [...study.querySelectorAll('[data-value]')];
  function metrics(values, t) {
    if (!motion.matches && t < nextMetric) return;
    nextMetric = t + 0.1;
    values.forEach((value, i) => {
      const text = String(value);
      if (readouts[i].textContent !== text) readouts[i].textContent = text;
    });
  }
  function phase(index) {
    study
      .querySelectorAll('.moya-science__metric')
      .forEach((item, i) => item.classList.toggle('is-active', i === index));
    study
      .querySelectorAll('[data-phase]')
      .forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    const word = study.querySelector('[data-rest-word]');
    if (word) word.textContent = ['Let go.', 'Slow down.', 'Rest.'][index];
  }
  function halo(ctx, x, y, radius, color, opacity) {
    const dpr = ctx.getTransform().a;
    const w = ctx.canvas.width / dpr,
      h = ctx.canvas.height / dpr;
    const rx = Math.max(1, Math.min(radius, x, w - x));
    const ry = Math.max(1, Math.min(radius, y, h - y));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, `rgba(${color},${opacity})`);
    gradient.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
  function stroke(ctx, points, color, width = 1) {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function touch(ctx, w, h, t) {
    if (t - touchAt > 8) {
      touchAt = t;
      touchU = 0;
      touchV = 0;
    }
    const age = motion.matches ? 1.6 : Math.max(0, t - touchAt);
    const press = Math.sin(clamp(age / 3.2) * pi);
    const envelope = Math.sin(clamp(age / 5.8) * pi);
    const radius = age * 0.3;
    const project = (u, v) => {
      const distance = Math.hypot(u - touchU, (v - touchV) * 0.82);
      const base = 0.12 * Math.sin(v * 2.7 + u * 0.8 + t * 0.17) + 0.055 * Math.cos(u * 3 - v);
      const crest = distance - radius;
      const ripple = 0.085 * Math.cos(crest * 15) * Math.exp(-crest * crest * 13) * envelope;
      const depression = -0.24 * Math.exp(-distance * distance * 16) * press;
      const z = base + depression + ripple;
      return [w * (0.5 + u * 0.43 + v * 0.075), h * (0.53 + v * 0.255 - z * 0.65)];
    };
    halo(ctx, w * 0.52, h * 0.57, w * 0.47, '128,174,144', 0.1);
    // A connected surface of fine contour lines conveys the soft deformation.
    for (let row = 0; row <= 38; row++) {
      const v = -1 + row / 19;
      const edge = Math.sin((pi * row) / 38);
      const points = [];
      for (let col = 0; col <= 96; col++) points.push(project(-1 + col / 48, v));
      if (row < 38) {
        const next = [];
        for (let col = 96; col >= 0; col--) next.push(project(-1 + col / 48, v + 1 / 19));
        ctx.beginPath();
        [...points, ...next].forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
        ctx.closePath();
        ctx.fillStyle = `rgba(129,173,149,${0.015 + edge * 0.026})`;
        ctx.fill();
      }
      stroke(ctx, points, `rgba(186,220,192,${0.08 + edge * 0.39})`, 0.7);
    }
    for (let col = 0; col <= 30; col++) {
      const u = -1 + col / 15,
        points = [];
      for (let row = 0; row <= 64; row++) points.push(project(u, -1 + row / 32));
      stroke(ctx, points, `rgba(170,211,188,${0.04 + Math.sin((pi * col) / 30) * 0.12})`, 0.55);
    }
    const point = project(touchU, touchV);
    halo(ctx, ...point, 54 + press * 20, '194,225,196', 0.15 + press * 0.08);
    ctx.setLineDash([2, 5]);
    stroke(
      ctx,
      [
        [point[0], h * 0.18],
        [point[0], point[1] - 13],
      ],
      'rgba(206,229,204,.22)',
      0.7,
    );
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.ellipse(point[0], point[1], 12 + press * 5, 5 + press * 2, -0.06, 0, pi * 2);
    ctx.strokeStyle = 'rgba(214,241,211,.65)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(point[0], point[1], 2.6, 0, pi * 2);
    ctx.fillStyle = '#deefd5';
    ctx.fill();
    metrics(
      [(2.4 * press).toFixed(1), Math.round(186 * Math.sqrt(press)), Math.min(age, 3.2).toFixed(1)],
      t,
    );
    phase(age < 1.3 ? 0 : age < 4.2 ? 1 : 2);
  }

  function safety(ctx, w, h, t) {
    if (t - helloAt > 7.8) helloAt = t;
    const age = motion.matches ? 3.2 : Math.max(0, t - helloAt);
    const synchronization = clamp((age - 1.2) / 4.5);
    const alignment = synchronization * synchronization * (3 - 2 * synchronization);
    const lag = 0.78 * (1 - 0.84 * alignment);
    const force = Math.sin(pi * clamp(age / 7.8));
    const left = w * 0.035,
      width = w * 0.93;
    const drawWave = (row, delay, color, amplitude) => {
      const y = h * (row ? 0.7 : 0.29);
      const center = 0.12 + (age - delay) * 0.118;
      halo(ctx, left + clamp(center) * width, y, w * 0.21, color, 0.085);
      const points = [];
      for (let i = 0; i <= 240; i++) {
        const x = i / 240;
        const d = x - center;
        const envelope = Math.exp(-d * d * 120) * clamp((age - (row ? 0.78 : 0)) * 2);
        const main = Math.sin(d * 55) * envelope;
        const breathing = Math.sin(x * 2 * pi - t * 0.5) * 1.4;
        points.push([left + x * width, y + main * h * amplitude + breathing]);
      }
      const gradient = ctx.createLinearGradient(left, 0, left + width, 0);
      gradient.addColorStop(0, `rgba(${color},.04)`);
      gradient.addColorStop(0.15, `rgba(${color},.85)`);
      gradient.addColorStop(0.75, `rgba(${color},.85)`);
      gradient.addColorStop(1, `rgba(${color},.03)`);
      stroke(ctx, points, gradient, 1.65);
      stroke(
        ctx,
        [
          [left, y],
          [left + width, y],
        ],
        `rgba(${color},.09)`,
        0.65,
      );
    };
    drawWave(0, 0, '222,204,166', 0.1 * force);
    drawWave(1, lag, '160,219,194', 0.075 * force);
    const linkX = w * 0.5;
    const response = clamp((age - 0.8) / 1.3) * (1 - clamp((age - 5.2) / 2));
    ctx.setLineDash([2, 6]);
    stroke(
      ctx,
      [
        [linkX, h * 0.35],
        [linkX, h * 0.42],
      ],
      `rgba(177,209,191,${response * 0.4})`,
      0.8,
    );
    stroke(
      ctx,
      [
        [linkX, h * 0.55],
        [linkX, h * 0.63],
      ],
      `rgba(177,209,191,${response * 0.4})`,
      0.8,
    );
    ctx.setLineDash([]);
    ctx.textAlign = 'center';
    ctx.font = '300 16px system-ui, sans-serif';
    ctx.fillStyle = `rgba(210,232,217,${0.35 + response * 0.45})`;
    ctx.fillText(
      age < 1 ? 'A little hello.' : age < 3 ? 'I’m here.' : 'A rhythm, shared.',
      linkX,
      h * 0.495,
    );
    metrics([(1.8 * force).toFixed(1), Math.round(lag * 1000), Math.round(alignment * 84)], t);
    phase(age < 1.2 ? 0 : age < 3.6 ? 1 : 2);
  }

  function rest(ctx, w, h, t) {
    const cycle = clamp(t + restOffset, 0, 17.999);
    const phaseIndex = Math.min(2, Math.floor(cycle / 6));
    const calm = (1 - Math.cos(pi * clamp(cycle / 14))) / 2;
    const amplitude = 1 - calm * 0.65,
      frequency = 3.8 - calm * 2.2;
    const breathsPerMinute = 14 - calm * 6;
    const delta = motion.matches ? 0 : Math.max(0, t - previousBreathTime);
    breathAngle += (delta * breathsPerMinute * pi * 2) / 60;
    previousBreathTime = t;
    halo(ctx, w * 0.67, h * 0.69, w * 0.47, '114,151,197', 0.085);
    // A continuous ribbon opens into longer, quieter rhythms over the evening.
    for (let row = 0; row < 26; row++) {
      const depth = row / 25,
        points = [];
      for (let i = 0; i <= 200; i++) {
        const x = i / 200;
        const edge = Math.pow(Math.sin(pi * x), 0.8);
        const wave = Math.sin(x * frequency * pi * 2 - breathAngle + depth * 1.45);
        const secondary = Math.sin(x * 11 - t * 0.2 + depth) * 0.14;
        const y =
          h * 0.64 +
          (depth - 0.5) * h * 0.21 * edge +
          (wave + secondary) * h * 0.115 * amplitude * edge * (1 - x * 0.48);
        points.push([w * (0.02 + x * 0.96), y]);
      }
      const alpha = 0.08 + Math.sin(depth * pi) * 0.38;
      stroke(
        ctx,
        points,
        `rgba(${155 + Math.round(depth * 48)},${179 + Math.round(depth * 30)},224,${alpha})`,
        0.85,
      );
    }
    const x = w * (0.07 + clamp(cycle / 18) * 0.86),
      y = h * 0.9;
    const lineGradient = ctx.createLinearGradient(w * 0.07, 0, w * 0.93, 0);
    lineGradient.addColorStop(0, 'rgba(202,190,158,.3)');
    lineGradient.addColorStop(0.55, 'rgba(167,202,189,.35)');
    lineGradient.addColorStop(1, 'rgba(160,180,227,.35)');
    stroke(
      ctx,
      [
        [w * 0.07, y],
        [w * 0.93, y],
      ],
      lineGradient,
      0.8,
    );
    halo(ctx, x, y, 18, '183,206,233', 0.16);
    ctx.beginPath();
    ctx.arc(x, y, 2.3, 0, pi * 2);
    ctx.fillStyle = '#cad8e7';
    ctx.fill();
    const seconds = Math.floor(t);
    const sessionTime =
      String(Math.floor(seconds / 60)).padStart(2, '0') +
      ':' +
      String(seconds % 60).padStart(2, '0');
    metrics([breathsPerMinute.toFixed(1), Math.round((cycle / 17.999) * 100), sessionTime], t);
    phase(phaseIndex);
  }

  return {
    reset() {
      touchAt = helloAt = -0.6;
      touchU = touchV = restOffset = breathAngle = previousBreathTime = nextMetric = 0;
    },
    pulse(x, y, time) {
      touchV = clamp((y - 0.53) / 0.255, -0.7, 0.7);
      touchU = clamp((x - 0.5 - touchV * 0.075) / 0.43, -0.75, 0.75);
      touchAt = helloAt = time;
      nextMetric = 0;
    },
    seek(seconds, time) {
      restOffset = seconds + 0.1 - time;
      nextMetric = 0;
    },
    draw(ctx, w, h, time, reduced) {
      motion.matches = reduced;
      ctx.clearRect(0, 0, w, h);
      (({ touch, safety, sleep: rest })[kind] || touch)(ctx, w, h, time);
    },
  };
}

export function createTextileRenderer() {
  const columns = 180,
    rows = 90;
  let seed = 7941;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // One sample per equal-area cell, with independent jitter to avoid woven rows.
  const particles = Array.from({ length: columns * rows }, (_, i) => {
    const col = i % columns,
      row = Math.floor(i / columns);
    const u = (col + 0.08 + random() * 0.84) / columns;
    const v = (row + 0.08 + random() * 0.84) / rows;
    return {
      x: (u - 0.5) * 3.5,
      y: (v - 0.5) * 1.6,
      edge: Math.pow(Math.sin(Math.PI * v), 0.4),
      grain: random(),
    };
  });
  const softDot = document.createElement('canvas');
  softDot.width = softDot.height = 32;
  const softCtx = softDot.getContext('2d');
  const softGlow = softCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  softGlow.addColorStop(0, 'rgba(180,205,170,.8)');
  softGlow.addColorStop(0.3, 'rgba(180,205,170,.4)');
  softGlow.addColorStop(1, 'rgba(180,205,170,0)');
  softCtx.fillStyle = softGlow;
  softCtx.fillRect(0, 0, 32, 32);
  return (ctx, w, h, seconds, reduced) => {
    ctx.clearRect(0, 0, w, h);
    const t = seconds * 0.22;
    const age = seconds % 8.5;
    const cycle = Math.floor(seconds / 8.5);
    const touchX = cycle % 2 ? 0.25 : 0.85,
      touchY = cycle % 2 ? 0.12 : -0.08;
    const envelope = reduced || age > 6.8 ? 0 : Math.sin((Math.PI * age) / 6.8);
    const radius = age * 0.27;
    const scale = Math.max(w * 0.34, h * 0.52);
    const haze = ctx.createRadialGradient(w * 0.78, h * 0.67, 0, w * 0.78, h * 0.67, w * 0.65);
    haze.addColorStop(0, 'rgba(107,141,111,.17)');
    haze.addColorStop(1, 'rgba(107,141,111,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, h);
    const surface = [];
    for (const p of particles) {
      // Broad traveling folds, with finer folds riding the same continuous sheet.
      const a = p.y * 7.4 + p.x * 1.5 - t;
      const b = p.y * 13 - p.x * 2.1 + t * 0.65;
      const c = p.x * 2 + t * 0.5;
      const z = 0.075 * Math.sin(a) + 0.012 * Math.sin(b) + 0.045 * Math.sin(c);
      const zx = 0.1125 * Math.cos(a) - 0.0252 * Math.cos(b) + 0.09 * Math.cos(c);
      const zy = 0.555 * Math.cos(a) + 0.156 * Math.cos(b);
      const inv = 1 / Math.hypot(zx, zy, 1);
      const nx = -zx * inv,
        ny = -zy * inv,
        nz = inv;
      const dx = p.x - touchX,
        dy = p.y - touchY;
      const distance = Math.hypot(dx, dy);
      const crest = distance - radius;
      const falloff = Math.exp((-crest * crest) / 0.095);
      const wave = envelope * 0.018 * Math.cos(crest * 23) * falloff;
      const derivative =
        envelope *
        0.018 *
        falloff *
        (-23 * Math.sin(crest * 23) - ((2 * crest) / 0.095) * Math.cos(crest * 23));
      // Displacement is perpendicular to the folded silk, not a screen-space ring.
      const x = p.x + nx * wave,
        y = p.y + ny * wave,
        height = z + nz * wave;
      const rx = x * 0.94 + y * 0.342;
      const ry = -x * 0.342 + y * 0.94;
      const perspective = 1 / (1 + ry * 0.07);
      const sx = w * 0.53 + rx * scale * perspective;
      const sy = h * 0.7 + (ry * 0.62 - height * 0.95) * scale * perspective;
      const slopeX = zx + (derivative * dx) / Math.max(0.001, distance);
      const slopeY = zy + (derivative * dy) / Math.max(0.001, distance);
      const normalLength = Math.hypot(slopeX, slopeY, 1);
      const light = Math.max(0, (-slopeX * -0.25 - slopeY * -0.65 + 0.72) / normalLength);
      const sheen = Math.pow(light, 3);
      const depth = Math.max(0, Math.min(1, (ry + 1.3) / 2.6));
      const alpha = p.edge * (0.22 + 0.2 * light + 0.08 * sheen) * (0.58 + depth * 0.42);
      const size = (0.55 + depth * 0.45) * perspective;
      surface.push({ x: sx, y: sy, size, alpha, light, depth, edge: p.edge });
    }
    // A quiet continuous surface supports the points, without yarn or weave lines.
    for (let row = 0; row < rows - 1; row += 3) {
      for (let col = 0; col < columns - 1; col += 3) {
        const r = Math.min(row + 3, rows - 1),
          c = Math.min(col + 3, columns - 1);
        const a = surface[row * columns + col],
          b = surface[row * columns + c];
        const d = surface[r * columns + col],
          e = surface[r * columns + c];
        const light = (a.light + b.light + d.light + e.light) / 4;
        const edge = (a.edge + b.edge + d.edge + e.edge) / 4;
        ctx.fillStyle = `rgba(125,158,132,${edge * (0.08 + light * 0.12)})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(e.x, e.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fill();
      }
    }
    for (const p of surface) {
      const blur = Math.max(0, (0.57 - p.depth) / 0.57);
      if (blur > 0.06) {
        const radius = p.size * (1.8 + blur * 1.9);
        ctx.globalAlpha = p.alpha;
        ctx.drawImage(softDot, p.x - radius, p.y - radius, radius * 2, radius * 2);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = `rgba(180,205,170,${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
}
