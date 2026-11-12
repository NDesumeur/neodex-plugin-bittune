// BitTune : composer de la musique chiptune sur une grille. 4 voies comme les vieilles consoles (deux carrées, une triangle, un bruit),
// 4 motifs de 32 pas enchaînés dans un ordre libre, tempo, volume et forme d'onde par voie. Lecture en direct et export WAV.
const CSS = `
.btTop{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px}
.btTop .btn{width:auto;margin:0;padding:4px 12px}
.btTop .f{width:auto;margin:0}
.btCh{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}
.btCh .btn{width:auto;margin:0;padding:4px 10px}
.btCh .btn i{display:inline-block;width:10px;height:10px;margin-right:6px;border:1px solid #000}
.btWrap{overflow:auto;border:2px solid var(--line);background:#0b0816;max-height:440px}
.btCan{display:block;image-rendering:pixelated;cursor:crosshair}
.btRow{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}
.btRow .btn{width:auto;margin:0;padding:4px 10px}
.btRange{-webkit-appearance:none;appearance:none;height:10px;background:var(--bg0);border:2px solid var(--line);outline:none;width:120px}
.btRange::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:22px;background:var(--magenta);border:2px solid #000;cursor:var(--cp,pointer)}
.btOrder{font:14px monospace;letter-spacing:2px;width:180px!important;text-transform:uppercase}
.btHelp{font-size:12px;color:var(--lilac);margin-top:6px}
`;
const STEPS = 32, NOTES = 25, LOW = 48;  // 25 notes : do3 à do5 (MIDI 48 à 72)
const CH = [['Carré 1', '#ff4fb0', 'pulse'], ['Carré 2', '#4fc3ff', 'pulse'], ['Triangle', '#ffd34f', 'triangle'], ['Bruit', '#9ae06a', 'noise']];
const DRUMS = ['Grosse caisse', 'Caisse claire', 'Charleston', 'Cymbale'];
const NAMES = ['do', 'do#', 'ré', 'ré#', 'mi', 'fa', 'fa#', 'sol', 'sol#', 'la', 'la#', 'si'];
const hz = m => 440 * 2 ** ((m - 69) / 12);
// une onde carrée à rapport cyclique variable (12,5 %, 25 %, 50 %), comme les consoles 8 bits
function pulseWave(ac, duty) { const n = 32, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) im[k] = 2 / (k * Math.PI) * Math.sin(k * Math.PI * duty) * 2, re[k] = 0; return ac.createPeriodicWave(re, im); }
function triWave(ac) { const n = 32, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k += 2) im[k] = 8 / (Math.PI * Math.PI * k * k) * (((k - 1) / 2) % 2 ? -1 : 1); return ac.createPeriodicWave(re, im); }
// programme tous les sons d'un morceau dans un contexte audio (en direct ou hors ligne pour le WAV)
function schedule(ac, dest, song, t0, fromStep = 0) {
  const step = 60 / song.bpm / 4, waves = {tri: triWave(ac)}, noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), nd = noise.getChannelData(0);
  let lfsr = 1; for (let i = 0; i < nd.length; i++) { const b = (lfsr ^ (lfsr >> 1)) & 1; lfsr = (lfsr >> 1) | (b << 14); nd[i] = (lfsr & 1) * 2 - 1; }  // bruit à registre, comme la NES
  const order = song.order.filter(p => song.pats[p]); let s = 0, n = 0;
  for (const p of order) for (let i = 0; i < STEPS; i++, s++) {
    if (s < fromStep) continue;
    const t = t0 + (s - fromStep) * step;
    song.pats[p].forEach((voice, c) => {
      const v = voice[i]; if (v < 0) return; const vol = song.vol[c] * .22; if (!vol) return; n++;
      const g = ac.createGain(); g.connect(dest);
      if (c === 3) { const src = ac.createBufferSource(); src.buffer = noise; const f = ac.createBiquadFilter(); f.type = v === 0 ? 'lowpass' : 'highpass'; f.frequency.value = [180, 1200, 7000, 4000][v];
        const len = [.18, .14, .04, .4][v]; src.playbackRate.value = v === 0 ? .25 : 1; src.connect(f); f.connect(g); g.gain.setValueAtTime(vol * (v === 0 ? 2.2 : 1), t); g.gain.exponentialRampToValueAtTime(.001, t + len); src.start(t); src.stop(t + len + .02); return; }
      const o = ac.createOscillator(), key = c === 2 ? 'tri' : 'p' + song.duty[c];
      waves[key] = waves[key] || pulseWave(ac, song.duty[c]); o.setPeriodicWave(waves[key]); o.frequency.value = hz(LOW + v + (c === 2 ? -12 : 0));
      let len = step; for (let k = i + 1; k < STEPS && voice[k] === -2; k++) len += step;  // -2 : la note est tenue
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .005); g.gain.setValueAtTime(vol, t + len * .85); g.gain.linearRampToValueAtTime(0, t + len * .98);
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
const empty = () => [0, 1, 2, 3].map(() => Array(STEPS).fill(-1));
function demo() {  // un petit air de départ en la mineur
  const p = empty(), mel = [12, -1, 15, -1, 19, -2, 17, -1, 15, -1, 14, -1, 12, -2, -2, -1, 10, -1, 12, -1, 14, -2, 15, -1, 14, -1, 12, -1, 9, -2, -2, -1];
  p[0] = mel; for (let i = 0; i < STEPS; i += 4) p[1][i] = [0, 0, 3, 3, 5, 5, 4, 4][i / 4] + 12; for (let i = 0; i < STEPS; i += 8) { p[2][i] = [9, 5, 0, 4][i / 8]; p[2][i + 1] = -2; p[2][i + 2] = -2; p[2][i + 3] = -2; }
  for (let i = 0; i < STEPS; i += 2) p[3][i] = i % 8 === 0 ? 0 : i % 8 === 4 ? 1 : 2; return p;
}
export default async function (ctx) {
  const view = ctx.view;
  if (!ctx.host) { view.textContent = "Ce plugin doit être approuvé par NeoDex pour s'ouvrir."; return; }
  const { el, toast } = ctx.host;
  ctx.host.addStyle(CSS);
  let data = null; try { data = await ctx.folder.read('bittune'); } catch {}
  const song = data?.pats ? data : {bpm: 120, pats: {A: demo(), B: empty(), C: empty(), D: empty()}, order: ['A', 'A'], vol: [1, .7, 1, .8], duty: [.25, .5, .5, .5]};
  let pat = 'A', ch = 0, saveT = 0;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => ctx.folder.write('bittune', song).catch(() => {}), 500); };
  // vérification : le morceau de départ se programme hors ligne et fait du son, le WAV a le bon en-tête
  (async () => { const oc = new OfflineAudioContext(1, 22050, 22050), r = schedule(oc, oc.destination, {...song, bpm: 240, pats: {A: demo()}, order: ['A']}, 0), b = await oc.startRendering(), d = b.getChannelData(0), w = wav(b);
    let peak = 0; for (const v of d) peak = Math.max(peak, Math.abs(v)); console.assert(r.notes > 40 && peak > .05 && peak <= 1.5 && w.length === 44 + 22050 * 2 && String.fromCharCode(...w.slice(8, 12)) === 'WAVE', 'bittune : rendu ' + peak); })();
  // ---------- l'interface ----------
  view.innerHTML = '';
  const wrap = el('div', 'appWrap'), head = el('div', 'agHead'), top = el('div', 'btTop'), chans = el('div', 'btCh'), card = el('div', 'sysCard px'), mix = el('div', 'btRow');
  head.append(el('span', 'label', 'BitTune · musique chiptune')); wrap.append(head, top, card); view.append(wrap);
  const box = el('div', 'btWrap'), can = el('canvas', 'btCan'), g = can.getContext('2d'); can.id = 'bt_grid'; box.append(can);
  const status = el('p', 'btHelp'); status.id = 'bt_status';
  card.append(chans, box, mix, status, el('p', 'btHelp', 'Clic : poser une note · glisser vers la droite : la tenir · clic droit : effacer · Espace : lecture.'));
  const play = el('button', 'btn px main', '▶ Jouer'), stop = el('button', 'btn px', '■'), bpm = el('input', 'btRange'), bpmL = el('span', 'hint'), order = el('input', 'f btOrder'), wavB = el('button', 'btn px', 'Exporter WAV'), clr = el('button', 'btn px', 'Vider le motif');
  play.id = 'bt_play'; bpm.type = 'range'; bpm.min = 60; bpm.max = 240; bpm.value = song.bpm; order.value = song.order.join(''); order.title = 'L\'ordre des motifs, par exemple AABA'; order.translate = false;
  const patBtns = el('span'); top.append(play, stop, el('span', 'hint', 'Tempo'), bpm, bpmL, el('span', 'hint', 'Motif'), patBtns, el('span', 'hint', 'Ordre'), order, clr, wavB);
  function drawTop() { bpmL.textContent = song.bpm + ' bpm'; patBtns.replaceChildren(...'ABCD'.split('').map(p => { const b = el('button', 'btn px' + (p === pat ? ' main' : ''), p); b.style.cssText = 'width:auto;margin:0 2px;padding:4px 10px'; b.dataset.pat = p; b.onclick = () => { pat = p; drawTop(); draw(); }; return b; })); }
  function drawChans() {
    chans.replaceChildren(...CH.map(([n, col], i) => { const b = el('button', 'btn px' + (i === ch ? ' main' : '')), sw = el('i'); sw.style.background = col; b.append(sw, el('span', '', n)); b.dataset.ch = i; b.onclick = () => { ch = i; drawChans(); draw(); }; return b; }));
    mix.replaceChildren(el('span', 'hint', 'Volume'));
    const v = el('input', 'btRange'); v.type = 'range'; v.min = 0; v.max = 1; v.step = .05; v.value = song.vol[ch]; v.oninput = () => { song.vol[ch] = +v.value; save(); }; mix.append(v);
    if (ch < 2) { mix.append(el('span', 'hint', 'Forme')); for (const d of [.125, .25, .5]) { const b = el('button', 'btn px' + (song.duty[ch] === d ? ' main' : ''), d * 100 + ' %'); b.title = 'Rapport cyclique de l\'onde carrée'; b.onclick = () => { song.duty[ch] = d; save(); drawChans(); preview(LOW + 12); }; mix.append(b); } }
  }
  // ---------- la grille ----------
  const CW = 22, RH = 14, LEFT = 44;
  const rows = () => ch === 3 ? DRUMS.length : NOTES;
  function draw() {
    const R = rows(), H = R * RH; can.width = LEFT + STEPS * CW; can.height = H + 16;
    g.fillStyle = '#0b0816'; g.fillRect(0, 0, can.width, can.height);
    g.font = '10px monospace'; g.textBaseline = 'middle';
    for (let r = 0; r < R; r++) { const y = 16 + r * RH, val = ch === 3 ? r : NOTES - 1 - r, black = ch !== 3 && [1, 3, 6, 8, 10].includes(val % 12);
      g.fillStyle = black ? '#100c1e' : '#16122a'; g.fillRect(LEFT, y, STEPS * CW, RH - 1);
      g.fillStyle = black ? '#5a4a8a' : '#c8b8f0'; g.fillText(ch === 3 ? DRUMS[r].slice(0, 6) : NAMES[val % 12] + (3 + Math.floor(val / 12) - (ch === 2 ? 1 : 0)), 2, y + RH / 2); }
    for (let i = 0; i < STEPS; i++) { g.fillStyle = i % 4 ? '#241c40' : '#3a2f5a'; g.fillRect(LEFT + i * CW, 16, 1, R * RH); if (i % 4 === 0) { g.fillStyle = '#8a7aa8'; g.fillText(String(i / 4 + 1), LEFT + i * CW + 3, 8); } }
    // les autres voies, en pâle, pour se repérer
    song.pats[pat].forEach((voice, c) => { if (c === ch || c === 3 || ch === 3) return; g.fillStyle = CH[c][1] + '33'; voice.forEach((v, i) => { if (v >= 0) g.fillRect(LEFT + i * CW + 2, 16 + (NOTES - 1 - v) * RH + 3, CW - 4, RH - 7); }); });
    const voice = song.pats[pat][ch], col = CH[ch][1];
    voice.forEach((v, i) => { if (v < 0) return; let len = 1; while (i + len < STEPS && voice[i + len] === -2) len++; const r = ch === 3 ? v : NOTES - 1 - v;
      g.fillStyle = '#000'; g.fillRect(LEFT + i * CW + 1, 16 + r * RH, len * CW - 1, RH - 1); g.fillStyle = col; g.fillRect(LEFT + i * CW + 2, 16 + r * RH + 1, len * CW - 3, RH - 3); });
    if (playing && playPat === pat && playStep >= 0) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(LEFT + playStep * CW, 16, CW, R * RH); }
    const n = Object.values(song.pats).flat(2).filter(v => v >= 0).length;
    status.replaceChildren(el('span', '', 'Morceau :'), ' ' + song.order.length + ' × 32 ', el('span', '', 'pas'), ' · ' + n + ' ', el('span', '', 'notes'), ' · ' + Math.round(song.order.length * STEPS * 15 / song.bpm) + ' s');
  }
  const cell = e => { const r = can.getBoundingClientRect(), x = (e.clientX - r.left) * can.width / r.width, y = (e.clientY - r.top) * can.height / r.height; return [Math.floor((x - LEFT) / CW), Math.floor((y - 16) / RH)]; };
  let drag = null;
  can.oncontextmenu = e => e.preventDefault();
  can.onpointerdown = e => {
    const [i, r] = cell(e); if (i < 0 || i >= STEPS || r < 0 || r >= rows()) return; const voice = song.pats[pat][ch], val = ch === 3 ? r : NOTES - 1 - r;
    // effacer la note (et sa tenue) qui couvre ce pas
    const clearAt = k => { let s = k; while (s > 0 && voice[s] === -2) s--; if (voice[s] < 0) return false; voice[s] = -1; for (let q = s + 1; q < STEPS && voice[q] === -2; q++) voice[q] = -1; return true; };
    if (e.button === 2) { clearAt(i); save(); draw(); return; }
    let s = i; while (s > 0 && voice[s] === -2) s--;
    if (voice[s] === val && s === i) { clearAt(i); save(); draw(); return; }
    clearAt(i); voice[i] = val; drag = {i}; try { can.setPointerCapture(e.pointerId); } catch {} preview(ch === 3 ? val : LOW + val + (ch === 2 ? -12 : 0)); save(); draw();
  };
  can.onpointermove = e => { if (!drag || ch === 3) return; const [i] = cell(e), voice = song.pats[pat][ch];
    for (let k = drag.i + 1; k < STEPS; k++) { if (k <= i) { if (voice[k] >= 0) break; voice[k] = -2; } else if (voice[k] === -2) voice[k] = -1; else break; } draw(); };
  can.onpointerup = () => { if (drag) { drag = null; save(); } };
  // ---------- le son ----------
  let ac = null, playing = false, playPat = 'A', playStep = -1, startT = 0, sched = null, master = null, raf = 0;
  const getAC = () => { if (!ac) { ac = new AudioContext(); } if (ac.state === 'suspended') ac.resume(); return ac; };
  function preview(m) { const a = getAC(), g2 = a.createGain(); g2.gain.value = .5; g2.connect(a.destination); const one = {bpm: 240, order: ['X'], vol: song.vol, duty: song.duty, pats: {X: empty()}}; one.pats.X[ch][0] = ch === 3 ? m : m - LOW - (ch === 2 ? -12 : 0); schedule(a, g2, one, a.currentTime + .01); setTimeout(() => g2.disconnect(), 800); }
  function start() {
    stopIt(); const a = getAC(); master = a.createGain(); master.connect(a.destination); song.order = order.value.toUpperCase().replace(/[^ABCD]/g, '').split('').slice(0, 64); if (!song.order.length) song.order = [pat];
    startT = a.currentTime + .08; sched = schedule(a, master, song, startT); playing = true; play.textContent = '❚❚ Pause'; tick();
  }
  function stopIt() { playing = false; playStep = -1; cancelAnimationFrame(raf); if (master) { const m = master; m.gain.setValueAtTime(m.gain.value, ac.currentTime); m.gain.linearRampToValueAtTime(0, ac.currentTime + .03); setTimeout(() => m.disconnect(), 80); master = null; } play.textContent = '▶ Jouer'; draw(); }
  function tick() { if (!playing || !view.isConnected) return; const s = Math.floor((ac.currentTime - startT) / sched.step); if (s >= sched.steps) { start(); return; }  // en boucle
    if (s >= 0) { const np = song.order[Math.floor(s / STEPS)], ns = s % STEPS; if (np !== playPat && playStep >= 0) { pat = np; drawTop(); } playPat = np; if (ns !== playStep) { playStep = ns; if (pat !== playPat) { pat = playPat; drawTop(); } draw(); } }
    raf = requestAnimationFrame(tick); }
  play.onclick = () => playing ? stopIt() : start();
  stop.onclick = stopIt;
  bpm.oninput = () => { song.bpm = +bpm.value; drawTop(); save(); }; bpm.onchange = () => { if (playing) start(); };
  order.oninput = () => { const v = order.value.toUpperCase().replace(/[^ABCD]/g, ''); if (v !== order.value) order.value = v; song.order = v.split(''); save(); draw(); };
  clr.onclick = async () => { if (!(await ctx.host.confirm?.('Vider le motif ' + pat + ' (les 4 voies) ?') ?? true)) return; song.pats[pat] = empty(); save(); draw(); };
  wavB.onclick = async () => {
    const o = song.order.length ? song.order : [pat], dur = o.length * STEPS * 15 / song.bpm + 1, oc = new OfflineAudioContext(2, Math.ceil(44100 * dur), 44100);
    wavB.disabled = true; schedule(oc, oc.destination, {...song, order: o}, 0); const b = await oc.startRendering(); wavB.disabled = false;
    const a = el('a'); a.href = URL.createObjectURL(new Blob([wav(b)], {type: 'audio/wav'})); a.download = 'bittune.wav'; document.body.append(a); a.click(); a.remove(); toast('WAV prêt (' + Math.round(dur) + ' s)');
  };
  const onKey = e => { if (!view.isConnected) { document.removeEventListener('keydown', onKey); return; } if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement?.tagName)) { e.preventDefault(); playing ? stopIt() : start(); } };
  document.addEventListener('keydown', onKey);
  ctx.onClose?.(() => { stopIt(); document.removeEventListener('keydown', onKey); ac?.close(); });
  drawTop(); drawChans(); draw();
}
