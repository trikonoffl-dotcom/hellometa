// HelloMeta logo renderer. The supplied logo pixels are drawn untouched; the
// write-on and signal effects only mask or overlay them.
import { C, rgba, clamp, lerp, polyLen, subPath, along, head, E } from './engine.js';

export class Logo {
  constructor({ full, hello, meta, info, path }) {
    this.full = full; this.hello = hello; this.meta = meta;
    this.iw = info.width; this.ih = info.height;
    this.split = info.split / info.width;
    this.metaLeft = info.metaLeft / info.width;
    this.pts = path.points; // [nx, ny, nr]
    this.L = polyLen(this.pts.map(([x, y]) => [x * this.iw, y * this.ih]));
    this.off = document.createElement('canvas');
    this.ox = this.off.getContext('2d');
    this.mask = document.createElement('canvas');
    this.mx = this.mask.getContext('2d');
  }
  aspect() { return this.ih / this.iw; }
  // screen-space polyline of the hello pen path for a logo box
  path(x, y, w) {
    const h = w * this.aspect();
    return this.pts.map(([nx, ny]) => [x + nx * w, y + ny * h]);
  }
  box(cx, cy, w) { const h = w * this.aspect(); return [cx - w / 2, cy - h / 2, w, h]; }
  // Exit point of the hello tail (rightmost point of the curl) and entry point.
  entry(cx, cy, w) { const [x, y, , h] = this.box(cx, cy, w); return [x + this.pts[0][0] * w, y + this.pts[0][1] * h]; }
  tail(cx, cy, w) {
    const [x, y, , h] = this.box(cx, cy, w);
    let best = this.pts[0];
    for (const p of this.pts) if (p[0] > best[0]) best = p;
    return [x + best[0] * w, y + best[1] * h];
  }
  // o: alpha, write (0..1 hello write-on), meta (0..1 reveal), metaRise
  draw(ctx, cx, cy, w, o = {}) {
    const { alpha = 1, write = 1, meta = 1, pen = true } = o;
    if (alpha <= 0.001) return;
    const [x, y, , h] = this.box(cx, cy, w);
    ctx.save();
    ctx.globalAlpha *= alpha;
    // --- hello
    if (write >= 1) {
      ctx.drawImage(this.hello, 0, 0, this.iw * this.split, this.ih, x, y, w * this.split, h);
    } else if (write > 0) {
      const ow = Math.ceil(w * this.split) + 4, oh = Math.ceil(h) + 4;
      if (this.off.width !== ow || this.off.height !== oh) { this.off.width = ow; this.off.height = oh; }
      const g = this.ox;
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, ow, oh);
      g.drawImage(this.hello, 0, 0, this.iw * this.split, this.ih, 0, 0, w * this.split, h);
      // build the reveal mask along the pen path (width follows the real stroke)
      if (this.mask.width !== ow || this.mask.height !== oh) { this.mask.width = ow; this.mask.height = oh; }
      const m = this.mx;
      m.clearRect(0, 0, ow, oh);
      m.lineCap = 'round';
      m.lineJoin = 'round';
      m.strokeStyle = '#000';
      const P = this.pts.map(([nx, ny]) => [nx * w, ny * h]);
      const f = write * (P.length - 1);
      const n = Math.floor(f);
      for (let i = 0; i <= n && i < P.length - 1; i++) {
        const r = this.pts[i][2] * w;
        const e = i < n ? 1 : f - n;
        m.lineWidth = r * 2.9 + 2;
        m.beginPath();
        m.moveTo(P[i][0], P[i][1]);
        m.lineTo(lerp(P[i][0], P[i + 1][0], e), lerp(P[i][1], P[i + 1][1], e));
        m.stroke();
      }
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(this.mask, 0, 0);
      g.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.off, x, y);
      if (pen) {
        const tip = along(P, this.L.map((v) => (v * w) / this.iw), write);
        head(ctx, x + tip[0], y + tip[1], w * 0.012, 1 - E.inQuart(prog01(write, 0.9, 1)));
      }
    }
    // --- Meta.ai: soft left-to-right wipe with a slight rise
    if (meta >= 1) {
      ctx.drawImage(this.meta, this.iw * this.split, 0, this.iw * (1 - this.split), this.ih, x + w * this.split, y, w * (1 - this.split), h);
    } else if (meta > 0) {
      const mx0 = x + w * this.metaLeft - 20, mx1 = x + w + 20;
      const edge = lerp(mx0, mx1 + 140, E.outCubic(meta));
      const ow = Math.ceil(w * (1 - this.split)) + 4, oh = Math.ceil(h) + 4;
      if (this.off.width !== ow || this.off.height !== oh) { this.off.width = ow; this.off.height = oh; }
      const g = this.ox;
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, ow, oh);
      g.drawImage(this.meta, this.iw * this.split, 0, this.iw * (1 - this.split), this.ih, 0, 0, w * (1 - this.split), h);
      g.globalCompositeOperation = 'destination-in';
      const ex = edge - (x + w * this.split);
      const grad = g.createLinearGradient(ex - 140, 0, ex, 0);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, ow, oh);
      g.globalCompositeOperation = 'source-over';
      const rise = (1 - E.outCubic(meta)) * h * 0.08;
      ctx.drawImage(this.off, x + w * this.split, y + rise);
    }
    ctx.restore();
  }
  // Orange signal travelling along the handwritten stroke. u = head position,
  // len = trail length (fractions of the path).
  signal(ctx, cx, cy, w, u, len = 0.22, alpha = 1, width = 1) {
    if (alpha <= 0.001) return;
    const [x, y] = this.box(cx, cy, w);
    const pts = this.pts.map(([nx, ny]) => [x + nx * w, y + ny * w * this.aspect()]);
    const L = this.L.map((v) => (v * w) / this.iw);
    const r = this.pts[0][2] * w;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'lighter';
    const steps = 14;
    for (let k = 0; k < steps; k++) {
      const a0 = u - len * ((k + 1) / steps), a1 = u - len * (k / steps);
      const fall = 1 - k / steps;
      ctx.beginPath();
      if (!subPath(ctx, pts, L, a0, a1)) continue;
      ctx.strokeStyle = rgba(C.orange, 0.42 * fall * alpha);
      ctx.lineWidth = r * 1.0 * width;
      ctx.stroke();
      ctx.strokeStyle = rgba(C.orange, 0.07 * fall * alpha);
      ctx.lineWidth = r * 4.2 * width;
      ctx.stroke();
    }
    ctx.restore();
    if (u > 0 && u < 1) {
      const p = along(pts, L, u);
      head(ctx, p[0], p[1], r * 0.9 * width, alpha);
    }
  }
}
const prog01 = (x, a, b) => clamp((x - a) / (b - a));
