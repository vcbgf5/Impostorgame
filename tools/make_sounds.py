#!/usr/bin/env python3
"""Generator dźwięków do gry Impostor (własne, bez licencji zewnętrznych).

Tworzy pliki mp3 w folderze sounds/: muzykę (lobby, napięcie) i efekty.
Wymaga: python3 + numpy + ffmpeg (z libmp3lame).
Uruchomienie z głównego folderu repo:  python3 tools/make_sounds.py
"""
import os, subprocess, tempfile, wave
import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sounds')
rng = np.random.default_rng(7)


# ---------------------------------------------------------------- narzędzia
def t_(dur):
    return np.arange(int(dur * SR)) / SR


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env(n, a=0.005, d=0.1, s=0.0, r=0.05, dur=None):
    """ADSR w próbkach (dur = czas trzymania przed release)."""
    total = n
    e = np.zeros(total)
    A, D, R = int(a * SR), int(d * SR), int(r * SR)
    hold = total - R if dur is None else min(total - R, int(dur * SR))
    i = 0
    seg = min(A, hold); e[:seg] = np.linspace(0, 1, seg, endpoint=False); i = seg
    seg = min(D, max(0, hold - i)); e[i:i + seg] = np.linspace(1, s, seg, endpoint=False); i += seg
    e[i:hold] = s if i > A else e[i - 1] if i else 0
    last = e[hold - 1] if hold > 0 else 0
    e[hold:hold + R] = np.linspace(last, 0, len(e[hold:hold + R]))
    return e


