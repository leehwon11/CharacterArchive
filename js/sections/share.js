// 공유 링크 만들기 · 열람 화면
import { sb } from '../db.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SITE_NAME } from '../config.js';
import { esc, modal, guard, toast, toRich, inkOn } from '../ui.js';
import { PROFILE } from './profile.js';
import { INNER } from './inner.js';

export const SHARE_SECTIONS = [['profile', '프로필'], ['inner', '내면 · 심리'], ['memo', '설정 메모'], ['timeline', '타임라인'], ['quote', '대사'], ['story', '썰 · 스토리'], ['gallery', '갤러리'], ['graph', '관계도']];
const label = (k) => (SHARE_SECTIONS.find(([x]) => x === k) || [k, k])[1];
const newToken = () => { const b = crypto.getRandomValues(new Uint8Array(18)); return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
export const shareUrl = (t) => `${location.origin}${location.pathname}#/share/${t}`;
const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

export async function openShare(c) {
  let rows = (await guard(async () => ok(await sb.from('shares').select('*').eq('char_id', c.id).order('created_at', { ascending: false })))) || [];
  if (rows === true) rows = [];
  const m = modal('<div></div>', { wide: true });
  const copy = async (t) => { try { await navigator.clipboard.writeText(shareUrl(t)); toast('링크를 복사했어요'); } catch { toast('칸을 길게 눌러 복사해주세요'); } };
  const draw = () => {
    m.el.innerHTML = `
      <h3>${esc(c.name)} · 공유 링크</h3>
      <p class="muted" style="margin:0;font-size:13px">링크를 아는 사람은 로그인 없이 <b>읽기만</b> 할 수 있어요. 고르지 않은 항목은 안 보이고, 링크를 지우면 바로 막혀요. 이름 · 사진 · 한 줄 소개 · 대표 컬러는 항상 보여요.</p>
      <fieldset style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:0">
        <legend class="mono" style="font-size:11px;color:var(--mute);padding:0 6px">보여줄 항목</legend>
        <div class="toolbar">${SHARE_SECTIONS.map(([k, l]) => `<label class="chip" style="display:inline-flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" value="${k}" ${k === 'memo' ? '' : 'checked'}> ${l}</label>`).join('')}</div>
      </fieldset>
      <div class="m-acts"><button class="btn solid" data-new>링크 만들기</button></div>
      <div class="rows">${rows.length ? rows.map((r) => `
        <div class="frow" style="grid-template-columns:1fr">
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <label class="hide" for="u-${esc(r.token)}">공유 링크</label>
            <input id="u-${esc(r.token)}" class="line-input mono" readonly value="${esc(shareUrl(r.token))}" style="flex:1;min-width:180px;font-size:12px">
            <button class="btn sm ghost" data-copy="${esc(r.token)}">복사</button>
            <button class="btn sm danger" data-del="${esc(r.token)}">지우기</button>
          </div>
          <div class="mono muted" style="font-size:11px">${String(r.created_at).slice(0, 10)} · ${(r.sections || []).map(label).join(', ') || '기본 정보만'}</div>
        </div>`).join('') : '<p class="muted" style="font-size:13px">아직 만든 링크가 없어요</p>'}</div>
      <div class="m-acts"><button class="btn ghost" data-x>닫기</button></div>`;
    m.el.querySelector('[data-x]').onclick = m.close;
    m.el.querySelector('[data-new]').onclick = async () => {
      const sections = [...m.el.querySelectorAll('fieldset input:checked')].map((i) => i.value);
      const row = await guard(async () => ok(await sb.from('shares').insert({ token: newToken(), char_id: c.id, sections }).select().single()), '링크를 만들었어요');
      if (row && row !== true) { rows.unshift(row); draw(); copy(row.token); }
    };
    m.el.querySelectorAll('[data-copy]').forEach((b) => (b.onclick = () => copy(b.dataset.copy)));
    m.el.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
      const t = b.dataset.del;
      const done = await guard(async () => { ok(await sb.from('shares').delete().eq('token', t)); return true; }, '링크를 지웠어요');
      if (done) { rows = rows.filter((r) => r.token !== t); draw(); }
    }));
  };
  draw();
}

