import { state, saveChar, saveSettings, charById, go } from '../app.js';
import { db, imgUrl } from '../db.js';
import { esc, $, $$, guard, modal, formModal, confirmBox, toast, iconBtn } from '../ui.js';

const KEYWORDS = {
  연인: '#be185d', 커플: '#be185d', 사랑: '#be185d', 좋아: '#db2777',
  친구: '#15803d', 절친: '#166534', 동료: '#0f766e',
  가족: '#1d4ed8', 형제: '#1d4ed8', 자매: '#1d4ed8', 부모: '#1e40af',
  라이벌: '#c2410c', 경쟁: '#c2410c',
  적: '#b42318', 원수: '#991b1b', 갈등: '#b42318',
  스승: '#7c3aed', 제자: '#7c3aed',
};
const SWATCHES = ['#be185d', '#15803d', '#1d4ed8', '#c2410c', '#b42318', '#7c3aed', '#0f766e', '#a16207', '#334155', '#6d6a62'];
export const groupKey = (type) => {
  const t = (type || '').trim();
  for (const k of Object.keys(KEYWORDS)) if (t.includes(k)) return k;
  return t;
};
export function relColor(type) {
  if (!type) return '#6d6a62';
  const g = groupKey(type);
  return state.settings.relColors?.[g] || KEYWORDS[g] || '#6d6a62';
}
const DIRS = [['from', '→ 이 캐릭터가 상대에게'], ['to', '← 상대가 이 캐릭터에게'], ['both', '↔ 서로']];
const dirMark = { from: '→', to: '←', both: '↔' };

const view = {};

