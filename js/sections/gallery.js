import { saveChar } from '../app.js';
import { db, upload, removeFiles, imgUrl } from '../db.js';
import { esc, $, $$, imgTag, hydrate, dropzone, shrink, guard, toast, formModal, confirmBox, ICON } from '../ui.js';
import { load, add } from './list.js';

const cur = {};
const gridSize = {};
const sortDir = {};
const selecting = {};

export default async function gallery({ el, c, head }) {
  const rows = await load(c, 'image');
  const meta = c.meta || (c.meta = {});
  meta.folders ??= [];
  const draw = () => {
    const f = cur[c.id] || '전체';
    const size = gridSize[c.id] || 'md';
    const dir = sortDir[c.id] || 'new';
    const sel = selecting[c.id] || false;
    const filtered = rows.filter((r) => f === '전체' || r.data.folder === f);
    const shown = [...filtered].sort((a, b) => dir === 'new' ? new Date(b.created_at) - new Date(a.created_at) : new Date(a.created_at) - new Date(b.created_at));
    const count = (n) => rows.filter((r) => r.data.folder === n).length;
    const selected = new Set();
    el.innerHTML = `
      ${head(`<span class="mono muted" style="font-size:12px">${rows.length}장</span>`)}
      <div class="toolbar">
        <button class="chip ${f === '전체' ? 'on' : ''}" data-f="전체">전체 ${rows.length}</button>
        ${meta.folders.map((n) => `<button class="chip ${f === n ? 'on' : ''}" data-f="${esc(n)}">${esc(n)} ${count(n)}</button>`).join('')}
        <button class="chip" data-act="folder-add">+ 폴더</button>
        <span class="grow"></span>
        ${f !== '전체' ? '<button class="btn sm ghost" data-act="folder-ren">이름 바꾸기</button><button class="btn sm danger" data-act="folder-del">폴더 삭제</button>' : ''}
      </div>
      <div class="gallery-controls">
        <button type="button" class="dropzone-compact" id="dz">${ICON.upload}<span>${f === '전체' ? '' : `「${esc(f)}」에 `}이미지 올리기</span></button>
        <div class="gallery-actions">
          <button class="btn sm ghost ${sel ? 'on' : ''}" data-act="select-toggle">${sel ? '취소' : '선택'}</button>
          <span class="sep-v"></span>
          <button class="btn sm ghost" data-act="sort" title="${dir === 'new' ? '최신순' : '오래된순'}">${dir === 'new' ? '↓ 최신' : '↑ 오래된'}</button>
          <span class="sep-v"></span>
          <button class="grid-btn ${size === 'sm' ? 'on' : ''}" data-size="sm" title="작게">${ICON.gridSm}</button>
          <button class="grid-btn ${size === 'md' ? 'on' : ''}" data-size="md" title="보통">${ICON.gridMd}</button>
          <button class="grid-btn ${size === 'lg' ? 'on' : ''}" data-size="lg" title="크게">${ICON.gridLg}</button>
        </div>
      </div>
      ${sel ? '<div class="bulk-bar" id="bulk"><span class="bulk-count">0장 선택</span><button class="btn sm ghost" data-act="bulk-move">이동</button><button class="btn sm danger" data-act="bulk-del">삭제</button><button class="btn sm ghost" data-act="bulk-all">전체 선택</button></div>' : ''}
      ${shown.length ? `<div class="gallery ${size === 'sm' ? 'gallery-sm' : size === 'lg' ? 'gallery-lg' : ''}">${shown.map((r) => `
        <figure class="shot ${sel ? 'selectable' : ''}" data-id="${r.id}" style="margin:0">
          ${sel ? `<div class="check-mark"></div>` : ''}
          <button type="button" class="open" aria-label="크게 보기">${imgTag(r.data.path)}</button>
          ${r.data.caption ? `<figcaption class="shot-caption">${esc(r.data.caption)}</figcaption>` : ''}
          ${!sel ? `<div class="acts"><button type="button" data-act="caption">${r.data.caption ? '메모' : '+ 메모'}</button><button type="button" data-act="move">이동</button><button type="button" data-act="del">삭제</button></div>` : ''}
        </figure>`).join('')}</div>` : `<div class="empty"><b>이미지가 없어요</b>레퍼런스, 커미션, 착장을 모아두세요.</div>`}`;
    hydrate(el);

    // folder tabs
    $$(el, '[data-f]').forEach((b) => (b.onclick = () => { cur[c.id] = b.dataset.f; draw(); }));
    $(el, '[data-act=folder-add]').onclick = async () => {
      const v = await formModal('새 폴더', [{ name: 'n', label: '폴더 이름' }], { okLabel: '만들기' });
      if (!v?.n) return;
      if (meta.folders.includes(v.n)) return toast('이미 있는 폴더예요');
      meta.folders = [...meta.folders, v.n]; saveChar(c, { meta });
      cur[c.id] = v.n; draw();
    };
    $(el, '[data-act=folder-ren]')?.addEventListener('click', async () => {
      const v = await formModal('폴더 이름 바꾸기', [{ name: 'n', label: '새 이름', value: f }], { okLabel: '바꾸기' });
      if (!v?.n || v.n === f) return;
      await guard(async () => {
        for (const r of rows.filter((x) => x.data.folder === f)) { r.data.folder = v.n; await db.updEntry(r.id, { data: r.data }); }
        meta.folders = meta.folders.map((x) => (x === f ? v.n : x)); saveChar(c, { meta });
        cur[c.id] = v.n; draw();
      });
    });
    $(el, '[data-act=folder-del]')?.addEventListener('click', async () => {
      if (!(await confirmBox(`「${f}」 폴더를 지울까요? 안의 이미지는 남아요.`))) return;
      await guard(async () => {
        for (const r of rows.filter((x) => x.data.folder === f)) { delete r.data.folder; await db.updEntry(r.id, { data: r.data }); }
        meta.folders = meta.folders.filter((x) => x !== f); saveChar(c, { meta });
        cur[c.id] = '전체'; draw();
      });
    });

    // upload
    dropzone($(el, '#dz'), async (files) => {
      toast(`${files.length}장 올리는 중…`, 60000);
      await guard(async () => {
        for (const file of files) {
          const path = await upload(await shrink(file), file.name);
          await add(c, 'image', { path, ...(f !== '전체' ? { folder: f } : {}) }, rows);
        }
        draw();
      }, `${files.length}장 올렸어요`);
    });

    // grid size
    $$(el, '.grid-btn').forEach((b) => (b.onclick = () => { gridSize[c.id] = b.dataset.size; draw(); }));

    // sort
    $(el, '[data-act=sort]').onclick = () => { sortDir[c.id] = dir === 'new' ? 'old' : 'new'; draw(); };

    // select mode
    $(el, '[data-act=select-toggle]').onclick = () => { selecting[c.id] = !sel; draw(); };

    if (sel) {
      // multi-select logic
      $$(el, '.shot').forEach((s) => {
        s.onclick = (e) => {
          if (e.target.closest('.acts')) return;
          s.classList.toggle('selected');
          const id = s.dataset.id;
          if (selected.has(id)) selected.delete(id); else selected.add(id);
          updateBulk();
        };
      });
      const updateBulk = () => {
        const cnt = $$(el, '.shot.selected').length;
        const bc = $(el, '.bulk-count');
        if (bc) bc.textContent = `${cnt}장 선택`;
      };
      $(el, '[data-act=bulk-all]')?.addEventListener('click', () => {
        const shots = $$(el, '.shot');
        const allSelected = shots.every((s) => s.classList.contains('selected'));
        shots.forEach((s) => {
          if (allSelected) s.classList.remove('selected');
          else s.classList.add('selected');
        });
        updateBulk();
      });
      $(el, '[data-act=bulk-del]')?.addEventListener('click', async () => {
        const ids = $$(el, '.shot.selected').map((s) => s.dataset.id);
        if (!ids.length) return toast('선택된 이미지가 없어요');
        if (!(await confirmBox(`${ids.length}장을 삭제할까요?`))) return;
        await guard(async () => {
          for (const id of ids) {
            const r = rows.find((x) => x.id === id);
            if (r) { await db.delEntry(r.id); await removeFiles([r.data.path]); rows.splice(rows.indexOf(r), 1); }
          }
          draw();
        }, `${ids.length}장 삭제했어요`);
      });
      $(el, '[data-act=bulk-move]')?.addEventListener('click', async () => {
        const ids = $$(el, '.shot.selected').map((s) => s.dataset.id);
        if (!ids.length) return toast('선택된 이미지가 없어요');
        const v = await formModal('폴더로 이동', [{ name: 'f', label: '폴더', type: 'select', value: '', options: [['', '(폴더 없음)'], ...meta.folders.map((n) => [n, n])] }], { okLabel: '이동' });
        if (!v) return;
        await guard(async () => {
          for (const id of ids) {
            const r = rows.find((x) => x.id === id);
            if (!r) continue;
            if (v.f) r.data.folder = v.f; else delete r.data.folder;
            await db.updEntry(r.id, { data: r.data });
          }
          draw();
        }, `${ids.length}장 이동했어요`);
      });
    } else {
      // normal mode - per-image actions
      $$(el, '.shot').forEach((s) => {
        const r = rows.find((x) => x.id === s.dataset.id);
        $(s, '.open').onclick = () => lightbox(shown, shown.indexOf(r), meta, rows, c, draw);
        $(s, '[data-act=del]').onclick = async () => {
          if (!(await confirmBox('이 이미지를 지울까요?'))) return;
          await guard(async () => { await db.delEntry(r.id); await removeFiles([r.data.path]); rows.splice(rows.indexOf(r), 1); draw(); }, '삭제했어요');
        };
        $(s, '[data-act=move]').onclick = async () => {
          const v = await formModal('폴더로 이동', [{ name: 'f', label: '폴더', type: 'select', value: r.data.folder || '', options: [['', '(폴더 없음)'], ...meta.folders.map((n) => [n, n])] }], { okLabel: '이동' });
          if (!v) return;
          if (v.f) r.data.folder = v.f; else delete r.data.folder;
          await guard(() => db.updEntry(r.id, { data: r.data })); draw();
        };
        $(s, '[data-act=caption]')?.addEventListener('click', async () => {
          const v = await formModal('이미지 메모', [{ name: 'caption', label: '메모', type: 'textarea', value: r.data.caption || '', ph: '이 이미지에 대한 메모를 남겨보세요' }], { okLabel: '저장' });
          if (!v) return;
          r.data.caption = v.caption || undefined;
          if (!r.data.caption) delete r.data.caption;
          await guard(() => db.updEntry(r.id, { data: r.data })); draw();
        });
      });
    }
  };
  draw();
}

