import { state, reloadAll, go } from '../app.js';
import { db, upload } from '../db.js';
import { modal, toast, guard, confirmBox, pickFiles, shrink, today } from '../ui.js';
import { PROFILE } from './profile.js';
import { INNER } from './inner.js';

const PF_KEYS = Object.values(PROFILE).flatMap(([, f]) => f.map(([k]) => k));
const RP_KEYS = INNER.flatMap(([, f]) => f.map(([k]) => k));
const LEGACY = () => { try { return JSON.parse(localStorage.getItem('ca_chars') || 'null'); } catch { return null; } };

export function openBackup() {
  const legacy = LEGACY();
  const m = modal(`
    <h3>백업</h3>
    <p class="muted" style="margin:0;font-size:13px">글과 설정은 전부 파일에 담기고, 이미지는 Supabase 저장소에 그대로 있어요.</p>
    <button class="btn solid" data-a="export">전체 백업 받기 (.json)</button>
    <button class="btn" data-a="import">백업 / 예전 사이트 파일 불러오기</button>
    ${legacy?.length ? `<button class="btn" data-a="legacy">이 브라우저에 남은 예전 데이터 가져오기 (${legacy.length}명)</button>` : ''}
    <p class="muted" style="margin:0;font-size:12px">예전 “Character Archive”에서 내보낸 캐릭터 파일도 그대로 불러올 수 있어요. 이미지까지 옮겨져요.</p>
    <div class="m-acts"><button class="btn ghost" data-x>닫기</button></div>`);
  m.el.querySelector('[data-x]').onclick = m.close;
  m.el.querySelector('[data-a=export]').onclick = () => { m.close(); exportAll(); };
  m.el.querySelector('[data-a=import]').onclick = async () => {
    const [f] = await pickFiles({ accept: '.json,application/json' }); if (!f) return;
    m.close();
    let data; try { data = JSON.parse(await f.text()); } catch { return toast('JSON 파일이 아니에요'); }
    if (data.format === 'character-files') importNew(data);
    else if (data.char || data.chars) importLegacy(data.chars || [data.char], data.rels || []);
    else toast('알 수 없는 파일 형식이에요');
  };
  m.el.querySelector('[data-a=legacy]')?.addEventListener('click', () => {
    m.close();
    let rels = []; try { rels = JSON.parse(localStorage.getItem('ca_rels') || '[]'); } catch {}
    importLegacy(legacy, rels);
  });
}

