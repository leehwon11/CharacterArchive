import { esc, $, $$, iconBtn, richHTML, bindRich, formModal, toast } from '../ui.js';
import { load, saveData, add, remove, tagColor, tagsOf } from './list.js';

const filterBy = {};

export default async function memo({ el, c, head }) {
  const rows = await load(c, 'memo');
  const draw = () => {
    const f = filterBy[c.id] || '전체';
    const tags = tagsOf(rows);
    const shown = rows.filter((r) => f === '전체' || r.data.tag === f);
    el.innerHTML = `
      ${head('<button class="btn sm solid" data-act="add">+ 메모</button>')}
      <div class="toolbar">${['전체', ...tags].map((t) => `<button class="chip ${t === f ? 'on' : ''}" data-tag="${esc(t)}" aria-pressed="${t === f}">${esc(t)}</button>`).join('')}</div>
      ${shown.length ? `<div class="cards">${shown.map((r) => {
        const d = r.data;
        const links = (d.links || []).map((id) => rows.find((x) => x.id === id)).filter(Boolean);
        return `<article class="card" data-id="${r.id}">
          <div class="card-top">
            <span class="tagstamp" style="color:${tagColor(d.tag)}">${esc(d.tag || '기타')}</span>
            <label class="hide" for="mt-${r.id}">제목</label>
            <input id="mt-${r.id}" class="title" data-k="title" value="${esc(d.title)}" placeholder="제목">
            ${iconBtn('del', '메모 삭제', 'del', 'del')}
          </div>
          ${richHTML('text', d.text, '내용')}
          <label class="hide" for="ms-${r.id}">출처</label>
          <input id="ms-${r.id}" class="sub" data-k="source" value="${esc(d.source)}" placeholder="출처 / 분류 (선택)">
          <div class="links">연결
            ${links.map((l) => `<button class="lk" data-unlink="${l.id}" title="연결 끊기">${esc(l.data.title || l.data.tag || '메모')} ×</button>`).join('')}
            <button class="lk" data-act="link">+ 연결</button>
          </div>
        </article>`;
      }).join('')}</div>` : `<div class="empty"><b>메모가 없어요</b>설정·떡밥·자료를 태그별로 모아두세요.</div>`}`;

    $(el, '[data-act=add]').onclick = async () => {
      const v = await formModal('메모 추가', [
        { name: 'tag', label: '태그', ph: '세계관, 떡밥, 자료…', hints: tags, value: f !== '전체' ? f : '' },
        { name: 'title', label: '제목' },
      ], { okLabel: '추가' });
      if (!v) return;
      const row = await add(c, 'memo', { tag: v.tag || '기타', title: v.title, text: '', source: '', links: [] }, rows);
      if (row) { draw(); $(el, `[data-id="${row.id}"] .rich`)?.focus(); }
    };
    $$(el, '[data-tag]').forEach((b) => (b.onclick = () => { filterBy[c.id] = b.dataset.tag; draw(); }));
    $$(el, '.card').forEach((card) => {
      const r = rows.find((x) => x.id === card.dataset.id);
      $$(card, 'input[data-k]').forEach((i) => (i.oninput = () => { r.data[i.dataset.k] = i.value; saveData(r); }));
      bindRich(card, (k, html) => { r.data[k] = html; saveData(r); });
      $(card, '[data-act=del]').onclick = async () => { if (await remove(rows, r, '이 메모를 지울까요?')) draw(); };
      $$(card, '[data-unlink]').forEach((b) => (b.onclick = () => { r.data.links = r.data.links.filter((x) => x !== b.dataset.unlink); saveData(r); draw(); }));
      $(card, '[data-act=link]').onclick = async () => {
        const others = rows.filter((x) => x.id !== r.id && !(r.data.links || []).includes(x.id));
        if (!others.length) return toast('연결할 다른 메모가 없어요');
        const v = await formModal('메모 연결', [{ name: 'id', label: '연결할 메모', type: 'select', value: others[0].id, options: others.map((x) => [x.id, `[${x.data.tag}] ${x.data.title || '제목 없음'}`]) }], { okLabel: '연결' });
        if (!v) return;
        r.data.links = [...(r.data.links || []), v.id]; saveData(r); draw();
      };
    });
  };
  draw();
}
