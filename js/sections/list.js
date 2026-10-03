// 메모 · 타임라인 · 대사 · 썰 공통
import { db } from '../db.js';
import { autosave, guard, confirmBox } from '../ui.js';

export const load = (c, section) => db.entries(c.id, section);
export function saveData(row) {
  autosave(`e:${row.id}`, () => db.updEntry(row.id, { data: row.data }));
}
export async function add(c, section, data, rows, atTop = false) {
  const sort = rows.length ? (atTop ? Math.min(...rows.map((r) => r.sort)) - 1 : Math.max(...rows.map((r) => r.sort)) + 1) : 0;
  const row = await guard(() => db.addEntry({ char_id: c.id, section, sort, data }));
  if (row && row !== true) { atTop ? rows.unshift(row) : rows.push(row); return row; }
  return null;
}
export async function remove(rows, row, msg = '이 항목을 지울까요?') {
  if (!(await confirmBox(msg))) return false;
  const ok = await guard(() => db.delEntry(row.id));
  if (ok) rows.splice(rows.indexOf(row), 1);
  return !!ok;
}
export async function move(rows, i, dir) {
  const j = i + dir;
  if (j < 0 || j >= rows.length) return false;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  rows.forEach((r, k) => (r._dirty = r.sort !== k, r.sort = k));
  await guard(() => Promise.all(rows.filter((r) => r._dirty).map((r) => db.updEntry(r.id, { sort: r.sort }))));
  return true;
}
const TAG_COLORS = ['#b42318', '#1d4ed8', '#0f766e', '#7c3aed', '#a16207', '#be185d', '#334155', '#15803d'];
export function tagColor(tag) {
  let h = 0;
  for (const ch of String(tag || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TAG_COLORS[h % TAG_COLORS.length];
}
export const tagsOf = (rows) => [...new Set(rows.map((r) => r.data.tag).filter(Boolean))];
