# HelloMeta.ai stall film

A 48-second, seamlessly looping motion-graphics film for an exhibition stall screen, in two
independently designed cuts:

| File | Format | Notes |
| --- | --- | --- |
| `out/hellometa-stall-16x9.mp4` | 1920×1080, 30 fps | Wide cinematic layout, horizontal signal flow |
| `out/hellometa-stall-9x16.mp4` | 1080×1920, 30 fps | Portrait layout, vertical signal flow, stacked UI and type |
| `out/soundtrack.wav` | 48 kHz stereo | The shared soundtrack, also muxed into both MP4s |

Both MP4s are H.264 High profile (yuv420p, BT.709), AAC 256 kb/s, `+faststart`, with a peak
bitrate of 24 Mb/s, so ordinary TV and media-player USB playback should handle them. Set the
player to **repeat one file**. The last frame flows straight into the first, so the loop is
seamless with no black gap. The film reads fully with the sound off.

## The story: one call wave

Everything is built on one visual metaphor, the call wave. Incoming calls become a chaotic
wave, the orange handwritten "hello" absorbs it and turns it into a clean signal, and that
signal travels through the real product UI until it becomes a booked appointment, then
returns through the logo and becomes the next `+61` call.

| Time | Scene | On screen |
| --- | --- | --- |
| 0.0–4.4 | The Australian business | `+61` pulse; the dot-matrix map of Australia ripples out from it; the camera tilts toward Sydney; Harbour Bridge and skyline line-art rise; restaurant, trades, property, professional services and retail pins appear; incoming call. **YOUR BUSINESS IS BUSY. BUT WHO'S ANSWERING?** |
| 4.4–9.8 | Missed-call chaos | Calls fly in from every side and flip to MISSED CALL / VOICEMAIL; each missed call joins a growing wave. **MISSED CALLS = MISSED OPPORTUNITIES** |
| 9.8–15.2 | The HelloMeta moment | Hard cut to silence, the logo appears, and the chaotic wave funnels into the lead-in stroke of "hello", travels along the real handwriting and leaves as an ordered signal. **WHAT IF EVERY CALL WAS ANSWERED?** |
| 15.2–21.8 | AI answers | The signal traces the outline of the real Call Logs panel; rows populate; the camera moves to one call; Call Details opens with the real waveform animating and the real transcript revealed line by line; large captions repeat it. **AI ANSWERED ✓ / HELLOMETA ANSWERS.** |
| 21.8–28.4 | Conversation to appointment | CALL → CONVERSATION → LEAD → APPOINTMENT; real Call Queues rows enter and are processed; the real Outbound list is organised and added to the queue. **APPOINTMENT BOOKED ✓** |
| 28.4–35.0 | The HelloMeta engine | Eight real UI panels in 3D, connected by orange signal paths: Business Search → Lead → AI Call → Conversation → Appointment → CRM + Accounting → Reporting → Analytics. **NOT JUST ANSWERING. CONNECTING.** |
| 35.0–39.2 | Australian business network | Sydney, Melbourne, Brisbane, Perth and Adelaide; business pins send calls through HelloMeta and get answers back. **✓ ANSWERED ✓ QUALIFIED ✓ BOOKED** |
| 39.2–42.8 | Dashboard | The real dashboard pushes in; the charts draw on with the signal riding the real chart lines; the overview stats highlight; the interface collapses into a line. |
| 42.8–48.0 | Final brand | "hello" writes itself along the real pen path, then Meta.ai is revealed. **NEVER MISS THE NEXT OPPORTUNITY.** A pulse runs through the logo and becomes the next `+61` call, which is frame 0. |

The 9:16 cut follows the same beats and timing (so it uses the same soundtrack), but every
layout is designed for portrait: the map is framed for the east coast with type stacked
below; the wave falls vertically into the logo; the call drawer rises from below; the
journey is a vertical spine; the engine is a zig-zag grid flowing downward; network paths
rise into the logo; and the dashboard cards are stacked.

## Brand and authenticity rules applied

- **Logo.** The supplied logo is used as supplied. It is split into a "hello" layer and a "Meta.ai"
  layer at the clean vertical gap between them (`tools/prepare_logo.py` asserts that the two
  layers recombine to exactly the original pixels). The write-on only masks the real
  pixels along a pen path traced from the glyph skeleton; nothing is redrawn. The white-text
  variant is used because it reads on a dark screen.
