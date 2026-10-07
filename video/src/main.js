// Boot: load fonts and assets, build the chosen composition, expose renderAt(t).
// URL params: format=16x9|9x16, play (live preview loop), t=<seconds> (still).
import { Stage, loadImage, loadJSON, loadIcons, iconImage, C } from './engine.js';
import { AusMap } from './map.js';
import { Logo } from './logo.js';

const params = new URLSearchParams(location.search);
const format = params.get('format') === '9x16' ? '9x16' : '16x9';
const [W, H] = format === '9x16' ? [1080, 1920] : [1920, 1080];

const FONTS = [
  ['Inter Tight', 'inter-tight-latin-600-normal', 600], ['Inter Tight', 'inter-tight-latin-700-normal', 700],
  ['Inter Tight', 'inter-tight-latin-800-normal', 800], ['Inter Tight', 'inter-tight-latin-900-normal', 900],
  ['Inter', 'inter-latin-400-normal', 400], ['Inter', 'inter-latin-500-normal', 500],
  ['Inter', 'inter-latin-600-normal', 600], ['Inter', 'inter-latin-700-normal', 700],
  ['JetBrains Mono', 'jetbrains-mono-latin-500-normal', 500], ['JetBrains Mono', 'jetbrains-mono-latin-700-normal', 700],
];
const ICONS = ['phone-incoming', 'phone-missed', 'voicemail', 'phone', 'phone-call', 'check', 'calendar-check', 'message-square-text',
  'user-check', 'utensils', 'wrench', 'building-2', 'briefcase', 'shopping-bag', 'search', 'database', 'chart-no-axes-combined',
  'list-checks', 'map-pin', 'house'];
const ICON_COLORS = [C.white, C.orange, C.bg, '#BDBDBD', '#8E8E8E'];

const UI = ['calllogs', 'calldetails', 'callqueues', 'dashboard', 'metrics', 'finder', 'outbound', 'outbound_single', 'accounting', 'assistants'];

async function boot() {
  await Promise.all(FONTS.map(async ([fam, file, weight]) => {
    const f = new FontFace(fam, `url(../assets/fonts/${file}.woff2)`, { weight: String(weight) });
    document.fonts.add(await f.load());
  }));
  const tl = await loadJSON('timeline.json');
  const L = '../assets/logo/';
  const [full, hello, meta, info, path] = await Promise.all([
    loadImage(L + 'hellometa-logo-white.png'), loadImage(L + 'hellometa-logo-white-hello.png'),
    loadImage(L + 'hellometa-logo-white-meta.png'), loadJSON(L + 'hellometa-logo-white.json'), loadJSON(L + 'hello-path.json'),
  ]);
  await loadIcons(ICONS);
  for (const n of ICONS) for (const c of ICON_COLORS) { await iconImage(n, c, 2); await iconImage(n, c, 2.2); }
  // Decode every UI image up front so CSS backgrounds paint on their first frame.
  const uiImgs = await Promise.all(UI.flatMap((n) => [loadImage(`../assets/ui/${n}.png`), loadImage(`../assets/ui/${n}@half.png`)]));
  window.__keep = uiImgs;
  const assets = {
    logo: new Logo({ full, hello, meta, info, path }),
    map: new AusMap(await loadJSON('../assets/map/australia.json')),
    ui: await loadJSON('../assets/ui/panels.json'),
    charts: await loadJSON('../assets/ui/charts.json'),
  };
  const stage = new Stage(document.getElementById('stage'), W, H);
  const comp = await import(format === '9x16' ? './comp9x16.js' : './comp16x9.js');
  const render = comp.create(stage, assets, tl);
  window.renderAt = (t) => { stage.begin(t); render(t); stage.end(); };
  window.DURATION = tl.duration;
  window.FPS = tl.fps;
  window.SIZE = [W, H];
  window.READY = true;

  if (params.has('play') || params.has('t')) {
    document.body.classList.add('preview');
    const s = Math.min(innerWidth / W, innerHeight / H);
    document.getElementById('stage').style.transform = `scale(${s})`;
    const hud = document.createElement('div');
    hud.id = 'hud';
    document.body.appendChild(hud);
    if (params.has('t')) { window.renderAt(+params.get('t')); hud.textContent = `t=${params.get('t')}`; return; }
    const t0 = performance.now() / 1000 - (+params.get('play') || 0);
    const loop = () => {
      const t = (performance.now() / 1000 - t0) % tl.duration;
      window.renderAt(t);
      hud.textContent = `${format}  t=${t.toFixed(2)}s`;
      requestAnimationFrame(loop);
    };
    loop();
  }
}
boot().catch((e) => { document.body.textContent = 'BOOT ERROR ' + e.stack; window.BOOT_ERROR = String(e.stack || e); });
