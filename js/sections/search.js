import { state, SECTIONS } from '../app.js';
import { db } from '../db.js';
import { esc, modal, plain, hilite, guard } from '../ui.js';
import { PROFILE } from './profile.js';
import { INNER } from './inner.js';

const SEC_OF = { memo: 'memo', timeline: 'timeline', quote: 'quote', story: 'story' };
const label = (k) => (SECTIONS.find(([s]) => s === k) || [k, k])[1];

export async function openSearch(q) {
  const entries = await guard(() => db.allEntries());
  if (!entries) return;
  const ql = q.toLowerCase();
  const hits = [];
  const snip = (text) => {
    const t = plain(text).replace(/\s+/g, ' ');
    const i = t.toLowerCase().indexOf(ql);
    return i < 0 ? null : (i > 30 ? '…' : '') + t.slice(Math.max(0, i - 30), i + 60) + (t.length > i + 60 ? '…' : '');
  };
  for (const c of state.chars) {
    const base = [c.name, c.genre, c.intro].join(' ');
    if (base.toLowerCase().includes(ql)) hits.push({ c, sec: 'profile', where: '이름 · 소개', text: base });
    for (const [tab, [tl, fields]] of Object.entries(PROFILE))
      for (const [k, l] of fields) { const s = snip(c.profile?.[k]); if (s) hits.push({ c, sec: 'profile', sub: tab, where: `프로필 · ${tl} · ${l}`, text: s }); }
    for (const [g, fields] of INNER)
      for (const [k, l] of fields) { const s = snip(c.inner_data?.[k]); if (s) hits.push({ c, sec: 'inner', where: `내면 · ${l}`, text: s }); }
  }
  for (const e of entries) {
    const c = state.chars.find((x) => x.id === e.char_id); const sec = SEC_OF[e.section];
    if (!c || !sec) continue;
    const s = snip(Object.values(e.data).filter((v) => typeof v === 'string').join(' \n '));
    if (s) hits.push({ c, sec, where: label(sec) + (e.data.title ? ` · ${e.data.title}` : ''), text: s });
  }
  const m = modal(`<h3>“${esc(q)}” 검색 결과 ${hits.length}건</h3>
    <div class="results">${hits.length ? hits.slice(0, 200).map((h) => `
      <a href="#/c/${h.c.id}/${h.sec}${h.sub ? '/' + h.sub : ''}">
        <div class="where">${esc(h.c.name)} · ${esc(h.where)}</div>
        <div>${hilite(h.text, q)}</div></a>`).join('') : '<p class="muted">찾는 내용이 없어요</p>'}</div>
    <div class="m-acts"><button class="btn solid" data-x>닫기</button></div>`, { wide: true });
  m.el.querySelector('[data-x]').onclick = m.close;
  m.el.querySelectorAll('.results a').forEach((a) => a.addEventListener('click', m.close));
}
