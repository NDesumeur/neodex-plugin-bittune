// BitTune : composer de la musique chiptune sur une grille. 5 voies comme les vieilles consoles (deux carrées, une triangle, un bruit, une dent de scie),
// 8 motifs de 32 pas enchaînés dans un ordre libre, effets par note (vibrato, arpèges, glissés, piqué, volume), panoramique, écho, swing, gammes.
// Lecture en direct (avec oscilloscope), export WAV et MIDI, morceau enregistrable et rouvrable.
const CSS = `
.btTop{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px}
.btTop .btn{width:auto;margin:0;padding:4px 12px}
.btTop .f{width:auto;margin:0}
.btCh{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}
.btCh .btn{width:auto;margin:0;padding:4px 10px}
.btCh .btn i{display:inline-block;width:10px;height:10px;margin-right:6px;border:1px solid #000}
.btCh .mini{padding:4px 6px;min-width:26px}
.btCh .off{opacity:.45}
.btWrap{overflow:auto;border:2px solid var(--line);background:#0b0816;max-height:460px}
.btCan{display:block;image-rendering:pixelated;cursor:crosshair}
.btRow{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}
.btRow .btn{width:auto;margin:0;padding:4px 10px}
.btRow .f{width:auto;margin:0}
.btRange{-webkit-appearance:none;appearance:none;height:10px;background:var(--bg0);border:2px solid var(--line);outline:none;width:110px}
.btRange::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:22px;background:var(--magenta);border:2px solid #000;cursor:var(--cp,pointer)}
.btOrder{font:14px monospace;letter-spacing:2px;width:200px!important;text-transform:uppercase}
.btHelp{font-size:12px;color:var(--lilac);margin-top:6px}
.btScope{width:160px;height:40px;background:#0b0816;border:2px solid var(--line);image-rendering:pixelated}
.btTool.main{outline:2px solid #fff}
.btTool{min-width:34px}
`;
const STEPS = 32, NOTES = 37, LOW = 48, PATS = 'ABCDEFGH';  // 37 notes : do3 à do6 (MIDI 48 à 84)
const CH = [['Carré 1', '#ff4fb0', 'pulse'], ['Carré 2', '#4fc3ff', 'pulse'], ['Triangle', '#ffd34f', 'tri'], ['Bruit', '#9ae06a', 'noise'], ['Dent de scie', '#ff8a4a', 'saw']];
const NV = CH.length, NOISE = 3;
const DRUMS = [['Grosse caisse', 'lowpass', 180, .18, .25, 2.2, 36], ['Caisse claire', 'highpass', 1200, .14, 1, 1, 38], ['Charleston', 'highpass', 7000, .04, 1, 1, 42],
  ['Cymbale', 'highpass', 4000, .4, 1, 1, 49], ['Charleston ouvert', 'highpass', 6000, .2, 1, .9, 46], ['Tom', 'lowpass', 600, .2, .5, 1.8, 45]];
const NAMES = ['do', 'do#', 'ré', 'ré#', 'mi', 'fa', 'fa#', 'sol', 'sol#', 'la', 'la#', 'si'];
const SCALES = {Chromatique: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], Majeur: [0, 2, 4, 5, 7, 9, 11], Mineur: [0, 2, 3, 5, 7, 8, 10], Pentatonique: [0, 2, 4, 7, 9], 'Penta mineure': [0, 3, 5, 7, 10], Blues: [0, 3, 5, 6, 7, 10]};
// les effets d'une note : la lettre dessinée dans la note et ce qu'elle fait
const FX = [['', '✎ Note', 'Poser et tenir des notes'], ['v', '~ Vibrato', 'La note ondule'], ['M', 'M Arpège majeur', 'La note, sa tierce majeure et sa quinte, très vite'], ['m', 'm Arpège mineur', 'La note, sa tierce mineure et sa quinte, très vite'],
  ['u', '↗ Glisse', 'Arrive en glissant depuis une octave plus bas'], ['d', '↘ Chute', 'Tombe de deux octaves (effet laser)'], ['s', '· Piqué', 'Note très courte'], ['V', '▮ Volume', 'Chaque clic baisse le volume de la note (4 niveaux)']];
