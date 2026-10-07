// Frame-accurate renderer: drives src/index.html in headless Chromium, captures
// every frame through DevTools, and encodes with ffmpeg.
//
//   node tools/render.mjs --format 16x9 [--fps 30] [--workers 4] [--shutter 3]
//                         [--audio out/soundtrack.wav] [--out out/file.mp4]
//   node tools/render.mjs --format 9x16 --stills 0,1.5,3 --outdir out/stills
//
// --shutter N renders N sub-frames across a 180 degree shutter and averages them
// (real motion blur). The film is a loop, so sub-frame times wrap.
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return a;
}, []));
const format = args.format || '16x9';
const tl = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/timeline.json')));
const FPS = +(args.fps || tl.fps);
const DUR = tl.duration;
const WORKERS = +(args.workers || Math.max(1, os.cpus().length));
const SHUTTER = +(args.shutter || 1);
const [W, H] = format === '9x16' ? [1080, 1920] : [1920, 1080];

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--disable-checker-imaging', '--force-color-profile=srgb', '--hide-scrollbars'] });

async function openPage() {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.goto(`http://127.0.0.1:${port}/src/index.html?format=${format}`);
  await page.waitForFunction(() => window.READY || window.BOOT_ERROR, null, { timeout: 180000 });
  const err = await page.evaluate(() => window.BOOT_ERROR);
  if (err) throw new Error(err);
  const cdp = await page.context().newCDPSession(page);
  // warm-up: visit the whole film once so every image is decoded and cached
  for (let t = 0; t < DUR; t += 0.25) await page.evaluate((tt) => window.renderAt(tt), t);
  return { page, cdp };
}
async function grab(pg, t) {
  await pg.page.evaluate((tt) => window.renderAt(tt), t);
  const r = await pg.cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
  return Buffer.from(r.data, 'base64');
}
const wrap = (t) => ((t % DUR) + DUR) % DUR;

function ffmpeg(argv) {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...argv], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  return { p, done };
}
const write = (stream, buf) => new Promise((res) => (stream.write(buf) ? res() : stream.once('drain', res)));

if (args.stills) {
  const outdir = path.resolve(args.outdir || path.join(ROOT, 'out/stills', format));
  fs.mkdirSync(outdir, { recursive: true });
  const times = String(args.stills).split(',').map(Number);
  const pg = await openPage();
  for (const [i, t] of times.entries()) {
    fs.writeFileSync(path.join(outdir, `still_${String(i).padStart(3, '0')}_${t.toFixed(2)}.png`), await grab(pg, t));
  }
  console.log(`stills -> ${outdir}`);
} else {
  const total = Math.round(DUR * FPS);
  const from = Math.round((+args.from || 0) * FPS), to = Math.min(total, Math.round((+(args.to ?? DUR)) * FPS));
  const outFile = path.resolve(args.out || path.join(ROOT, `out/hellometa-stall-${format}.mp4`));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-render-'));
  const n = to - from;
  const per = Math.ceil(n / WORKERS);
  const started = Date.now();
  let doneFrames = 0;
  const chunks = [];
  await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
    const a = from + w * per, b = Math.min(to, a + per);
    if (a >= b) return;
    const file = path.join(tmp, `chunk_${String(w).padStart(2, '0')}.mkv`);
    chunks[w] = file;
    const vf = SHUTTER > 1 ? ['-vf', `tmix=frames=${SHUTTER},select='eq(mod(n\\,${SHUTTER})\\,${SHUTTER - 1})',setpts=N/(${FPS}*TB)`] : [];
    const ff = ffmpeg(['-y', '-f', 'image2pipe', '-framerate', String(FPS * SHUTTER), '-c:v', 'png', '-i', '-', ...vf,
      '-r', String(FPS), '-c:v', 'libx264rgb', '-crf', '0', '-preset', 'ultrafast', file]);
    const pg = await openPage();
    for (let f = a; f < b; f++) {
      for (let k = 0; k < SHUTTER; k++) {
        const off = SHUTTER > 1 ? (k / (SHUTTER - 1) - 0.5) * (0.5 / FPS) : 0;
        await write(ff.p.stdin, await grab(pg, wrap(f / FPS + off)));
      }
      doneFrames++;
      if (doneFrames % 60 === 0) {
        const el = (Date.now() - started) / 1000;
        console.log(`${format}: ${doneFrames}/${n} frames, ${(doneFrames / el).toFixed(2)} fps, eta ${((n - doneFrames) / (doneFrames / el)).toFixed(0)}s`);
      }
    }
    ff.p.stdin.end();
    await ff.done;
    await pg.page.close();
  }));
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, chunks.filter(Boolean).map((c) => `file '${c}'`).join('\n'));
  const audio = args.audio ? ['-i', path.resolve(args.audio)] : [];
  const aopts = args.audio ? ['-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest'] : [];
  const fin = ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', list, ...audio,
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-profile:v', 'high', '-level:v', format === '9x16' ? '4.2' : '4.2', '-preset', 'slow', '-crf', String(args.crf || 15),
    '-maxrate', '24M', '-bufsize', '48M', '-g', String(FPS * 2), '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-color_range', 'tv', ...aopts, '-movflags', '+faststart', outFile]);
  await fin.done;
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`done ${outFile} in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}
await browser.close();
server.close();
