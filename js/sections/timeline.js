import { esc, $, $$, iconBtn, richHTML, bindRich } from '../ui.js';
import { load, saveData, add, remove, move } from './list.js';

const DOTS = [['기본', 'var(--c)'], ['초록', '#15803d'], ['주황', '#c2410c'], ['노랑', '#ca8a04'], ['빨강', '#b42318'], ['파랑', '#1d4ed8'], ['회색', '#6d6a62']];
const dotColor = (k) => (DOTS.find(([n]) => n === k) || DOTS[0])[1];

export default async function timeline({ el, c, head }) {
  const rows = await load(c, 'timeline');
  const draw = () => {
    el.innerHTML = `
      ${head('<button class="btn sm solid" data-act="add">+ 사건</button>')}
      ${rows.length ? `<div class="tl">${rows.map((r, i) => `
        <div class="tl-item" data-id="${r.id}">
          <div style="position:relative">
            <button type="button" class="tl-dot" data-act="dot" style="background:${dotColor(r.data.dotColor)}" aria-label="점 색 바꾸기" title="점 색 바꾸기"></button>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;min-width:0">
            <label class="hide" for="td-${r.id}">시기</label><input id="td-${r.id}" class="date" data-k="date" value="${esc(r.data.date)}" placeholder="시기">
            <label class="hide" for="tt-${r.id}">사건</label><input id="tt-${r.id}" class="ttl" data-k="title" value="${esc(r.data.title)}" placeholder="사건 이름">
            ${richHTML('desc', r.data.desc, '설명')}
          </div>
          <div class="order">
            ${iconBtn('up', '위로', 'up', '', `data-i="${i}"`)}${iconBtn('down', '아래로', 'down', '', `data-i="${i}"`)}${iconBtn('del', '사건 삭제', 'del', 'del')}
          </div>
        </div>`).join('')}</div>` : `<div class="empty"><b>아직 사건이 없어요</b>태어난 날부터 지금까지, 굵직한 사건을 순서대로 쌓아보세요.</div>`}`;
    $(el, '[data-act=add]').onclick = async () => { const r = await add(c, 'timeline', { date: '', title: '', desc: '', dotColor: '기본' }, rows); if (r) { draw(); $(el, `#td-${r.id}`)?.focus(); } };
    $$(el, '.tl-item').forEach((item) => {
      const r = rows.find((x) => x.id === item.dataset.id);
      $$(item, 'input[data-k]').forEach((i) => (i.oninput = () => { r.data[i.dataset.k] = i.value; saveData(r); }));
      bindRich(item, (k, html) => { r.data[k] = html; saveData(r); });
      $(item, '[data-act=del]').onclick = async () => { if (await remove(rows, r, '이 사건을 지울까요?')) draw(); };
      $$(item, '[data-act=up],[data-act=down]').forEach((b) => (b.onclick = async () => { if (await move(rows, +b.dataset.i, b.dataset.act === 'up' ? -1 : 1)) draw(); }));
      $(item, '[data-act=dot]').onclick = (e) => {
        const wrap = e.currentTarget.parentElement;
        wrap.querySelector('.dot-pick')?.remove();
        const pick = document.createElement('div');
        pick.className = 'dot-pick';
        pick.innerHTML = DOTS.map(([n, col]) => `<button type="button" data-dc="${n}" style="background:${col}" aria-label="${n}" title="${n}"></button>`).join('');
        wrap.appendChild(pick);
        pick.querySelector('button').focus();
        pick.onclick = (ev) => { const b = ev.target.closest('[data-dc]'); if (!b) return; r.data.dotColor = b.dataset.dc; saveData(r); draw(); };
        setTimeout(() => document.addEventListener('click', function off(ev) { if (!pick.contains(ev.target)) { pick.remove(); document.removeEventListener('click', off); } }), 0);
      };
    });
  };
  draw();
}