def expdec(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def phase(freq, n):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    return 2 * np.pi * np.cumsum(f) / SR


def additive(freq, n, partials, bright=None):
    """Suma harmonicznych: partials = lista (numer, amplituda). bright – opcjonalna obwiednia jasności 0..1."""
    ph = phase(freq, n)
    out = np.zeros(n)
    f0 = float(np.max(freq))
    for k, amp in partials:
        if f0 * k > SR / 2 - 500:
            break
        w = amp if bright is None else amp * np.clip(bright * 1.4 - (k - 1) * 0.08, 0, 1) ** 1.2
        out += w * np.sin(ph * k)
    return out


SAW = [(k, 1 / k) for k in range(1, 40)]
SQR = [(k, 1 / k) for k in range(1, 40, 2)]


def noise(n):
    return rng.uniform(-1, 1, n)


def fft_filter(x, lo=None, hi=None, peak=None, q=1.0):
    """Filtr w dziedzinie częstotliwości: highpass lo, lowpass hi, opcjonalny pasmowy peak."""
    N = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(N, 1 / SR)
    m = np.ones_like(f)
    if lo:
        m *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        m *= 1 / np.sqrt(1 + (f / hi) ** 4)
    if peak:
        bw = peak / q
        m *= np.exp(-0.5 * ((f - peak) / bw) ** 2)
    return np.fft.irfft(X * m, N)


def sweep_filter(x, f_start, f_end, q=2.0, frame=1024):
    """Pasmowy filtr przesuwany w czasie (ramki z nakładaniem)."""
    hop = frame // 2
    win = np.hanning(frame)
    out = np.zeros(len(x) + frame)
    nfr = max(1, (len(x) - frame) // hop + 1)
    f = np.fft.rfftfreq(frame, 1 / SR)
    for i in range(nfr):
        a = i * hop
        seg = x[a:a + frame]
        if len(seg) < frame:
            seg = np.pad(seg, (0, frame - len(seg)))
        c = f_start * (f_end / f_start) ** (i / max(1, nfr - 1))
        m = np.exp(-0.5 * ((f - c) / (c / q)) ** 2)
        out[a:a + frame] += np.fft.irfft(np.fft.rfft(seg * win) * m, frame)
    return out[:len(x)]


def reverb(x, size=1.6, mix=0.25, damp=5000):
    n = int(size * SR)
    ir = noise(n) * expdec(n, size / 5)
    ir = fft_filter(ir, lo=200, hi=damp)
    ir[:int(0.012 * SR)] = 0
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    L = len(x) + n
    nfft = 1 << (L - 1).bit_length()
    wet = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[:L]
    dry = np.pad(x, (0, n))
    return dry * (1 - mix) + wet * mix * 0.9


def place(buf, sig, at):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    seg = sig[:j - i].copy()
    fi, fo = min(len(seg), int(0.0015 * SR)), min(len(seg), int(0.006 * SR))
    seg[:fi] *= np.linspace(0, 1, fi)            # bez trzasku na starcie
    seg[len(seg) - fo:] *= np.linspace(1, 0, fo)  # i na końcu (też gdy nuta ucięta)
    buf[i:j] += seg


def mix(*xs):
    n = max(len(x) for x in xs)
    out = np.zeros(n)
    for x in xs:
        out[:len(x)] += x
    return out


def soft(x, drive=1.5):
    return np.tanh(x * drive) / np.tanh(drive)


def norm(x, peak=0.89):
    m = np.max(np.abs(x)) + 1e-9
    return x / m * peak


def fade(x, fin=0.003, fout=0.02):
    a, b = int(fin * SR), int(fout * SR)
    x = x.copy()
    if a: x[:a] *= np.linspace(0, 1, a)
    if b: x[-b:] *= np.linspace(1, 0, b)
    return x


def save(name, x, br='128k', peak=0.89, trim=True):
    x = norm(x, peak)
    if trim:  # utnij ciszę na końcu
        idx = np.where(np.abs(x) > 0.002)[0]
        if len(idx): x = x[:idx[-1] + int(0.02 * SR)]
        x = fade(x)
    os.makedirs(OUT, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tf:
        path = tf.name
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())
    dst = os.path.join(OUT, name + '.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', path, '-codec:a', 'libmp3lame', '-b:a', br, dst], check=True)
    os.unlink(path)
    print(f'{name:10s} {len(x) / SR:5.2f}s  {os.path.getsize(dst) // 1024} KB')


# ---------------------------------------------------------------- instrumenty
def kick(v=1.0):
    n = int(0.45 * SR); tt = np.arange(n) / SR
    f = 45 + 120 * np.exp(-tt * 28)
    s = np.sin(phase(f, n)) * expdec(n, 0.16)
    s += 0.3 * noise(n) * expdec(n, 0.004)
    return soft(s * v, 1.8)


def snare(v=1.0, tone=190):
    n = int(0.3 * SR)
    body = np.sin(phase(tone, n)) * expdec(n, 0.05)
    nz = fft_filter(noise(n), lo=1200, hi=9000) * expdec(n, 0.09)
    return (0.5 * body + nz * 1.1) * v


def hat(v=1.0, open_=False):
    n = int((0.35 if open_ else 0.06) * SR)
    nz = fft_filter(noise(n), lo=7000) * expdec(n, 0.12 if open_ else 0.018)
    return nz * v


def clap(v=1.0):
    n = int(0.25 * SR)
    nz = fft_filter(noise(n), lo=900, hi=5000, peak=1700, q=0.8)
    e = np.zeros(n)
    for d in (0, 0.011, 0.022):
        e += np.pad(expdec(n - int(d * SR), 0.012), (int(d * SR), 0))
    e += np.pad(expdec(n - int(0.03 * SR), 0.08), (int(0.03 * SR), 0)) * 0.6
    return nz * e * v


def crash(v=1.0, dur=2.2):
    n = int(dur * SR)
    nz = fft_filter(noise(n), lo=4500, hi=14000) * expdec(n, dur / 5)
    metal = sum(np.sin(phase(f, n)) for f in (3120, 4370, 5230, 6810)) * 0.05 * expdec(n, dur / 5)
    return (nz + metal) * v


def pluck(m, dur=0.5, v=1.0, bright=1.0):
    n = int(dur * SR); f = hz(m)
    out = np.zeros(n)
    for k in range(1, 18):
        if f * k > 12000: break
        out += (1 / k) * np.sin(2 * np.pi * f * k * np.arange(n) / SR) * expdec(n, 0.9 / (1 + k * 0.9 / bright))
    return out * env(n, 0.002, 0.05, 1, 0.03) * v


def epiano(m, dur=0.8, v=1.0):
    n = int(dur * SR); f = hz(m); tt = np.arange(n) / SR
    mod = np.sin(2 * np.pi * f * tt) * 1.8 * expdec(n, 0.25)
    car = np.sin(2 * np.pi * f * tt + mod)
    bell = 0.25 * np.sin(2 * np.pi * f * 4.0 * tt) * expdec(n, 0.08)
    return (car + bell) * expdec(n, 0.7) * env(n, 0.003, 0.0, 1, 0.08) * v


def bass(m, dur=0.3, v=1.0):
    n = int(dur * SR); f = hz(m)
    s = additive(f, n, [(1, 1), (2, 0.45), (3, 0.25), (4, 0.12), (5, 0.06)])
    return soft(s * env(n, 0.004, 0.12, 0.6, 0.04) * v, 1.3)


def pad(ms, dur, v=1.0):
    n = int(dur * SR)
    out = np.zeros(n)
    for m in ms:
        for det in (-0.08, 0.0, 0.08):
            out += additive(hz(m + det), n, [(k, 1 / k) for k in range(1, 9)])
    out = fft_filter(out, hi=1800)
    return out * env(n, 0.4, 0.0, 1, 0.6) * v / (len(ms) * 3)


def brass(m, dur, v=1.0, vib=0.0, slide_to=None):
    n = int(dur * SR); tt = np.arange(n) / SR
    f = np.full(n, hz(m))
    if slide_to is not None:
        f = hz(m) * (hz(slide_to) / hz(m)) ** np.clip(tt / dur, 0, 1)
    if vib:
        f = f * (1 + vib * np.sin(2 * np.pi * 5.5 * tt) * np.clip(tt / 0.25, 0, 1))
    br = env(n, 0.06, 0.15, 0.75, 0.08)
    s = additive(f, n, SAW[:16], bright=br)
    return s * br * v


def bell(m, dur=1.2, v=1.0):
    n = int(dur * SR); f = hz(m)
    parts = [(1, 1, 1.0), (2.0, 0.5, 0.6), (2.76, 0.35, 0.4), (5.4, 0.2, 0.25), (8.93, 0.1, 0.15)]
    out = sum(a * np.sin(phase(f * r, n)) * expdec(n, dur * d / 2) for r, a, d in parts)
    return out * env(n, 0.001, 0, 1, 0.05) * v


def woodblock(f, v=1.0):
    n = int(0.08 * SR)
    s = np.sin(phase(f, n)) * expdec(n, 0.012) + 0.3 * np.sin(phase(f * 2.7, n)) * expdec(n, 0.006)
    s += 0.15 * fft_filter(noise(n), lo=2000) * expdec(n, 0.003)
    return s * v


# ---------------------------------------------------------------- muzyka
def loop_render(bars, bpm, draw, tail=2.0):
    beat = 60 / bpm
    L = bars * 4 * beat
    buf = np.zeros(int((L + tail) * SR))
    draw(buf, beat)
    return buf, L


def fold_loop(buf, L):
    n = int(L * SR)
    out = buf[:n].copy()
    out[:len(buf) - n] += buf[n:]  # ogon pogłosu wraca na początek – pętla bez szwu
    return out


def music_lobby():
    # „szpiegowski” groove w a-moll, 112 BPM, 16 taktów
    bpm = 112
    prog = [(57, [57, 60, 64]), (53, [53, 57, 60]), (50, [50, 53, 57]), (52, [52, 56, 59])] * 4  # Am F Dm E
    mel = [  # (takt, ósemka, nuta, długość w ósemkach)
        (0, 0, 76, 2), (0, 3, 74, 1), (0, 4, 72, 2), (0, 6, 69, 2), (1, 0, 72, 3), (1, 4, 69, 2), (1, 6, 65, 2),
        (2, 0, 69, 2), (2, 2, 72, 2), (2, 4, 74, 2), (2, 6, 77, 2), (3, 0, 76, 4), (3, 4, 75, 2), (3, 6, 76, 2),
        (8, 0, 81, 2), (8, 3, 79, 1), (8, 4, 76, 2), (8, 6, 72, 2), (9, 0, 77, 3), (9, 4, 76, 2), (9, 6, 72, 2),
        (10, 0, 74, 2), (10, 2, 77, 2), (10, 4, 76, 2), (10, 6, 74, 2), (11, 0, 76, 6), (11, 6, 68, 2),
    ]

    def draw(buf, beat):
        e8 = beat / 2
        drums = np.zeros_like(buf); keys = np.zeros_like(buf); lead = np.zeros_like(buf); bs = np.zeros_like(buf)
        for b, (root, ch) in enumerate(prog):
            t0 = b * 4 * beat
            intro = b < 2
            # perkusja
            for s in range(8):
                ts = t0 + s * e8
                if not intro or s % 2 == 0:
                    place(drums, hat(0.22 if s % 2 else 0.32, open_=(s == 7 and b % 2 == 1)), ts + (0.012 if s % 2 else 0))
            if not intro:
                for s in (0, 3, 4):
                    place(drums, kick(0.9 if s != 3 else 0.6), t0 + s * e8)
                for s in (2, 6):
                    place(drums, mix(snare(0.55), clap(0.35)), t0 + s * e8)
            if b % 4 == 3:
                place(drums, snare(0.25), t0 + 7.5 * e8)
            if b == 8:
                place(drums, crash(0.35, 2.5), t0)
            # bas: walking ósemkami
            pat = [0, 0, 12, 0, 10, 0, 7, 8] if root == 57 else [0, 0, 12, 0, 7, 0, 10, 12]
            for s, iv in enumerate(pat):
                if intro and s % 4:
                    continue
                place(bs, bass(root - 24 + iv, e8 * 0.9, 0.9 if s == 0 else 0.7), t0 + s * e8)
            # akordy: e-piano na „i”
            for s in (1, 3, 5, 7) if not intro else (0,):
                for m in ch:
                    place(keys, epiano(m + 12, 0.35, 0.22), t0 + s * e8 + 0.004 * (m % 3))
            place(keys, pad([m + 12 for m in ch], 4 * beat + 0.3, 0.5), t0)
        for bar, s8, m, ln in mel:
            place(lead, mix(pluck(m, ln * e8 + 0.25, 0.5, bright=1.6), 0.35 * bell(m + 12, ln * e8 + 0.3, 0.15)), bar * 4 * beat + s8 * e8)
        lead = reverb(lead, 1.4, 0.35)[:len(buf)]
        keys = reverb(keys, 1.2, 0.25)[:len(buf)]
        buf += drums * 0.9 + bs * 0.75 + keys * 0.8 + lead * 0.9

    buf, L = loop_render(16, bpm, draw)
    save('music_lobby', soft(fold_loop(buf, L) * 1.2, 1.2), br='160k', trim=False, peak=0.8)


def music_tension():
    # dyskusja/głosowanie: pulsujący bas, tykanie, niepokojące smyczki – 96 BPM, 16 taktów
    bpm = 96

    def draw(buf, beat):
        e8 = beat / 2
        roots = [45, 45, 46, 45] * 4
        layer = np.zeros_like(buf); pd = np.zeros_like(buf)
        for b, r in enumerate(roots):
            t0 = b * 4 * beat
            for s in range(8):
                place(layer, bass(r - 12 + (12 if s in (3, 7) else 0), e8 * 0.7, 0.75 if s % 2 == 0 else 0.5), t0 + s * e8)
                place(layer, woodblock(1900 if s % 2 else 1500, 0.18), t0 + s * e8)
            if b >= 4:
                place(layer, kick(0.7), t0); place(layer, kick(0.5), t0 + 2 * beat)
            if b >= 8:
                for s in range(16):
                    place(layer, hat(0.12), t0 + s * e8 / 2)
            if b % 2 == 0:
                place(pd, pad([r + 12, r + 15, r + 19] if r == 45 else [r + 12, r + 15, r + 18], 8 * beat + 0.5, 0.45), t0)
            if b % 4 == 3:
                place(layer, snare(0.3) * 0.6, t0 + 3.5 * beat)
        pd = reverb(pd, 2.0, 0.4)[:len(buf)]
        buf += layer + pd * 0.9

    buf, L = loop_render(16, bpm, draw)
    save('music_tension', fold_loop(buf, L), br='160k', trim=False, peak=0.75)


# ---------------------------------------------------------------- efekty
def fx_pop():
    n = int(0.18 * SR); tt = np.arange(n) / SR
    s = np.sin(phase(380 + 900 * (1 - np.exp(-tt * 40)), n)) * expdec(n, 0.05)
    s += 0.4 * fft_filter(noise(n), lo=3000) * expdec(n, 0.004)
    save('pop', reverb(s, 0.5, 0.15))


def fx_join():
    buf = np.zeros(int(0.9 * SR))
    place(buf, bell(88, 0.6, 0.6), 0); place(buf, bell(95, 0.7, 0.5), 0.09)
    place(buf, pluck(76, 0.3, 0.4, 2), 0)
    save('join', reverb(buf, 0.9, 0.25))


def fx_ding():
    buf = np.zeros(int(1.2 * SR))
    place(buf, bell(84, 1.1, 0.7), 0); place(buf, bell(91, 1.0, 0.5), 0.06)
    save('ding', reverb(buf, 1.0, 0.25))


def fx_tick():
    save('tick', woodblock(2100, 1.0), peak=0.7)


def fx_tock():
    s = mix(woodblock(1250, 1.0), 0.5 * woodblock(1700, 1.0))
    save('tock', reverb(s, 0.4, 0.15), peak=0.85)


def fx_blip():
    n = int(0.16 * SR)
    s = additive(np.linspace(hz(76), hz(83), n), n, SQR[:6]) * env(n, 0.003, 0.08, 0.3, 0.05)
    save('blip', reverb(s, 0.5, 0.15), peak=0.6)


def fx_whoosh():
    n = int(0.75 * SR)
    s = sweep_filter(noise(n), 250, 5000, q=1.6) * np.sin(np.linspace(0, np.pi, n)) ** 1.5
    save('whoosh', reverb(s, 0.6, 0.2))


def fx_drumroll():
    dur = 2.4
    buf = np.zeros(int((dur + 2.6) * SR))
    k = 0; tt = 0.0
    while tt < dur:
        place(buf, snare(0.18 + 0.6 * (tt / dur) ** 1.5, tone=210) * (0.8 if k % 2 else 1), tt)
        tt += 0.062; k += 1
    place(buf, crash(0.5, 2.4), dur); place(buf, kick(1.2), dur)
    place(buf, brass(57, 1.2, 0.35) + brass(64, 1.2, 0.25), dur)
    save('drumroll', reverb(buf, 1.5, 0.2))


def fx_stamp():
    n = int(0.5 * SR)
    s = np.zeros(n)
    place(s, kick(1.3), 0)
    s += 0.8 * fft_filter(noise(n), hi=1500) * expdec(n, 0.03)
    place(s, woodblock(900, 0.5), 0)
    save('stamp', reverb(soft(s, 2), 0.7, 0.2))


def fx_fanfare():
    buf = np.zeros(int(2.8 * SR))
    for m, at in ((60, 0), (64, 0.14), (67, 0.28)):
        place(buf, brass(m + 12, 0.18, 0.5) + brass(m, 0.18, 0.3), at)
    for m in (72, 76, 79, 84):
        place(buf, brass(m, 1.4, 0.32, vib=0.006), 0.45)
    place(buf, brass(48, 1.4, 0.45), 0.45)
    place(buf, mix(snare(0.45), crash(0.22, 1.8)), 0.45); place(buf, kick(1.0), 0.45)
    for at in (0, 0.14, 0.28):
        place(buf, snare(0.3), at)
    save('fanfare', reverb(buf, 1.4, 0.25))


def fx_win():
    buf = np.zeros(int(5.0 * SR))
    tt = 0.0
    while tt < 1.0:  # tremolo kotłów
        place(buf, kick(0.3 + 0.5 * tt), tt); tt += 0.07
    seq = [(67, 1.0, 0.2), (67, 1.22, 0.2), (67, 1.44, 0.2), (72, 1.66, 0.7), (69, 2.4, 0.25), (71, 2.66, 0.25), (72, 2.92, 1.8)]
    for m, at, d in seq:
        place(buf, brass(m + 12, d, 0.45, vib=0.005) + brass(m, d, 0.25), at)
    for m in (60, 64, 67):
        place(buf, brass(m, 1.9, 0.25, vib=0.006), 2.92)
    for m in (84, 88, 91, 96):
        place(buf, bell(m, 2.0, 0.12), 2.92 + (m - 84) * 0.01)
    place(buf, crash(0.35, 2.5), 2.92); place(buf, kick(1.2), 2.92)
    place(buf, crash(0.22, 1.5), 1.66); place(buf, snare(0.5), 1.66)
    save('win', reverb(buf, 1.8, 0.28))


def fx_wah():
    # smutny puzon: „wah wah wah wahhhh”
    buf = np.zeros(int(4.2 * SR))
    for i, (m, at) in enumerate(((67, 0.0), (66, 0.5), (65, 1.0))):
        place(buf, brass(m - 12, 0.48, 0.6, slide_to=m - 12.4), at)
    place(buf, brass(64 - 12, 2.0, 0.7, vib=0.025), 1.5)
    # efekt „wah” – modulacja barwy
    tt = np.arange(len(buf)) / SR
    wobble = fft_filter(buf, hi=900)
    mix = 0.5 + 0.5 * np.sin(2 * np.pi * 2.0 * tt) ** 2
    buf = buf * mix + wobble * (1 - mix)
    save('wah', reverb(buf, 1.0, 0.2))


def fx_clown():
    buf = np.zeros(int(2.0 * SR))
    # gwizdek ślizgowy w górę i w dół
    n = int(0.7 * SR); tt = np.arange(n) / SR
    f = 500 + 900 * np.sin(np.pi * tt / 0.7)
    place(buf, np.sin(phase(f, n)) * env(n, 0.02, 0, 1, 0.1) * 0.5, 0)
    # klakson x2
    for at in (0.8, 1.05):
        n2 = int(0.2 * SR)
        h = additive(420, n2, SQR[:12]) + additive(434, n2, SQR[:12])
        place(buf, fft_filter(h, peak=1100, q=0.6) * env(n2, 0.005, 0.02, 0.8, 0.04) * 1.6, at)
    # „boing”
    n3 = int(0.6 * SR); tt3 = np.arange(n3) / SR
    place(buf, np.sin(phase(180 + 70 * np.sin(2 * np.pi * 9 * tt3) * np.exp(-tt3 * 4), n3)) * expdec(n3, 0.2) * env(n3, 0.01, 0, 1, 0.05) * 0.8, 1.35)
    save('clown', reverb(buf, 0.8, 0.15))


def fx_reveal():
    buf = np.zeros(int(2.0 * SR))
    for i, m in enumerate((72, 76, 79, 83, 86, 88)):
        place(buf, mix(bell(m, 1.2, 0.45), pluck(m - 12, 0.4, 0.2, 2)), i * 0.065)
    n = int(1.6 * SR)
    place(buf, fft_filter(noise(n), lo=6000) * env(n, 0.3, 0, 1, 1.0) * 0.08, 0.1)
    save('reveal', reverb(buf, 1.6, 0.35))


def fx_react():
    n = int(0.14 * SR); tt = np.arange(n) / SR
    s = np.sin(phase(600 + 800 * tt / 0.14, n)) * expdec(n, 0.035)
    save('react', reverb(s, 0.3, 0.1), peak=0.7)


def fx_buzzer():
    n = int(0.6 * SR)
    s = additive(150, n, SAW[:30]) + additive(157, n, SAW[:30])
    s = fft_filter(s, hi=3000) * env(n, 0.005, 0.05, 0.85, 0.06)
    save('buzzer', soft(s, 1.6), peak=0.75)


def fx_start():
    # start rundy: krótki „riser” + uderzenie
    buf = np.zeros(int(1.8 * SR))
    n = int(0.8 * SR)
    place(buf, sweep_filter(noise(n), 200, 6000, q=1.2) * np.linspace(0, 1, n) ** 2 * 1.2, 0)
    place(buf, mix(kick(1.2), crash(0.3, 1.0)), 0.8)
    for m in (57, 64, 69):
        place(buf, brass(m, 0.6, 0.3), 0.8)
    save('start', reverb(buf, 1.2, 0.25))


if __name__ == '__main__':
    for fn in (fx_pop, fx_join, fx_ding, fx_tick, fx_tock, fx_blip, fx_whoosh, fx_drumroll, fx_stamp,
               fx_fanfare, fx_win, fx_wah, fx_clown, fx_reveal, fx_react, fx_buzzer, fx_start,
               music_lobby, music_tension):
        fn()
