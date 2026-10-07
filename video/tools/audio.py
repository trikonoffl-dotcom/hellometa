"""Procedural, loop-safe soundtrack for the HelloMeta stall film.

Everything is synthesised (no samples) and placed from src/timeline.json, so
sound stays locked to picture in both the 16:9 and 9:16 cuts. Every event
wraps around the end of the timeline, so the file loops without a seam.

Arc: Australian double-ring -> a rhythmic build of calls and missed-call blips
-> hard silence at the cut -> a clean, confident groove in C major once the
handwritten "hello" transforms the wave -> brand pulse that hands back to the
first ring.

    python tools/audio.py out/soundtrack.wav
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = Path(__file__).resolve().parent.parent
TL = json.loads((ROOT / "src/timeline.json").read_text())
CUE = TL["cues"]
SR = 48000
DUR = TL["duration"]
N = int(round(DUR * SR))
rng = np.random.default_rng(7)

dry = np.zeros((2, N))
verb = np.zeros((2, N))  # reverb send


def t_(d):
    return np.arange(int(d * SR)) / SR


def place(bus, sig, t0, gain=1.0, pan=0.0):
    """Mix a mono (or stereo) signal at t0 seconds, wrapping round the loop."""
    sig = np.asarray(sig, float) * gain
    if sig.ndim == 1:
        a = (pan + 1) * math.pi / 4
        sig = np.stack([sig * math.cos(a), sig * math.sin(a)])
    i0 = int(round((t0 % DUR) * SR))
    pos = 0
    while pos < sig.shape[1]:  # wrap round the loop point
        k = min(sig.shape[1] - pos, N - i0)
        bus[:, i0:i0 + k] += sig[:, pos:pos + k]
        pos += k
        i0 = 0


def add(sig, t0, gain=1.0, pan=0.0, send=0.25):
    place(dry, sig, t0, gain, pan)
    if send:
        place(verb, sig, t0, gain * send, pan)


def filt(x, kind, f, order=2):
    if kind == "bp":
        sos = butter(order, [f[0] / (SR / 2), f[1] / (SR / 2)], btype="band", output="sos")
    else:
        sos = butter(order, f / (SR / 2), btype=kind, output="sos")
    return sosfilt(sos, x, axis=-1)


def env_ad(n, a, d, curve=4.0):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), np.exp(-(t - a) * curve / max(d, 1e-4)))
    return e


def fade(x, fi=0.005, fo=0.02):
    n = x.shape[-1]
    k1, k2 = min(n, int(fi * SR)), min(n, int(fo * SR))
    e = np.ones(n)
    if k1:
        e[:k1] = np.linspace(0, 1, k1)
    if k2:
        e[-k2:] *= np.linspace(1, 0, k2)
    return x * e


def note(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def saw(f, t, detune=(0.0,)):
    out = 0
    for d in detune:
        ph = (f * (1 + d) * t + rng.random()) % 1.0
        out = out + (2 * ph - 1)
    return out / len(detune)


# ------------------------------------------------------------------ instruments
def ring(dur=0.4):
    """Classic Australian/UK landline ring: 400 Hz + 450 Hz, gently softened."""
    t = t_(dur)
    s = np.sin(2 * np.pi * 400 * t) + np.sin(2 * np.pi * 450 * t)
    s *= 0.6 + 0.4 * np.sin(2 * np.pi * 25 * t) ** 2
    s = filt(s, "lp", 2600)
    return fade(s * 0.16, 0.01, 0.04)


def double_ring(t0, gain=1.0, pan=0.0):
    add(ring(), t0, gain, pan, 0.3)
    add(ring(), t0 + 0.6, gain, pan, 0.3)


def blip(freqs, each=0.07, gain=1.0):
    parts = []
    for f in freqs:
        t = t_(each)
        parts.append(fade(np.sin(2 * np.pi * f * t) * env_ad(len(t), 0.003, each, 3), 0.002, 0.01))
    return np.concatenate(parts) * 0.5 * gain


def click(freq=2600, dur=0.018):
    t = t_(dur)
    s = np.sin(2 * np.pi * freq * t) * env_ad(len(t), 0.0005, dur, 6)
    s += filt(rng.standard_normal(len(t)), "hp", 3000) * env_ad(len(t), 0.0003, dur * 0.5, 8) * 0.3
    return s * 0.45


def kick(gain=1.0):
    t = t_(0.45)
    f = 45 + 110 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 7.5)
    s += filt(rng.standard_normal(len(t)), "hp", 2000) * np.exp(-t * 180) * 0.15
    return np.tanh(s * 1.6) * 0.75 * gain


def clap():
    t = t_(0.25)
    n = filt(rng.standard_normal(len(t)), "bp", (900, 3200))
    e = np.zeros(len(t))
    for k, off in enumerate((0, 0.011, 0.022)):
        i = int(off * SR)
        e[i:] += np.exp(-(t[: len(t) - i]) * (90 if k < 2 else 18))
    return n * e * 0.28


def hat(open_=False):
    d = 0.16 if open_ else 0.045
    t = t_(d)
    s = filt(rng.standard_normal(len(t)), "hp", 7500) * env_ad(len(t), 0.001, d, 5)
    return s * (0.16 if open_ else 0.12)


def bass_note(m, dur):
    t = t_(dur)
    f = note(m)
    s = saw(f, t, (0, 0.004)) * 0.6 + np.sin(2 * np.pi * f * t) * 0.6
    s = filt(s, "lp", 380)
    return fade(s * env_ad(len(t), 0.005, dur, 2.2), 0.003, 0.03) * 0.42


def pad(chord, dur, bright=1500, gain=1.0, attack=0.6):
    t = t_(dur)
    s = 0
    for m in chord:
        s = s + saw(note(m), t, (-0.006, 0.0, 0.0061))
    s = filt(s / len(chord), "lp", bright, order=4)
    e = np.minimum(1, t / attack) * np.minimum(1, (dur - t) / 0.5).clip(0, 1)
    return s * e * 0.22 * gain


def pluck(m, dur=0.5, gain=1.0):
    t = t_(dur)
    f = note(m)
    idx = 2.2 * np.exp(-t * 18)
    s = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * 2 * f * t)) * np.exp(-t * 7)
    return fade(s, 0.002, 0.05) * 0.22 * gain


def bell(m, dur=2.2, gain=1.0):
    t = t_(dur)
    f = note(m)
    idx = 3.0 * np.exp(-t * 3)
    s = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * 3.5 * f * t)) * np.exp(-t * 2.4)
    return fade(s, 0.002, 0.2) * 0.25 * gain


def whoosh(dur, f0, f1, gain=1.0):
    t = t_(dur)
    n = rng.standard_normal(len(t))
    out = np.zeros(len(t))
    seg = int(0.02 * SR)
    for i in range(0, len(t), seg):
        u = i / len(t)
        fc = f0 * (f1 / f0) ** u
        lo, hi = max(40, fc * 0.6), min(SR / 2 - 100, fc * 1.6)
        out[i:i + seg] = filt(n[max(0, i - 2 * seg):i + seg], "bp", (lo, hi))[-len(out[i:i + seg]):]
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    return out * e * 0.5 * gain


def boom(gain=1.0):
    t = t_(2.4)
    f = 38 + 30 * np.exp(-t * 6)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    s += filt(rng.standard_normal(len(t)), "lp", 300) * np.exp(-t * 4) * 0.35
    return np.tanh(s * 1.3) * 0.45 * gain


def riser(dur, gain=1.0):
    t = t_(dur)
    f = 110 * (8 ** (t / dur))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = (np.sin(ph) + 0.5 * np.sin(2 * ph)) * 0.25
    s += whoosh(dur, 300, 6000, 1.0) * 0.8
    return s * (t / dur) ** 2 * gain


def voice(t0, dur, pitch, syll, gain=1.0, rise=False):
    """Phone-band murmur that reads as speech without words."""
    t = t_(dur)
    p = pitch * (1 + 0.06 * np.sin(2 * np.pi * 3.1 * t + rng.random() * 6))
    if rise:
        p = p * (1 + 0.35 * (t / dur) ** 2)
    ph = np.cumsum(p) / SR
    src = 2 * (ph % 1.0) - 1
    a = filt(src, "bp", (500, 900)) + 0.7 * filt(src, "bp", (1100, 1700)) + 0.3 * filt(src, "bp", (2300, 3000))
    gate = np.zeros(len(t))
    pos = 0
    for s in syll:
        n0, n1 = int(pos * SR), int((pos + s) * SR)
        if n1 > n0:
            g = np.sin(np.linspace(0, np.pi, n1 - n0)) ** 0.7
            gate[n0:min(n1, len(t))] = g[: max(0, min(n1, len(t)) - n0)]
        pos += s + 0.035
    s = filt(a * gate, "bp", (300, 3400))
    add(s * 0.5 * gain, t0, 1.0, 0.0, 0.12)


# ------------------------------------------------------------------ S1: the business
add(pad([45, 52, 57], 4.6, bright=700, gain=0.7, attack=1.2), -0.2, 1.0, 0, 0.5)  # low A drone (wraps from the outro)
double_ring(1.05, 1.0, 0.25)
double_ring(3.45, 0.85, 0.25)
for k in range(8):
    add(click(1800, 0.012), 2.4 + k * 0.25, 0.35 + 0.05 * k, 0.4 * (-1) ** k, 0.1)

# ------------------------------------------------------------------ S2: missed-call chaos
def card_schedule():
    out, tt, i = [], 4.55, 0
    while tt < 9.5:
        u = min(1, max(0, (tt - 4.55) / (8.4 - 4.55)))
        d = u ** 3
        ring_ = 0.95 + (0.42 - 0.95) * d
        h = math.sin(i * 9.1 * 127.1 + 311.7) * 43758.5453
        vm = (h - math.floor(h)) < 0.3
        out.append((tt, ring_, vm, ((i * 7 + 3) % 4) / 1.5 - 1))
        tt += 0.42 + (0.075 - 0.42) * d
        i += 1
    return out


for (t0, rdur, vm, pan) in card_schedule():
    add(ring(min(0.4, rdur * 0.6)), t0 + 0.02, 0.55, pan, 0.25)
    tm = t0 + 0.38 + rdur
    if tm < 9.75:
        add(blip([1000] if vm else [880, 587], 0.11 if vm else 0.07), tm, 0.5, pan, 0.2)

beat = 0.5
for k in range(int((9.8 - 4.4) / beat)):
    t0 = 4.4 + k * beat
    if t0 >= 9.75:
        break
    lvl = 0.45 + 0.55 * (t0 - 4.4) / 5.4
    add(kick(lvl), t0, 0.9, 0, 0.05)
    add(bass_note(33 if (k // 4) % 2 == 0 else 34, beat * 0.9), t0, 0.7 * lvl, 0, 0.0)
for k in range(int((9.8 - 5.4) / 0.25)):
    t0 = 5.4 + k * 0.25
    add(hat(), t0 + 0.125, 0.9, 0.3, 0.05)
for k in range(int((9.8 - 7.4) / 0.125)):
    add(hat(), 7.4 + k * 0.125, 0.7, -0.3, 0.05)
add(pad([57, 60, 64, 71], 5.4, bright=1200, gain=0.9, attack=2.0), 4.4, 1.0, 0, 0.35)
add(riser(2.5, 1.0), 7.3, 0.8, 0, 0.3)
add(boom(0.8), CUE["s2_statement"], 0.9, 0, 0.3)
add(blip([1320], 0.09), CUE["s2_equals"], 0.6, 0, 0.3)
add(boom(0.6), CUE["s2_statement2"], 0.7, 0, 0.3)

# ------------------------------------------------------------------ S3: the HelloMeta moment
add(boom(1.0), CUE["s3_logo"], 1.0, 0, 0.6)
add(pad([72, 76, 79, 84], 5.0, bright=2600, gain=0.55, attack=1.4), CUE["s3_logo"] + 0.1, 1.0, 0, 0.6)
add(whoosh(1.2, 200, 4000, 1.4), CUE["s3_waveIn"] - 0.25, 0.8, -0.6, 0.3)
tt = t_(CUE["s3_helloEnd"] - CUE["s3_hello"])
glide = 330 * (2 ** (2 * (tt / tt[-1])))
sig = np.sin(2 * np.pi * np.cumsum(glide) / SR + 0.3 * np.sin(2 * np.pi * 6 * tt)) * np.sin(np.pi * tt / tt[-1]) * 0.18
add(sig, CUE["s3_hello"], 1.0, 0, 0.5)
add(bell(72, 3.0, 1.0), CUE["s3_order"], 0.9, -0.1, 0.5)
add(bell(79, 3.0, 0.8), CUE["s3_order"] + 0.08, 0.9, 0.1, 0.5)
add(pad([48, 55, 64, 67], 2.6, bright=1800, gain=0.8, attack=0.3), CUE["s3_order"], 1.0, 0, 0.4)

# ------------------------------------------------------------------ groove (13.0 -> 42.8), C major, 120 BPM
PROG = [[48, 55, 64, 67, 72], [45, 52, 60, 64, 69], [41, 48, 57, 60, 65], [43, 50, 59, 62, 67]]  # C Am F G
ROOTS = [36, 33, 29, 31]
G0, BAR = 13.0, 2.0
for b in range(int((42.8 - G0) / BAR) + 1):
    t0 = G0 + b * BAR
    if t0 >= 42.8:
        break
    ch = PROG[b % 4]
    full = t0 >= 15.0
    lift = 1.0 if t0 < 28.4 else 1.15
    add(pad(ch[1:], BAR + 0.4, bright=1400 if t0 < 21.8 else 2000, gain=0.65 * lift, attack=0.25), t0, 1.0, 0, 0.45)
    arp = [ch[2] + 12, ch[3] + 12, ch[4] + 12, ch[3] + 12]
    for k in range(8):
        add(pluck(arp[k % 4] + (12 if (t0 >= 28.4 and k % 4 == 2) else 0), 0.45, 0.8 * lift), t0 + k * 0.25, 1.0, 0.35 * (-1) ** k, 0.35)
    if full:
        for k in range(4):
            add(kick(0.85), t0 + k * 0.5, 1.0, 0, 0.03)
            add(bass_note(ROOTS[b % 4], 0.22), t0 + k * 0.5 + 0.25, 1.0, 0, 0.0)
            add(hat(), t0 + k * 0.5 + 0.25, 0.9, 0.25, 0.05)
            if t0 >= 21.8:
                add(hat(), t0 + k * 0.5 + 0.125, 0.5, -0.25, 0.04)
        if t0 >= 17.0:
            add(clap(), t0 + 0.5, 0.9, 0, 0.3)
            add(clap(), t0 + 1.5, 0.9, 0, 0.3)

# --- S4 AI answers
for i in range(10):
    add(click(2400 + i * 60), 15.95 + i * 0.085, 0.7, 0.3, 0.1)
add(whoosh(0.5, 400, 3000), 15.2, 0.5, 0.6, 0.2)
add(blip([1175, 1568], 0.06), CUE["s4_focus"] + 0.25, 0.5, -0.2, 0.2)
add(whoosh(0.6, 300, 2500), CUE["s4_drawer"] - 0.1, 0.55, 0.7, 0.2)
voice(18.38, 0.42, 205, [0.17, 0.22], 1.0, rise=True)            # AI: "Hello?"
voice(18.93, 0.45, 125, [0.18, 0.24], 1.1, rise=True)            # User: "Hello?"
voice(19.48, 1.25, 210, [0.12, 0.09, 0.14, 0.1, 0.16, 0.11, 0.13, 0.09, 0.15], 0.9)  # AI: "Hi, this is Angela..."
add(bell(84, 1.8, 0.9), CUE["s4_answered"], 0.9, 0, 0.4)
add(bell(88, 1.8, 0.7), CUE["s4_answered"] + 0.09, 0.9, 0, 0.4)
add(boom(0.55), CUE["s4_answers"], 0.8, 0, 0.3)

# --- S5 conversation to appointment
for k, c in enumerate(("s5_nodeCall", "s5_nodeConv", "s5_nodeLead", "s5_nodeAppt")):
    add(blip([784 * 2 ** (k * 2 / 12)], 0.08), CUE[c], 0.55, -0.4 + k * 0.27, 0.3)
for i in range(10):
    add(click(2000, 0.014), CUE["s5_queueRows"] + 0.05 + i * 0.07, 0.5, 0.4, 0.05)
    add(blip([1568], 0.04), CUE["s5_process"] + i * 0.1, 0.3, -0.3, 0.1)
for i in range(5):
    add(click(2800, 0.014), 25.8 + i * 0.08, 0.5, 0.2, 0.05)
add(click(1500, 0.03), CUE["s5_addQueue"], 0.9, 0, 0.1)
for k, m in enumerate((72, 76, 79, 84)):
    add(bell(m, 2.4, 1.0), CUE["s5_booked"] + 0.05 + k * 0.07, 0.8, -0.3 + 0.2 * k, 0.5)
add(kick(0.7) * 0.6, CUE["s5_booked"], 1.0, 0, 0.2)

# --- S6 engine: ascending stage pings
scale = [72, 74, 76, 79, 81, 84, 86, 88]
for k, ts in enumerate(CUE["s6_stages"]):
    add(blip([note(scale[k])], 0.07), ts, 0.45, -0.6 + 0.17 * k, 0.4)
    add(whoosh(0.35, 800, 4000, 0.5), ts - 0.3, 0.4, -0.6 + 0.17 * k, 0.1)
add(bell(79, 2.5, 0.9), CUE["s6_wide"], 0.7, 0, 0.5)

# --- S7 network
for i in range(26):
    add(click(3000 + (i % 5) * 200, 0.01), CUE["s7_converge"] + i * 0.045, 0.35, ((i * 37) % 11) / 5.5 - 1, 0.2)
    add(click(3400 + (i % 4) * 150, 0.01), CUE["s7_return"] + i * 0.05, 0.3, ((i * 53) % 11) / 5.5 - 1, 0.2)
for k, ts in enumerate(CUE["s7_words"]):
    add(bell(79 + [0, 4, 7][k], 1.4, 0.8), ts, 0.8, -0.4 + 0.4 * k, 0.4)
add(riser(0.55, 0.8), CUE["s7_fire"], 0.7, 0, 0.3)

# --- S8 dashboard
add(boom(0.7), CUE["s8_in"], 0.8, 0, 0.3)
tt = t_(1.2)
sweep = np.sin(2 * np.pi * np.cumsum(500 * 2 ** (tt / 1.2)) / SR) * np.sin(np.pi * tt / 1.2) * 0.07
add(sweep, CUE["s8_charts"], 1.0, 0, 0.3)
for k, ts in enumerate(CUE["s8_stats"]):
    add(blip([1046.5 * 2 ** (k * 4 / 12)], 0.06), ts, 0.45, -0.3 + 0.3 * k, 0.3)
add(whoosh(0.8, 6000, 200, 1.2), CUE["s8_collapse"], 0.6, 0, 0.3)

# ------------------------------------------------------------------ S9 brand + loop hand-off
add(pad([48, 55, 64, 67, 72], 5.0, bright=2200, gain=0.75, attack=1.0), CUE["s9_write"], 1.0, 0, 0.6)
add(whoosh(1.5, 2500, 7000, 0.35), CUE["s9_write"], 0.6, -0.5, 0.3)
for k, m in enumerate((60, 67, 72, 76, 79)):
    add(bell(m, 3.5, 0.9), 44.3 + k * 0.05, 0.7, -0.4 + 0.2 * k, 0.6)
add(boom(0.5), 44.3, 0.6, 0, 0.4)
add(kick(0.9) * 0.7, CUE["s9_pulse"], 1.0, 0, 0.3)
add(bell(84, 2.0, 0.7), CUE["s9_pulse"] + 0.05, 0.8, 0, 0.5)
add(blip([1046.5, 1568], 0.06), CUE["s9_plus61"] + 0.3, 0.45, 0.3, 0.4)

# ------------------------------------------------------------------ mix
def make_ir(sec=2.4):
    t = t_(sec)
    irs = []
    for _ in range(2):
        n = rng.standard_normal(len(t)) * np.exp(-t * 3.2)
        irs.append(filt(n, "lp", 6000) * 0.12)
    return np.stack(irs)


ir = make_ir()
wet = np.zeros_like(verb)
for c in range(2):
    full = fftconvolve(verb[c], ir[c])
    wet[c] += full[:N]
    tail = full[N:]
    wet[c][: len(tail)] += tail  # wrap reverb tail into the loop start

mix = dry + wet
# sidechain-style duck of everything but the kick on groove beats for pump
duck = np.ones(N)
for b in range(int((42.8 - 15.0) / 0.5)):
    i0 = int((15.0 + b * 0.5) * SR)
    n = int(0.22 * SR)
    duck[i0:i0 + n] = np.minimum(duck[i0:i0 + n], 1 - 0.25 * np.exp(-np.arange(n) / SR * 14))
mix *= duck
# hard silence at the cut (9.8 -> 10.18), with 4 ms ramps
gate = np.ones(N)
a, b = int(9.8 * SR), int(10.18 * SR)
r = int(0.004 * SR)
gate[a - r:a] = np.linspace(1, 0, r)
gate[a:b] = 0
gate[b:b + r] = np.linspace(0, 1, r)
mix *= gate
# gentle master: high-pass rumble, soft clip, normalise
# circular high-pass: filter three laps and keep the middle so the loop seam stays continuous
tri = filt(np.concatenate([mix, mix, mix], axis=1), "hp", 28)
mix = tri[:, N:2 * N]
mix = np.tanh(mix * 1.1) / 1.1
peak = np.abs(mix).max()
mix = mix / peak * 10 ** (-1.0 / 20)
rms = np.sqrt((mix ** 2).mean())
print(f"peak -1.0 dBFS, rms {20 * np.log10(rms):.1f} dBFS, {DUR:.1f}s @ {SR} Hz")

out = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "out/soundtrack.wav")
out.parent.mkdir(parents=True, exist_ok=True)
pcm = (np.clip(mix.T, -1, 1) * 32767).astype("<i2")
import wave  # noqa: E402

with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", out)