export default async function graph({ el, c, head }) {
  const mode = view[c.id] || 'graph';
  const myRels = () => state.rels.filter((r) => r.from_id === c.id || r.to_id === c.id);
  const draw = () => {
    const rels = myRels();
    const types = [...new Set(rels.map((r) => r.type).filter(Boolean))];
    el.innerHTML = `
      ${head(`<button class="btn sm ${mode === 'graph' ? 'solid' : 'ghost'}" data-view="graph" aria-pressed="${mode === 'graph'}">그래프</button><button class="btn sm ${mode === 'list' ? 'solid' : 'ghost'}" data-view="list" aria-pressed="${mode === 'list'}">목록</button>`)}
      <div class="toolbar">
        <button class="btn sm solid" data-act="add">+ 내 캐릭터</button>
        <button class="btn sm ghost" data-act="add-ext">+ 외부 캐릭터</button>
        <button class="btn sm ghost" data-act="colors">색상 그룹</button>
        <span class="grow"></span>
        ${mode === 'graph' ? '<button class="btn sm ghost" data-act="reset">배치 초기화</button><button class="btn sm ghost" data-act="png">이미지로 저장</button>' : ''}
      </div>
      ${types.length ? `<div class="legend">${[...new Set(types.map(groupKey))].map((g) => `<span><i style="background:${relColor(g)}"></i>${esc(g)}</span>`).join('')}</div>` : ''}
      ${mode === 'graph'
        ? `<div class="graph-wrap" id="gw"><canvas id="gc" aria-label="${esc(c.name)} 관계도. 목록 보기에서 같은 내용을 볼 수 있어요." role="img"></canvas></div>
           <p class="muted mono" style="font-size:11px;margin:0">드래그로 위치 옮기기 · 빈 곳 드래그로 화면 이동 · 휠/두 손가락으로 확대 · 다른 캐릭터 더블클릭하면 그 파일로 이동</p>`
        : list(rels)}`;

    $$(el, '[data-view]').forEach((b) => (b.onclick = () => { view[c.id] = b.dataset.view; graph({ el, c, head }); }));
    $(el, '[data-act=add]').onclick = () => editRel(null, false);
    $(el, '[data-act=add-ext]').onclick = () => editRel(null, true);
    $(el, '[data-act=colors]').onclick = () => colorGroups(rels);
    if (mode === 'graph') canvasGraph();
    else {
      $$(el, '[data-edit]').forEach((b) => (b.onclick = () => editRel(state.rels.find((r) => r.id === b.dataset.edit))));
      $$(el, '[data-del]').forEach((b) => (b.onclick = async () => {
        if (!(await confirmBox('이 관계를 지울까요?'))) return;
        await guard(async () => { await db.delRel(b.dataset.del); state.rels = state.rels.filter((r) => r.id !== b.dataset.del); draw(); }, '삭제했어요');
      }));
    }
  };

  function otherOf(r) {
    if (!r.to_id) return { key: 'ext:' + r.id, name: r.ext_name || '외부', ext: true };
    const oid = r.from_id === c.id ? r.to_id : r.from_id;
    const o = charById(oid);
    return { key: oid, name: o?.name || '?', char: o };
  }
  // 이 캐릭터 기준 방향
  function relDir(r) {
    if (r.dir === 'both') return 'both';
    const outgoing = (r.from_id === c.id) === (r.dir === 'from');
    return outgoing ? 'from' : 'to';
  }

  function list(rels) {
    if (!rels.length) return `<div class="empty"><b>관계가 없어요</b>“+ 내 캐릭터”나 “+ 외부 캐릭터”로 이어보세요.</div>`;
    return `<table class="rel-table"><thead><tr><th>상대</th><th>관계</th><th>방향</th><th>설명</th><th><span class="hide">편집</span></th></tr></thead><tbody>
      ${rels.map((r) => { const o = otherOf(r); return `<tr>
        <td>${o.ext ? `${esc(o.name)} <span class="mono muted" style="font-size:10px">외부</span>` : `<a href="#/c/${o.key}/graph">${esc(o.name)}</a>`}</td>
        <td><span class="reltag" style="color:${relColor(r.type)}">${esc(r.type || '—')}</span></td>
        <td class="mono">${dirMark[relDir(r)]}</td>
        <td style="white-space:pre-wrap">${esc(r.descr)}</td>
        <td style="white-space:nowrap"><button class="btn sm ghost" data-edit="${r.id}">수정</button> ${iconBtn('rel-del', '관계 삭제', 'del', 'del', `data-del="${r.id}"`)}</td></tr>`; }).join('')}
      </tbody></table>`;
  }

  async function editRel(r, ext = !!(r && !r.to_id)) {
    const others = state.chars.filter((x) => x.id !== c.id);
    if (!ext && !r && !others.length) return toast('다른 캐릭터 파일이 하나 이상 있어야 해요');
    const types = [...new Set(state.rels.map((x) => x.type).filter(Boolean))].slice(0, 12);
    const curDir = r ? relDir(r) : 'from';
    const fields = [
      ext ? { name: 'ext', label: '외부 캐릭터 이름', value: r?.ext_name || '' }
          : { name: 'to', label: '상대 캐릭터', type: 'select', value: r ? otherOf(r).key : others[0].id, options: others.map((x) => [x.id, x.name]) },
      ...(ext ? [] : [{ name: 'dir', label: '방향', type: 'select', value: curDir, options: DIRS }]),
      { name: 'type', label: '관계', value: r?.type || '', ph: '연인, 라이벌, 소꿉친구…', hints: types },
      { name: 'descr', label: '설명', type: 'textarea', value: r?.descr || '' },
    ];
    const v = await formModal(r ? '관계 수정' : ext ? '외부 캐릭터 관계' : '관계 추가', fields, { okLabel: '저장' });
    if (!v) return;
    if (ext && !v.ext) return toast('이름을 입력해주세요');
    const row = ext
      ? { from_id: c.id, to_id: null, ext_name: v.ext, type: v.type, descr: v.descr, dir: 'both' }
      : { from_id: c.id, to_id: v.to, type: v.type, descr: v.descr, dir: v.dir === 'both' ? 'both' : v.dir };
    await guard(async () => {
      if (r) { await db.updRel(r.id, row); Object.assign(r, row); }
      else state.rels.push(await db.addRel(row));
      draw();
    }, '저장했어요');
  }

  function colorGroups(rels) {
    const groups = [...new Set(rels.map((r) => groupKey(r.type)).filter(Boolean))];
    if (!groups.length) return toast('관계 유형이 아직 없어요');
    const m = modal(`<h3>관계 색상 그룹</h3><p class="muted" style="margin:0;font-size:13px">같은 유형은 모든 파일의 관계도에서 같은 색으로 보여요.</p>
      ${groups.map((g) => `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 0;border-top:1px solid var(--line)">
        <span style="flex:1;min-width:90px">${esc(g)}</span>
        ${SWATCHES.map((s) => `<button type="button" data-g="${esc(g)}" data-c="${s}" aria-label="${esc(g)} ${s}" style="width:26px;height:26px;border-radius:13px;background:${s};border:3px solid ${relColor(g) === s ? 'var(--ink)' : 'transparent'}"></button>`).join('')}
        <button type="button" class="chip" data-g="${esc(g)}" data-c="">자동</button></div>`).join('')}
      <div class="m-acts"><button class="btn solid" data-x>닫기</button></div>`);
    m.el.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => {
      const rc = { ...(state.settings.relColors || {}) };
      if (b.dataset.c) rc[b.dataset.g] = b.dataset.c; else delete rc[b.dataset.g];
      saveSettings({ relColors: rc });
      m.close(); draw(); colorGroups(rels);
    }));
    m.el.querySelector('[data-x]').onclick = m.close;
  }

  // ── 캔버스 ──
  function canvasGraph() {
    const wrap = $(el, '#gw'), cv = $(el, '#gc'), ctx = cv.getContext('2d');
    const meta = c.meta || (c.meta = {});
    const pos = meta.graph || (meta.graph = {});
    const rels = myRels();
    const nodes = new Map();
    nodes.set(c.id, { key: c.id, name: c.name, char: c, main: true });
    rels.forEach((r) => { const o = otherOf(r); if (!nodes.has(o.key)) nodes.set(o.key, o); });
    const arr = [...nodes.values()];
    const others = arr.filter((n) => !n.main);
    arr.forEach((n) => {
      if (n.main) { n.x = 0; n.y = 0; return; }
      const p = pos[n.key];
      if (p) { n.x = p.x; n.y = p.y; return; }
      const i = others.indexOf(n), a = (2 * Math.PI * i) / Math.max(others.length, 1) - Math.PI / 2;
      const rad = 170 + (others.length > 10 ? 60 : 0);
      n.x = Math.cos(a) * rad; n.y = Math.sin(a) * rad;
    });
    // 이미지 미리 불러오기 (PNG 저장 가능하게 crossOrigin)
    arr.forEach((n) => {
      const path = n.char?.image_path;
      if (!path) return;
      imgUrl(path).then((u) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { n.img = im; paint(); }; im.src = u; }).catch(() => {});
    });

    let W = 0, H = 0, dpr = 1, ox = 0, oy = 0, zoom = 1;
    const R = (n) => (n.main ? 34 : 24);
    function size() {
      dpr = window.devicePixelRatio || 1;
      W = wrap.clientWidth; H = wrap.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      if (!ox && !oy) { ox = W / 2; oy = H / 2; }
      paint();
    }
    const toWorld = (px, py) => ({ x: (px - ox) / zoom, y: (py - oy) / zoom });

    function paint(forExport = false) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (forExport) { ctx.fillStyle = '#fbfaf6'; ctx.fillRect(0, 0, W, H); }
      ctx.save(); ctx.translate(ox, oy); ctx.scale(zoom, zoom);
      // 같은 쌍 묶기
      const pairs = {};
      rels.forEach((r) => { const k = otherOf(r).key; (pairs[k] ||= []).push(r); });
      rels.forEach((r) => {
        const a = nodes.get(c.id), b = nodes.get(otherOf(r).key);
        const list = pairs[b.key], idx = list.indexOf(r), cnt = list.length;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
        const off = cnt > 1 ? (idx - (cnt - 1) / 2) * 34 : 0;
        const mx = (a.x + b.x) / 2 + nx * off, my = (a.y + b.y) / 2 + ny * off;
        const col = r.to_id ? relColor(r.type) : '#9a968c';
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(r.to_id ? [] : [5, 4]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
        const dir = relDir(r);
        const head = (from, to, ctrlX, ctrlY) => {
          const ang = Math.atan2(to.y - ctrlY, to.x - ctrlX), rr = R(to) + 3;
          const ex = to.x - Math.cos(ang) * rr, ey = to.y - Math.sin(ang) * rr;
          ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(ex, ey);
          ctx.lineTo(ex - 10 * Math.cos(ang - 0.45), ey - 10 * Math.sin(ang - 0.45));
          ctx.lineTo(ex - 10 * Math.cos(ang + 0.45), ey - 10 * Math.sin(ang + 0.45)); ctx.closePath(); ctx.fill();
        };
        if (dir === 'from') head(a, b, mx, my);
        if (dir === 'to') head(b, a, mx, my);
        if (r.type) {
          const lx = 0.25 * a.x + 0.5 * mx + 0.25 * b.x, ly = 0.25 * a.y + 0.5 * my + 0.25 * b.y;
          ctx.font = '600 12px "Noto Sans KR", sans-serif';
          const tw = ctx.measureText(r.type).width;
          ctx.fillStyle = '#fbfaf6'; ctx.fillRect(lx - tw / 2 - 6, ly - 10, tw + 12, 20);
          ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.strokeRect(lx - tw / 2 - 6, ly - 10, tw + 12, 20);
          ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(r.type, lx, ly + 1);
        }
      });
      arr.forEach((n) => {
        const r = R(n), col = n.char?.color || '#9a968c';
        ctx.save(); ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.closePath();
        ctx.fillStyle = n.ext ? '#e7e5de' : col; ctx.fill(); ctx.clip();
        if (n.img) ctx.drawImage(n.img, n.x - r, n.y - r, r * 2, r * 2);
        else { ctx.fillStyle = n.ext ? '#6d6a62' : '#fff'; ctx.font = `700 ${n.main ? 18 : 14}px "Noto Sans KR", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((n.name || '?')[0], n.x, n.y + 1); }
        ctx.restore();
        ctx.lineWidth = n.main ? 3 : 2; ctx.strokeStyle = n.main ? '#1c1b19' : n.ext ? '#9a968c' : col;
        if (n.ext) ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#1c1b19'; ctx.font = `${n.main ? 700 : 500} 13px "Noto Sans KR", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(n.name, n.x, n.y + r + 6);
      });
      ctx.restore();
    }

    // 포인터 (마우스 + 터치)
    const pts = new Map();
    let drag = null, pan = null, pinch = null, moved = false, lastTap = 0;
    const hit = (px, py) => { const w = toWorld(px, py); return arr.slice().reverse().find((n) => Math.hypot(n.x - w.x, n.y - w.y) <= R(n) + 4); };
    const local = (e) => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      const [px, py] = local(e); pts.set(e.pointerId, [px, py]); moved = false;
      if (pts.size === 2) { const [p1, p2] = [...pts.values()]; pinch = { d: Math.hypot(p1[0] - p2[0], p1[1] - p2[1]), z: zoom }; drag = pan = null; return; }
      const n = hit(px, py);
      if (n) { const w = toWorld(px, py); drag = { n, dx: w.x - n.x, dy: w.y - n.y }; }
      else pan = { x: px - ox, y: py - oy };
      cv.classList.add('drag');
    });
    cv.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const [px, py] = local(e); pts.set(e.pointerId, [px, py]); moved = true;
      if (pinch && pts.size === 2) { const [p1, p2] = [...pts.values()]; zoom = Math.min(2.5, Math.max(0.4, pinch.z * Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) / pinch.d)); paint(); return; }
      if (drag) { const w = toWorld(px, py); drag.n.x = w.x - drag.dx; drag.n.y = w.y - drag.dy; paint(); }
      else if (pan) { ox = px - pan.x; oy = py - pan.y; paint(); }
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      cv.classList.remove('drag');
      if (drag) {
        const n = drag.n;
        if (moved && !n.main) { pos[n.key] = { x: Math.round(n.x), y: Math.round(n.y) }; saveChar(c, { meta }); }
        if (!moved) { const now = Date.now(); if (now - lastTap < 350 && n.char && !n.main) go(n.char.id, 'graph'); lastTap = now; }
      }
      drag = pan = null;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('dblclick', (e) => { const [px, py] = local(e); const n = hit(px, py); if (n?.char && !n.main) go(n.char.id, 'graph'); });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [px, py] = local(e), w = toWorld(px, py);
      zoom = Math.min(2.5, Math.max(0.4, zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
      ox = px - w.x * zoom; oy = py - w.y * zoom; paint();
    }, { passive: false });
    new ResizeObserver(size).observe(wrap);

    $(el, '[data-act=reset]').onclick = () => { meta.graph = {}; saveChar(c, { meta }); graph({ el, c, head }); };
    $(el, '[data-act=png]').onclick = () => {
      paint(true);
      try {
        cv.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${c.name || 'character'}_관계도.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); paint(); });
      } catch { toast('이미지로 저장하지 못했어요'); paint(); }
    };
  }

  draw();
}
