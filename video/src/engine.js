// HelloMeta stall film: deterministic motion-graphics engine.
// Every frame is a pure function of time t: compositions call renderAt(t) and
// the renderer screenshots the stage. No CSS transitions or timers are used.

export const C = {
  orange: '#FC8803',
  orangeHot: '#FFB04A',
  grey: '#606060',
  greyL: '#8E8E8E',
  greyD: '#2A2A2C',
  white: '#FFFFFF',
  bg: '#0A0A0B',
  ui: '#182B4D', // real UI card background (sampled)
};
export const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// ---------------------------------------------------------------- math
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const win = (t, a, b) => t >= a && t < b;
export const smooth = (x) => x * x * (3 - 2 * x);
export const mix2 = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
export const TAU = Math.PI * 2;

export const E = {
  lin: (x) => x,
  inSine: (x) => 1 - Math.cos((x * Math.PI) / 2),
  outSine: (x) => Math.sin((x * Math.PI) / 2),
  inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  inQuart: (x) => x * x * x * x,
  outQuart: (x) => 1 - Math.pow(1 - x, 4),
  inOutQuart: (x) => (x < 0.5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2),
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
  inOutQuint: (x) => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2),
  inExpo: (x) => (x === 0 ? 0 : Math.pow(2, 10 * x - 10)),
  outExpo: (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inOutExpo: (x) => (x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
  outBack: (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
};
// eased progress helper: ep(t, a, b, E.outCubic)
export const ep = (t, a, b, f = E.inOutCubic) => f(prog(t, a, b));
// in/out envelope: rises over [a, a+fi], falls over [b-fo, b]
export const env = (t, a, b, fi = 0.3, fo = 0.3, f = E.inOutSine) =>
  Math.min(f(prog(t, a, a + fi)), 1 - f(prog(t, b - fo, b)));

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
// smooth 1D value noise in [-1, 1]
export function noise(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash(i + seed * 1013) * 2 - 1;
  const b = hash(i + 1 + seed * 1013) * 2 - 1;
  return lerp(a, b, smooth(f));
}

// ---------------------------------------------------------------- loading
export const loadImage = (url) =>
  new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => im.decode().then(() => res(im), () => res(im));
    im.onerror = () => rej(new Error('image ' + url));
    im.src = url;
  });
export const loadJSON = (url) => fetch(url).then((r) => r.json());

const iconSvg = {};
const iconImg = {};
export async function loadIcons(names) {
  await Promise.all(names.map(async (n) => { iconSvg[n] = await (await fetch(`../assets/icons/${n}.svg`)).text(); }));
}
export async function iconImage(name, color, stroke = 2) {
  const key = `${name}|${color}|${stroke}`;
  if (iconImg[key]) return iconImg[key];
  const svg = iconSvg[name].replace('currentColor', color).replace('stroke-width="2"', `stroke-width="${stroke}"`)
    .replace('width="24"', 'width="96"').replace('height="24"', 'height="96"');
  const url = 'data:image/svg+xml;base64,' + btoa(svg);
  iconImg[key] = await loadImage(url);
  return iconImg[key];
}
export const icon = (name, color, stroke = 2) => iconImg[`${name}|${color}|${stroke}`];

// ---------------------------------------------------------------- stage
export class Stage {
  constructor(root, W, H, perspective = 1800) {
    this.W = W; this.H = H; this.P = perspective;
    root.style.cssText = `position:relative;width:${W}px;height:${H}px;overflow:hidden;background:${C.bg}`;
    const mk = (z) => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      c.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;z-index:${z}`;
      root.appendChild(c);
      return c;
    };
    this.c0 = mk(0);
    this.dom = document.createElement('div');
    this.dom.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;z-index:1;perspective:${perspective}px;perspective-origin:50% 50%;`;
    root.appendChild(this.dom);
    this.c1 = mk(2);
    this.x0 = this.c0.getContext('2d');
    this.x1 = this.c1.getContext('2d');
    this.panels = [];
    this.frame = 0;
  }
  begin(t) {
    this.t = t;
    this.frame++;
    for (const c of [this.x0, this.x1]) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.filter = 'none';
      c.clearRect(0, 0, this.W, this.H);
    }
  }
  end() {
    for (const p of this.panels) if (p.lastFrame !== this.frame) p.hide();
  }
  // CSS-equivalent projection of a 3D point in stage coordinates.
  proj(x, y, z) {
    const k = this.P / (this.P - z);
    return [this.W / 2 + (x - this.W / 2) * k, this.H / 2 + (y - this.H / 2) * k, k];
  }
}

