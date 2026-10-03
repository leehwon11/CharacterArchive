import { saveChar } from '../app.js';
import { esc, richHTML, bindRich } from '../ui.js';

export const INNER = [
  ['내면 · 심리', [['rp_desire', '진심으로 원하는 것'], ['rp_fear', '가장 두려운 것'], ['rp_selfview', '자신에 대한 인식'], ['rp_hidden', '감추고 있는 것 / 인정하기 싫은 것'], ['rp_gave_up', '무언가를 포기한 경험과 지금의 감정']]],
  ['대인관계 패턴', [['rp_conflict', '갈등 상황에서의 반응'], ['rp_love', '연애 / 감정 표현 방식'], ['rp_like_type', '호감 / 비호감 유형'], ['rp_depend', '의존성 / 독립성'], ['rp_special', '특이한 대인관계 패턴']]],
  ['서사 · 과거', [['rp_birth', '출생 배경'], ['rp_turning', '전환점'], ['rp_now', '현재 처한 상황 및 목표'], ['rp_choice', '과거의 선택과 그 결과'], ['rp_unresolved', '아직 해결되지 않은 관계']]],
];

export default async function inner({ el, c, head }) {
  const d = c.inner_data || (c.inner_data = {});
  el.innerHTML = head() + INNER.map(([g, fields]) => `
    <div class="group-title">${esc(g)}</div>
    <div class="rows">${fields.map(([k, l]) => `<div class="frow"><div class="k">${esc(l)}</div>${richHTML(k, d[k], '—')}</div>`).join('')}</div>`).join('');
  bindRich(el, (k, html) => { d[k] = html; saveChar(c, { inner_data: d }); });
}
