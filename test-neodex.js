// lancé par le test « local » de NeoDex : le morceau de départ, une note posée et tenue dans le motif B, la lecture
module.exports = async ({ pj, sleep }) => {
  const st = () => pj(`document.getElementById('bt_status').textContent`);
  const notes = async () => +(/([0-9]+) notes/.exec(await st()) || [])[1];
  await sleep(600);
  const n0 = await notes(); if (!(n0 > 40)) throw new Error('au départ : ' + await st());
  await pj(`document.querySelector('[data-pat=B]').click(), 0`);
  await pj(`(() => { const c = document.getElementById('bt_grid'), r = c.getBoundingClientRect(), k = r.width / c.width, P = (i, row) => ({clientX: r.left + (44 + i * 22 + 11) * k, clientY: r.top + (16 + row * 14 + 7) * k, button: 0, bubbles: true, pointerId: 1});
    c.dispatchEvent(new PointerEvent('pointerdown', P(0, 12))); c.dispatchEvent(new PointerEvent('pointermove', P(3, 12))); c.dispatchEvent(new PointerEvent('pointerup', P(3, 12))); })(), 0`); await sleep(100);
  if (await notes() !== n0 + 1) throw new Error('note posée : ' + await st());
  await pj(`(() => { const o = document.querySelector('.btOrder'); o.value = 'AB'; o.dispatchEvent(new Event('input')); })(), 0`);
  if (!/2 × 32/.test(await st())) throw new Error('ordre : ' + await st());
  await pj(`document.getElementById('bt_play').click(), 0`); await sleep(1200);
  if (!/Pause/.test(await pj(`document.getElementById('bt_play').textContent`))) throw new Error('lecture');
  await pj(`document.querySelector('[data-pat=A]').click(), 0`);
  return 'morceau, note tenue, ordre et lecture ok';
};
