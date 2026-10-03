import { imgUrl } from './db.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (r, s) => r.querySelector(s);
export const $$ = (r, s) => [...r.querySelectorAll(s)];
export const today = () => new Date().toISOString().slice(0, 10);

const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON = {
  del: P('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>'),
  x: P('<path d="M6 6l12 12"/><path d="M18 6L6 18"/>'),
  up: P('<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>'),
  down: P('<path d="M12 5v14"/><path d="M6 13l6 6 6-6"/>'),
  upload: P('<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 20h16"/>'),
  gear: P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'),
};
export const iconBtn = (act, label, icon, cls = '', data = '') =>
  `<button type="button" class="icon-btn ${cls}" data-act="${act}" ${data} aria-label="${esc(label)}" title="${esc(label)}">${ICON[icon]}</button>`;

// ── 토스트 ──
let tt;
export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), ms);
}
export async function guard(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r ?? true; }
  catch (e) { console.error(e); toast('오류: ' + e.message, 4000); return null; }
}

// ── 자동 저장 (키별 디바운스) ──
const timers = new Map();
const pending = new Map();
let statusEl = null;
export const setStatusEl = (el) => (statusEl = el);
const status = (t) => { if (statusEl) statusEl.textContent = t; };
export function autosave(key, fn, wait = 700) {
  status('저장 중…');
  pending.set(key, fn);
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => run(key), wait));
}
async function run(key) {
  const fn = pending.get(key); pending.delete(key); timers.delete(key);
  if (!fn) return;
  try { await fn(); if (!pending.size) status('저장됨'); }
  catch (e) { console.error(e); status('저장 실패'); toast('저장 실패: ' + e.message, 4000); }
}
export async function flushSaves() {
  const keys = [...pending.keys()];
  keys.forEach((k) => clearTimeout(timers.get(k)));
  await Promise.all(keys.map(run));
}
window.addEventListener('beforeunload', (e) => { if (pending.size) { flushSaves(); e.preventDefault(); e.returnValue = ''; } });

// ── 모달 ──
export function modal(html, { wide = false } = {}) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  document.getElementById('modal-root').appendChild(bg);
  const close = () => { bg.remove(); document.removeEventListener('keydown', key); };
  const key = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', key);
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
  setTimeout(() => bg.querySelector('input,select,textarea,button')?.focus(), 30);
  return { el: bg.querySelector('.modal'), close };
}
export function confirmBox(msg, okLabel = '삭제') {
  return new Promise((res) => {
    const m = modal(`<h3>${esc(msg)}</h3><div class="m-acts"><button class="btn ghost" data-n>취소</button><button class="btn solid" data-y>${esc(okLabel)}</button></div>`);
    m.el.querySelector('[data-n]').onclick = () => { m.close(); res(false); };
    m.el.querySelector('[data-y]').onclick = () => { m.close(); res(true); };
  });
}
// 간단 입력 폼 모달: fields = [{name,label,type,value,options,ph,hints}]
export function formModal(title, fields, { okLabel = '확인', wide = false } = {}) {
  return new Promise((res) => {
    const html = fields.map((f, i) => {
      const id = 'mf' + i;
      let ctl;
      if (f.type === 'select') ctl = `<select id="${id}" name="${f.name}">${f.options.map(([v, l]) => `<option value="${esc(v)}" ${v === f.value ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
      else if (f.type === 'textarea') ctl = `<textarea id="${id}" name="${f.name}" rows="4" placeholder="${esc(f.ph || '')}">${esc(f.value || '')}</textarea>`;
      else ctl = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value || '')}" placeholder="${esc(f.ph || '')}">`;
      const hints = f.hints?.length ? `<div class="hint-chips">${f.hints.map((h) => `<button type="button" class="chip" data-hint="${esc(f.name)}" data-v="${esc(h)}">${esc(h)}</button>`).join('')}</div>` : '';
      return `<div class="field"><label for="${id}">${esc(f.label)}</label>${ctl}${hints}</div>`;
    }).join('');
    const m = modal(`<h3>${esc(title)}</h3><form style="display:flex;flex-direction:column;gap:12px">${html}<div class="m-acts"><button type="button" class="btn ghost" data-n>취소</button><button class="btn solid">${esc(okLabel)}</button></div></form>`, { wide });
    m.el.querySelectorAll('[data-hint]').forEach((b) => (b.onclick = () => { m.el.querySelector(`[name="${b.dataset.hint}"]`).value = b.dataset.v; }));
    m.el.querySelector('[data-n]').onclick = () => { m.close(); res(null); };
    m.el.querySelector('form').onsubmit = (e) => {
      e.preventDefault();
      const out = {};
      m.el.querySelectorAll('[name]').forEach((x) => (out[x.name] = x.value.trim()));
      m.close(); res(out);
    };
  });
}

