/** Photo-calibrated point fields from the companion reference, isolated per instance. */
const painters = {};
const mount = (topic, paint) => { painters[topic] = paint; };
// Original Meet dialogue waveform and calibration for MOYA5017.
  mount('conversation', (ctx, time, reduced) => {
    const cycle = reduced ? 1.2 : time % 6, reply = cycle >= 3, local = cycle % 3;
    const direction = reply ? 1 : -1, progress = Math.min(1, local / 2.65);
    const head = reply ? progress : 1 - progress;
    const speech = Math.sin(Math.PI * Math.min(1, local / 2.65)) ** .5;
    for (let col = 0; col < 27; col++) {
      const u = col / 26, edge = Math.sin(Math.PI * u) ** .7;
      const phase = u * 19 - direction * local * 7;
      const packet = Math.exp(-Math.pow((u - head) / .26, 2));
      const syllable = .20 + .80 * Math.abs(Math.sin(phase) * Math.cos(u * 11 - direction * local * 4));
      const amplitude = 2 + edge * (5 + 30 * syllable) * speech * packet;
      for (let row = -7; row <= 7; row++) {
        const coverage = Math.max(0, Math.min(1, (amplitude - Math.abs(row) * 5) / 5 + 1));
        if (!coverage) continue;
        // Preserve Meet's white speech / pale mint reply, spacing and fade.
        // A fine outline separates those light dots from the bright curtains.
        const alpha = (.16 + .82 * packet) * coverage * speech;
        const x = 620 + u * 155, y = 252 + row * 5;
        ctx.beginPath(); ctx.arc(x, y, 1.85, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(34,62,53,${alpha * .8})`;
        ctx.lineWidth = 1.25; ctx.stroke();
        ctx.fillStyle = reply ? `rgba(221,255,241,${alpha})` : `rgba(255,255,255,${alpha})`;
        ctx.fill();
      }
    }
  });

  const breathDots = [];
  for (let j = -14; j <= 14; j++) for (let i = -20; i <= 20; i++) {
    const u = i / 20, v = j / 14, r = u * u + v * v;
    if (r < 1) breathDots.push({u, v, r});
  }
  // Recovered Meet (45d6022a): broad breathing surface just below the
  // face/hand contact, with the person's silhouette masking its upper edge.
  // Register that contact to MOYA5278, retaining Meet's footprint and motion.
  const contactEdge = [[800,800],[900,770],[1000,730],[1100,675],[1180,620]];
  function contactBoundary(x) {
    if (x <= contactEdge[0][0]) return contactEdge[0][1];
    for (let i = 1; i < contactEdge.length; i++) {
      const a = contactEdge[i - 1], b = contactEdge[i];
      if (x <= b[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
    }
    return contactEdge[contactEdge.length - 1][1];
  }
  mount('care', (ctx, time, reduced) => {
    const breath = reduced ? .5 : (1 - Math.cos(time * Math.PI / 3)) / 2;
    const tilt = -.27, ca = Math.cos(tilt), sa = Math.sin(tilt);
    for (const {u, v, r} of breathDots) {
      const edge = Math.pow(1 - r, .65), z = (55 + 48 * breath) * edge;
      const x = u * 215 * (1 + breath * .025), y = v * 138 * (1 + breath * .035);
      const p = {x: 1000 + x * ca - y * sa, y: 825 + x * sa + y * ca * .83 - z * .72, z, edge, near: (v + 1) / 2};
      const radius = 1.05 + p.near * .85 + p.z / 120;
      const clearance = p.y - contactBoundary(p.x);
      if (clearance <= 5) continue;
      const alpha = Math.min(1, (clearance - 5) / 8) * p.edge * (.25 + p.near * .22 + breath * .25);
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(250,253,255,${alpha})`; ctx.fill();
      if (p.z > 65) {
        ctx.beginPath(); ctx.arc(p.x, p.y, radius * 2.1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(238,248,255,${alpha * .07})`; ctx.fill();
      }
    }
  });

  // Original Meet pat grid, curved projection, rings and MOYA5531 position.
  function paintPat(ctx, time, reduced) {
    const t = reduced ? 0 : time % 2.4;
    const tap = (1 - Math.cos(t / 2.4 * Math.PI * 2)) / 2;
    ctx.translate(700, 470); ctx.rotate(-.75);
    const project = (x, y) => {
      const perspective = 1 / (1 - y / 850);
      return [x * perspective, (y * .62 - 17 * (1 - Math.min(1, (x * x + y * y) / (230 * 230)))) * perspective];
    };
    for (let row = -12; row <= 12; row++) for (let col = -15; col <= 15; col++) {
      const u = col / 15, v = row / 12, r = u * u + v * v;
      if (r >= 1) continue;
      const edge = Math.pow(1 - r, 1.5), depth = Math.sqrt(1 - r);
      const [px, py] = project(u * 155, v * 115 + tap * 8);
      ctx.beginPath(); ctx.arc(px, py, 1.5 + depth * .6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,246,225,${edge * (.42 + tap * .22)})`; ctx.fill();
    }
    if (!reduced) for (let ring = 0; ring < 3; ring++) {
      const age = (t - 1.05 - ring * .26 + 2.4) % 2.4;
      if (age > 1.55) continue;
      const progress = age / 1.55, radius = 108 + progress * 108;
      const fade = Math.pow(Math.sin(Math.PI * progress), 2) * (.32 - ring * .035);
      for (let j = 0; j < 112; j++) {
        const a = j / 112 * Math.PI * 2;
        const [px, py] = project(Math.cos(a) * radius, Math.sin(a) * radius * .74 + tap * 8);
        ctx.beginPath(); ctx.arc(px, py, 1.45, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,246,225,${fade})`; ctx.fill();
      }
    }
  }
  // Original Meet warm dot field, registered on the lower back in MOYA5192.
  const heatDots = [];
  for (let row=-13;row<=13;row++) for (let col=-17;col<=17;col++) {
    const u=col/17,v=row/13,r=u*u+v*v;
    if(r<1)heatDots.push({u,v,r});
  }
  function paintHeat(ctx,time,reduced) {
    const warmth=reduced?.6:(1-Math.cos(time*Math.PI/4))/2;
    ctx.translate(810,820);ctx.rotate(-.04);
    // Project a gently rounded surface tilted 30 degrees out of the image
    // plane. Pitch controls foreshortening independently of in-image rotation.
    const pitch=Math.PI/6, yaw=.12;
    const projectHeat=(u,v)=>{
      const sx=148*Math.sin(u*.72)/Math.sin(.72), sy=v*118;
      const sz=28*(1-u*u);
      const rx=sx*Math.cos(yaw)+sz*Math.sin(yaw);
      const rz=sz*Math.cos(yaw)-sx*Math.sin(yaw);
      const ry=sy*Math.cos(pitch)-rz*Math.sin(pitch)+14;
      const depth=sy*Math.sin(pitch)+rz*Math.cos(pitch);
      const perspective=900/(900-depth);
      return [rx*perspective,ry*perspective,perspective];
    };
    ctx.save();ctx.scale(1,.80);
    const glow=ctx.createRadialGradient(0,0,0,0,0,165);
    glow.addColorStop(0,`rgba(248,163,82,${.06+warmth*.035})`);
    glow.addColorStop(.6,'rgba(229,123,46,.025)');glow.addColorStop(1,'rgba(229,123,46,0)');
    ctx.fillStyle=glow;ctx.fillRect(-170,-170,340,340);ctx.restore();
    for(const p of heatDots){
      const rim=Math.min(1,Math.max(0,(1-p.r)/.62));
      const edge=Math.pow(1-p.r,.6)*rim*rim*(3-2*rim),distance=Math.sqrt(p.r);
      const wave=reduced?.65:(1+Math.cos(distance*5.2-time*1.05))/2;
      const depth=(p.v+1)/2;
      const [x,y,perspective]=projectHeat(p.u,p.v);
      const alpha=edge*(.36+wave*.48+depth*.1),radius=(1.35+depth*.65+wave*.45)*.85*perspective;
      ctx.beginPath();ctx.arc(x,y,radius*2.6,0,Math.PI*2);ctx.fillStyle=`rgba(255,165,74,${alpha*.12})`;ctx.fill();
      ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fillStyle=`rgba(255,${Math.round(181+wave*43)},${Math.round(102+wave*63)},${alpha})`;ctx.fill();
    }
  }
  mount('touch',paintPat);
  mount('warmth',paintHeat);

export function createStoryParticles(figure, options) {
  const canvas = figure.querySelector('canvas');
  const paint = painters[options.topic];
  const ctx = paint && canvas?.getContext('2d');
  if (!ctx) return { resize() {}, select() {}, destroy() {} };
  let width = 0, height = 0, ratio = 1, frame = 0, time = 0, last = 0;
  let inView = false, selected = true, disposed = false;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');

  function draw() {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.scale(width / 2000, height / 1333);
    ctx.translate(options.x * 20, options.y * 13.33);
    ctx.translate(1000, 666.5);
    ctx.scale(options.scale / 100, options.scale / 100);
    ctx.translate(-1000, -666.5);
    paint(ctx, time, motion.matches);
    ctx.restore();
  }

  function tick(now) {
    frame = 0;
    if (disposed || !selected || !inView || document.hidden) { last = 0; return; }
    if (!last || now - last >= 32) {
      if (last) time += Math.min((now - last) / 1000, 0.08);
      last = now;
      draw();
    }
    if (!motion.matches) frame = requestAnimationFrame(tick);
  }

  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    if (selected && inView && !document.hidden && width && height) {
      if (motion.matches) draw();
      else frame = requestAnimationFrame(tick);
    }
  }

  const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); });
  observer.observe(figure);
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  return {
    resize(w, h) {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      if (w === width && h === height && dpr === ratio) return;
      width = w; height = h; ratio = dpr;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      sync();
    },
    select(value) {
      if (selected === value) return;
      selected = value;
      sync();
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      motion.removeEventListener('change', sync);
      canvas.width = canvas.height = 1;
    },
  };
}
