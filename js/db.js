import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

export const db = {
  async chars() { return ok(await sb.from('characters').select('*').order('sort').order('created_at')); },
  async addChar(row) { return ok(await sb.from('characters').insert(row).select().single()); },
  async updChar(id, patch) { return ok(await sb.from('characters').update(patch).eq('id', id).select('id').single()); },
  async delChar(id) { ok(await sb.from('characters').delete().eq('id', id)); },

  async entries(charId, section) {
    return ok(await sb.from('entries').select('*').eq('char_id', charId).eq('section', section).order('sort').order('created_at'));
  },
  async allEntries() { return ok(await sb.from('entries').select('*').order('sort')); },
  async addEntry(row) { return ok(await sb.from('entries').insert(row).select().single()); },
  async updEntry(id, patch) { return ok(await sb.from('entries').update(patch).eq('id', id).select('id').single()); },
  async delEntry(id) { ok(await sb.from('entries').delete().eq('id', id)); },

  async rels() { return ok(await sb.from('relations').select('*').order('created_at')); },
  async addRel(row) { return ok(await sb.from('relations').insert(row).select().single()); },
  async updRel(id, patch) { return ok(await sb.from('relations').update(patch).eq('id', id).select('id').single()); },
  async delRel(id) { ok(await sb.from('relations').delete().eq('id', id)); },

  async settings() { const r = ok(await sb.from('settings').select('data').maybeSingle()); return r?.data || {}; },
  async saveSettings(data) { ok(await sb.from('settings').upsert({ owner: (await sb.auth.getUser()).data.user.id, data })); },
};

// ── 이미지 ──
let uidCache = null;
async function uid() { return uidCache ??= (await sb.auth.getUser()).data.user.id; }
export async function upload(blob, name = 'image.png') {
  const ext = (name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `${await uid()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  ok(await sb.storage.from('images').upload(path, blob, { contentType: blob.type || 'image/png' }));
  return path;
}
export async function removeFiles(paths) {
  const list = paths.filter(Boolean);
  if (list.length) await sb.storage.from('images').remove(list);
}
const urlCache = new Map();
export async function imgUrl(path) {
  if (!path) return '';
  const hit = urlCache.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const d = ok(await sb.storage.from('images').createSignedUrl(path, 3600));
  urlCache.set(path, { url: d.signedUrl, exp: Date.now() + 3500e3 });
  return d.signedUrl;
}