// ── 리치 텍스트 ──
const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'BR', 'DIV', 'P', 'SPAN', 'FONT']);
export function sanitize(html) {
  const t = document.createElement('template');
  t.innerHTML = String(html ?? '');
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) return;
      if (n.nodeType !== 1 || !ALLOWED.has(n.tagName)) {
        if (n.nodeType === 1 && !['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT'].includes(n.tagName)) { walk(n); n.replaceWith(...n.childNodes); }
        else n.remove();
        return;
      }
      const color = n.tagName === 'FONT' ? n.getAttribute('color') : n.style?.color;
      [...n.attributes].forEach((a) => n.removeAttribute(a.name));
      if (color && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(color.trim())) {
        if (n.tagName === 'FONT') n.setAttribute('color', color); else n.style.color = color;
      }
      walk(n);
    });
  };
  walk(t.content);
  return t.innerHTML;
}
// 오래된 순수 텍스트 → HTML
export function toRich(v) {
  const s = String(v ?? '');
  if (/<(b|i|u|br|span|div|strong|em|p|font)\b/i.test(s)) return sanitize(s);
  return esc(s).replace(/\r?\n/g, '<br>');
}
export const plain = (html) => { const t = document.createElement('template'); t.innerHTML = String(html ?? '').replace(/<br\s*\/?>/gi, '\n'); return t.content.textContent || ''; };

// <div class="rich" ...> 를 만들어 반환 (문자열)
export const richHTML = (key, value, ph = '', extraCls = '') =>
  `<div class="rich ${extraCls}" contenteditable="true" role="textbox" aria-multiline="true" aria-label="${esc(ph)}" data-ph="${esc(ph)}" data-key="${esc(key)}">${toRich(value)}</div>`;
// 렌더 후 바인딩: onChange(key, html)
export function bindRich(root, onChange) {
  $$(root, '.rich[data-key]').forEach((el) => {
    el.addEventListener('input', () => onChange(el.dataset.key, sanitize(el.innerHTML), el));
    el.addEventListener('paste', (e) => {
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
    });
  });
}

// 떠다니는 서식 툴바
let fmtColors = ['#b42318', '#1d4ed8', '#15803d'];
export const setFmtAccent = (c) => { fmtColors[3] = c; renderFmt(); };
const fmt = () => document.getElementById('fmt');
function renderFmt() {
  const el = fmt(); if (!el) return;
  el.innerHTML = `
    <button type="button" data-cmd="bold" aria-label="굵게" style="font-weight:800">B</button>
    <button type="button" data-cmd="italic" aria-label="기울임" style="font-style:italic;font-family:Georgia,serif">I</button>
    <button type="button" data-cmd="underline" aria-label="밑줄" style="text-decoration:underline">U</button>
    <button type="button" data-cmd="strikeThrough" aria-label="취소선" style="text-decoration:line-through">S</button>
    <span class="sep"></span>
    ${fmtColors.filter(Boolean).map((c) => `<button type="button" data-color="${c}" aria-label="글자색 ${c}"><span class="dot" style="background:${c}"></span></button>`).join('')}
    <button type="button" data-cmd="removeFormat" aria-label="서식 지우기" style="font-size:12px">⌫</button>`;
}
export function initFmt() {
  renderFmt();
  const el = fmt();
  el.addEventListener('mousedown', (e) => e.preventDefault());
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const sel = getSelection(); const root = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement)?.closest('.rich');
    if (!root) return;
    document.execCommand('styleWithCSS', false, true);
    if (b.dataset.color) document.execCommand('foreColor', false, b.dataset.color);
    else document.execCommand(b.dataset.cmd, false, null);
    root.dispatchEvent(new Event('input', { bubbles: true }));
  });
  document.addEventListener('selectionchange', () => {
    const sel = getSelection();
    const node = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    const root = node?.closest?.('.rich');
    if (!root || sel.isCollapsed || !sel.toString().trim()) { el.hidden = true; return; }
    const r = sel.getRangeAt(0).getBoundingClientRect();
    el.hidden = false;
    const w = el.offsetWidth || 300;
    el.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    el.style.top = Math.max(8, r.top - 50) + 'px';
  });
  window.addEventListener('scroll', () => (el.hidden = true), true);
}

// ── 이미지 ──
export async function hydrate(root) {
  await Promise.all($$(root, 'img[data-img]').map(async (img) => {
    try { img.src = await imgUrl(img.dataset.img); } catch { img.alt = '이미지 없음'; }
  }));
}
export const imgTag = (path, alt = '') => (path ? `<img data-img="${esc(path)}" alt="${esc(alt)}" loading="lazy">` : '');
export function pickFiles({ multiple = false, accept = 'image/*' } = {}) {
  return new Promise((res) => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept; i.multiple = multiple;
    i.onchange = () => res([...i.files]);
    i.click();
  });
}
export function dropzone(el, onFiles) {
  el.addEventListener('click', async () => { const f = await pickFiles({ multiple: true }); if (f.length) onFiles(f); });
  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('over'); });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', (e) => {
    e.preventDefault(); el.classList.remove('over');
    const f = [...e.dataTransfer.files].filter((x) => x.type.startsWith('image/'));
    if (f.length) onFiles(f);
  });
}
// 큰 이미지는 줄여서 올리기 (긴 변 2400px, JPEG/WebP 유지)
export async function shrink(file, max = 2400) {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp || Math.max(bmp.width, bmp.height) <= max) return file;
  const k = max / Math.max(bmp.width, bmp.height);
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return new Promise((r) => c.toBlob((b) => r(b || file), type, 0.9));
}

// 글자색 대비
export function inkOn(hex) {
  const h = String(hex || '#ffffff').replace('#', '').padEnd(6, 'f');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#1c1b19' : '#ffffff';
}
export const validHex = (h) => /^#[0-9a-fA-F]{6}$/.test(h || '');
export function hilite(text, q) {
  const s = esc(text);
  if (!q) return s;
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return s.replace(re, (m) => `<mark>${m}</mark>`);
}
