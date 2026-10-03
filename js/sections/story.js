import { esc, $, $$, iconBtn, richHTML, bindRich, formModal, today } from '../ui.js';
import { load, saveData, add, remove, move, tagColor, tagsOf } from './list.js';

const filterBy = {};
const folded = new Set();

export default async function story({ el, c, head }) {
  const rows = await load(c, 'story');
  const draw = () => {
    const f = filterBy[c.id] || '전체';
    const tags = tagsOf(rows);
    const shown = rows.filter((r) => f === '전체' || r.data.tag === f);
    el.innerHTML = `
      ${head('<button class="btn sm solid" data-act="add">+ 썰 · 스토리</button>')}
      <div class="toolbar">${['전체', ...tags].map((t) => `<button class="chip ${t === f ? 'on' : ''}" data-tag="${esc(t)}" aria-pressed="${t === f}">${esc(t)}</button>`).join('')}</div>
      ${shown.length ? `<div class="cards">${shown.map((r) => {
        const d = r.data, i = rows.indexOf(r), fold = folded.has(r.id);
        return `<article class="card" data-id="${r.id}">
          <div class="card-top">
            <span class="tagstamp" style="color:${tagColor(d.tag)}">${esc(d.tag || '썰')}</span>
            <label class="hide" for="st-${r.id}">제목</label>
            <input id="st-${r.id}" class="title" data-k="title" value="${esc(d.title)}" placeholder="제목">
            <span class="meta">${esc(d.date || '')}</span>
            <button class="btn sm ghost" data-act="fold" aria-expanded="${!fold}">${fold ? '펼치기' : '접기'}</button>
            ${iconBtn('up', '위로', 'up', '', `data-i="${i}"`)}${iconBtn('down', '아래로', 'down', '', `data-i="${i}"`)}${iconBtn('del', '삭제', 'del', 'del')}
          </div>
          <div ${fold ? 'hidden' : ''} style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;gap:12px;flex-wrap:wrap">
              <label class="hide" for="sg-${r.id}">장르</label><input id="sg-${r.id}" class="sub" style="flex:1;min-width:140px" data-k="genre" value="${esc(d.genre)}" placeholder="장르 / AU">
              <label class="hide" for="sc-${r.id}">공동 등장</label><input id="sc-${r.id}" class="sub" style="flex:2;min-width:180px" data-k="chars" value="${esc(d.chars)}" placeholder="공동 등장 캐릭터">
            </div>
            ${richHTML('text', d.text, '내용을 자유롭게…')}
          </div>
        </article>`;
      }).join('')}</div>` : `<div class="empty"><b>썰 · 스토리가 없어요</b>짧은 썰은 태그로, 긴 스토리는 접어서 정리해요.</div>`}`;

    $(el, '[data-act=add]').onclick = async () => {
      const v = await formModal('썰 · 스토리 추가', [
        { name: 'tag', label: '태그 / 폴더', ph: '썰, AU, 본편…', hints: tags, value: f !== '전체' ? f : '' },
        { name: 'title', label: '제목' },
      ], { okLabel: '추가' });
      if (!v) return;
      const r = await add(c, 'story', { tag: v.tag || '썰', title: v.title, genre: '', chars: '', text: '', date: today() }, rows, true);
      if (r) { draw(); $(el, `[data-id="${r.id}"] .rich`)?.focus(); }
    };
    $$(el, '[data-tag]').forEach((b) => (b.onclick = () => { filterBy[c.id] = b.dataset.tag; draw(); }));
    $$(el, '.card').forEach((card) => {
      const r = rows.find((x) => x.id === card.dataset.id);
      $$(card, 'input[data-k]').forEach((i) => (i.oninput = () => { r.data[i.dataset.k] = i.value; saveData(r); }));
      bindRich(card, (k, html) => { r.data[k] = html; saveData(r); });
      $(card, '[data-act=fold]').onclick = () => { folded.has(r.id) ? folded.delete(r.id) : folded.add(r.id); draw(); };
      $(card, '[data-act=del]').onclick = async () => { if (await remove(rows, r, `“${r.data.title || '제목 없음'}”을(를) 지울까요?`)) draw(); };
      $$(card, '[data-act=up],[data-act=down]').forEach((b) => (b.onclick = async () => { if (await move(rows, +b.dataset.i, b.dataset.act === 'up' ? -1 : 1)) draw(); }));
    });
  };
  draw();
}
