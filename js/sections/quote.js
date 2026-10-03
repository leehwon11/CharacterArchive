import { $, $$, iconBtn, richHTML, bindRich } from '../ui.js';
import { load, saveData, add, remove, move } from './list.js';

export default async function quote({ el, c, head }) {
  const rows = await load(c, 'quote');
  const draw = () => {
    el.innerHTML = `
      ${head('<button class="btn sm solid" data-act="add">+ 대사</button>')}
      ${rows.length ? `<div class="cards">${rows.map((r, i) => `
        <article class="card quote" data-id="${r.id}">
          <div style="display:flex;gap:12px;align-items:flex-start">
            <span aria-hidden="true" style="font-family:var(--serif);font-size:40px;line-height:1;color:var(--c)">“</span>
            <div style="flex:1;display:flex;flex-direction:column;gap:6px;min-width:0">
              ${richHTML('text', r.data.text, '대사')}
              ${richHTML('context', r.data.context, '상황 · 말투 특징', 'ctx')}
            </div>
            <div class="order">${iconBtn('up', '위로', 'up', '', `data-i="${i}"`)}${iconBtn('down', '아래로', 'down', '', `data-i="${i}"`)}${iconBtn('del', '대사 삭제', 'del', 'del')}</div>
          </div>
        </article>`).join('')}</div>` : `<div class="empty"><b>대사가 없어요</b>말버릇이 드러나는 한마디를 모아보세요.</div>`}`;
    $(el, '[data-act=add]').onclick = async () => { const r = await add(c, 'quote', { text: '', context: '' }, rows); if (r) { draw(); $(el, `[data-id="${r.id}"] .rich`)?.focus(); } };
    $$(el, '.card').forEach((card) => {
      const r = rows.find((x) => x.id === card.dataset.id);
      bindRich(card, (k, html) => { r.data[k] = html; saveData(r); });
      $(card, '[data-act=del]').onclick = async () => { if (await remove(rows, r, '이 대사를 지울까요?')) draw(); };
      $$(card, '[data-act=up],[data-act=down]').forEach((b) => (b.onclick = async () => { if (await move(rows, +b.dataset.i, b.dataset.act === 'up' ? -1 : 1)) draw(); }));
    });
  };
  draw();
}
