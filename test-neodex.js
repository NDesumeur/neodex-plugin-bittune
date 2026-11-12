// lancé par le test « local » de NeoDex : le morceau de départ, une note posée et tenue dans le motif B, un effet, annuler, la 5e voie, l'ordre, MIDI et WAV, la lecture
module.exports = async ({ pj, sleep }) => {
  const run = async code => { const r = await pj(code); if (r && r.err) throw new Error(r.err); return r; };
  const st = () => pj(`document.getElementById('bt_status').textContent`);
  const notes = async () => +(/([0-9]+) notes/.exec(await st()) || [])[1];
  await sleep(600);
  const n0 = await notes(); if (!(n0 > 40)) throw new Error('au départ : ' + await st());
  await pj(`document.querySelector('[data-pat=B]').click(), 0`);
  const click = (i, row, move) => pj(`(() => { const c = document.getElementById('bt_grid'), r = c.getBoundingClientRect(), k = r.width / c.width, P = (i, row) => ({clientX: r.left + (50 + i * 22 + 11) * k, clientY: r.top + (16 + row * 13 + 6) * k, button: 0, bubbles: true, pointerId: 1});
    c.dispatchEvent(new PointerEvent('pointerdown', P(${i}, ${row}))); c.dispatchEvent(new PointerEvent('pointermove', P(${move ?? i}, ${row}))); c.dispatchEvent(new PointerEvent('pointerup', P(${move ?? i}, ${row}))); })(), 0`);
  await click(0, 12, 3); await sleep(100);
  if (await notes() !== n0 + 1) throw new Error('note posée : ' + await st());
  const held = await pj(`document.querySelector('.btWrap').parentNode.parentNode.parentNode.__bt.song.pats.B[0].slice(0, 5).join()`);
  if (held !== '24,-2,-2,-2,-1') throw new Error('note tenue : ' + held);
  // l'outil vibrato sur cette note, puis annuler
  await pj(`document.querySelector('[data-tool=v]').click(), 0`); await click(1, 12); await sleep(50);
  const bt = `document.querySelector('.btWrap').parentNode.parentNode.parentNode.__bt`;
  if (await pj(`${bt}.song.ex.B[0][0].f`) !== 'v') throw new Error('vibrato non posé');
  await pj(`${bt}.undo(), 0`); if (await pj(`${bt}.song.ex.B[0][0] ? 1 : 0`)) throw new Error('annuler le vibrato');
  await pj(`document.querySelector('[data-tool=""]').click(), 0`);
  // la dent de scie (5e voie)
  await pj(`document.querySelector('[data-ch="4"]').click(), 0`); await click(4, 10); await sleep(50);
  if (await pj(`${bt}.song.pats.B[4][4]`) !== 26) throw new Error('dent de scie : ' + await pj(`${bt}.song.pats.B[4].join()`));
  await pj(`(() => { const o = document.querySelector('.btOrder'); o.value = 'ABH'; o.dispatchEvent(new Event('input')); })(), 0`);
  if (!/3 × 32/.test(await st())) throw new Error('ordre : ' + await st());
  const files = await run(`(async () => { try { const b = ${bt}, m = b.midi(), w = await b.renderWav();
    if (String.fromCharCode(...m.slice(0, 4)) !== 'MThd' || String.fromCharCode(...m.slice(14, 18)) !== 'MTrk') return {err: 'MIDI : en-tête'};
    if (String.fromCharCode(...w.bytes.slice(8, 12)) !== 'WAVE' || w.bytes.length < 44100 * 4) return {err: 'WAV : ' + w.bytes.length};
    let peak = 0; const d = new DataView(w.bytes.buffer); for (let i = 44; i < w.bytes.length; i += 2) peak = Math.max(peak, Math.abs(d.getInt16(i, true)));
    return {midi: m.length, wav: Math.round(w.dur), peak}; } catch (e) { return {err: e.message}; } })()`);
  if (!(files.peak > 1000)) throw new Error('WAV silencieux : ' + files.peak);
  await pj(`document.getElementById('bt_play').click(), 0`); await sleep(1200);
  if (!/Pause/.test(await pj(`document.getElementById('bt_play').textContent`))) throw new Error('lecture');
  await pj(`document.querySelector('[data-pat=A]').click(), 0`);
  return 'note tenue, vibrato, annuler, dent de scie, ordre, MIDI ' + files.midi + ' octets, WAV ' + files.wav + ' s, lecture ok';
};
