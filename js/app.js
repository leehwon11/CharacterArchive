import { sb, db, removeFiles } from './db.js';
import { esc, $, $$, toast, guard, modal, confirmBox, formModal, imgTag, hydrate, initFmt, setFmtAccent, setStatusEl, flushSaves, autosave, inkOn, ICON } from './ui.js';
import { SUPABASE_URL, SITE_NAME } from './config.js';
import profile from './sections/profile.js';
import inner from './sections/inner.js';
import memo from './sections/memo.js';
import timeline from './sections/timeline.js';
import quote from './sections/quote.js';
import story from './sections/story.js';
import gallery from './sections/gallery.js';
import graph from './sections/graph.js';
import { openSearch } from './sections/search.js';
import { openBackup } from './sections/backup.js';

export const SECTIONS = [
  ['profile', '프로필', profile], ['inner', '내면 · 심리', inner], ['memo', '설정 메모', memo], ['timeline', '타임라인', timeline],
  ['quote', '대사', quote], ['story', '썰 · 스토리', story], ['gallery', '갤러리', gallery], ['graph', '관계도', graph],
];
export const KINDS = ['드림주', 'OC', '기타'];

const app = document.getElementById('app');
export const state = { chars: [], rels: [], settings: {}, kind: '전체', session: null };

// ── 공용 API (섹션에서 사용) ──
export function saveChar(c, patch, key = Object.keys(patch).join(',')) {
  Object.assign(c, patch);
  autosave(`c:${c.id}:${key}`, () => db.updChar(c.id, patch));
  if ('name' in patch || 'color' in patch || 'image_path' in patch || 'kind' in patch) drawFolders();
  if ('color' in patch) applyAccent(c);
}
export function saveSettings(patch) {
  Object.assign(state.settings, patch);
  autosave('settings', () => db.saveSettings(state.settings));
  applySettings();
}
export const charById = (id) => state.chars.find((c) => c.id === id);
export const go = (id, sec = 'profile', sub = '') => { location.hash = `#/c/${id}/${sec}${sub ? '/' + sub : ''}`; };

function applySettings() {
  const s = state.settings;
  document.documentElement.style.setProperty('--fs', (s.fontSize || 15) + 'px');
  document.documentElement.style.setProperty('--body', s.font === 'serif' ? 'var(--serif)' : 'var(--sans)');
}
function applyAccent(c) {
  const col = c?.color || '#c2410c';
  document.documentElement.style.setProperty('--c', col);
  document.documentElement.style.setProperty('--c-ink', inkOn(col));
  setFmtAccent(col);
}

// ── 셸 ──
function shell() {
  app.innerHTML = `
    <header class="top">
      <a class="brand" href="#/">${esc(SITE_NAME)}</a>
      <form id="sf" role="search" style="display:contents"><label for="sq" class="hide">전체 검색</label>
        <input id="sq" class="search" type="search" placeholder="전체 검색 — 이름, 메모, 썰, 대사"></form>
      <span class="saved" id="saved" aria-live="polite"></span>
      <button class="btn ghost" data-act="backup">백업</button>
      <button class="icon-btn" data-act="settings" aria-label="설정" title="설정">${ICON.gear}</button>
      <button class="btn solid" data-act="new">+ 새 파일</button>
    </header>
    <nav class="folders" id="folders" aria-label="캐릭터"></nav>
    <div class="paper" id="paper"></div>`;
  setStatusEl($(app, '#saved'));
  $(app, '#sf').onsubmit = (e) => { e.preventDefault(); const q = $(app, '#sq').value.trim(); if (q) openSearch(q); };
  $(app, '[data-act=new]').onclick = newChar;
  $(app, '[data-act=backup]').onclick = () => openBackup();
  $(app, '[data-act=settings]').onclick = openSettings;
}