async function exportAll() {
  const data = await guard(async () => ({
    format: 'character-files', version: 1, exportedAt: new Date().toISOString(),
    chars: await db.chars(), entries: await db.allEntries(), rels: await db.rels(), settings: state.settings,
  }));
  if (!data) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = `character-files_${today()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('백업 파일을 받았어요');
}

const strip = (row) => { const { id, owner, created_at, ...rest } = row; return rest; };

async function importNew(data) {
  if (!(await confirmBox(`백업의 캐릭터 ${data.chars.length}명을 지금 데이터에 추가할까요?`, '불러오기'))) return;
  const ok = await guard(async () => {
    const map = {};
    for (const c of data.chars) {
      toast(`불러오는 중… ${c.name}`, 60000);
      const row = strip(c); row.sort = state.chars.length + Object.keys(map).length;
      map[c.id] = (await db.addChar(row)).id;
    }
    for (const e of data.entries) if (map[e.char_id]) await db.addEntry({ ...strip(e), char_id: map[e.char_id] });
    for (const r of data.rels) if (map[r.from_id] && (!r.to_id || map[r.to_id])) await db.addRel({ ...strip(r), from_id: map[r.from_id], to_id: r.to_id ? map[r.to_id] : null });
    // 관계도 위치 키도 새 id 로
    for (const c of data.chars) {
      const g = c.meta?.graph; if (!g) continue;
      const ng = {}; for (const [k, v] of Object.entries(g)) if (map[k]) ng[map[k]] = v;
      await db.updChar(map[c.id], { meta: { ...c.meta, graph: ng } });
    }
    return map;
  }, '불러왔어요');
  if (ok) { await reloadAll(); go(Object.values(ok)[0] || state.chars[0]?.id); location.reload(); }
}

async function dataUrlToPath(src, name) {
  if (!src || !String(src).startsWith('data:')) return null;
  const blob = await (await fetch(src)).blob();
  const file = new File([blob], name, { type: blob.type });
  return upload(await shrink(file), name);
}

export async function importLegacy(chars, rels) {
  chars = (chars || []).filter(Boolean);
  if (!chars.length) return toast('불러올 캐릭터가 없어요');
  if (!(await confirmBox(`예전 사이트의 캐릭터 ${chars.length}명을 옮길까요? 이미지가 많으면 몇 분 걸릴 수 있어요.`, '옮기기'))) return;
  const map = {};
  const ok = await guard(async () => {
    let n = 0;
    for (const o of chars) {
      n++;
      toast(`옮기는 중 ${n}/${chars.length} · ${o.name || '이름 없음'}`, 600000);
      const profile = {}; PF_KEYS.forEach((k) => { if (o[k]) profile[k] = o[k]; });
      const inner = {}; RP_KEYS.forEach((k) => { if (o[k]) inner[k] = o[k]; });
      const folders = (o.galleryFolders || []).map((f) => f.name).filter(Boolean);
      const row = {
        name: o.name || '이름 없음', kind: ['드림주', 'OC', '기타'].includes(o.type) ? o.type : 'OC', genre: o.genre || '',
        color: /^#[0-9a-f]{6}$/i.test(o.color || '') ? o.color : '#c2410c',
        palette: (o.palette || []).filter((x) => /^#[0-9a-f]{6}$/i.test(x)),
        songs: (o.themeSongs || []).map((s) => ({ title: s.title || '', artist: s.artist || '', url: s.url || '' })),
        profile, inner_data: inner, meta: { folders }, sort: state.chars.length + n,
        image_path: await dataUrlToPath(o.img, 'avatar.png').catch(() => null),
      };
      const nc = await db.addChar(row);
      map[o.id] = nc.id;
      let s = 0;
      // 메모 (연결은 두 번에 걸쳐)
      const memoMap = {};
      for (const mm of o.memos || []) {
        const e = await db.addEntry({ char_id: nc.id, section: 'memo', sort: s++, data: { tag: mm.tag || '기타', title: mm.title || '', text: mm.text || '', source: mm.source || '', links: [] } });
        memoMap[mm.id] = e;
      }
      for (const mm of o.memos || []) {
        const links = (mm.links || []).map((l) => memoMap[l]?.id).filter(Boolean);
        if (links.length) { const e = memoMap[mm.id]; e.data.links = links; await db.updEntry(e.id, { data: e.data }); }
      }
      for (const t of o.timeline || []) await db.addEntry({ char_id: nc.id, section: 'timeline', sort: s++, data: { date: t.date || '', title: t.title || '', desc: t.desc || '', dotColor: t.dotColor || '기본' } });
      for (const q of o.quotes || []) await db.addEntry({ char_id: nc.id, section: 'quote', sort: s++, data: { text: q.text || '', context: q.context || '' } });
      for (const d of o.dreams || []) await db.addEntry({ char_id: nc.id, section: 'story', sort: s++, data: { tag: d.tag || '썰', title: d.title || '', text: d.text || '', date: d.date || '', genre: '', chars: '' } });
      for (const f of o.storyFolders || []) for (const st of f.stories || [])
        await db.addEntry({ char_id: nc.id, section: 'story', sort: s++, data: { tag: f.name || '스토리', title: st.title || '', genre: st.genre || '', chars: st.chars || '', text: st.text || '', date: '' } });
      const fname = Object.fromEntries((o.galleryFolders || []).map((f) => [f.id, f.name]));
      let gi = 0;
      for (const g of o.gallery || []) {
        gi++; toast(`옮기는 중 ${n}/${chars.length} · ${o.name} 이미지 ${gi}/${o.gallery.length}`, 600000);
        const path = await dataUrlToPath(g.src, 'image.png').catch(() => null);
        if (path) await db.addEntry({ char_id: nc.id, section: 'image', sort: s++, data: { path, ...(fname[g.folder] ? { folder: fname[g.folder] } : {}) } });
      }
    }
    const seen = new Set();
    for (const r of rels || []) {
      const from = map[r.from]; if (!from) continue;
      const ext = !!r.ext || !map[r.to];
      if (ext && !r.ext) continue; // 상대가 안 옮겨진 내 캐릭터
      const key = [from, ext ? r.extName : map[r.to], r.type].join('|');
      if (seen.has(key)) continue; seen.add(key);
      await db.addRel({ from_id: from, to_id: ext ? null : map[r.to], ext_name: ext ? r.extName || '' : '', type: r.type || '', descr: r.desc || '', dir: ['from', 'to', 'both'].includes(r.dir) ? r.dir : 'both' });
    }
    return true;
  }, `${chars.length}명을 옮겼어요`);
  if (ok) { await reloadAll(); const first = Object.values(map)[0]; location.hash = first ? `#/c/${first}/profile` : '#/'; location.reload(); }
}