// ── 열람 화면 ──
export async function publicView(app, token) {
  app.innerHTML = '<div class="boot">파일 여는 중…</div>';
  let d;
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/share?t=${encodeURIComponent(token)}`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
    d = await r.json();
    if (!r.ok) throw new Error(d.error || '불러오지 못했어요');
  } catch (e) { app.innerHTML = `<div class="boot">열 수 없는 링크예요<br><small>${esc(e.message)}</small></div>`; return; }

  const c = d.char, urls = d.urls || {}, S = new Set(d.sections || []);
  const img = (p, alt = '') => (p && urls[p] ? `<img src="${esc(urls[p])}" alt="${esc(alt)}" loading="lazy">` : '');
  document.title = `${c.name} · ${SITE_NAME}`;
  document.documentElement.style.setProperty('--c', c.color || '#c2410c');
  document.documentElement.style.setProperty('--c-ink', inkOn(c.color));
  const E = (sec) => (d.entries || []).filter((e) => e.section === sec);
  const rich = (v) => (v && String(v).replace(/<[^>]+>/g, '').trim() ? `<div class="rich" style="border:none">${toRich(v)}</div>` : '<span class="muted">—</span>');
  const sheets = [];
  const add = (id, title, html) => sheets.push([id, title, html]);

  if (S.has('profile')) add('profile', '프로필', Object.values(PROFILE).map(([g, fields, mode]) => {
    const p = c.profile || {};
    const rows = fields.filter(([k]) => p[k] && String(p[k]).replace(/<[^>]+>/g, '').trim());
    return rows.length ? `<div class="group-title">${esc(g)}</div><div class="rows">${rows.map(([k, l]) => `<div class="frow"><div class="k">${esc(l)}</div>${mode === 'line' ? `<div>${esc(p[k])}</div>` : rich(p[k])}</div>`).join('')}</div>` : '';
  }).join('') || '<p class="muted">비어 있어요</p>');
  if (S.has('inner')) add('inner', '내면 · 심리', INNER.map(([g, fields]) => {
    const p = c.inner_data || {};
    const rows = fields.filter(([k]) => p[k] && String(p[k]).replace(/<[^>]+>/g, '').trim());
    return rows.length ? `<div class="group-title">${esc(g)}</div><div class="rows">${rows.map(([k, l]) => `<div class="frow"><div class="k">${esc(l)}</div>${rich(p[k])}</div>`).join('')}</div>` : '';
  }).join('') || '<p class="muted">비어 있어요</p>');
  if (S.has('memo') && E('memo').length) add('memo', '설정 메모', `<div class="cards">${E('memo').map((e) => `<article class="card"><div class="card-top"><span class="tagstamp">${esc(e.data.tag || '기타')}</span><b style="font-size:16px">${esc(e.data.title || '')}</b></div>${rich(e.data.text)}${e.data.source ? `<div class="mono muted" style="font-size:12px">${esc(e.data.source)}</div>` : ''}</article>`).join('')}</div>`);
  if (S.has('timeline') && E('timeline').length) add('timeline', '타임라인', `<div class="tl">${E('timeline').map((e) => `<div class="tl-item" style="grid-template-columns:26px minmax(0,1fr)"><span class="tl-dot" style="background:var(--c)"></span><div><div class="mono" style="font-size:12px;color:var(--c)">${esc(e.data.date || '')}</div><b style="font-size:16px">${esc(e.data.title || '')}</b>${rich(e.data.desc)}</div></div>`).join('')}</div>`);
  if (S.has('quote') && E('quote').length) add('quote', '대사', `<div class="cards">${E('quote').map((e) => `<article class="card quote"><div style="font-family:var(--serif);font-size:19px">“${toRich(e.data.text)}”</div>${e.data.context ? `<div class="ctx">${toRich(e.data.context)}</div>` : ''}</article>`).join('')}</div>`);
  if (S.has('story') && E('story').length) add('story', '썰 · 스토리', `<div class="cards">${E('story').map((e) => `<details class="card"><summary style="cursor:pointer;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="tagstamp">${esc(e.data.tag || '썰')}</span><b style="font-size:16px">${esc(e.data.title || '제목 없음')}</b><span class="mono muted" style="font-size:11px">${esc(e.data.date || '')}</span></summary><div style="padding-top:8px">${e.data.genre || e.data.chars ? `<div class="mono muted" style="font-size:12px">${esc([e.data.genre, e.data.chars].filter(Boolean).join(' · '))}</div>` : ''}${rich(e.data.text)}</div></details>`).join('')}</div>`);
  if (S.has('gallery') && E('image').length) add('gallery', '갤러리', `<div class="gallery">${E('image').map((e) => `<figure class="shot" style="margin:0"><a class="open" href="${esc(urls[e.data.path] || '#')}" target="_blank" rel="noopener" aria-label="원본 보기" style="display:block;width:100%;height:100%">${img(e.data.path)}</a></figure>`).join('')}</div>`);
  if (S.has('graph') && (d.rels || []).length) add('graph', '관계도', `<table class="rel-table"><thead><tr><th>상대</th><th>관계</th><th>설명</th></tr></thead><tbody>${d.rels.map((r) => {
    const o = r.to_id ? (d.others[r.to_id] || d.others[r.from_id]) : { name: r.ext_name || '외부', color: '#9a968c' };
    return `<tr><td data-l="상대"><span style="display:inline-flex;gap:8px;align-items:center"><span class="folder" style="padding:0;background:none;border:none"><span class="av" style="--fc:${esc(o?.color || '#9a968c')}">${img(o?.image_path, o?.name)}</span></span>${esc(o?.name || '?')}</span></td><td data-l="관계"><span class="reltag">${esc(r.type || '—')}</span></td><td data-l="설명" style="white-space:pre-wrap">${esc(r.descr || '')}</td></tr>`;
  }).join('')}</tbody></table>`);

  app.innerHTML = `
    <header class="top"><span class="brand">${esc(SITE_NAME)}</span><span class="grow" style="flex:1"></span><span class="mono" style="font-size:11px;padding:6px 10px;border:1px solid var(--ink);border-radius:6px">열람 전용</span></header>
    <nav class="folders" aria-label="캐릭터"><span class="folder on" style="--fc:${esc(c.color)}"><span class="av">${img(c.image_path)}</span>${esc(c.name)}</span></nav>
    <div class="paper">
      <nav class="index" aria-label="목차"><div class="lab">INDEX</div>
        ${[['top', '개요'], ...sheets.map(([id, t]) => [id, t])].map(([id, t], i) => `<a href="#/share/${esc(token)}" data-go="pv-${id}"><span class="n">${String(i + 1).padStart(2, '0')}</span>${esc(t)}</a>`).join('')}
      </nav>
      <section class="sheet">
        <div id="pv-top" class="ph">
          <div class="photo">${img(c.image_path, c.name) || '사진'}</div>
          <div class="ph-main">
            <div class="stamp-row"><span class="stamp">${esc(c.kind)}</span><span class="mono muted" style="font-size:12px">${esc(c.genre || '')}</span></div>
            <h1 class="name-input" style="margin:0">${esc(c.name)}</h1>
            ${c.intro ? `<div style="color:var(--ink2)">${esc(c.intro)}</div>` : ''}
            <div class="palette"><span class="sw" style="background:${esc(c.color)}"></span>${(c.palette || []).map((x) => `<span class="sw" style="background:${esc(x)}"></span>`).join('')}<span class="mono muted" style="font-size:11px;margin-left:10px">${esc(c.color)}</span></div>
            ${(c.songs || []).filter((s) => s.title).map((s) => `<div class="song"><span aria-hidden="true">♪</span>${esc(s.title)}${s.artist ? ' — ' + esc(s.artist) : ''}${s.url ? ` <a href="${esc(s.url)}" target="_blank" rel="noopener">▶</a>` : ''}</div>`).join('')}
          </div>
        </div>
        ${sheets.map(([id, t, html], i) => `<div id="pv-${id}" style="display:flex;flex-direction:column;gap:14px;scroll-margin-top:110px"><div class="sheet-head"><span class="n">${String(i + 2).padStart(2, '0')}</span><h2>${esc(t)}</h2></div>${html}</div>`).join('')}
      </section>
    </div>`;
  app.querySelectorAll('[data-go]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    app.querySelectorAll('.index a').forEach((x) => x.classList.toggle('on', x === a));
    document.getElementById(a.dataset.go)?.scrollIntoView({ behavior: 'smooth' });
  }));
}