// ---------------------------------------------------------------- panels
// A real UI screenshot floating in CSS 3D space. Optional row strips, line
// strips and waveform strips animate slices of the real pixels.
export class Panel {
  constructor(stage, o) {
    this.st = stage;
    this.o = o;
    const [x0, y0, x1, y1] = o.window || [0, 0, o.w, o.h];
    this.win = [x0, y0, x1, y1];
    this.ww = x1 - x0; this.wh = y1 - y0;
    const k = o.res || 1; // 0.5 when using the @half image
    this.k = k;
    const url = o.url;
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;left:${-this.ww / 2}px;top:${-this.wh / 2}px;width:${this.ww}px;height:${this.wh}px;` +
      `overflow:hidden;border-radius:${o.radius ?? 28}px;transform-origin:50% 50%;display:none;backface-visibility:hidden;`;
    const inner = document.createElement('div');
    inner.style.cssText = `position:absolute;left:${-x0}px;top:${-y0}px;width:${o.w}px;height:${o.h}px;`;
    el.appendChild(inner);
    const bg = (x, y) => `background-image:url(${url});background-size:${o.w}px ${o.h}px;background-position:${-x}px ${-y}px;background-repeat:no-repeat;`;
    this.bgcss = bg;
    const base = document.createElement('div');
    base.style.cssText = `position:absolute;left:0;top:0;width:${o.w}px;height:${o.h}px;${bg(0, 0)}`;
    inner.appendChild(base);
    this.el = el; this.inner = inner;
    this.groups = {};
    this.ovs = {};
    this.ovUsed = new Set();
    stage.dom.appendChild(el);
    stage.panels.push(this);
    this.visible = false;
    this.lastFrame = -1;
  }
  // Row-like strips (table rows, transcript lines): cover the originals with a
  // filler of the real background colour, then animate copies of each strip.
  strips(name, ranges, { x0 = 33, x1 = null, filler = C.ui, clipX = true } = {}) {
    x1 = x1 ?? this.o.w - 33;
    const g = { ranges, x0, x1, els: [], fill: document.createElement('div'), wrap: document.createElement('div') };
    const top = Math.min(...ranges.map((r) => r[0]));
    const bot = Math.max(...ranges.map((r) => r[1]));
    g.fill.style.cssText = `position:absolute;left:${x0}px;top:${top}px;width:${x1 - x0}px;height:${bot - top}px;background:${filler};display:none;`;
    g.wrap.style.cssText = `position:absolute;left:${x0}px;top:${top}px;width:${x1 - x0}px;height:${bot - top}px;${clipX ? 'overflow:hidden;' : ''}display:none;`;
    for (const [a, b] of ranges) {
      const s = document.createElement('div');
      s.style.cssText = `position:absolute;left:0;top:${a - top}px;width:${x1 - x0}px;height:${b - a}px;${this.bgcss(x0, a)}`;
      g.wrap.appendChild(s);
      g.els.push(s);
    }
    this.inner.appendChild(g.fill);
    this.inner.appendChild(g.wrap);
    this.groups[name] = g;
    return this;
  }
  // Vertical slices of a region (used to animate the real call waveform).
  slices(name, [x0, y0, x1, y1], n) {
    const g = { els: [], wrap: document.createElement('div'), n };
    g.wrap.style.cssText = `position:absolute;left:${x0}px;top:${y0}px;width:${x1 - x0}px;height:${y1 - y0}px;display:none;`;
    const sw = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('div');
      s.style.cssText = `position:absolute;left:${i * sw}px;top:0;width:${sw + 0.5}px;height:${y1 - y0}px;${this.bgcss(x0 + i * sw, y0)}transform-origin:50% 50%;`;
      g.wrap.appendChild(s);
      g.els.push(s);
    }
    this.inner.appendChild(g.wrap);
    this.groups[name] = g;
    return this;
  }
  // Brand overlay (orange highlight, dim, tick) in panel-local coordinates.
  ov(key, [x, y, w, h], css) {
    let d = this.ovs[key];
    if (!d) {
      d = document.createElement('div');
      d.style.position = 'absolute';
      this.inner.appendChild(d);
      this.ovs[key] = d;
    }
    d.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;${css}`;
    this.ovUsed.add(key);
    return d;
  }
  hide() {
    if (this.visible) { this.el.style.display = 'none'; this.visible = false; }
  }
  // state: x,y (stage px of centre), z, s (scale), rx, ry, rz (deg), o (opacity),
  // wipe (0..1 reveal from top), glow (0..1 orange edge), dim, blur, filter
  set(st) {
    const s = { x: 0, y: 0, z: 0, s: 1, rx: 0, ry: 0, rz: 0, o: 1, ...st };
    this.state = s;
    this.lastFrame = this.st.frame;
    const el = this.el;
    if (!this.visible) { el.style.display = 'block'; this.visible = true; }
    el.style.transform = `translate3d(${s.x}px,${s.y}px,${s.z}px) rotateX(${s.rx}deg) rotateY(${s.ry}deg) rotateZ(${s.rz}deg) scale(${s.s})`;
    el.style.opacity = s.o;
    const f = [];
    if (s.blur) f.push(`blur(${s.blur}px)`);
    if (s.bright !== undefined) f.push(`brightness(${s.bright})`);
    el.style.filter = f.join(' ');
    const g = s.glow || 0;
    el.style.boxShadow = g > 0.001
      ? `0 0 0 ${2 / s.s}px ${rgba(C.orange, 0.9 * g)}, 0 0 ${60 / s.s}px ${rgba(C.orange, 0.35 * g)}`
      : `0 ${30 / s.s}px ${80 / s.s}px rgba(0,0,0,0.55)`;
    el.style.clipPath = s.wipe !== undefined && s.wipe < 1 ? `inset(0 0 ${(1 - s.wipe) * 100}% 0 round ${this.o.radius ?? 28}px)` : '';
    // groups: hidden unless provided this frame
    for (const [name, g2] of Object.entries(this.groups)) {
      const fn = s[name];
      if (!fn) {
        g2.wrap.style.display = 'none';
        if (g2.fill) g2.fill.style.display = 'none';
        continue;
      }
      g2.wrap.style.display = 'block';
      if (g2.fill) g2.fill.style.display = 'block';
      g2.els.forEach((e, i) => {
        const r = fn(i) || {};
        e.style.opacity = r.o ?? 1;
        const tf = [];
        if (r.dx) tf.push(`translateX(${r.dx}px)`);
        if (r.sy) tf.push(`scaleY(${r.sy})`);
        e.style.transform = tf.join(' ');
        e.style.clipPath = r.clip !== undefined && r.clip < 1 ? `inset(0 ${(1 - r.clip) * 100}% 0 0)` : '';
      });
    }
    for (const [k, d] of Object.entries(this.ovs)) d.style.display = this.ovUsed.has(k) ? 'block' : 'none';
    this.ovUsed.clear();
    return this;
  }
  // Must be called before set() in a frame for overlays to persist (ov marks usage).
  // Screen position of a window-local point under the current state.
  p(lx, ly, st = this.state) {
    const s = { x: 0, y: 0, z: 0, s: 1, rx: 0, ry: 0, rz: 0, ...st };
    let x = (lx - this.win[0] - this.ww / 2) * s.s;
    let y = (ly - this.win[1] - this.wh / 2) * s.s;
    let z = 0;
    const r = Math.PI / 180;
    const cz = Math.cos(s.rz * r), sz = Math.sin(s.rz * r);
    [x, y] = [x * cz - y * sz, x * sz + y * cz];
    const cy = Math.cos(s.ry * r), sy = Math.sin(s.ry * r);
    [x, z] = [x * cy + z * sy, -x * sy + z * cy];
    const cx = Math.cos(s.rx * r), sx = Math.sin(s.rx * r);
    [y, z] = [y * cx - z * sx, y * sx + z * cx];
    return this.st.proj(x + s.x, y + s.y, z + s.z);
  }
  // Outline of the window as a projected polyline (rounded corners sampled).
  outline(st = this.state, rad = this.o.radius ?? 28) {
    const [x0, y0, x1, y1] = this.win;
    const pts = [];
    const corner = (cx, cy, a0) => {
      for (let i = 0; i <= 6; i++) {
        const a = a0 + (i / 6) * (Math.PI / 2);
        pts.push(this.p(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, st));
      }
    };
    const mx = (x0 + x1) / 2;
    pts.push(this.p(mx, y0, st));
    corner(x1 - rad, y0 + rad, -Math.PI / 2);
    corner(x1 - rad, y1 - rad, 0);
    corner(x0 + rad, y1 - rad, Math.PI / 2);
    corner(x0 + rad, y0 + rad, Math.PI);
    pts.push(this.p(mx, y0, st));
    return pts;
  }
}

