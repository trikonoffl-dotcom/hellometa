// Signature visual language: the call wave, call cards, particles.
import { C, rgba, clamp, lerp, hash, noise, E, TAU, F, text, drawIcon, rr, smooth } from './engine.js';

// Fictional numbers from ACMA's ranges reserved for creative works:
// (0X) 5550 xxxx, (0X) 7010 xxxx and 0491 570 xxx mobiles.
export const NUMBERS = [
  '+61 2 5550 0142', '+61 3 7010 4418', '+61 491 570 156', '+61 7 5550 2391', '+61 8 7010 6627',
  '+61 2 7010 3384', '+61 491 570 006', '+61 3 5550 9120', '+61 7 7010 5536', '+61 2 5550 7713',
  '+61 491 570 157', '+61 8 5550 1209', '+61 3 7010 0871', '+61 2 5550 4466', '+61 491 570 313',
  '+61 7 5550 8045', '+61 2 7010 9932', '+61 3 5550 3307', '+61 491 570 737', '+61 8 7010 2254',
  '+61 2 5550 6619', '+61 7 7010 1478', '+61 491 570 158', '+61 3 5550 5582', '+61 2 7010 7745',
  '+61 8 5550 3931', '+61 491 570 110', '+61 7 5550 6670', '+61 2 5550 2208', '+61 3 7010 6693',
  '+61 491 570 159', '+61 2 7010 1150',
];