- **Product UI.** Every panel is a crop of a supplied screenshot at the exact bounds of one
  content card. Nothing is recoloured or recreated, and the UI stays blue. Animations move
  slices of the real pixels (rows, transcript lines, waveform bars). Orange appears only in
  the brand layer around the UI: outlines, highlights, ticks, signals.
- **Framing.** Cropping to the content cards also keeps the white-label "Tricall" header and
  footer and the corner robot mascot out of frame.
- **Privacy.** Prospect phone numbers in Call Logs, Call Queues, Outbound and Metrics are softly
  blurred after the `+614` prefix, because the film plays on a public screen. The account
  holder's name and email on the Profile page are framed out. The business's own line and the
  public Google Places listings are left as captured.
- **Numbers.** Every `+61` number in the motion graphics is from ACMA's ranges reserved for
  creative works (`(0X) 5550 xxxx`, `(0X) 7010 xxxx`, `0491 570 xxx`), so none reaches a real
  person ([ACMA](https://www.acma.gov.au/phone-numbers-use-tv-shows-films-and-creative-works)).
- **Metrics.** Dashboard and metrics figures appear only as they are in the real interface;
  no figure is restated as a marketing claim.
- **Palette.** Orange `#FC8803`, Meta grey `#606060`, white and a charcoal background, plus the
  UI's own blue inside the screenshots.

## Audio

The soundtrack is fully synthesised, with no samples (`tools/audio.py`), and placed from the same
timeline as the picture. It opens with the classic Australian double ring (400 + 450 Hz,
0.4 s on / 0.2 s off / 0.4 s on). Rings and missed-call blips build with a tightening rhythm
through the chaos. The cut drops to true silence, and once "hello" transforms the wave the
music resolves into a clean, confident groove in C major at 120 BPM. Over the music sit UI
clicks, a phone-band murmur under the transcript, an appointment chime, stage pings, and a
final brand pulse. Every event wraps around the end of the timeline and the master filter
runs circularly, so the audio loops without a click.

### Optional voiceover script

The film works without voiceover. If you record one, these lines sit on the existing beats:

| In at | Line |
| --- | --- |
| 0.6 s | Your business is busy. |
| 2.4 s | But who's answering? |
| 7.3 s | Missed calls are missed opportunities. |
| 13.5 s | What if every call was answered? |
| 20.5 s | HelloMeta answers. |
| 27.3 s | From first hello to booked appointment. |
| 33.1 s | Not just answering. Connecting. |
| 37.3 s | Answered. Qualified. Booked. |
| 44.8 s | HelloMeta. Never miss the next opportunity. |

## Rebuilding

Requirements: Node 18+, ffmpeg, Python 3.10+ (`pip install -r tools/requirements.txt`), and a
Chromium that Playwright can drive (`PLAYWRIGHT_BROWSERS_PATH` or `npx playwright install chromium`).

```bash
npm install

# one-off asset preparation (already committed in assets/)
python tools/prepare_logo.py .. assets/logo
python tools/hello_path.py assets/logo/hellometa-logo-white-hello.png assets/logo/hello-path.json
python tools/prepare_ui.py .. assets/ui
node tools/prepare_map.mjs

# soundtrack, then the two films (--shutter 3 = motion blur from 3 sub-frames)
python tools/audio.py out/soundtrack.wav
node tools/render.mjs --format 16x9 --shutter 3 --audio out/soundtrack.wav
node tools/render.mjs --format 9x16 --shutter 3 --audio out/soundtrack.wav

# stills for review
node tools/render.mjs --format 9x16 --stills 1.5,8,12,20 --outdir out/stills
```

**Live preview:** serve the `video/` folder (`npx serve .`) and open
`src/index.html?format=16x9&play` or `?format=9x16&play`. Add `&t=12.5` to hold one frame.

**Structure:**

- `src/engine.js`: deterministic engine (easing, CSS-3D UI panels with exact projection, text and signal primitives).
- `src/map.js`, `src/logo.js`, `src/fx.js`: map, logo and wave modules.
- `src/comp16x9.js`, `src/comp9x16.js`: the two compositions.
- `src/timeline.json`: the shared scene and cue timeline.

Every frame is a pure function of time, so renders are repeatable and can be split across workers.

Fonts are Inter Tight, Inter and JetBrains Mono (SIL OFL) and the icons are Lucide (ISC); their
licence files are in `assets/`. The map is Natural Earth 1:50m, which is public domain.