const hz = m => 440 * 2 ** ((m - 69) / 12);
function pulseWave(ac, duty) { const n = 32, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) im[k] = 2 / (k * Math.PI) * Math.sin(k * Math.PI * duty) * 2, re[k] = 0; return ac.createPeriodicWave(re, im); }
function triWave(ac) { const n = 32, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k += 2) im[k] = 8 / (Math.PI * Math.PI * k * k) * (((k - 1) / 2) % 2 ? -1 : 1); return ac.createPeriodicWave(re, im); }
const empty = () => [...Array(NV)].map(() => Array(STEPS).fill(-1));
const emptyEx = () => [...Array(NV)].map(() => Array(STEPS).fill(0));
// le morceau d'avant (4 voies, 4 motifs, sans effets) est complété sans rien perdre
function migrate(s) {
  s.pats ||= {}; s.ex ||= {};
  for (const p of PATS) { const v = s.pats[p] ||= empty(); while (v.length < NV) v.push(Array(STEPS).fill(-1)); const e = s.ex[p] ||= emptyEx(); while (e.length < NV) e.push(Array(STEPS).fill(0)); }
  const pad = (k, d) => { s[k] ||= []; while (s[k].length < NV) s[k].push(d); };
  pad('vol', .7); pad('duty', .5); pad('pan', 0); pad('echo', 0); pad('oct', 0); pad('mute', false);
  s.swing ??= 0; s.scale ||= 'Chromatique'; s.root ??= 0; s.order = (s.order || ['A']).filter(p => PATS.includes(p)); if (!s.order.length) s.order = ['A'];
  return s;
}
// programme tous les sons d'un morceau dans un contexte audio (en direct ou hors ligne pour le WAV)
function schedule(ac, dest, song, t0, fromStep = 0) {
  const step = 60 / song.bpm / 4, waves = {tri: triWave(ac)}, noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), nd = noise.getChannelData(0);
  let lfsr = 1; for (let i = 0; i < nd.length; i++) { const b = (lfsr ^ (lfsr >> 1)) & 1; lfsr = (lfsr >> 1) | (b << 14); nd[i] = (lfsr & 1) * 2 - 1; }  // bruit à registre, comme la NES
  const solo = (song.solo ?? -1) >= 0;
  const bus = [...Array(NV)].map((_, c) => {  // une entrée par voie : volume, panoramique, et l'écho (3 pas, qui se répète)
    const gIn = ac.createGain(), pan = ac.createStereoPanner ? ac.createStereoPanner() : null; gIn.gain.value = (solo ? song.solo === c : !song.mute?.[c]) ? 1 : 0;
    if (pan) { pan.pan.value = song.pan?.[c] || 0; gIn.connect(pan); pan.connect(dest); } else gIn.connect(dest);
    if (song.echo?.[c] > 0) { const send = ac.createGain(), dl = ac.createDelay(2), fb = ac.createGain(); send.gain.value = song.echo[c]; dl.delayTime.value = step * 3; fb.gain.value = .35; gIn.connect(send); send.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(pan || dest); }
    return gIn;
  });
  const order = song.order.filter(p => song.pats[p]); let s = 0, n = 0;
  for (const p of order) for (let i = 0; i < STEPS; i++, s++) {
    if (s < fromStep) continue;
    const t = t0 + (s - fromStep) * step + (i % 2 ? (song.swing || 0) * step : 0);
    song.pats[p].forEach((voice, c) => {
      const v = voice[i]; if (v < 0) return; const ex = song.ex?.[p]?.[c]?.[i] || 0, vel = (ex.v || 4) / 4, vol = (song.vol[c] ?? .7) * .22 * vel; if (!vol) return; n++;
      const g = ac.createGain(); g.connect(bus[c]);
      if (c === NOISE) { const [, ft, fq, len0, rate, mul] = DRUMS[v] || DRUMS[0], len = ex.f === 's' ? len0 / 2 : len0, src = ac.createBufferSource(); src.buffer = noise; const f = ac.createBiquadFilter(); f.type = ft; f.frequency.value = fq;
        src.playbackRate.value = rate; src.connect(f); f.connect(g); g.gain.setValueAtTime(vol * mul, t); g.gain.exponentialRampToValueAtTime(.001, t + len); src.start(t); src.stop(t + len + .02); return; }
      const kind = CH[c][2], o = ac.createOscillator();
      if (kind === 'saw') o.type = 'sawtooth'; else { const key = kind === 'tri' ? 'tri' : 'p' + song.duty[c]; waves[key] ||= pulseWave(ac, song.duty[c]); o.setPeriodicWave(waves[key]); }
      const m = LOW + v + (kind === 'tri' ? -12 : 0) + 12 * (song.oct?.[c] || 0), f0 = hz(m);
      let len = step; for (let k = i + 1; k < STEPS && voice[k] === -2; k++) len += step;  // -2 : la note est tenue
      if (ex.f === 's') len = Math.min(len, step * .45);
      o.frequency.setValueAtTime(f0, t);
      if (ex.f === 'M' || ex.f === 'm') { const iv = [0, ex.f === 'M' ? 4 : 3, 7]; for (let k = 0, tt = t; tt < t + len; k++, tt += 1 / 30) o.frequency.setValueAtTime(hz(m + iv[k % 3]), tt); }
      else if (ex.f === 'u') { o.frequency.setValueAtTime(f0 / 2, t); o.frequency.exponentialRampToValueAtTime(f0, t + Math.min(len * .6, .12)); }
      else if (ex.f === 'd') { o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 / 4, t + len); }
      else if (ex.f === 'v') { const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f0 * .03, t + Math.min(.15, len / 2)); lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + len); }
      const amp = kind === 'saw' ? vol * .6 : vol;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + .005); g.gain.setValueAtTime(amp, t + len * .85); g.gain.linearRampToValueAtTime(0, t + len * .98);
      o.connect(g); o.start(t); o.stop(t + len);
    });
  }
  return {steps: s, step, notes: n};
}
function wav(buf) {
  const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate, out = new DataView(new ArrayBuffer(44 + len * ch * 2)), w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); out.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, len * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c)); for (let i = 0, o = 44; i < len; i++) for (let c = 0; c < ch; c++, o += 2) out.setInt16(o, Math.max(-1, Math.min(1, data[c][i])) * 32767, true);
  return new Uint8Array(out.buffer);
}
// le MIDI : un fichier de type 0, une voie MIDI par voie (le bruit sur la 10, les percussions), 96 tics par noire
function midi(song) {
  const TPQ = 96, ST = TPQ / 4, ev = [], prog = [80, 80, 38, 0, 81];
  const vlq = n => { const b = [n & 127]; while ((n >>= 7)) b.unshift((n & 127) | 128); return b; };
  CH.forEach((_, c) => { if (c !== NOISE) ev.push([0, 0, [0xC0 | c, prog[c]]]); ev.push([0, 0, [0xB0 | (c === NOISE ? 9 : c), 10, Math.round(64 + (song.pan[c] || 0) * 63)]]); });
  let s = 0;
  for (const p of song.order) for (let i = 0; i < STEPS; i++, s++) song.pats[p].forEach((voice, c) => {
    const v = voice[i]; if (v < 0 || song.mute[c]) return; const ex = song.ex[p][c][i] || 0, vel = Math.min(127, Math.round((ex.v || 4) * 31 * (song.vol[c] ?? .7) + 8)), mc = c === NOISE ? 9 : c;
    const key = c === NOISE ? (DRUMS[v] || DRUMS[0])[6] : LOW + v + (CH[c][2] === 'tri' ? -12 : 0) + 12 * (song.oct[c] || 0);
    let len = 1; if (c !== NOISE) while (i + len < STEPS && voice[i + len] === -2) len++;
    const on = s * ST, off = on + (ex.f === 's' ? ST / 2 : len * ST) - 1;
    ev.push([on, 1, [0x90 | mc, key, vel]], [off, 0, [0x80 | mc, key, 0]]);
  });
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const us = Math.round(60e6 / song.bpm), trk = [0, 0xFF, 0x51, 3, us >> 16 & 255, us >> 8 & 255, us & 255]; let last = 0;
  for (const [t, , b] of ev) { trk.push(...vlq(t - last), ...b); last = t; }
  trk.push(0, 0xFF, 0x2F, 0);
  const head = [77, 84, 104, 100, 0, 0, 0, 6, 0, 0, 0, 1, TPQ >> 8, TPQ & 255], L = trk.length;
  return new Uint8Array([...head, 77, 84, 114, 107, L >>> 24 & 255, L >> 16 & 255, L >> 8 & 255, L & 255, ...trk]);
}
// les morceaux d'exemple, écrits note par note
function demo() {  // un petit air de départ en la mineur
  const p = empty(), mel = [12, -1, 15, -1, 19, -2, 17, -1, 15, -1, 14, -1, 12, -2, -2, -1, 10, -1, 12, -1, 14, -2, 15, -1, 14, -1, 12, -1, 9, -2, -2, -1];
  p[0] = mel; for (let i = 0; i < STEPS; i += 4) p[1][i] = [0, 0, 3, 3, 5, 5, 4, 4][i / 4] + 12; for (let i = 0; i < STEPS; i += 8) { p[2][i] = [9, 5, 0, 4][i / 8]; p[2][i + 1] = -2; p[2][i + 2] = -2; p[2][i + 3] = -2; }
  for (let i = 0; i < STEPS; i += 2) p[3][i] = i % 8 === 0 ? 0 : i % 8 === 4 ? 1 : 2; return p;
}
function example(kind) {
  const s = migrate({bpm: 120, vol: [1, .7, 1, .8, .6], duty: [.25, .5, .5, .5, .5], order: ['A']});
  const put = (p, c, i, v, len = 1, ex = 0) => { s.pats[p][c][i] = v; for (let k = 1; k < len; k++) s.pats[p][c][i + k] = -2; if (ex) s.ex[p][c][i] = ex; };
  const drums = (p, fill) => { for (let i = 0; i < STEPS; i += 2) put(p, 3, i, i % 8 === 0 ? 0 : i % 8 === 4 ? 1 : 2); if (fill) for (const i of [26, 28, 30]) put(p, 3, i, 5); };
  if (kind === 'Départ') { s.pats.A = demo(); s.order = ['A', 'A']; return s; }
  if (kind === 'Aventure') {  // do majeur, entraînant : do sol la fa
    s.bpm = 140; s.scale = 'Majeur'; s.echo[0] = .25; s.pan[1] = -.4; s.pan[4] = .4;
    const chords = [0, 7, 9, 5], third = [4, 4, 3, 4];
    for (const p of ['A', 'B']) chords.forEach((r, k) => { put(p, 2, k * 8, r + 12, 3); put(p, 2, k * 8 + 4, r + 12, 2); put(p, 2, k * 8 + 6, r + 19, 2); put(p, 1, k * 8, r + 12, 8, {f: third[k] === 4 ? 'M' : 'm', v: 2}); });
    [24, -1, 26, 28, -1, 26, 24, -1, 31, -2, 28, -1, 26, -1, 24, -1, 28, -1, 26, 24, -1, 21, -1, 24, 29, -2, 28, -1, 26, -1, 24, -2].forEach((v, i) => { if (v !== -1) s.pats.A[0][i] = v; });
    [31, -1, 33, 31, -1, 28, -1, 31, 33, -2, 35, -1, 36, -2, -2, -1, 33, -1, 31, 28, -1, 26, -1, 28, 29, -1, 28, -1, 26, -1, 24, -2].forEach((v, i) => { if (v !== -1) s.pats.B[0][i] = v; });
    s.ex.B[0][12] = {f: 'v', v: 4}; s.ex.A[0][8] = {f: 'u', v: 4};
    drums('A'); drums('B', true); s.order = ['A', 'B', 'A', 'B']; return s;
  }
  // Donjon : la mineur, lent et inquiétant, avec l'écho et la dent de scie
  s.bpm = 96; s.scale = 'Mineur'; s.root = 9; s.echo = [.4, .3, 0, 0, .35]; s.duty[0] = .125; s.vol[4] = .5;
  const bass = [9, 9, 5, 5, 7, 7, 4, 4];
  for (const p of ['A', 'B']) { bass.forEach((r, k) => put(p, 2, k * 4, r, 3)); for (let i = 0; i < STEPS; i += 8) { put(p, 3, i, 0); put(p, 3, i + 4, i % 16 ? 5 : 1); } }
  [21, -2, -2, -1, 24, -1, 23, -1, 21, -2, -2, -1, 17, -1, 16, -1, 19, -2, -2, -1, 21, -1, 19, -1, 16, -2, -2, -2, -2, -2, -1, -1].forEach((v, i) => { if (v !== -1) s.pats.A[0][i] = v; });
  s.ex.A[0][24] = {f: 'v', v: 4};
  for (let k = 0; k < 4; k++) put('B', 4, k * 8, [21, 17, 19, 16][k] + 12, 8, {f: 'v', v: 3});
  [28, -1, 29, 28, 26, -1, 24, -1, 23, -2, 24, -1, 26, -2, -2, -1, 24, -1, 23, 21, 19, -1, 21, -1, 16, -2, -2, -2, -1, 28, -1, -1].forEach((v, i) => { if (v !== -1) s.pats.B[0][i] = v; });
  s.ex.B[0][29] = {f: 'd', v: 3};
  s.order = ['A', 'A', 'B', 'A']; return s;
}
export default async function (ctx) {
  const view = ctx.view;
  if (!ctx.host) { view.textContent = "Ce plugin doit être approuvé par NeoDex pour s'ouvrir."; return; }
  const { el, toast } = ctx.host;
  ctx.host.addStyle(CSS);
  let data = null; try { data = await ctx.folder.read('bittune'); } catch {}
  let song = migrate(data?.pats ? data : example('Départ'));
  let pat = 'A', ch = 0, saveT = 0, tool = '', loopPat = false, clip = null;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => ctx.folder.write('bittune', song).catch(() => {}), 500); };
  const hist = [], redo = [];
  const snap = () => { hist.push(JSON.stringify(song)); if (hist.length > 80) hist.shift(); redo.length = 0; };
  const undo = (from, to) => { if (!from.length) return; to.push(JSON.stringify(song)); song = migrate(JSON.parse(from.pop())); save(); all(); };
  // vérification : les morceaux d'exemple se programment hors ligne et font du son, le WAV et le MIDI ont le bon en-tête
  (async () => { const ex = example('Aventure'), oc = new OfflineAudioContext(2, 22050, 22050), r = schedule(oc, oc.destination, {...ex, bpm: 240, order: ['A']}, 0), b = await oc.startRendering(), d = b.getChannelData(0), w = wav(b), m = midi(ex);
    let peak = 0; for (const v of d) peak = Math.max(peak, Math.abs(v));
    console.assert(r.notes > 40 && peak > .05 && peak <= 2 && w.length === 44 + 22050 * 4 && String.fromCharCode(...w.slice(8, 12)) === 'WAVE' && String.fromCharCode(...m.slice(0, 4)) === 'MThd' && m.length > 200, 'bittune : rendu ' + peak); })();
  // ---------- l'interface ----------
  view.innerHTML = '';
  const wrap = el('div', 'appWrap'), head = el('div', 'agHead'), top = el('div', 'btTop'), chans = el('div', 'btCh'), card = el('div', 'sysCard px'), mix = el('div', 'btRow'), tools = el('div', 'btRow'), patRow = el('div', 'btRow'), files = el('div', 'btRow');
  head.append(el('span', 'label', 'BitTune · musique chiptune')); wrap.append(head, top, card); view.append(wrap);
  const box = el('div', 'btWrap'), can = el('canvas', 'btCan'), g = can.getContext('2d'); can.id = 'bt_grid'; box.append(can);
  const status = el('p', 'btHelp'); status.id = 'bt_status';
  card.append(chans, tools, box, patRow, mix, status, files, el('p', 'btHelp', 'Clic : poser une note · glisser vers la droite : la tenir · clic droit : effacer · avec un outil d\'effet, clic sur une note pour le poser ou l\'enlever · Espace : lecture · Ctrl+Z / Ctrl+Y : annuler / refaire.'));
  const btn = (t, f, cls = 'btn px') => { const b = el('button', cls, t); b.onclick = f; return b; };
  const play = el('button', 'btn px main', '▶ Jouer'), stop = btn('■', () => stopIt()), bpm = el('input', 'btRange'), bpmL = el('span', 'hint'), swing = el('input', 'btRange'), swingL = el('span', 'hint'), order = el('input', 'f btOrder');
  const loopB = btn('', () => { loopPat = !loopPat; drawTop(); if (playing) start(); }), scope = el('canvas', 'btScope'), sg = scope.getContext('2d'); scope.width = 160; scope.height = 40;
  play.id = 'bt_play'; bpm.type = 'range'; bpm.min = 60; bpm.max = 240; swing.type = 'range'; swing.min = 0; swing.max = .5; swing.step = .05; swing.title = 'Swing : les pas impairs arrivent en retard';
  order.title = 'L\'ordre des motifs, par exemple AABA (A à H)'; order.translate = false; loopB.title = 'Jouer seulement le motif affiché, en boucle';
  const patBtns = el('span');
  top.append(play, stop, loopB, el('span', 'hint', 'Tempo'), bpm, bpmL, el('span', 'hint', 'Swing'), swing, swingL, btn('↶', () => undo(hist, redo)), btn('↷', () => undo(redo, hist)), scope);
  function drawTop() {
    bpm.value = song.bpm; swing.value = song.swing; order.value = song.order.join(''); bpmL.textContent = song.bpm + ' bpm'; swingL.textContent = Math.round(song.swing * 100) + ' %';
    loopB.textContent = loopPat ? '⟳ Motif ' + pat : '⟳ Morceau'; loopB.classList.toggle('main', loopPat);
    patBtns.replaceChildren(...PATS.split('').map(p => { const used = song.pats[p].some(v => v.some(x => x >= 0)), b = el('button', 'btn px' + (p === pat ? ' main' : ''), p + (used ? '' : '·')); b.style.cssText = 'width:auto;margin:0 2px;padding:4px 8px'; b.dataset.pat = p; b.onclick = () => { pat = p; drawTop(); draw(); }; return b; }));
  }
  const pcopy = btn('Copier', () => { clip = JSON.stringify([song.pats[pat], song.ex[pat]]); toast('Motif ' + pat + ' copié'); }), ppaste = btn('Coller', () => { if (!clip) return toast('Rien à coller'); snap(); [song.pats[pat], song.ex[pat]] = JSON.parse(clip); save(); all(); });
  const pclear = btn('Vider', async () => { if (!(await ctx.host.confirm?.('Vider le motif ' + pat + ' (toutes les voies) ?') ?? true)) return; snap(); song.pats[pat] = empty(); song.ex[pat] = emptyEx(); save(); all(); });
  function transpose(d) {  // décale toutes les notes de la voie dans ce motif ; celles qui sortiraient de la grille ne bougent pas
    if (ch === NOISE) return toast('Le bruit ne se transpose pas'); const v = song.pats[pat][ch]; if (v.some(x => x >= 0 && (x + d < 0 || x + d >= NOTES))) return toast('Des notes sortiraient de la grille');
    snap(); song.pats[pat][ch] = v.map(x => x >= 0 ? x + d : x); save(); draw(); }
  patRow.append(el('span', 'hint', 'Motif'), patBtns, pcopy, ppaste, pclear, el('span', 'hint', 'Transposer la voie'), btn('−1', () => transpose(-1)), btn('+1', () => transpose(1)), btn('−8ve', () => transpose(-12)), btn('+8ve', () => transpose(12)), el('span', 'hint', 'Ordre'), order);
  function drawChans() {
    chans.replaceChildren(...CH.map(([n, col], i) => {
      const b = btn('', () => { ch = i; drawChans(); draw(); }, 'btn px' + (i === ch ? ' main' : '') + (song.mute[i] || (song.solo >= 0 && song.solo !== i) ? ' off' : '')), sw = el('i'); sw.style.background = col; b.append(sw, el('span', '', n)); b.dataset.ch = i;
      const mu = btn('M', () => { song.mute[i] = !song.mute[i]; save(); drawChans(); if (playing) start(); }, 'btn px mini' + (song.mute[i] ? ' main' : '')); mu.title = 'Muet';
      const so = btn('S', () => { song.solo = song.solo === i ? -1 : i; save(); drawChans(); if (playing) start(); }, 'btn px mini' + (song.solo === i ? ' main' : '')); so.title = 'Solo';
      const r = el('span'); r.style.cssText = 'display:inline-flex;gap:2px'; r.append(b, mu, so); return r;
    }));
    mix.replaceChildren();
    const slider = (t, k, mn, mx, stp, title) => { const v = el('input', 'btRange'); v.type = 'range'; v.min = mn; v.max = mx; v.step = stp; v.value = song[k][ch]; v.title = title || t; v.dataset.mix = k;
      v.oninput = () => { song[k][ch] = +v.value; save(); }; v.onchange = () => { if (playing) start(); }; mix.append(el('span', 'hint', t), v); };
    slider('Volume', 'vol', 0, 1, .05); slider('Panoramique', 'pan', -1, 1, .1, 'Gauche ← → droite'); slider('Écho', 'echo', 0, .7, .05);
    if (ch !== NOISE) { mix.append(el('span', 'hint', 'Octave')); for (const o of [-2, -1, 0, 1, 2]) mix.append(btn((o > 0 ? '+' : '') + o, () => { song.oct[ch] = o; save(); drawChans(); preview(LOW + 12); }, 'btn px' + ((song.oct[ch] || 0) === o ? ' main' : ''))); }
    if (CH[ch][2] === 'pulse') { mix.append(el('span', 'hint', 'Forme')); for (const d of [.125, .25, .5]) { const b = btn(d * 100 + ' %', () => { song.duty[ch] = d; save(); drawChans(); preview(LOW + 12); }, 'btn px' + (song.duty[ch] === d ? ' main' : '')); b.title = 'Rapport cyclique de l\'onde carrée'; mix.append(b); } }
    drawTools();
  }
  function drawTools() {
    const sc = el('select', 'f'), rt = el('select', 'f'), snapB = btn(song.snapScale ? '✓ Coller à la gamme' : 'Coller à la gamme', () => { song.snapScale = !song.snapScale; save(); drawTools(); }, 'btn px' + (song.snapScale ? ' main' : ''));
    for (const k in SCALES) { const o = el('option', '', k); o.value = k; sc.append(o); } sc.value = song.scale; sc.onchange = () => { song.scale = sc.value; save(); draw(); };
    NAMES.forEach((nm, i) => { const o = el('option', '', nm); o.value = i; rt.append(o); }); rt.value = song.root; rt.onchange = () => { song.root = +rt.value; save(); draw(); };
    tools.replaceChildren(el('span', 'hint', 'Outil'), ...FX.filter(([k]) => ch !== NOISE || ['', 's', 'V'].includes(k)).map(([k, t, title]) => { const b = btn(k ? {v: 'Vib', M: 'Maj', m: 'Min', u: '↗', d: '↘', s: 'Piqué', V: 'Vol'}[k] : t, () => { tool = k; drawTools(); }, 'btn px btTool' + (tool === k ? ' main' : '')); b.title = t.slice(2) + ' : ' + title; b.setAttribute('aria-label', t.slice(2)); b.dataset.tool = k; return b; }),
      el('span', 'hint', 'Gamme'), rt, sc, snapB);
  }
  // ---------- la grille ----------
  const CW = 22, RH = 13, LEFT = 50;
  const rows = () => ch === NOISE ? DRUMS.length : NOTES;
  const inScale = val => SCALES[song.scale].includes(((val - song.root) % 12 + 12) % 12);
  function draw() {
    const R = rows(), H = R * RH; can.width = LEFT + STEPS * CW; can.height = H + 16;
    g.fillStyle = '#0b0816'; g.fillRect(0, 0, can.width, can.height);
    g.font = '10px monospace'; g.textBaseline = 'middle';
    const sh = CH[ch][2] === 'tri' ? -1 : 0;
    for (let r = 0; r < R; r++) { const y = 16 + r * RH, val = ch === NOISE ? r : NOTES - 1 - r, black = ch !== NOISE && [1, 3, 6, 8, 10].includes(val % 12), out = ch !== NOISE && !inScale(val), tonic = ch !== NOISE && (val - song.root) % 12 === 0;
      g.fillStyle = out ? '#0d0a18' : tonic ? '#221a3c' : black ? '#120e22' : '#18142e'; g.fillRect(LEFT, y, STEPS * CW, RH - 1);
      g.fillStyle = black ? '#241c40' : '#3a2f5a'; g.fillRect(0, y, LEFT - 4, RH - 1);  // le clavier à gauche
      g.fillStyle = out ? '#4a3f6a' : black ? '#8a7aa8' : '#e8e0ff'; g.fillText(ch === NOISE ? DRUMS[r][0].slice(0, 7) : NAMES[val % 12] + (3 + Math.floor(val / 12) + sh + (song.oct[ch] || 0)), 3, y + RH / 2); }
    for (let i = 0; i < STEPS; i++) { g.fillStyle = i % 4 ? '#241c40' : '#3a2f5a'; g.fillRect(LEFT + i * CW, 16, 1, R * RH); if (i % 4 === 0) { g.fillStyle = '#8a7aa8'; g.fillText(String(i / 4 + 1), LEFT + i * CW + 3, 8); } }
    song.pats[pat].forEach((voice, c) => { if (c === ch || c === NOISE || ch === NOISE) return; g.fillStyle = CH[c][1] + '33'; voice.forEach((v, i) => { if (v >= 0) g.fillRect(LEFT + i * CW + 2, 16 + (NOTES - 1 - v) * RH + 3, CW - 4, RH - 7); }); });  // les autres voies, en pâle
    const voice = song.pats[pat][ch], col = CH[ch][1];
    voice.forEach((v, i) => { if (v < 0) return; let len = 1; while (i + len < STEPS && voice[i + len] === -2) len++; const r = ch === NOISE ? v : NOTES - 1 - v, ex = song.ex[pat][ch][i] || 0, x = LEFT + i * CW, y = 16 + r * RH;
      g.fillStyle = '#000'; g.fillRect(x + 1, y, len * CW - 1, RH - 1); g.globalAlpha = .35 + .65 * (ex.v || 4) / 4; g.fillStyle = col; g.fillRect(x + 2, y + 1, len * CW - 3, RH - 3); g.globalAlpha = 1;
      if (ex.f) { g.fillStyle = '#000'; g.fillText(FX.find(f => f[0] === ex.f)[1][0], x + 5, y + RH / 2); } if ((ex.v || 4) < 4) { g.fillStyle = '#000'; g.fillRect(x + len * CW - 5, y + RH - 3 - ex.v * 2, 2, ex.v * 2); } });
    if (playing && playPat === pat && playStep >= 0) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(LEFT + playStep * CW, 16, CW, R * RH); }
    const n = PATS.split('').reduce((a, p) => a + song.pats[p].flat().filter(v => v >= 0).length, 0);
    status.replaceChildren(el('span', '', 'Morceau :'), ' ' + song.order.join('') + ' (' + song.order.length + ' × 32 ', el('span', '', 'pas'), ') · ' + n + ' ', el('span', '', 'notes'), ' · ' + Math.round(song.order.length * STEPS * 15 / song.bpm) + ' s');
  }
  const cell = e => { const r = can.getBoundingClientRect(), x = (e.clientX - r.left) * can.width / r.width, y = (e.clientY - r.top) * can.height / r.height; return [Math.floor((x - LEFT) / CW), Math.floor((y - 16) / RH)]; };
  let drag = null;
  can.oncontextmenu = e => e.preventDefault();
  can.onpointerdown = e => {
    const [i, r] = cell(e); if (i < 0 || i >= STEPS || r < 0 || r >= rows()) return; const voice = song.pats[pat][ch], exs = song.ex[pat][ch], val = ch === NOISE ? r : NOTES - 1 - r;
    let s = i; while (s > 0 && voice[s] === -2) s--;
    const clearAt = k => { let s = k; while (s > 0 && voice[s] === -2) s--; if (voice[s] < 0) return false; voice[s] = -1; exs[s] = 0; for (let q = s + 1; q < STEPS && voice[q] === -2; q++) voice[q] = -1; return true; };
    if (e.button === 2) { if (voice[s] >= 0) { snap(); clearAt(i); save(); draw(); } return; }
    if (tool) {  // un outil d'effet : sur la note qui couvre ce pas
      if (voice[s] < 0) return toast('Clique sur une note pour lui poser cet effet');
      snap(); const ex = exs[s] || {f: '', v: 4};
      if (tool === 'V') ex.v = (ex.v || 4) === 1 ? 4 : (ex.v || 4) - 1; else ex.f = ex.f === tool ? '' : tool;
      exs[s] = ex.f || ex.v < 4 ? ex : 0; save(); draw(); preview(ch === NOISE ? voice[s] : LOW + voice[s] + (CH[ch][2] === 'tri' ? -12 : 0), exs[s]); return;
    }
    if (voice[s] === val && s === i) { snap(); clearAt(i); save(); draw(); return; }
    if (ch !== NOISE && song.snapScale && !inScale(val)) return;
    snap(); clearAt(i); voice[i] = val; drag = {i}; try { can.setPointerCapture(e.pointerId); } catch {} preview(ch === NOISE ? val : LOW + val + (CH[ch][2] === 'tri' ? -12 : 0)); save(); draw();
  };
  can.onpointermove = e => { if (!drag || ch === NOISE) return; const [i] = cell(e), voice = song.pats[pat][ch];
    for (let k = drag.i + 1; k < STEPS; k++) { if (k <= i) { if (voice[k] >= 0) break; voice[k] = -2; } else if (voice[k] === -2) voice[k] = -1; else break; } draw(); };
  can.onpointerup = () => { if (drag) { drag = null; save(); } };
  // ---------- le son ----------
  let ac = null, playing = false, playPat = 'A', playStep = -1, startT = 0, sched = null, master = null, an = null, raf = 0, curOrder = [];
  const getAC = () => { if (!ac) { ac = new AudioContext(); an = ac.createAnalyser(); an.fftSize = 512; an.connect(ac.destination); } if (ac.state === 'suspended') ac.resume(); return ac; };
  function preview(m, ex = 0) { const a = getAC(), g2 = a.createGain(); g2.gain.value = .5; g2.connect(an); const one = {...song, bpm: 240, order: ['X'], solo: -1, mute: [], pats: {X: empty()}, ex: {X: emptyEx()}};
    one.pats.X[ch][0] = ch === NOISE ? m : m - LOW - (CH[ch][2] === 'tri' ? -12 : 0); one.pats.X[ch][1] = ch === NOISE ? -1 : -2; one.ex.X[ch][0] = ex; schedule(a, g2, one, a.currentTime + .01); setTimeout(() => g2.disconnect(), 900); }
  function start() {
    stopIt(); const a = getAC(); master = a.createGain(); master.connect(an); curOrder = loopPat ? [pat] : song.order.length ? song.order : [pat];
    startT = a.currentTime + .08; sched = schedule(a, master, {...song, order: curOrder}, startT); playing = true; play.textContent = '❚❚ Pause'; tick();
  }
  function stopIt() { playing = false; playStep = -1; cancelAnimationFrame(raf); if (master) { const m = master; m.gain.setValueAtTime(m.gain.value, ac.currentTime); m.gain.linearRampToValueAtTime(0, ac.currentTime + .03); setTimeout(() => m.disconnect(), 80); master = null; } play.textContent = '▶ Jouer'; draw(); drawScope(); }
  const buf = new Uint8Array(512);
  function drawScope() { sg.fillStyle = '#0b0816'; sg.fillRect(0, 0, 160, 40); sg.fillStyle = '#3a2f5a'; sg.fillRect(0, 20, 160, 1); if (!an || !playing) return; an.getByteTimeDomainData(buf); sg.fillStyle = CH[ch][1]; for (let x = 0; x < 160; x++) { const v = buf[Math.floor(x * 512 / 160)]; sg.fillRect(x, Math.round((255 - v) / 255 * 38) + 1, 1, 2); } }
  function tick() { if (!playing || !view.isConnected) return; const s = Math.floor((ac.currentTime - startT) / sched.step); if (s >= sched.steps) { start(); return; }  // en boucle
    if (s >= 0) { const np = curOrder[Math.floor(s / STEPS)], ns = s % STEPS; playPat = np; if (ns !== playStep) { playStep = ns; if (pat !== playPat) { pat = playPat; drawTop(); } draw(); } }
    drawScope(); raf = requestAnimationFrame(tick); }
  play.onclick = () => playing ? stopIt() : start();
  bpm.oninput = () => { song.bpm = +bpm.value; drawTop(); save(); }; bpm.onchange = () => { if (playing) start(); };
  swing.oninput = () => { song.swing = +swing.value; drawTop(); save(); }; swing.onchange = () => { if (playing) start(); };
  order.oninput = () => { const v = order.value.toUpperCase().replace(/[^A-H]/g, '').slice(0, 64); if (v !== order.value) order.value = v; song.order = v.split(''); save(); draw(); };
  // ---------- les fichiers : WAV, MIDI, morceau, exemples ----------
  const dl = (bytes, type, name) => { const a = el('a'); a.href = URL.createObjectURL(new Blob([bytes], {type})); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  async function renderWav() { const o = song.order.length ? song.order : [pat], dur = o.length * STEPS * 15 / song.bpm + 1.5, oc = new OfflineAudioContext(2, Math.ceil(44100 * dur), 44100);
    schedule(oc, oc.destination, {...song, order: o}, 0); return {bytes: wav(await oc.startRendering()), dur}; }
  const wavB = btn('Exporter WAV', async () => { wavB.disabled = true; const {bytes, dur} = await renderWav(); wavB.disabled = false; dl(bytes, 'audio/wav', 'bittune.wav'); toast('WAV prêt (' + Math.round(dur) + ' s)'); });
  const midB = btn('Exporter MIDI', () => { dl(midi(song), 'audio/midi', 'bittune.mid'); toast('MIDI prêt : 5 voies, les percussions sur la voie 10'); });
  const fileIn = el('input'); fileIn.type = 'file'; fileIn.accept = '.json,.bittune,application/json'; fileIn.hidden = true;
  fileIn.onchange = async () => { const f = fileIn.files[0]; fileIn.value = ''; if (!f) return; try { const j = JSON.parse(await f.text()); if (!j.pats || !j.bpm) throw 0; snap(); song = migrate(j); save(); all(); toast('Morceau ouvert : ' + f.name); } catch { toast('Ce fichier n\'est pas un morceau BitTune'); } };
  const exSel = el('select', 'f'); exSel.append(el('option', '', 'Exemples…')); for (const k of ['Départ', 'Aventure', 'Donjon']) { const o = el('option', '', k); o.value = k; exSel.append(o); }
  exSel.onchange = async () => { const k = exSel.value; exSel.selectedIndex = 0; if (!k || !(await ctx.host.confirm?.('Remplacer le morceau par l\'exemple « ' + k + ' » ? (Ctrl+Z pour revenir)') ?? true)) return; snap(); stopIt(); song = example(k); save(); all(); };
  files.append(wavB, midB, btn('Enregistrer le morceau', () => dl(JSON.stringify(song), 'application/json', 'morceau.bittune.json')), btn('Ouvrir un morceau', () => fileIn.click()), fileIn, exSel);
  const onKey = e => {
    if (!view.isConnected) { document.removeEventListener('keydown', onKey); return; } if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
    if (e.code === 'Space' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); playing ? stopIt() : start(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(hist, redo); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); undo(redo, hist); }
  };
  document.addEventListener('keydown', onKey);
  ctx.onClose?.(() => { stopIt(); document.removeEventListener('keydown', onKey); ac?.close(); });
  function all() { drawTop(); drawChans(); draw(); }
  view.__bt = {get song() { return song; }, midi: () => midi(song), renderWav, example, undo: () => undo(hist, redo), setTool: t => { tool = t; drawTools(); }, setCh: c => { ch = c; drawChans(); draw(); }, setPat: p => { pat = p; drawTop(); draw(); }};
  all(); drawScope(); box.scrollTop = 9 * RH;  // la grille s'ouvre vers le milieu (do4 à do5)
}
