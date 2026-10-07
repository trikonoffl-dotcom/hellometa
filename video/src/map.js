// Premium dot-matrix map of Australia with a simple 3D camera (tilt, yaw,
// zoom), plus Sydney skyline / Harbour Bridge line-art.
import { C, rgba, clamp, lerp, rng, polyLen, subPath, E, TAU } from './engine.js';

const K = 20; // map units per degree latitude
const COSL = Math.cos((27 * Math.PI) / 180);
export const geo = (lon, lat) => [(lon - 134) * COSL * K, -(lat + 26) * K];

export const CITIES = {
  SYDNEY: geo(151.21, -33.87),
  MELBOURNE: geo(144.96, -37.81),
  BRISBANE: geo(153.03, -27.47),
  PERTH: geo(115.86, -31.95),
  ADELAIDE: geo(138.6, -34.93),
  CANBERRA: geo(149.13, -35.28),
  HOBART: geo(147.33, -42.88),
  DARWIN: geo(130.84, -12.46),
  NEWCASTLE: geo(151.78, -32.93),
  'GOLD COAST': geo(153.4, -28.0),
};

export class AusMap {
  constructor(data) {
    this.rings = data.rings.map((r) => r.map(([lo, la]) => geo(lo, la)));
    // inside test via Path2D
    const c = document.createElement('canvas');
    c.width = c.height = 4;
    const g = c.getContext('2d');
    const path = new Path2D();
    for (const r of this.rings) { path.moveTo(r[0][0], r[0][1]); for (const p of r) path.lineTo(p[0], p[1]); path.closePath(); }
    this.inside = (x, y) => g.isPointInPath(path, x, y);
    // main dot lattice (offset rows for a hex feel)
    this.dots = [];
    const S = 5.2;
    for (let y = -330, row = 0; y < 380; y += S * 0.866, row++) {
      for (let x = -390 + (row % 2) * S * 0.5; x < 390; x += S) if (this.inside(x, y)) this.dots.push([x, y]);
    }
    // fine local lattice around the east-coast capitals
    this.fine = [];
    const r = rng(7);
    const sy = CITIES.SYDNEY;
    for (let y = sy[1] - 70; y < sy[1] + 70; y += 1.7) {
      for (let x = sy[0] - 90; x < sy[0] + 10; x += 1.7) {
        const d = Math.hypot(x - sy[0], (y - sy[1]) * 1.2);
        if (d < 70 && this.inside(x, y) && r() < 0.85 - d / 110) this.fine.push([x + (r() - 0.5) * 0.6, y + (r() - 0.5) * 0.6, d]);
      }
    }
    this.cam = { tx: 0, ty: 0, zoom: 1, tilt: 0, yaw: 0, ax: 960, ay: 540, F: 1400 };
  }
  setCam(c) { Object.assign(this.cam, c); }
  // project map point (x, y) with height z (map units) to screen
  p(x, y, z = 0) {
    const { tx, ty, zoom, tilt, yaw, ax, ay, F } = this.cam;
    let dx = (x - tx) * zoom, dy = (y - ty) * zoom;
    const dz = z * zoom;
    if (yaw) { const c = Math.cos(yaw), s = Math.sin(yaw); [dx, dy] = [dx * c - dy * s, dx * s + dy * c]; }
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const Y = dy * ct - dz * st;
    const D = F - dy * st - dz * ct;
    if (D < 60) return null;
    const k = F / D;
    return [ax + dx * k, ay + Y * k, k];
  }
  // reveal: radius in map units from origin point (ox, oy) for ripple reveal
  draw(ctx, { alpha = 1, reveal = 1e9, ox = 0, oy = 0, coast = 0.5, fine = 0, highlight = null, fog = 0.55 } = {}) {
    if (alpha <= 0.001) return;
    const { zoom } = this.cam;
    const buckets = new Array(8).fill(0).map(() => []);
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const rad = clamp(0.62 * Math.pow(zoom, 0.55), 0.7, 2.6);
    for (const [x, y] of this.dots) {
      const d = Math.hypot(x - ox, y - oy);
      if (d > reveal) continue;
      const q = this.p(x, y);
      if (!q || q[0] < -10 || q[0] > W + 10 || q[1] < -10 || q[1] > H + 10) continue;
      const edge = clamp((reveal - d) / 40);
      const depth = clamp(q[2] * 1.15, 0, 1.4);
      let a = clamp(lerp(1 - fog, 1, clamp(depth))) * edge;
      if (highlight) a *= highlight(x, y);
      const b = Math.min(7, Math.floor(a * 7.99));
      if (b <= 0) continue;
      buckets[b].push(q[0], q[1], rad * clamp(q[2], 0.4, 1.8));
    }
    ctx.save();
    for (let b = 1; b < 8; b++) {
      const arr = buckets[b];
      if (!arr.length) continue;
      ctx.fillStyle = rgba('#7A7A7E', (b / 7) * 0.75 * alpha);
      ctx.beginPath();
      for (let i = 0; i < arr.length; i += 3) { ctx.moveTo(arr[i] + arr[i + 2], arr[i + 1]); ctx.arc(arr[i], arr[i + 1], arr[i + 2], 0, TAU); }
      ctx.fill();
    }
    if (fine > 0.01) {
      ctx.fillStyle = rgba('#9A9AA0', 0.5 * fine * alpha);
      ctx.beginPath();
      for (const [x, y, d] of this.fine) {
        if (Math.hypot(x - ox, y - oy) > reveal) continue;
        const q = this.p(x, y);
        if (!q) continue;
        const r = clamp(0.45 * Math.pow(zoom, 0.5) * q[2], 0.5, 1.6) * (1 - d / 90);
        ctx.moveTo(q[0] + r, q[1]);
        ctx.arc(q[0], q[1], r, 0, TAU);
      }
      ctx.fill();
    }
    if (coast > 0.01) {
      ctx.strokeStyle = rgba('#8A8A90', coast * alpha);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (const ring of this.rings) {
        let pen = false;
        for (const [x, y] of ring) {
          const q = Math.hypot(x - ox, y - oy) <= reveal ? this.p(x, y) : null;
          if (!q) { pen = false; continue; }
          if (!pen) { ctx.moveTo(q[0], q[1]); pen = true; } else ctx.lineTo(q[0], q[1]);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- skyline
// Sydney Harbour Bridge + CBD skyline as line-art (unit: bridge span = 1).
function bridgeLines() {
  const L = [];
  const arch = (base, rise) => {
    const pts = [];
    for (let i = 0; i <= 48; i++) { const u = -1 + (2 * i) / 48; pts.push([u * 0.5, base + rise * (1 - u * u)]); }
    return pts;
  };
  L.push({ pts: [[-0.86, 0], [0.86, 0]], w: 1.4, kind: 'deck' });
  const lower = arch(-0.1, 0.235);
  const upper = arch(0.01, 0.16);
  L.push({ pts: lower, w: 1.6, kind: 'arch' });
  L.push({ pts: upper, w: 1.6, kind: 'arch' });
  // truss: verticals + diagonals between chords
  const at = (pts, x) => { const i = Math.round((x + 0.5) * 48); return pts[clamp(i, 0, 48)][1]; };
  for (let x = -0.46; x <= 0.461; x += 0.04) {
    L.push({ pts: [[x, at(lower, x)], [x, at(upper, x)]], w: 0.8, kind: 'truss' });
    const x2 = x + 0.04;
    if (x2 <= 0.47) L.push({ pts: [[x, at(lower, x)], [x2, at(upper, x2)]], w: 0.6, kind: 'truss' });
  }
  // hangers from lower chord to deck where the arch is above the deck
  for (let x = -0.36; x <= 0.361; x += 0.04) L.push({ pts: [[x, at(lower, x)], [x, 0]], w: 0.6, kind: 'hanger' });
  // granite pylons
  for (const sx of [-1, 1]) {
    const cx = sx * 0.55;
    const w = 0.035;
    L.push({ pts: [[cx - w, -0.1], [cx - w, 0.075], [cx - w * 0.8, 0.09], [cx + w * 0.8, 0.09], [cx + w, 0.075], [cx + w, -0.1]], w: 1.3, kind: 'pylon' });
    L.push({ pts: [[cx - w * 0.5, 0.02], [cx - w * 0.5, 0.06], [cx + w * 0.5, 0.06], [cx + w * 0.5, 0.02]], w: 0.8, kind: 'pylon' });
  }
  // approach piers
  for (const x of [-0.8, -0.7, 0.7, 0.8]) L.push({ pts: [[x, -0.1], [x, 0]], w: 0.8, kind: 'pier' });
  return L;
}
function skylineLines(seed = 3) {
  const r = rng(seed);
  const L = [];
  // CBD towers to the right of the southern pylon
  let x = 0.66;
  const towers = [0.2, 0.32, 0.26, 0.42, 0.3, 0.5, 0.36, 0.28, 0.46, 0.22, 0.34, 0.18];
  towers.forEach((h, i) => {
    const w = 0.035 + r() * 0.03;
    L.push({ pts: [[x, -0.1], [x, h], [x + w, h + (i % 3 === 0 ? 0.02 : 0)], [x + w, -0.1]], w: 1, kind: 'tower', top: [x + w / 2, h + 0.02] });
    if (r() < 0.6) for (let k = 1; k < 5; k++) { const yy = -0.1 + ((h + 0.1) * k) / 5; L.push({ pts: [[x + w * 0.2, yy], [x + w * 0.8, yy]], w: 0.5, kind: 'floor' }); }
    x += w + 0.008 + r() * 0.01;
    if (i === 4) {
      // Sydney Tower: slender shaft, turret, spire
      const cx = x + 0.02;
      L.push({ pts: [[cx - 0.006, -0.1], [cx - 0.006, 0.52]], w: 1, kind: 'spire' });
      L.push({ pts: [[cx + 0.006, -0.1], [cx + 0.006, 0.52]], w: 1, kind: 'spire' });
      L.push({ pts: [[cx - 0.03, 0.52], [cx - 0.034, 0.56], [cx - 0.03, 0.6], [cx + 0.03, 0.6], [cx + 0.034, 0.56], [cx + 0.03, 0.52], [cx - 0.03, 0.52]], w: 1.1, kind: 'spire' });
      L.push({ pts: [[cx, 0.6], [cx, 0.7]], w: 0.9, kind: 'spire', top: [cx, 0.7] });
      x += 0.05;
    }
  });
  // lower-rise north shore to the left of the northern pylon
  x = -0.98;
  for (let i = 0; i < 6; i++) {
    const w = 0.03 + r() * 0.02, h = 0.05 + r() * 0.12;
    L.push({ pts: [[x, -0.1], [x, h], [x + w, h], [x + w, -0.1]], w: 0.8, kind: 'tower' });
    x += w + 0.01;
  }
  L.push({ pts: [[-1.02, -0.1], [1.32, -0.1]], w: 1, kind: 'water' });
  return L;
}
const BRIDGE = bridgeLines();
const SKY = skylineLines();
for (const l of [...BRIDGE, ...SKY]) l.L = polyLen(l.pts);

// Draw at (x, y) = bridge deck centre; span in px; p = draw-on progress.
export function drawSkyline(ctx, x, y, span, p, { alpha = 1, beacon = 0, t = 0 } = {}) {
  if (alpha <= 0.001 || p <= 0) return;
  const tf = (q) => [x + q[0] * span, y - q[1] * span];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const all = [...SKY.map((l, i) => ({ l, d: 0.15 + 0.5 * (i / SKY.length) })), ...BRIDGE.map((l, i) => ({ l, d: (l.kind === 'deck' ? 0 : l.kind === 'arch' ? 0.05 : 0.25) + 0.35 * (i / BRIDGE.length) }))];
  for (const { l, d } of all) {
    const lp = E.outCubic(clamp((p - d) / 0.45));
    if (lp <= 0) continue;
    const pts = l.pts.map(tf);
    ctx.beginPath();
    subPath(ctx, pts, polyLen(pts), 0, lp);
    const a = l.kind === 'arch' ? 0.75 : l.kind === 'floor' ? 0.22 : l.kind === 'truss' || l.kind === 'hanger' ? 0.35 : 0.5;
    ctx.strokeStyle = rgba('#A0A0A6', a * alpha);
    ctx.lineWidth = l.w * clamp(span / 700, 0.6, 1.6);
    ctx.stroke();
  }
  // aircraft-warning beacons on tower tops, orange, slow blink
  if (beacon > 0) {
    let k = 0;
    for (const l of SKY) {
      if (!l.top || p < 0.8) continue;
      k++;
      const bl = 0.5 + 0.5 * Math.sin(t * 2.4 + k * 1.7);
      const [bx, by] = tf(l.top);
      ctx.fillStyle = rgba(C.orange, beacon * alpha * (0.35 + 0.65 * bl));
      ctx.beginPath();
      ctx.arc(bx, by - 2, 2.2, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}