export function drawFolders() {
  const el = document.getElementById('folders'); if (!el) return;
  const cur = currentId();
  const list = state.chars.filter((c) => state.kind === '전체' || c.kind === state.kind);
  el.innerHTML = `
    <label for="kf" class="hide">유형</label>
    <select id="kf" class="kind-filter">${['전체', ...KINDS].map((k) => `<option ${k === state.kind ? 'selected' : ''}>${k}</option>`).join('')}</select>
    ${list.map((c) => `<a href="#/c/${c.id}/${currentSection()}" class="folder ${c.id === cur ? 'on' : ''}" style="--fc:${esc(c.color)}" ${c.id === cur ? 'aria-current="page"' : ''}>
      <span class="av">${imgTag(c.image_path)}</span>${esc(c.name || '이름 없음')}</a>`).join('')}`;
  hydrate(el);
  $(el, '#kf').onchange = (e) => { state.kind = e.target.value; drawFolders(); };
  el.querySelector('.folder.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

const parse = () => (location.hash.match(/^#\/c\/([\w-]+)(?:\/(\w+))?(?:\/(\w+))?/) || []);
const currentId = () => parse()[1];
const currentSection = () => parse()[2] || 'profile';

async function route() {
  await flushSaves();
  document.getElementById('fmt').hidden = true;
  const [, id, sec = 'profile', sub = ''] = parse();
  const paper = document.getElementById('paper');
  if (!state.chars.length) {
    drawFolders(); applyAccent(null);
    paper.innerHTML = `<div class="sheet"><div class="empty"><b>아직 파일이 없어요</b>오른쪽 위 “+ 새 파일”로 첫 캐릭터를 만들거나, “백업”에서 예전 사이트 데이터를 가져올 수 있어요.</div></div>`;
    return;
  }
  const c = charById(id);
  if (!c) { go(state.chars[0].id); return; }
  applyAccent(c);
  drawFolders();
  const entry = SECTIONS.find(([k]) => k === sec) || SECTIONS[0];
  paper.innerHTML = `
    <nav class="index" aria-label="목차"><div class="lab">INDEX</div>
      ${SECTIONS.map(([k, l], i) => `<a href="#/c/${c.id}/${k}" class="${k === entry[0] ? 'on' : ''}" ${k === entry[0] ? 'aria-current="page"' : ''}><span class="n">${String(i + 1).padStart(2, '0')}</span>${l}</a>`).join('')}
    </nav>
    <section class="sheet" id="sheet"></section>`;
  const sheet = $(paper, '#sheet');
  const n = String(SECTIONS.indexOf(entry) + 1).padStart(2, '0');
  const head = (extra = '') => `<div class="sheet-head"><span class="n">${n}</span><h2>${entry[1]}</h2><span class="who">${esc(c.name)} · FILE</span><span class="grow"></span>${extra}</div>`;
  try { await entry[2]({ el: sheet, c, sub, head, state }); }
  catch (e) { console.error(e); sheet.innerHTML = `<div class="empty"><b>불러오지 못했어요</b>${esc(e.message)}</div>`; }
}

async function newChar() {
  const f = await formModal('새 파일', [
    { name: 'name', label: '이름', ph: '캐릭터 이름' },
    { name: 'kind', label: '유형', type: 'select', value: '드림주', options: KINDS.map((k) => [k, k]) },
    { name: 'genre', label: '장르 / 세계관', ph: '판타지, 현대물…' },
  ], { okLabel: '만들기' });
  if (!f) return;
  if (!f.name) return toast('이름을 입력해주세요');
  const palette = ['#c2410c', '#1d4ed8', '#0f766e', '#7c3aed', '#be185d', '#a16207', '#334155'];
  const c = await guard(() => db.addChar({ name: f.name, kind: f.kind, genre: f.genre, color: palette[state.chars.length % palette.length], sort: state.chars.length }), '파일을 만들었어요');
  if (!c) return;
  state.chars.push(c);
  go(c.id);
}

export async function deleteChar(c) {
  if (!(await confirmBox(`“${c.name}” 파일을 폐기할까요? 메모·썰·갤러리·관계까지 모두 지워져요.`, '폐기'))) return;
  await guard(async () => {
    const imgs = (await db.entries(c.id, 'image')).map((e) => e.data.path);
    await db.delChar(c.id);
    await removeFiles([c.image_path, ...imgs]);
    state.chars = state.chars.filter((x) => x.id !== c.id);
    state.rels = state.rels.filter((r) => r.from_id !== c.id && r.to_id !== c.id);
    location.hash = state.chars[0] ? `#/c/${state.chars[0].id}/profile` : '#/';
    if (!state.chars.length) route();
  }, '폐기했어요');
}

function openSettings() {
  const s = state.settings;
  const m = modal(`
    <h3>설정</h3>
    <div class="field"><label for="fs">글자 크기 <span id="fsv" class="mono">${s.fontSize || 15}px</span></label><input id="fs" type="range" min="12" max="20" value="${s.fontSize || 15}"></div>
    <div class="field"><label for="ff">본문 글꼴</label><select id="ff"><option value="sans" ${s.font !== 'serif' ? 'selected' : ''}>고딕</option><option value="serif" ${s.font === 'serif' ? 'selected' : ''}>명조</option></select></div>
    <div class="m-acts" style="justify-content:space-between"><button class="btn danger" data-out>로그아웃</button><button class="btn solid" data-x>닫기</button></div>`);
  $(m.el, '#fs').oninput = (e) => { $(m.el, '#fsv').textContent = e.target.value + 'px'; saveSettings({ fontSize: +e.target.value }); };
  $(m.el, '#ff').onchange = (e) => saveSettings({ font: e.target.value });
  $(m.el, '[data-x]').onclick = m.close;
  $(m.el, '[data-out]').onclick = () => { m.close(); sb.auth.signOut(); };
}

function login() {
  app.innerHTML = `
    <form class="login" id="lf">
      <div class="brand" style="text-align:center">${esc(SITE_NAME)}</div>
      <div class="field"><label for="em">이메일</label><input id="em" type="email" autocomplete="email" required></div>
      <div class="field"><label for="pw">비밀번호</label><input id="pw" type="password" autocomplete="current-password" required></div>
      <button class="btn solid" style="justify-content:center">열람</button>
    </form>`;
  $(app, '#lf').onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await sb.auth.signInWithPassword({ email: $(app, '#em').value.trim(), password: $(app, '#pw').value });
    if (error) toast('로그인 실패: 이메일이나 비밀번호를 확인해주세요');
  };
}

export async function reloadAll() {
  [state.chars, state.rels, state.settings] = await Promise.all([db.chars(), db.rels(), db.settings()]);
  applySettings();
}

async function start() {
  if (SUPABASE_URL.includes('YOUR-PROJECT')) { app.innerHTML = '<div class="boot">js/config.js 에 Supabase URL과 키를 넣어주세요.</div>'; return; }
  if (!state.session) return login();
  app.innerHTML = '<div class="boot">파일 여는 중…</div>';
  await reloadAll();
  shell();
  initFmt();
  route();
}

let started = false;
window.addEventListener('hashchange', () => { if (state.session && started) route(); });
sb.auth.onAuthStateChange((_e, s) => {
  const changed = !!s !== !!state.session;
  state.session = s;
  if (changed && started) start();
});
try { state.session = (await sb.auth.getSession()).data.session; } catch { state.session = null; }
started = true;
start();