// ---------------------------------------------------------------- drawing
export const F = {
  head: '"Inter Tight"',
  body: 'Inter',
  mono: '"JetBrains Mono"',
};
export function font(ctx, size, weight = 800, family = F.head, tracking = 0) {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.letterSpacing = `${tracking * size}px`;
}
export function measure(ctx, str, size, weight = 800, family = F.head, tracking = 0) {
  font(ctx, size, weight, family, tracking);
  return ctx.measureText(str).width - (str.length ? tracking * size : 0);
}
// Draw text; o: {size, weight, family, tracking(em), color, align, alpha}
export function text(ctx, str, x, y, o = {}) {
  const { size = 48, weight = 800, family = F.head, tracking = 0, color = C.white, align = 'left', alpha = 1, baseline = 'alphabetic' } = o;
  if (alpha <= 0.001) return 0;
  font(ctx, size, weight, family, tracking);
  const w = ctx.measureText(str).width - (str.length ? tracking * size : 0);
  const ox = align === 'center' ? -w / 2 : align === 'right' ? -w : 0;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.textBaseline = baseline;
  ctx.fillText(str, x + ox, y);
  ctx.restore();
  return w;
}
// Rich line: segments [{t:'BUT WHO\'S ', c:white}, {t:'ANSWERING?', c:orange}]
export function richWidth(ctx, segs, o) {
  return segs.reduce((w, s) => w + measure(ctx, s.t, o.size, o.weight ?? 800, o.family ?? F.head, o.tracking ?? 0), 0);
}
export function rich(ctx, segs, x, y, o = {}) {
  const w = richWidth(ctx, segs, o);
  let cx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  for (const s of segs) cx += text(ctx, s.t, cx, y, { ...o, align: 'left', color: s.c ?? o.color ?? C.white });
  return w;
}
// Masked slide-up reveal of one line. p: 0..1 in, q: 0..1 out (exit upward).
export function revealLine(ctx, segs, x, y, o, p, q = 0) {
  if (p <= 0 || q >= 1) return;
  if (typeof segs === 'string') segs = [{ t: segs }];
  const size = o.size;
  const w = richWidth(ctx, segs, o);
  const lx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  ctx.save();
  ctx.beginPath();
  ctx.rect(lx - size, y - size * 1.05, w + size * 2, size * 1.38);
  ctx.clip();
  const dy = (1 - E.outQuint(p)) * size * 1.15 - E.inQuart(q) * size * 1.2;
  ctx.globalAlpha *= clamp(p * 1.6) * (1 - q);
  rich(ctx, segs, x, y + dy, o);
  ctx.restore();
}
// Per-character tracking-in reveal for hero lines.
export function trackIn(ctx, segs, x, y, o, p, q = 0) {
  if (p <= 0 || q >= 1) return;
  if (typeof segs === 'string') segs = [{ t: segs }];
  const tr0 = (o.tracking ?? 0) + 0.12 * (1 - E.outCubic(p));
  const oo = { ...o, tracking: tr0 };
  ctx.save();
  ctx.globalAlpha *= E.outCubic(clamp(p * 1.4)) * (1 - E.inCubic(q));
  if (p < 1) ctx.filter = `blur(${(1 - E.outCubic(p)) * 8}px)`;
  rich(ctx, segs, x, y - E.inCubic(q) * o.size * 0.4, oo);
  ctx.restore();
}

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
export function polyLen(pts) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return L;
}
// point at fraction u along polyline (with cumulative length table L)
export function along(pts, L, u) {
  const d = clamp(u) * L[L.length - 1];
  let lo = 0, hi = L.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] < d) lo = m; else hi = m; }
  const seg = L[hi] - L[lo] || 1;
  const f = (d - L[lo]) / seg;
  return [lerp(pts[lo][0], pts[hi][0], f), lerp(pts[lo][1], pts[hi][1], f), Math.atan2(pts[hi][1] - pts[lo][1], pts[hi][0] - pts[lo][0])];
}
// path for the sub-range [a, b] (fractions) of a polyline
export function subPath(ctx, pts, L, a, b) {
  a = clamp(a); b = clamp(b);
  if (b <= a) return false;
  const T = L[L.length - 1];
  const s = along(pts, L, a);
  ctx.moveTo(s[0], s[1]);
  for (let i = 1; i < pts.length; i++) {
    const d = L[i] / T;
    if (d <= a) continue;
    if (d >= b) break;
    ctx.lineTo(pts[i][0], pts[i][1]);
  }
  const e = along(pts, L, b);
  ctx.lineTo(e[0], e[1]);
  return true;
}
// Layered orange signal stroke: soft glow + body + hot core.
export function signal(ctx, pathFn, { w = 3, alpha = 1, glow = 1, color = C.orange, core = true } = {}) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';
  const pass = (lw, a, c) => { ctx.beginPath(); pathFn(ctx); ctx.lineWidth = lw; ctx.strokeStyle = rgba(c, a * alpha); ctx.stroke(); };
  if (glow > 0) { pass(w * 9, 0.05 * glow, color); pass(w * 4, 0.12 * glow, color); }
  ctx.globalCompositeOperation = 'source-over';
  pass(w, 0.95, color);
  if (core) pass(Math.max(1, w * 0.4), 0.7, C.orangeHot);
  ctx.restore();
}
// Bright signal head (soft radial glow).
export function head(ctx, x, y, r = 10, alpha = 1, color = C.orange) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
  g.addColorStop(0, rgba('#FFE2B8', 0.95 * alpha));
  g.addColorStop(0.18, rgba(C.orangeHot, 0.7 * alpha));
  g.addColorStop(0.45, rgba(color, 0.22 * alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 4, 0, TAU);
  ctx.fill();
  ctx.restore();
}
export function ringPulse(ctx, x, y, r0, r1, p, { w = 2, color = C.orange, alpha = 1 } = {}) {
  if (p <= 0 || p >= 1) return;
  ctx.save();
  ctx.globalAlpha = alpha * (1 - E.inSine(p));
  ctx.strokeStyle = color;
  ctx.lineWidth = w * (1 - 0.6 * p);
  ctx.beginPath();
  ctx.arc(x, y, lerp(r0, r1, E.outCubic(p)), 0, TAU);
  ctx.stroke();
  ctx.restore();
}
// Orange check-circle with draw-on tick.
export function checkCircle(ctx, x, y, r, p, { fill = C.orange, tick = C.bg, alpha = 1 } = {}) {
  if (p <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const s = E.outBack(clamp(p / 0.6), 2.2);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r * s, 0, TAU);
  ctx.fill();
  const tp = E.outCubic(prog(p, 0.35, 1));
  if (tp > 0) {
    const pts = [[x - r * 0.42, y + r * 0.02], [x - r * 0.1, y + r * 0.32], [x + r * 0.45, y - r * 0.3]];
    const L = polyLen(pts);
    ctx.beginPath();
    subPath(ctx, pts, L, 0, tp);
    ctx.strokeStyle = tick;
    ctx.lineWidth = r * 0.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.restore();
}
export function drawIcon(ctx, name, color, x, y, size, alpha = 1, stroke = 2) {
  const im = icon(name, color, stroke);
  if (!im || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(im, x - size / 2, y - size / 2, size, size);
  ctx.restore();
}

// Base atmosphere: charcoal with a soft central lift.
export function background(ctx, W, H, { lift = 1, cx = W / 2, cy = H / 2, warm = 0 } = {}) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const R = Math.max(W, H) * 0.75;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  g.addColorStop(0, `rgba(34,34,38,${0.9 * lift})`);
  g.addColorStop(0.55, `rgba(20,20,23,${0.6 * lift})`);
  g.addColorStop(1, 'rgba(10,10,11,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (warm > 0) {
    const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.7);
    g2.addColorStop(0, rgba(C.orange, 0.07 * warm));
    g2.addColorStop(1, rgba(C.orange, 0));
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);
  }
}
let grainTiles = null;
export function grain(ctx, W, H, frame, amount = 0.05) {
  if (!grainTiles) {
    grainTiles = [];
    const r = rng(99);
    for (let k = 0; k < 4; k++) {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d');
      const id = g.createImageData(256, 256);
      for (let i = 0; i < id.data.length; i += 4) {
        const v = r() * 255;
        id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
        id.data[i + 3] = 255;
      }
      g.putImageData(id, 0, 0);
      grainTiles.push(ctx.createPattern(c, 'repeat'));
    }
  }
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = 'soft-light';
  const pat = grainTiles[frame % 4];
  const ox = Math.floor(hash(frame) * 256), oy = Math.floor(hash(frame + 7) * 256);
  ctx.translate(-ox, -oy);
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, W + 256, H + 256);
  ctx.restore();
}
export function vignette(ctx, W, H, a = 0.55) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