export function lightbox(list, start, meta, rows, c, redraw) {
  let i = start;
  const box = document.createElement('div');
  box.className = 'lightbox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');

  let touchStartX = 0;
  let touchStartY = 0;

  const show = async () => {
    const r = list[i];
    const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    const fileName = r.data.path?.split('/').pop() || '';
    box.innerHTML = `
      <div class="lb-top">
        <span class="lb-info">${dateStr}${r.data.folder ? ` · ${esc(r.data.folder)}` : ''}</span>
        <button data-c class="lb-close" aria-label="닫기">${ICON.x}</button>
      </div>
      <div class="lb-body"><img alt="${esc(r.data.caption || '')}"></div>
      ${r.data.caption ? `<p class="lb-caption">${esc(r.data.caption)}</p>` : ''}
      <div class="bar">
        <button data-p aria-label="이전" ${list.length < 2 ? 'disabled' : ''}>‹</button>
        <span>${i + 1} / ${list.length}</span>
        <button data-n aria-label="다음" ${list.length < 2 ? 'disabled' : ''}>›</button>
        <button data-cap>${r.data.caption ? '메모 수정' : '+ 메모'}</button>
        <button data-d>다운로드</button>
      </div>`;
    const url = await imgUrl(r.data.path);
    box.querySelector('img').src = url;
    box.querySelector('[data-p]').onclick = () => { i = (i - 1 + list.length) % list.length; show(); };
    box.querySelector('[data-n]').onclick = () => { i = (i + 1) % list.length; show(); };
    box.querySelector('[data-c]').onclick = close;
    box.querySelector('[data-d]').onclick = async () => {
      const blob = await (await fetch(url)).blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    box.querySelector('[data-cap]').onclick = async () => {
      const v = await formModal('이미지 메모', [{ name: 'caption', label: '메모', type: 'textarea', value: r.data.caption || '', ph: '이 이미지에 대한 메모를 남겨보세요' }], { okLabel: '저장' });
      if (!v) return;
      r.data.caption = v.caption || undefined;
      if (!r.data.caption) delete r.data.caption;
      await guard(() => db.updEntry(r.id, { data: r.data }));
      if (redraw) redraw();
      show();
    };
  };

  // touch swipe
  box.addEventListener('touchstart', (e) => {
    if (e.target.closest('.bar, .lb-top')) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  box.addEventListener('touchend', (e) => {
    if (e.target.closest('.bar, .lb-top')) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
    if (Math.abs(dx) > 50 && dy < 100) {
      if (dx < 0) { i = (i + 1) % list.length; show(); }
      else { i = (i - 1 + list.length) % list.length; show(); }
    }
  }, { passive: true });

  const key = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') box.querySelector('[data-p]')?.click();
    if (e.key === 'ArrowRight') box.querySelector('[data-n]')?.click();
  };
  function close() { box.remove(); document.removeEventListener('keydown', key); }
  box.addEventListener('click', (e) => { if (e.target === box || e.target.classList.contains('lb-body')) close(); });
  document.addEventListener('keydown', key);
  document.body.appendChild(box);
  show();
}