// ------------------------------------------------------------------ waves
// One line of the call wave. Returns cross-axis offset at axial position s.
function chaosOffset(i, s, t, chaos) {
  const a1 = 0.55 + hash(i * 3.1) * 0.9, a2 = 0.3 + hash(i * 5.7) * 0.7, a3 = hash(i * 9.3);
  const f1 = 0.0042 + hash(i * 1.3) * 0.004, f2 = 0.011 + hash(i * 2.9) * 0.012, f3 = 0.03 + hash(i * 4.4) * 0.03;
  const ph = hash(i * 7.7) * TAU;
  const sp = 1.6 + hash(i * 8.8) * 2.4;
  const clean = Math.sin(s * 0.0062 - t * 3.2 + ph * 0.15);
  const wild = a1 * Math.sin(s * f1 - t * sp + ph) + a2 * Math.sin(s * f2 + t * sp * 1.7 + ph * 2.3) +
    0.35 * a3 * Math.sin(s * f3 - t * 6.1 + ph * 3.1) + 0.6 * noise(s * 0.006 + t * 1.3 + i * 17, i);
  return lerp(clean, wild, chaos);
}
// o: {axis:'h'|'v', s0, s1, c (cross centre), amp, chaos, n, t, alphaFn(i), funnel:{s, c} (converge end),
//     front (axial head; draw up to), back (axial tail), step, width, spread}
export function callWave(ctx, o) {
  const { axis = 'h', s0, s1, c, amp, chaos, n, t, step = 7, spread = 0.4, width = 1.5, alpha = 1, funnel = null, front = Infinity, back = -Infinity, colorFn = null } = o;
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const la = (o.alphaFn ? o.alphaFn(i) : 1) * alpha;
    if (la <= 0.004) continue;
    const kind = hash(i * 13.37);
    const col = colorFn ? colorFn(i) : kind < 0.2 ? C.orange : kind < 0.45 ? '#E8E8E8' : kind < 0.75 ? '#8A8A8A' : '#5E5E62';
    const baseOff = (hash(i * 2.2) - 0.5) * 2 * spread;
    ctx.beginPath();
    let started = false;
    const a = Math.max(s0, back), b = Math.min(s1, front);
    for (let s = a; s <= b + step * 0.5; s += step) {
      const ss = Math.min(s, b);
      let k = 1, cc = c;
      if (funnel) {
        const u = clamp((ss - funnel.s0) / (funnel.s - funnel.s0));
        k = 1 - E.inOutSine(u);
        cc = lerp(c, funnel.c, E.inOutSine(u));
      }
      const off = (chaosOffset(i, ss, t, chaos) + baseOff) * amp * k;
      const x = axis === 'h' ? ss : cc + off;
      const y = axis === 'h' ? cc + off : ss;
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    // tapered ends via alpha, crisp line
    ctx.strokeStyle = rgba(col, (col === C.orange ? 0.85 : 0.55) * la);
    ctx.lineWidth = width * (col === C.orange ? 1.25 : 1);
    ctx.stroke();
  }
  ctx.restore();
}
// Organised signal: parallel in-phase sine ribbon from a start point.
// o: {axis, s0, s1, c, amp, n, gap, t, k (wavenumber), speed, grow (px over which amplitude grows), alpha, front}
export function orderWave(ctx, o) {
  const { axis = 'h', s0, s1, c, amp = 40, n = 5, gap = 14, t, k = 0.012, speed = 5, grow = 260, alpha = 1, front = Infinity, dir = 1, width = 2, fade = 0 } = o;
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * gap;
    const mid = 1 - Math.abs(i - (n - 1) / 2) / ((n - 1) / 2 + 0.5);
    ctx.beginPath();
    let started = false;
    const end = Math.min(s1, front);
    for (let s = s0; dir > 0 ? s <= end : s >= end; s += 6 * dir) {
      const d = Math.abs(s - s0);
      const g = smooth(clamp(d / grow));
      const v = c + (Math.sin(d * k - t * speed) * amp + off) * g;
      const x = axis === 'h' ? s : v, y = axis === 'h' ? v : s;
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    const col = i === (n - 1) / 2 ? C.orangeHot : C.orange;
    const la = alpha * (0.35 + 0.65 * mid);
    if (fade > 0) {
      // fade out over the last `fade` px of the run
      const g = axis === 'h' ? ctx.createLinearGradient(s1 - fade, 0, s1, 0) : ctx.createLinearGradient(0, s1 - fade, 0, s1);
      g.addColorStop(0, rgba(col, la));
      g.addColorStop(1, rgba(col, 0));
      ctx.strokeStyle = g;
    } else ctx.strokeStyle = rgba(col, la);
    ctx.lineWidth = width * (0.6 + 0.6 * mid);
    ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ cards
// state: 'incoming' | 'missed' | 'voicemail'. s: scale. ring: 0..1 shake amount.
export function callCard(ctx, x, y, num, state, { s = 1, alpha = 1, ring = 0, t = 0, flip = 1, blur = 0 } = {}) {
  if (alpha <= 0.001) return;
  const w = 470, h = 100;
  ctx.save();
  if (blur > 0.4) ctx.filter = `blur(${blur.toFixed(1)}px)`;
  ctx.translate(x, y);
  ctx.scale(s, s * flip);
  ctx.globalAlpha *= alpha;
  const inc = state === 'incoming';
  rr(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fillStyle = 'rgba(20,20,22,0.94)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = inc ? rgba(C.orange, 0.7) : 'rgba(255,255,255,0.10)';
  ctx.stroke();
  const ix = -w / 2 + 52;
  ctx.fillStyle = inc ? C.orange : '#2C2C30';
  ctx.beginPath();
  ctx.arc(ix, 0, 34, 0, TAU);
  ctx.fill();
  const wob = inc ? Math.sin(t * 34) * 0.22 * ring * (Math.sin(t * 5) > -0.2 ? 1 : 0) : 0;
  ctx.save();
  ctx.translate(ix, 0);
  ctx.rotate(wob);
  drawIcon(ctx, inc ? 'phone-incoming' : state === 'voicemail' ? 'voicemail' : 'phone-missed', inc ? C.bg : '#BDBDBD', 0, 0, 34, 1, 2.2);
  ctx.restore();
  const tx = -w / 2 + 104;
  text(ctx, num, tx, -4, { size: 31, weight: 500, family: F.mono, color: inc ? C.white : '#9A9A9A' });
  if (!inc) {
    ctx.strokeStyle = 'rgba(160,160,160,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx - 2, -15);
    ctx.lineTo(tx + 262, -15);
    ctx.stroke();
  }
  text(ctx, inc ? 'INCOMING CALL' : state === 'voicemail' ? 'VOICEMAIL' : 'MISSED CALL', tx, 29, { size: 17, weight: 700, family: F.body, tracking: 0.18, color: inc ? C.orange : '#8E8E8E' });
  ctx.restore();
}

// ------------------------------------------------------------------ particles
// Deterministic burst: n particles from (x, y) emitted at t0.
export function burst(ctx, x, y, t, t0, { n = 24, seed = 1, speed = 260, life = 0.9, size = 2.2, color = C.orange, spread = TAU, dir = 0, drag = 2.2 } = {}) {
  const dt = t - t0;
  if (dt < 0 || dt > life * 1.6) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const a = dir + (hash(seed * 31 + i) - 0.5) * spread;
    const v = speed * (0.35 + hash(seed * 17 + i * 3) * 0.9);
    const l = life * (0.5 + hash(seed * 7 + i) * 0.8);
    if (dt > l) continue;
    const d = (v * (1 - Math.exp(-drag * dt))) / drag;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    const al = 1 - dt / l;
    ctx.fillStyle = rgba(color, al * 0.9);
    ctx.beginPath();
    ctx.arc(px, py, size * (0.5 + al * 0.6), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
// Slow ambient dust drifting in a direction; deterministic in t.
export function dust(ctx, W, H, t, { n = 60, seed = 3, alpha = 0.35, vx = 12, vy = -6, color = '#9A9A9A' } = {}) {
  if (alpha <= 0.001) return;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const x = (((hash(seed + i * 1.7) * W + vx * t * (0.5 + hash(i))) % W) + W) % W;
    const y = (((hash(seed + i * 2.3) * H + vy * t * (0.5 + hash(i + 9))) % H) + H) % H;
    const tw = 0.5 + 0.5 * Math.sin(t * (0.6 + hash(i * 4)) * 2 + i);
    ctx.fillStyle = rgba(hash(i * 5.1) < 0.18 ? C.orange : color, alpha * tw * (0.3 + hash(i * 3) * 0.7));
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + hash(i * 6) * 1.4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
