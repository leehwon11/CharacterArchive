import { saveChar } from '../app.js';
import { db, upload, removeFiles, imgUrl } from '../db.js';
import { esc, $, $$, imgTag, hydrate, dropzone, shrink, guard, toast, formModal, confirmBox, ICON } from '../ui.js';
import { load, add } from './list.js';

const cur = {};

export default async function gallery({ el, c, head }) {
  const rows = await load(c, 'image');
  const meta = c.meta || (c.meta = {});
  meta.folders ??= [];
  const draw = () => {
    const f = cur[c.id] || '전체';
    const shown = rows.filter((r) => f === '전체' || r.data.folder === f);
    const count = (n) => rows.filter((r) => r.data.folder === n).length;
    el.innerHTML = `
      ${head(`<span class="mono muted" style="font-size:12px">${rows.length}장</span>`)}
      <div class="toolbar">
        <button class="chip ${f === '전체' ? 'on' : ''}" data-f="전체">전체 ${rows.length}</button>
        ${meta.folders.map((n) => `<button class="chip ${f === n ? 'on' : ''}" data-f="${esc(n)}">${esc(n)} ${count(n)}</button>`).join('')}
        <button class="chip" data-act="folder-add">+ 폴더</button>
        <span class="grow"></span>
        ${f !== '전체' ? '<button class="btn sm ghost" data-act="folder-ren">이름 바꾸기</button><button class="btn sm danger" data-act="folder-del">폴더 삭제</button>' : ''}
      </div>
      <button type="button" class="dropzone" id="dz">${ICON.upload}<span>${f === '전체' ? '' : `「${esc(f)}」에 `}이미지 올리기 — 클릭하거나 끌어다 놓기</span></button>
      ${shown.length ? `<div class="gallery">${shown.map((r) => `
        <figure class="shot" data-id="${r.id}" style="margin:0">
          <button type="button" class="open" aria-label="크게 보기">${imgTag(r.data.path)}</button>
          <div class="acts"><button type="button" data-act="move">이동</button><button type="button" data-act="del">삭제</button></div>
        </figure>`).join('')}</div>` : `<div class="empty"><b>이미지가 없어요</b>레퍼런스, 커미션, 착장을 모아두세요.</div>`}`;
    hydrate(el);

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
    $$(el, '.shot').forEach((s) => {
      const r = rows.find((x) => x.id === s.dataset.id);
      $(s, '.open').onclick = () => lightbox(shown, shown.indexOf(r));
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
    });
  };
  draw();
}

export function lightbox(list, start) {
  let i = start;
  const box = document.createElement('div');
  box.className = 'lightbox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
  const show = async () => {
    const r = list[i];
    box.innerHTML = `<img alt=""><div class="bar">
      <button data-p aria-label="이전">‹</button><span>${i + 1} / ${list.length}</span><button data-n aria-label="다음">›</button>
      <button data-d>다운로드</button><button data-c>닫기</button></div>`;
    const url = await imgUrl(r.data.path);
    box.querySelector('img').src = url;
    box.querySelector('[data-p]').onclick = () => { i = (i - 1 + list.length) % list.length; show(); };
    box.querySelector('[data-n]').onclick = () => { i = (i + 1) % list.length; show(); };
    box.querySelector('[data-c]').onclick = close;
    box.querySelector('[data-d]').onclick = async () => {
      const blob = await (await fetch(url)).blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = r.data.path.split('/').pop(); a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    box.querySelector('[data-c]').focus();
  };
  const key = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') box.querySelector('[data-p]')?.click(); if (e.key === 'ArrowRight') box.querySelector('[data-n]')?.click(); };
  function close() { box.remove(); document.removeEventListener('keydown', key); }
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  document.addEventListener('keydown', key);
  document.body.appendChild(box);
  show();
}
