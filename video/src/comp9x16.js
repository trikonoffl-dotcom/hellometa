// HelloMeta stall film: 9:16 portrait composition (1080x1920).
// Designed independently of 16:9: vertical signal flow, stacked UI panels,
// stacked typography, east-coast map framing.
import {
  C, rgba, clamp, lerp, prog, ep, env, E, hash, TAU, Panel, F, text, revealLine, trackIn, measure,
  polyLen, subPath, along, signal, head, ringPulse, checkCircle, drawIcon, rr, background, grain, vignette,
} from './engine.js';
import { CITIES, drawSkyline } from './map.js';
import { callWave, orderWave, callCard, burst, dust, NUMBERS } from './fx.js';

const CHECK_SVG = `url("data:image/svg+xml;base64,${btoa("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='20' fill='#FC8803'/><path d='M11.5 20.5l5.5 5.5L28.5 14.5' stroke='#0A0A0B' stroke-width='4.2' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>")}")`;

export function create(st, A, tl) {
  const { W, H } = st;
  const c0 = st.x0, c1 = st.x1;
  const T = tl.cues;
  const { map, logo, ui } = A;
  const SYD = CITIES.SYDNEY;
  const CX = W / 2;

  const mk = (name, { half = false, window = null, radius = 28 } = {}) => {
    const m = ui[name];
    const k = half ? 0.5 : 1;
    return new Panel(st, {
      url: `../assets/ui/${name}${half ? '@half' : ''}.png`, w: Math.round(m.w * k), h: Math.round(m.h * k),
      window: window ? window.map((v) => v * k) : null, radius: radius * k,
    });
  };
  // Portrait framing of the call log: the left six columns, full height.
  const logs = mk('calllogs', { window: [0, 0, 1100, 1716] }).strips('rows', ui.calllogs.rows, { x1: 1100 });
  const details = mk('calldetails')
    .strips('lines', ui.calldetails.lines, { x0: 34, x1: 606, filler: '#0B1422' })
    .slices('wave', ui.calldetails.regions.waveform, 72);
  const queue = mk('callqueues', { window: [0, 300, 1560, 1290] }).strips('rows', ui.callqueues.rows);
  const outb = mk('outbound', { window: [0, 900, 1560, 1746] });
  const dashO = mk('dashboard', { window: [0, 0, 462, 597] });
  const dashC = mk('dashboard', { window: [482, 0, 1560, 1055] });
  const E8 = [
    { name: 'finder', win: [0, 0, 1560, 1153], at: [290, 330], label: 'BUSINESS SEARCH' },
    { name: 'outbound', win: [0, 0, 1560, 1150], at: [790, 330], label: 'LEAD' },
    { name: 'callqueues', win: [0, 280, 1560, 1359], at: [790, 720], label: 'AI CALL' },
    { name: 'calllogs', win: [0, 200, 1560, 1300], at: [290, 720], label: 'CONVERSATION' },
    { name: 'assistants', win: [0, 0, 1560, 448], at: [290, 1110], label: 'APPOINTMENT', wide: 470 },
    { name: 'accounting', win: [0, 0, 1560, 493], at: [790, 1110], label: 'CRM + ACCOUNTING', wide: 470 },
    { name: 'dashboard', win: [0, 0, 1560, 1055], at: [790, 1500], label: 'REPORTING' },
    { name: 'metrics', win: [0, 0, 1560, 1000], at: [290, 1500], label: 'ANALYTICS' },
  ].map((e) => {
    const disp = e.wide || 440;
    const p = mk(e.name, { half: true, window: e.win });
    return { ...e, p, disp, s: disp / 780, h: ((e.win[3] - e.win[1]) / 1560) * disp };
  });

  const ripple = (ctx, x, y, t, alpha = 1, r1 = 64) => {
    for (let k = 0; k < 2; k++) {
      const ph = (((t + k * 0.4) % 0.8) + 0.8) % 0.8 / 0.8;
      ringPulse(ctx, x, y, 8, r1, ph, { w: 2.2, alpha: 0.85 * alpha });
    }
  };
  const plus61 = (ctx, x, y, t, a) => {
    if (a <= 0) return;
    ripple(ctx, x, y, t, a);
    head(ctx, x, y, 7, a);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = C.orange;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, TAU);
    ctx.fill();
    ctx.restore();
    text(ctx, '+61', x - 24, y + 11, { size: 30, weight: 700, family: F.mono, color: C.orange, alpha: a, align: 'right' });
  };
  const scrimV = (ctx, a, y0, y1, top = false) => {
    if (a <= 0) return;
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, rgba(C.bg, top ? 0.95 * a : 0));
    g.addColorStop(0.45, rgba(C.bg, 0.82 * a));
    g.addColorStop(1, rgba(C.bg, top ? 0 : 0.95 * a));
    ctx.fillStyle = g;
    if (top) {
      const g2 = ctx.createLinearGradient(0, y0, 0, y1);
      g2.addColorStop(0, rgba(C.bg, 0.95 * a));
      g2.addColorStop(0.6, rgba(C.bg, 0.8 * a));
      g2.addColorStop(1, rgba(C.bg, 0));
      ctx.fillStyle = g2;
    }
    ctx.fillRect(0, y0, W, y1 - y0);
  };
  const dim = (ctx, a) => { if (a > 0) { ctx.fillStyle = rgba(C.bg, a); ctx.fillRect(0, 0, W, H); } };

  // ------------------------------------------------------------ S1/S2 map
  const camA = { tx: 0, ty: 20, zoom: 1.3, tilt: 0, yaw: 0, ax: 540, ay: 620 };
  const camB = { tx: SYD[0] - 14, ty: SYD[1] - 18, zoom: 4.0, tilt: 0.86, yaw: -0.12, ax: 600, ay: 820 };
  const camC = { tx: SYD[0] - 18, ty: SYD[1] - 22, zoom: 5.2, tilt: 0.98, yaw: -0.26, ax: 560, ay: 860 };
  const camAt = (t) => {
    if (t <= 2.9) {
      const p = ep(t, 0.15, 2.9, E.inOutCubic);
      return {
        tx: lerp(camA.tx, camB.tx, p), ty: lerp(camA.ty, camB.ty, p), zoom: Math.exp(lerp(Math.log(camA.zoom), Math.log(camB.zoom), p)),
        tilt: lerp(0, camB.tilt, ep(t, 0.6, 2.9, E.inOutSine)), yaw: lerp(0, camB.yaw, p), ax: lerp(camA.ax, camB.ax, p), ay: lerp(camA.ay, camB.ay, p),
      };
    }
    const q = ep(t, 2.9, 9.8, E.outSine);
    const o = {};
    for (const k of Object.keys(camB)) o[k] = lerp(camB[k], camC[k], q);
    o.zoom = Math.exp(lerp(Math.log(camB.zoom), Math.log(camC.zoom), q));
    return o;
  };
  const PINS = [
    { off: [-30, -14], label: 'RESTAURANT', icon: 'utensils' },
    { off: [-62, 10], label: 'TRADES', icon: 'wrench' },
    { off: [-20, 30], label: 'PROPERTY', icon: 'house' },
    { off: [-54, -46], label: 'PROFESSIONAL SERVICES', icon: 'briefcase' },
    { off: [-80, -18], label: 'RETAIL', icon: 'shopping-bag' },
  ];
  const drawPin = (ctx, pin, i, t, a) => {
    const g = map.p(SYD[0] + pin.off[0], SYD[1] + pin.off[1], 0);
    const top = map.p(SYD[0] + pin.off[0], SYD[1] + pin.off[1], 9);
    if (!g || !top || a <= 0) return;
    const s = E.outBack(clamp(a), 1.8);
    ctx.save();
    ctx.globalAlpha = clamp(a);
    ctx.strokeStyle = rgba('#B0B0B0', 0.6);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(g[0], g[1]);
    ctx.lineTo(top[0], top[1]);
    ctx.stroke();
    ringPulse(ctx, top[0], top[1], 18, 46, (t * 0.9 + i * 0.27) % 1, { w: 1.6, alpha: 0.45 });
    ctx.fillStyle = '#141416';
    ctx.strokeStyle = rgba(C.orange, 0.75 + 0.25 * Math.sin(t * 3 + i));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(top[0], top[1], 21 * s, 0, TAU);
    ctx.fill();
    ctx.stroke();
    drawIcon(ctx, pin.icon, C.white, top[0], top[1], 21 * s);
    const lw = measure(ctx, pin.label, 19, 700, F.body, 0.14);
    rr(ctx, top[0] + 30, top[1] - 18, lw + 26, 36, 18);
    ctx.fillStyle = 'rgba(16,16,18,0.9)';
    ctx.fill();
    text(ctx, pin.label, top[0] + 43, top[1] + 7, { size: 19, weight: 700, family: F.body, tracking: 0.14, color: '#E6E6E6' });
    ctx.restore();
  };

  // S2 call schedule: cards stream in vertically
  const CARDS = [];
  {
    let tt = 4.55, i = 0;
    while (tt < 9.5) {
      const d = ep(tt, 4.55, 8.4, E.inCubic);
      const col = i % 2;
      const row = (i * 5) % 10;
      const ring = lerp(0.95, 0.42, d);
      CARDS.push({
        t0: tt, num: NUMBERS[(i + 1) % NUMBERS.length], x: (col ? 700 : 380) + (hash(i) - 0.5) * 80, y: 170 + row * 165 + (hash(i + 5) - 0.5) * 40,
        dir: hash(i * 3.3) < 0.7 ? (i % 2 ? 2 : 3) : (i % 2 ? 1 : 0), ring, vm: hash(i * 9.1) < 0.3, absorb: tt + 0.35 + ring + 0.55,
      });
      tt += lerp(0.42, 0.075, d);
      i++;
    }
  }
  const cardPos = (cd, t) => {
    const p = ep(t, cd.t0, cd.t0 + 0.38, E.outExpo);
    const from = [[-300, cd.y], [W + 300, cd.y], [cd.x, -150], [cd.x, H + 150]][cd.dir];
    let x = lerp(from[0], cd.x, p), y = lerp(from[1], cd.y, p);
    const q = ep(t, cd.absorb, cd.absorb + 0.55, E.inCubic);
    x = lerp(x, CX + (hash(cd.t0 * 3) - 0.5) * 160, q);
    y = lerp(y, y + (hash(cd.t0) - 0.3) * 260, q);
    return [x, y, q];
  };

  function sceneMap(t) {
    if (t >= 9.8) return;
    map.setCam({ ...camAt(t), F: 1500 });
    const a2 = 1 - 0.75 * ep(t, 4.6, 6.2);
    const par = ep(t, 1.4, 9.8, E.lin);
    drawSkyline(c0, 600 - 40 * par, 560 + 12 * par, 640, prog(t, 1.45, 3.7), { alpha: 0.85 * (1 - 0.9 * ep(t, 4.5, 5.4)), beacon: 1, t });
    map.draw(c0, { alpha: a2, reveal: lerp(0, 1100, ep(t, 0.05, 1.5, E.outCubic)), ox: SYD[0], oy: SYD[1], coast: 0.42, fine: ep(t, 1.3, 2.7), fog: 0.85 });
    PINS.forEach((pin, i) => drawPin(c0, pin, i, t, prog(t, 1.55 + i * 0.16, 1.95 + i * 0.16) * (1 - ep(t, 4.5, 5.2))));
  }

  function scene1(t) {
    if (t > 5.2) return;
    const sp = map.p(SYD[0], SYD[1], 0);
    if (sp) {
      plus61(c1, sp[0], sp[1], t, 1 - ep(t, 1.0, 1.35));
      const cp = ep(t, 1.0, 1.45, E.outBack);
      if (t >= 1.0) {
        const lift = map.p(SYD[0], SYD[1], 10) || sp;
        const cx = Math.min(lift[0] - 20, 820), cy = lift[1] - 270;
        const fo = 1 - ep(t, 4.4, 4.8);
        c1.save();
        c1.strokeStyle = rgba(C.orange, 0.7 * clamp(cp) * fo);
        c1.lineWidth = 2;
        c1.beginPath();
        c1.moveTo(sp[0], sp[1]);
        c1.lineTo(cx, cy + 50);
        c1.stroke();
        c1.restore();
        head(c1, sp[0], sp[1], 6, fo);
        ripple(c1, sp[0], sp[1], t, fo * clamp(cp), 58);
        const missed = t > 4.62;
        const flip = missed ? Math.abs(Math.cos(clamp((t - 4.55) / 0.14) * Math.PI)) : 1;
        const [ax, ay, q] = missed ? cardPos({ t0: -1, x: cx, y: cy, dir: 2, absorb: 5.0 }, t) : [cx, cy, 0];
        callCard(c1, ax, ay, NUMBERS[0], missed ? 'missed' : 'incoming', { s: lerp(0.55, 1, clamp(cp)) * (1 - 0.5 * q), alpha: clamp(cp * 1.5) * (1 - q), ring: 1, t, flip: Math.max(0.05, flip) });
      }
    }
    scrimV(c1, ep(t, 0.3, 1.0) * (1 - ep(t, 4.4, 5.0)), 1050, H);
    const o = { size: 104, weight: 800, tracking: -0.01 };
    const out = (k) => prog(t, 4.25 + k * 0.06, 4.7 + k * 0.06);
    revealLine(c1, 'YOUR BUSINESS', 80, 1330, o, prog(t, 0.55, 1.2), out(0));
    revealLine(c1, 'IS BUSY.', 80, 1440, o, prog(t, 0.72, 1.37), out(1));
    revealLine(c1, "BUT WHO'S", 80, 1610, o, prog(t, 2.35, 3.0), out(2));
    revealLine(c1, [{ t: 'ANSWERING?', c: C.orange }], 80, 1720, o, prog(t, 2.5, 3.15), out(3));
  }

  function scene2(t) {
    if (t < 4.4 || t >= 9.8) return;
    callWave(c0, {
      axis: 'v', s0: -40, s1: H + 40, c: CX, amp: lerp(80, 300, ep(t, 4.6, 9.4, E.outQuad)), chaos: lerp(0.3, 1, ep(t, 4.6, 9.2, E.inSine)), n: 46, t, spread: 0.55,
      alphaFn: (i) => (i < 8 ? ep(t, 4.6 + i * 0.12, 5.1 + i * 0.12) : CARDS[i - 8] ? ep(t, CARDS[i - 8].absorb + 0.4, CARDS[i - 8].absorb + 0.8) : 0), width: 1.9,
    });
    for (const cd of CARDS) {
      if (t < cd.t0) continue;
      const [x, y, q] = cardPos(cd, t);
      if (q >= 1) continue;
      const tm = cd.t0 + 0.38 + cd.ring;
      const state = t < tm ? 'incoming' : cd.vm ? 'voicemail' : 'missed';
      const flip = Math.abs(Math.cos(clamp((t - tm + 0.07) / 0.14) * Math.PI));
      const pv = cardPos(cd, t - 1 / 60);
      const mb = clamp(Math.hypot(x - pv[0], y - pv[1]) / 7, 0, 9);
      callCard(c1, x, y, cd.num, state, { blur: mb, s: 0.9 * (1 - 0.6 * q), alpha: (1 - q) * clamp((t - cd.t0) * 6), ring: 1, t, flip: Math.max(0.05, flip) });
      burst(c1, x - 180, y, t, tm, { n: 10, seed: cd.t0 * 100, color: '#9A9A9A', speed: 140, life: 0.6, size: 1.6 });
    }
    dim(c1, 0.62 * ep(t, 7.2, 7.6));
    const o = { size: 112, weight: 800, align: 'center', tracking: -0.01 };
    trackIn(c1, 'MISSED', CX, 700, o, prog(t, 7.3, 7.85));
    trackIn(c1, 'CALLS', CX, 815, o, prog(t, 7.38, 7.93));
    const eq = ep(t, 7.6, 7.95, E.outBack);
    if (eq > 0.001) {
      c1.save();
      c1.translate(CX, 930);
      c1.scale(eq, eq);
      text(c1, '=', 0, 40, { ...o, color: C.orange, size: 130 });
      c1.restore();
    }
    trackIn(c1, 'MISSED', CX, 1110, o, prog(t, 7.85, 8.4));
    trackIn(c1, 'OPPORTUNITIES', CX, 1225, { ...o, size: 106 }, prog(t, 7.95, 8.5));
  }

  function scene3(t) {
    if (t < 9.8 || t > 15.6) return;
    const lw = lerp(960, 880, ep(t, 13.35, 14.1));
    const ly = lerp(860, 600, ep(t, 13.35, 14.1));
    const la = ep(t, 10.2, 10.75, E.outCubic) * (1 - ep(t, 15.0, 15.45));
    const W2 = lw * lerp(1.05, 1, ep(t, 10.2, 11.0, E.outCubic));
    const en = logo.entry(CX, ly, W2);
    const tail = logo.tail(CX, ly, W2);
    // the wave cascades down and funnels into the lead-in stroke
    if (t > 11.2 && t < 13.3) {
      callWave(c1, {
        axis: 'v', s0: -60, s1: en[1], c: CX, amp: 300, chaos: 1, n: 34, t, spread: 0.5, width: 1.5,
        front: lerp(-60, en[1], ep(t, 11.2, 11.65, E.outCubic)), back: lerp(-60, en[1], ep(t, 12.35, 13.25, E.inCubic)),
        funnel: { s0: en[1] - 820, s: en[1], c: en[0] },
      });
      for (let j = 0; j < 9; j++) {
        const t0 = 11.25 + j * 0.11;
        const u = ep(t, t0, t0 + 0.55, E.inCubic);
        if (u <= 0 || u >= 1) { burst(c1, en[0], en[1], t, t0 + 0.55, { n: 14, seed: j + 40, speed: 220, life: 0.5 }); continue; }
        const x0 = CX + (hash(j * 4.1) - 0.5) * 760;
        const x = lerp(x0, en[0], E.inOutSine(u)), y = lerp(-120, en[1], u);
        callCard(c1, x, y, NUMBERS[(j + 5) % NUMBERS.length], j % 3 === 2 ? 'voicemail' : 'missed', { s: 0.62 * (1 - 0.8 * u), alpha: 1 - E.inQuart(u) });
      }
    }
    // organised signal descends from the tail of "hello"
    const conv = ep(t, 14.85, 15.35);
    if (t > 12.7) {
      const end = tail[1] + 420;
      orderWave(c1, {
        axis: 'v', s0: tail[1], s1: end, c: tail[0], amp: 30 * (1 - conv), n: 5, gap: 12 * (1 - conv), t, k: 0.013, speed: 5.5, grow: 200,
        front: lerp(tail[1], end, ep(t, 12.7, 13.3, E.outCubic)), alpha: 1 - ep(t, 15.35, 15.55), fade: 200,
      });
    }
    logo.draw(c1, CX, ly, W2, { alpha: la });
    logo.signal(c1, CX, ly, W2, ep(t, 11.65, 12.85, E.inOutSine), 0.26, la * (1 - ep(t, 12.85, 13.1)));
    head(c1, en[0], en[1], 10, env(t, 11.55, 11.95, 0.1, 0.3) * la);
    const o = { size: 112, weight: 800, align: 'center', tracking: -0.01 };
    const q = (k) => prog(t, 14.95 + k * 0.07, 15.35 + k * 0.07);
    revealLine(c1, 'WHAT IF', CX, 1130, o, prog(t, 13.5, 14.1), q(0));
    revealLine(c1, 'EVERY CALL', CX, 1250, o, prog(t, 13.6, 14.2), q(1));
    revealLine(c1, [{ t: 'WAS ', c: C.white }, { t: 'ANSWERED?', c: C.orange }], CX, 1370, o, prog(t, 13.7, 14.3), q(2));
  }

  const L_ROWS = ui.calllogs.rows;
  const FOCUS = 8;
  function scene4(t) {
    if (t < 15.15 || t > 22.2) return;
    const lh = ui.calllogs.h;
    const pin = ep(t, 15.7, 16.6, E.inOutCubic);
    const pf = ep(t, 16.85, 17.6, E.inOutCubic);
    const pd = ep(t, 17.65, 18.25, E.inOutCubic);
    const pb = ep(t, 20.4, 21.0, E.inOutCubic);
    const rowY = (L_ROWS[FOCUS][0] + L_ROWS[FOCUS][1]) / 2;
    const fsc = 1.22;
    const focusY = 760 - (rowY - lh / 2) * fsc;
    let s = { x: CX, y: lerp(1020, 960, pin), z: lerp(-300, 0, pin), s: 0.86, rx: lerp(30, 6, pin), ry: lerp(10, 2, pin) };
    s = { ...s, x: lerp(CX, CX + 40, pf), y: lerp(s.y, focusY, pf), s: lerp(0.86, fsc, pf), rx: lerp(s.rx, 0, pf), ry: lerp(s.ry, 0, pf) };
    s = { ...s, y: lerp(s.y, focusY - 420, pd), s: lerp(s.s, 1.1, pd) };
    s = { ...s, z: lerp(0, -500, pb) };
    const wipe = ep(t, 15.75, 16.2, E.inOutSine);
    const fo = ep(t, 17.05, 17.4);
    const r8 = L_ROWS[FOCUS];
    if (fo > 0) {
      logs.ov('dimA', [33, L_ROWS[0][0], 1067, r8[0] - L_ROWS[0][0]], `background:rgba(6,10,20,${0.5 * fo})`);
      logs.ov('dimB', [33, r8[1], 1067, L_ROWS[9][1] - r8[1]], `background:rgba(6,10,20,${0.5 * fo})`);
      logs.ov('focus', [26, r8[0] + 2, 1074, r8[1] - r8[0] - 4],
        `border:3px solid ${rgba(C.orange, fo)};border-radius:12px;box-shadow:0 0 34px ${rgba(C.orange, 0.45 * fo)}, inset 0 0 0 999px ${rgba(C.orange, 0.06 * fo)}`);
      const sx = lerp(40, 1060, ep(t, 17.1, 17.6, E.inOutSine));
      logs.ov('scan', [sx - 6, (r8[0] + r8[1]) / 2 - 6, 12, 12], `border-radius:50%;background:#FFD7A0;box-shadow:0 0 16px 6px ${rgba(C.orange, 0.8)};opacity:${env(t, 17.1, 17.7, 0.08, 0.15)}`);
    }
    if (t < 21.9) {
      logs.set({
        ...s, o: (t < 15.7 ? 0 : 1) * (1 - ep(t, 21.6, 21.9)), wipe, bright: lerp(1, 0.5, pd) * lerp(1, 0.6, pb), blur: 7 * pb,
        rows: (i) => { const p = ep(t, 15.95 + i * 0.085, 16.32 + i * 0.085, E.outCubic); return { o: p, dx: (1 - p) * 140 }; },
      });
    }
    // the signal arrives from above and traces the panel
    const st0 = { x: CX, y: 1020, z: -300, s: 0.86, rx: 30, ry: 10, rz: 0 };
    const tr = ep(t, 15.4, 15.85, E.inOutSine);
    const fadeTr = 1 - ep(t, 16.0, 16.5);
    if (t > 15.15 && fadeTr > 0) {
      const pts = logs.outline({ ...st0, ...s, rz: 0 });
      const L = polyLen(pts);
      const top = pts[0];
      const inb = ep(t, 15.15, 15.42, E.inCubic);
      signal(c1, (g) => { g.moveTo(top[0], -40); g.lineTo(top[0], lerp(-40, top[1], inb)); }, { w: 3, alpha: fadeTr * (1 - tr) });
      signal(c1, (g) => { subPath(g, pts, L, 0, tr * 0.5); }, { w: 3, alpha: fadeTr });
      signal(c1, (g) => { subPath(g, pts, L, 1 - tr * 0.5, 1); }, { w: 3, alpha: fadeTr });
      if (tr > 0 && tr < 1) { const a = along(pts, L, tr * 0.5), b = along(pts, L, 1 - tr * 0.5); head(c1, a[0], a[1], 9); head(c1, b[0], b[1], 9); }
      if (wipe > 0 && wipe < 1) {
        const yy = lh * wipe;
        const a = logs.p(0, yy, { ...st0, ...s }), b = logs.p(1100, yy, { ...st0, ...s });
        signal(c1, (g) => { g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }, { w: 2.5, alpha: 0.9 });
      }
    }
    // call details rises from below
    const dl = ui.calldetails;
    const dIn = ep(t, 17.65, 18.25, E.outCubic);
    const dOut = ep(t, 21.55, 22.0, E.inOutCubic);
    if (t > 17.6) {
      const ph = ep(t, 18.2, 20.1, E.lin);
      const wr = dl.regions.waveform;
      details.ov('play', [wr[0] + (wr[2] - wr[0]) * ph - 2, wr[1] - 10, 4, wr[3] - wr[1] + 20],
        `background:#FFE0B0;box-shadow:0 0 14px 4px ${rgba(C.orange, 0.85)};border-radius:2px;opacity:${env(t, 18.2, 20.25, 0.1, 0.2)}`);
      details.ov('tfade', [34, 760, 572, 40], 'background:linear-gradient(rgba(11,20,34,0),rgba(11,20,34,1))');
      const lineT = [18.35, 18.45, 18.9, 19.0, 19.45, 19.55, 19.75];
      details.set({
        x: CX, y: lerp(2500, 1230, dIn), z: lerp(0, -500, pb), s: 1.3, rx: lerp(-30, 0, dIn) + 88 * dOut, o: clamp(dIn * 2),
        blur: 6 * pb * (1 - dOut) + 10 * (1 - dIn) ** 2, bright: lerp(1, 0.6, pb),
        lines: (i) => ({ clip: ep(t, lineT[i], lineT[i] + (i === 5 ? 0.5 : 0.3), E.inOutSine) }),
        wave: (i) => {
          const u = i / 71;
          const near = Math.exp(-((u - ph) ** 2) / 0.004) * env(t, 18.2, 20.1, 0.1, 0.2);
          return { sy: 1 + near * (0.35 + 0.25 * Math.sin(t * 38 + i * 1.7)) };
        },
      });
    }
    // transcript captions above the drawer
    const ca = ep(t, 18.15, 18.5) * (1 - ep(t, 20.3, 20.6));
    scrimV(c1, ca, 0, 760, true);
    const qo = (k) => prog(t, 20.25 + k * 0.05, 20.6 + k * 0.05);
    const lab = { size: 26, weight: 700, family: F.body, tracking: 0.22 };
    const big = { size: 84, weight: 800, tracking: -0.01 };
    revealLine(c1, [{ t: 'AI', c: C.orange }], 80, 150, lab, prog(t, 18.35, 18.75), qo(0));
    revealLine(c1, 'Hello?', 80, 236, big, prog(t, 18.45, 18.95), qo(0));
    revealLine(c1, [{ t: 'USER', c: '#9A9A9A' }], 80, 316, lab, prog(t, 18.9, 19.3), qo(1));
    revealLine(c1, 'Hello?', 80, 402, big, prog(t, 19.0, 19.5), qo(1));
    revealLine(c1, [{ t: 'AI', c: C.orange }], 80, 482, lab, prog(t, 19.45, 19.85), qo(2));
    const sm = { size: 52, weight: 700, tracking: -0.005 };
    revealLine(c1, 'Hi, this is Angela calling', 80, 552, sm, prog(t, 19.55, 20.0), qo(2));
    revealLine(c1, 'from MetaWeb…', 80, 616, sm, prog(t, 19.65, 20.1), qo(3));
    const ba = ep(t, 20.0, 20.35, E.outBack) * (1 - ep(t, 20.4, 20.65));
    if (ba > 0.001) {
      c1.save();
      c1.translate(CX, 1838);
      c1.scale(ba, ba);
      rr(c1, -230, -46, 460, 92, 46);
      c1.fillStyle = 'rgba(14,14,16,0.95)';
      c1.fill();
      c1.strokeStyle = C.orange;
      c1.lineWidth = 2.5;
      c1.stroke();
      c1.restore();
      checkCircle(c1, CX - 180 * ba, 1838, 28 * ba, prog(t, 20.05, 20.5));
      text(c1, 'AI ANSWERED', CX + 34 * ba, 1838 + 16 * ba, { size: 44 * ba, weight: 800, align: 'center', alpha: clamp(ba) });
    }
    const ha = { size: 150, weight: 800, align: 'center', tracking: -0.015 };
    trackIn(c1, 'HELLOMETA', CX, 900, ha, prog(t, 20.55, 21.2), prog(t, 21.45, 21.75));
    trackIn(c1, [{ t: 'ANSWERS.', c: C.orange }], CX, 1060, ha, prog(t, 20.65, 21.3), prog(t, 21.5, 21.8));
    if (dOut > 0 && dOut < 1) {
      // drawer folds into the vertical journey spine
      const x = lerp(CX, 170, dOut), y0 = lerp(1230 - 500, 230, dOut), y1 = lerp(1230 + 500, 800, dOut);
      signal(c1, (g) => { g.moveTo(x, y0); g.lineTo(x, y1); }, { w: 3, alpha: dOut });
    }
  }

  // vertical journey
  const NODES = [
    { y: 250, label: 'CALL', icon: 'phone' }, { y: 440, label: 'CONVERSATION', icon: 'message-square-text' },
    { y: 630, label: 'LEAD', icon: 'user-check' }, { y: 820, label: 'APPOINTMENT', icon: 'calendar-check' },
  ];
  const NODE_T = [T.s5_nodeCall, T.s5_nodeConv, T.s5_nodeLead, T.s5_nodeAppt];
  const JX = 170;
  const headY = (t) => {
    if (t < NODE_T[0]) return lerp(150, NODES[0].y, ep(t, 21.95, NODE_T[0], E.outCubic));
    for (let k = 0; k < 3; k++) if (t < NODE_T[k + 1]) return lerp(NODES[k].y, NODES[k + 1].y, ep(t, NODE_T[k + 1] - 0.38, NODE_T[k + 1], E.inOutSine));
    return NODES[3].y;
  };
  function journey(ctx, t, a) {
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#2E2E32';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(JX, 150);
    ctx.lineTo(JX, 880);
    ctx.stroke();
    ctx.restore();
    const hy = headY(t);
    signal(ctx, (g) => { g.moveTo(JX, 150); g.lineTo(JX, hy); }, { w: 3, alpha: a });
    NODES.forEach((n, k) => {
      const on = ep(t, NODE_T[k] - 0.02, NODE_T[k] + 0.25, E.outCubic);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = on > 0.5 ? C.orange : '#151517';
      ctx.strokeStyle = on > 0.5 ? C.orange : '#3A3A3E';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(JX, n.y, 44 * (1 + 0.15 * Math.sin(Math.PI * on)), 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      drawIcon(ctx, n.icon, on > 0.5 ? C.bg : '#8E8E8E', JX, n.y, 40, a, 2.2);
      ringPulse(ctx, JX, n.y, 46, 120, prog(t, NODE_T[k], NODE_T[k] + 0.8), { alpha: a });
      text(ctx, n.label, JX + 86, n.y + 20, { size: 58, weight: 800, tracking: 0.01, color: on > 0.5 ? C.white : '#4E4E52', alpha: a });
    });
    if (t < NODE_T[3] + 0.1) head(ctx, JX, hy, 10, a);
  }

  const Q_ROWS = ui.callqueues.rows;
  function scene5(t) {
    if (t < 21.7 || t > 28.9) return;
    journey(c1, t, ep(t, 21.85, 22.1) * (1 - ep(t, 28.2, 28.55)));
    const qi = ep(t, 23.0, 23.55, E.outCubic);
    const qo = ep(t, 25.2, 25.65, E.inOutCubic);
    if (t > 22.95 && t < 25.7) {
      const scanP = ep(t, 24.1, 25.1, E.lin);
      const scanY = lerp(Q_ROWS[0][0], Q_ROWS[9][1], scanP);
      Q_ROWS.forEach((r, i) => {
        const done = clamp((scanY - r[1]) / 30);
        if (done > 0) {
          queue.ov('tick' + i, [1490, (r[0] + r[1]) / 2 - 20, 40, 40], `background:${CHECK_SVG} center/contain no-repeat;opacity:${done};transform:scale(${E.outBack(done)})`);
          queue.ov('flash' + i, [33, r[0], 1494, r[1] - r[0]], `background:${rgba(C.orange, 0.13 * (1 - done) + 0.03)}`);
        }
      });
      if (scanP > 0 && scanP < 1) queue.ov('scan', [33, scanY - 2, 1494, 4], `background:#FFD39A;box-shadow:0 0 18px 4px ${rgba(C.orange, 0.8)}`);
      queue.set({
        x: CX, y: lerp(2400, 1390, qi) + qo * 900, s: 0.66, rx: lerp(-32, 4, qi) - qo * 30, o: clamp(qi * 2) * (1 - qo), blur: 10 * (1 - qi) ** 2 + 6 * qo * qo,
        rows: (i) => {
          const p = ep(t, 23.25 + i * 0.07, 23.6 + i * 0.07, E.outCubic);
          const done = clamp((scanY - Q_ROWS[i][1]) / 30);
          return { o: p * (1 - 0.45 * done), dx: (1 - p) * 220 };
        },
      });
    }
    const oi = ep(t, 25.3, 25.85, E.outCubic);
    const oo = ep(t, 26.75, 27.2, E.inOutCubic);
    if (t > 25.25 && t < 27.25) {
      ui.outbound.rows.forEach((r, i) => {
        const p = ep(t, 25.8 + i * 0.08, 26.0 + i * 0.08, E.outCubic);
        if (p > 0) outb.ov('sel' + i, [33, r[0] + 6, 1494, r[1] - r[0] - 12], `border-left:6px solid ${C.orange};background:${rgba(C.orange, 0.08 * p)};opacity:${p};border-radius:6px`);
      });
      const aq = ui.outbound.regions.addToQueue;
      const pq = env(t, 26.15, 26.9, 0.12, 0.3);
      outb.ov('addq', [aq[0] - 6, aq[1] - 6, aq[2] - aq[0] + 12, aq[3] - aq[1] + 12], `border-radius:40px;border:3px solid ${rgba(C.orange, pq)};box-shadow:0 0 30px ${rgba(C.orange, 0.6 * pq)}`);
      const stt = { x: CX, y: lerp(2400, 1390, oi), s: 0.66, rx: lerp(-30, 3, oi), o: clamp(oi * 2) * (1 - oo), blur: 10 * (1 - oi) ** 2, z: lerp(0, -300, oo) };
      outb.set(stt);
      const b = outb.p((aq[0] + aq[2]) / 2, (aq[1] + aq[3]) / 2, stt);
      const sp = ep(t, 26.2, 26.5, E.inOutSine);
      if (sp > 0 && t < 26.9) {
        const pts = [[b[0], b[1]], [b[0] + 30, b[1] - 120], [JX + 300, NODES[3].y + 80], [JX + 50, NODES[3].y + 10]];
        const L = polyLen(pts);
        signal(c1, (g) => subPath(g, pts, L, Math.max(0, sp - 0.5), sp), { w: 3, alpha: 1 - ep(t, 26.6, 26.9) });
        const hp = along(pts, L, sp);
        head(c1, hp[0], hp[1], 9, 1 - ep(t, 26.5, 26.6));
      }
    }
    if (t > 26.75) {
      const bo = ep(t, 28.15, 28.5);
      checkCircle(c1, CX, 1120, 74, prog(t, 26.8, 27.5), { alpha: 1 - bo });
      for (let k = 0; k < 3; k++) ringPulse(c1, CX, 1120, 78, 300, prog(t, 26.95 + k * 0.28, 27.95 + k * 0.28), { w: 3, alpha: 1 - bo });
      const o = { size: 118, weight: 800, align: 'center', tracking: -0.01 };
      trackIn(c1, 'APPOINTMENT', CX, 1340, o, prog(t, 26.9, 27.5), bo);
      trackIn(c1, 'BOOKED', CX, 1462, o, prog(t, 27.0, 27.6), bo);
      const cap = { size: 44, weight: 500, family: F.body, align: 'center', color: '#C8C8CC' };
      revealLine(c1, 'From first hello', CX, 1570, cap, prog(t, 27.3, 27.8), bo);
      revealLine(c1, 'to booked appointment.', CX, 1630, cap, prog(t, 27.38, 27.88), bo);
    }
  }

  // S6 engine: zig-zag grid, overall downward flow
  const stagesT = T.s6_stages;
  const conn = [];
  for (let k = 0; k < 7; k++) {
    const a = E8[k], b = E8[k + 1];
    let p0, p1, q0, q1;
    if (a.at[1] === b.at[1]) {
      const dir = Math.sign(b.at[0] - a.at[0]);
      p0 = [a.at[0] + (dir * a.disp) / 2, a.at[1]]; p1 = [b.at[0] - (dir * b.disp) / 2, b.at[1]];
      q0 = [p0[0] + dir * 30, p0[1]]; q1 = [p1[0] - dir * 30, p1[1]];
    } else {
      p0 = [a.at[0], a.at[1] + a.h / 2]; p1 = [b.at[0], b.at[1] - b.h / 2];
      q0 = [p0[0], p0[1] + 70]; q1 = [p1[0], p1[1] - 70];
    }
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const u = i / 30, v = 1 - u;
      pts.push([v * v * v * p0[0] + 3 * v * v * u * q0[0] + 3 * v * u * u * q1[0] + u * u * u * p1[0], v * v * v * p0[1] + 3 * v * v * u * q0[1] + 3 * v * u * u * q1[1] + u * u * u * p1[1]]);
    }
    conn.push({ pts, L: polyLen(pts) });
  }
  function engineHead(t) {
    if (t <= stagesT[0]) return E8[0].at;
    for (let k = 0; k < 7; k++) {
      if (t < stagesT[k + 1]) {
        const u = ep(t, stagesT[k] + 0.12, stagesT[k + 1], E.inOutSine);
        return u <= 0 ? E8[k].at : along(conn[k].pts, conn[k].L, u);
      }
    }
    return E8[7].at;
  }
  const camE = (t) => {
    const h = engineHead(t);
    const z = lerp(1.75, 1.0, ep(t, 28.4, 33.0, E.inOutCubic));
    const follow = 1 - ep(t, 31.8, 33.0, E.inOutCubic);
    return { x: lerp(CX, h[0], follow), y: lerp(900, clamp(h[1], 330, 1500), follow), z };
  };
  function scene6(t) {
    if (t < 28.2 || t > 35.6) return;
    const cam = camE(t);
    const toS = (p) => [(p[0] - cam.x) * cam.z + CX, (p[1] - cam.y) * cam.z + H / 2];
    const fin = ep(t, 28.35, 28.75);
    const fout = ep(t, 34.8, 35.4, E.inCubic);
    conn.forEach((c, k) => {
      const pts = c.pts.map(toS);
      const L = polyLen(pts);
      c0.save();
      c0.globalAlpha = fin * (1 - fout);
      c0.setLineDash([6, 8]);
      c0.strokeStyle = '#3A3A3E';
      c0.lineWidth = 2;
      c0.beginPath();
      subPath(c0, pts, L, 0, 1);
      c0.stroke();
      c0.restore();
      const u = ep(t, stagesT[k] + 0.12, stagesT[k + 1], E.inOutSine);
      if (u > 0) signal(c0, (g) => subPath(g, pts, L, 0, u), { w: 2.6, alpha: fin * (1 - fout) * (u < 1 ? 1 : 0.75) });
      const flow = ep(t, stagesT[k + 1], stagesT[k + 1] + 0.3);
      for (let j = 0; j < 2; j++) {
        const hp = along(pts, L, (t * 0.55 + j * 0.5 + k * 0.13) % 1);
        head(c0, hp[0], hp[1], 5, flow * fin * (1 - fout) * 0.8);
      }
    });
    E8.forEach((e, k) => {
      const [sx, sy] = toS(e.at);
      const arr = ep(t, stagesT[k] - 0.05, stagesT[k] + 0.25, E.outCubic);
      const rx = clamp((sy - H / 2) * -0.008, -10, 10);
      const z = (hash(k * 2.7) - 0.5) * 60 + 40 * Math.sin(Math.PI * clamp((t - stagesT[k]) / 0.5)) - fout * 1400;
      e.p.set({
        x: sx, y: sy, z, s: e.s * cam.z, rx, ry: (sx < CX ? 4 : -4), o: lerp(0.35, 1, ep(t, stagesT[k] - 0.4, stagesT[k], E.outSine)) * fin * (1 - ep(t, 34.9, 35.4)),
        glow: arr * lerp(1, 0.4, ep(t, stagesT[k] + 0.3, stagesT[k] + 0.9)), bright: lerp(0.65, 1, arr),
      });
      const ls = clamp(28 * Math.pow(cam.z, 0.7), 28, 46);
      const ly = sy - (e.h / 2) * cam.z - 18 * Math.pow(cam.z, 0.5);
      const lx = sx - (e.disp / 2) * cam.z;
      const la = fin * (1 - fout) * lerp(0.4, 1, arr);
      text(c1, String(k + 1).padStart(2, '0'), lx, ly, { size: ls, weight: 800, color: arr > 0.5 ? C.orange : '#5E5E62', alpha: la });
      text(c1, e.label, lx + ls * 1.5, ly, { size: ls, weight: 800, tracking: 0.02, color: arr > 0.5 ? C.white : '#6E6E72', alpha: la });
    });
    const hh = toS(engineHead(t));
    if (t < stagesT[7] + 0.2) head(c1, hh[0], hh[1], 11, fin * (1 - fout));
    const so = ep(t, 34.75, 35.1);
    const o = { size: 62, weight: 800, align: 'center' };
    trackIn(c1, 'NOT JUST ANSWERING.', CX, 1760, o, prog(t, 33.1, 33.7), so);
    trackIn(c1, [{ t: 'CONNECTING.', c: C.orange }], CX, 1840, o, prog(t, 33.25, 33.85), so);
  }

  // S7 network: paths rise vertically into HelloMeta
  const NET = [];
  {
    let j = 0;
    ['SYDNEY', 'MELBOURNE', 'BRISBANE', 'PERTH', 'ADELAIDE'].forEach((cn, ci) => {
      const c = CITIES[cn];
      const n = cn === 'ADELAIDE' ? 7 : 13;
      for (let i = 0; i < n * 3 && NET.filter((p) => p.city === ci).length < n; i++) {
        const a = hash(j * 1.7 + 11) * TAU, r = 6 + hash(j * 2.9 + 3) * 34;
        const x = c[0] + Math.cos(a) * r * 1.2, y = c[1] + Math.sin(a) * r;
        j++;
        if (!map.inside(x, y)) continue;
        NET.push({ x, y, city: ci, t0: T.s7_converge + hash(j * 5.3) * 1.0, t1: T.s7_return + hash(j * 3.1) * 1.0, k: j });
      }
    });
  }
  const HUB = [CX, 330];
  const HUBIN = [CX, 440];
  const rise = (a, b, k) => {
    const pts = [];
    const c1p = [a[0], lerp(a[1], b[1], 0.55 + 0.15 * k)];
    const c2p = [b[0] + (a[0] - b[0]) * 0.25, b[1] + 160];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24, v = 1 - u;
      pts.push([v * v * v * a[0] + 3 * v * v * u * c1p[0] + 3 * v * u * u * c2p[0] + u * u * u * b[0], v * v * v * a[1] + 3 * v * v * u * c1p[1] + 3 * v * u * u * c2p[1] + u * u * u * b[1]]);
    }
    return pts;
  };
  function scene7(t) {
    if (t < 34.8 || t > 39.6) return;
    const mi = ep(t, 34.9, 35.6) * (1 - ep(t, 38.9, 39.35));
    map.setCam({ tx: -6, ty: 30, zoom: lerp(1.3, 1.38, ep(t, 35, 39.2, E.lin)), tilt: lerp(0.66, 0.46, ep(t, 34.9, 35.9, E.outCubic)), yaw: 0, ax: CX, ay: 1070, F: 1500 });
    map.draw(c0, { alpha: mi, coast: 0.5, fog: 0.4 });
    const la = ep(t, 35.3, 35.8) * (1 - ep(t, 38.85, 39.2));
    for (let k = 0; k < 4; k++) ringPulse(c1, HUB[0], HUB[1], 60, 320, prog(t, 36.1 + k * 0.45, 37.0 + k * 0.45), { w: 2, alpha: la * 0.6 });
    const names = ['SYDNEY', 'MELBOURNE', 'BRISBANE', 'PERTH', 'ADELAIDE'];
    const side = { SYDNEY: -1, MELBOURNE: -1, BRISBANE: -1, PERTH: 1, ADELAIDE: -1 };
    names.forEach((n, i) => {
      const q = map.p(...CITIES[n]);
      if (!q) return;
      const a = ep(t, 35.4 + i * 0.1, 35.8 + i * 0.1) * mi;
      c0.fillStyle = rgba(C.orange, a);
      c0.beginPath();
      c0.arc(q[0], q[1], 6, 0, TAU);
      c0.fill();
      text(c1, n, q[0] + side[n] * 20, q[1] + 30, { size: 26, weight: 700, tracking: 0.14, align: side[n] > 0 ? 'left' : 'right', alpha: a });
    });
    for (const p of NET) {
      const q = map.p(p.x, p.y);
      if (!q) continue;
      const pa = ep(t, 35.45 + hash(p.k) * 0.8, 35.75 + hash(p.k) * 0.8) * mi;
      const back = ep(t, p.t1 + 0.55, p.t1 + 0.75);
      c0.fillStyle = back > 0.5 ? rgba(C.orange, pa) : rgba('#D0D0D0', pa * 0.85);
      c0.beginPath();
      c0.arc(q[0], q[1], 2.8 + back * 1.2, 0, TAU);
      c0.fill();
      const path = rise([q[0], q[1]], HUBIN, hash(p.k * 3));
      const L = polyLen(path);
      const u = ep(t, p.t0, p.t0 + 0.65, E.inOutSine);
      const w = ep(t, p.t1, p.t1 + 0.65, E.inOutSine);
      const ga = mi * (1 - ep(t, 38.7, 39.1));
      if (u > 0) {
        c0.save();
        c0.strokeStyle = rgba(C.orange, 0.15 * ga);
        c0.lineWidth = 1.2;
        c0.beginPath();
        subPath(c0, path, L, 0, u);
        c0.stroke();
        c0.restore();
        if (u < 1) {
          signal(c1, (g) => subPath(g, path, L, Math.max(0, u - 0.25), u), { w: 2, alpha: ga, glow: 0.6 });
          const hp = along(path, L, u);
          head(c1, hp[0], hp[1], 5, ga);
        }
      }
      if (w > 0 && w < 1) {
        signal(c1, (g) => subPath(g, path, L, 1 - w, Math.min(1, 1 - w + 0.25)), { w: 2, alpha: ga, glow: 0.6 });
        const hp = along(path, L, 1 - w);
        head(c1, hp[0], hp[1], 5, ga);
      }
      if (back > 0) ringPulse(c0, q[0], q[1], 3, 22, prog(t, p.t1 + 0.6, p.t1 + 1.3), { w: 1.5, alpha: mi });
    }
    logo.draw(c1, HUB[0], HUB[1], 640, { alpha: la });
    const wo = ep(t, 38.75, 39.1);
    ['ANSWERED', 'QUALIFIED', 'BOOKED'].forEach((wd, i) => {
      const y = 1590 + i * 100;
      const p = prog(t, T.s7_words[i], T.s7_words[i] + 0.5);
      checkCircle(c1, 330, y - 22, 26, p * (1 - wo));
      revealLine(c1, wd, 380, y, { size: 64, weight: 800 }, p, wo);
    });
    const fire = env(t, 38.7, 39.35, 0.25, 0.35);
    head(c1, HUBIN[0], HUBIN[1], 16 * (1 + 0.6 * fire), fire);
  }

  // S8 dashboard: overview card above the charts card, stacked
  const DR = ui.dashboard.regions;
  const CH = A.charts;
  function scene8(t) {
    if (t < 39.1 || t > 42.85) return;
    const pi = ep(t, 39.2, 39.8, E.outCubic);
    const pi2 = ep(t, 39.32, 39.92, E.outCubic);
    const drift = ep(t, 39.8, 41.6, E.inOutSine);
    const col = ep(t, 41.6, 42.05, E.inCubic);
    const rev = ep(t, 39.65, 40.85, E.inOutCubic);
    const fade = 1 - ep(t, 41.95, 42.05);
    if (rev < 1) {
      const cover = (key, [x0, y0, x1, y1], color) => { const x = lerp(x0, x1, rev); dashC.ov(key, [x, y0, x1 - x + 2, y1 - y0], `background:${color}`); };
      cover('cm', [598, 165, 1488, 470], '#183050');
      cover('cc', [606, 672, 1488, 978], '#1F3B63');
    }
    ['statPhone', 'statCalls', 'statQueues'].forEach((k, i) => {
      const g = env(t, T.s8_stats[i], T.s8_stats[i] + 0.9, 0.15, 0.5);
      if (g > 0) { const r = DR[k]; dashO.ov('st' + i, [r[0] - 4, r[1] - 4, r[2] - r[0] + 8, r[3] - r[1] + 8], `border-radius:26px;border:3px solid ${rgba(C.orange, g)};box-shadow:0 0 34px ${rgba(C.orange, 0.5 * g)}`); }
    });
    const so = { x: CX, y: lerp(HUB[1], 470, pi), z: lerp(-1500, 0, pi), s: lerp(1.05, 1.12, drift), rx: lerp(40, 4, pi) * (1 - drift) + col * 89, o: clamp(pi * 2) * fade, glow: col };
    const sc = { x: CX, y: lerp(HUB[1], 1330, pi2), z: lerp(-1500, 0, pi2), s: lerp(0.92, 0.96, drift), rx: lerp(40, 4, pi2) * (1 - drift) + col * 89, o: clamp(pi2 * 2) * fade, glow: col };
    dashO.set(so);
    dashC.set(sc);
    for (const pts0 of [CH.minutes, CH.calls]) {
      const pts = pts0.map(([x, y]) => dashC.p(x, y, sc));
      const L = polyLen(pts);
      if (rev > 0 && rev < 1 && col === 0) {
        signal(c1, (g) => subPath(g, pts, L, Math.max(0, rev - 0.18), rev), { w: 2.4, alpha: 1 - ep(t, 40.7, 40.85) });
        const hp = along(pts, L, rev);
        head(c1, hp[0], hp[1], 8);
      }
    }
    if (t > 41.95) {
      const en = logo.entry(CX, 860, 960);
      const sh = ep(t, 42.05, 42.65, E.inOutCubic);
      const cy = lerp(900, en[1], sh);
      const x0 = lerp(60, en[0], sh), x1 = lerp(1020, en[0], sh);
      signal(c1, (g) => { g.moveTo(x0, cy); g.lineTo(x1, cy); }, { w: 3, alpha: 1 - ep(t, 42.6, 42.8) });
      head(c1, lerp(CX, en[0], sh), cy, 10 + 8 * sh);
    }
  }

  const P0 = (() => { map.setCam({ ...camA, F: 1500 }); const q = map.p(SYD[0], SYD[1], 0); return [q[0], q[1]]; })();
  function scene9(t) {
    if (t < 42.6) return;
    const cx = CX, cy = 860, w = 960;
    const fo = ep(t, 47.0, 47.6, E.inOutSine);
    logo.draw(c1, cx, cy, w, { alpha: 1 - fo, write: ep(t, 42.8, 44.3, E.inOutSine), meta: prog(t, 44.05, 44.7) });
    const en = logo.entry(cx, cy, w);
    if (t < 42.85) head(c1, en[0], en[1], 16);
    const o = { size: 92, weight: 800, align: 'center', tracking: 0.0 };
    trackIn(c1, 'NEVER MISS', CX, 1150, o, prog(t, 44.75, 45.35), fo);
    trackIn(c1, 'THE NEXT', CX, 1252, o, prog(t, 44.85, 45.45), fo);
    trackIn(c1, [{ t: 'OPPORTUNITY.', c: C.orange }], CX, 1354, o, prog(t, 44.95, 45.55), fo);
    const up = ep(t, 46.1, 46.9, E.inOutSine);
    if (up > 0 && up < 1) logo.signal(c1, cx, cy, w, up, 0.1, 1, 0.8);
    const tail = logo.tail(cx, cy, w);
    const below = [tail[0], cy + 260];
    const r1 = ep(t, 46.9, 47.3, E.lin);
    if (r1 > 0 && r1 < 1) {
      const y = lerp(tail[1], below[1], r1);
      signal(c1, (g) => { g.moveTo(tail[0], Math.max(tail[1], y - 140)); g.lineTo(tail[0], y); }, { w: 2.5 });
      head(c1, tail[0], y, 8);
    }
    if (t >= 47.3) {
      const r2 = ep(t, 47.3, 48.0, E.inOutCubic);
      const ctrl = [P0[0] + 40, below[1] + 120];
      const pt = (u) => { const v = 1 - u; return [v * v * below[0] + 2 * v * u * ctrl[0] + u * u * P0[0], v * v * below[1] + 2 * v * u * ctrl[1] + u * u * P0[1]]; };
      const trail = [];
      for (let k = 0; k <= 12; k++) trail.push(pt(Math.max(0, r2 - 0.25 * (k / 12))));
      signal(c1, (g) => { g.moveTo(trail[0][0], trail[0][1]); for (const p of trail) g.lineTo(p[0], p[1]); }, { w: 2.2, alpha: 1 - ep(t, 47.75, 48.0) });
      const pa = ep(t, 47.45, 47.95, E.inOutSine);
      const hp = pt(r2);
      head(c1, hp[0], hp[1], 8, 1 - pa);
      plus61(c1, P0[0], P0[1], t, pa);
    }
  }

  return (t) => {
    const cut = t >= 9.8 && t < 10.2;
    background(c0, W, H, { lift: cut ? 0 : t > 9.8 && t < 15.2 ? 0.7 : 1, cx: CX, cy: H * 0.48 });
    if (cut) { grain(c1, W, H, st.frame, 0.04); return; }
    dust(c0, W, H, t, { n: 80, alpha: 0.22, vx: 4, vy: 14 });
    sceneMap(t);
    scene1(t);
    scene2(t);
    scene3(t);
    scene4(t);
    scene5(t);
    scene6(t);
    scene7(t);
    scene8(t);
    scene9(t);
    vignette(c1, W, H, 0.5);
    grain(c1, W, H, st.frame, 0.045);
  };
}
