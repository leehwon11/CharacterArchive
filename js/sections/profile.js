import { saveChar, deleteChar, KINDS } from '../app.js';
import { upload, removeFiles } from '../db.js';
import { esc, $, $$, imgTag, hydrate, pickFiles, shrink, guard, richHTML, bindRich, iconBtn } from '../ui.js';

export const PROFILE = {
  basic: ['기본', [
    ['age', '나이 / 생일'], ['gender', '성별'], ['job', '직업 / 소속'], ['world', '출처 / 세계관'], ['race', '국적 / 종족'],
    ['body', '키 / 체형'], ['mbti', 'MBTI'], ['enneagram', '에니어그램'], ['blood', '혈액형'],
  ], 'line'],
  look: ['외형', [
    ['appear', '전체 외형'], ['firstlook', '첫인상을 결정짓는 포인트'], ['habit', '자주 짓는 표정 / 몸짓 버릇'], ['scar', '상처 / 신체적 특이점'],
    ['style', '즐겨 입는 스타일 / 애착 아이템'], ['emotion', '감정이 격해질 때 몸·표정 변화'],
  ]],
  mind: ['성격', [
    ['personality', '전반적인 성격 / 말투'], ['gap', '평소 모습 vs 본모습의 괴리'], ['stress', '스트레스 상황에서의 반응'], ['selfimage', '타인에게 보이고 싶은 이미지'],
    ['nonneg', '절대 양보 못 하는 것'], ['closediff', '처음 만났을 때 vs 친해졌을 때'],
  ]],
  power: ['능력', [
    ['ability', '주력 능력 / 기술'], ['ablimit', '능력의 한계 / 대가'], ['abhow', '습득 경위'], ['abhidden', '잠재력 / 숨겨진 약점'], ['abchange', '능력 사용 시 변화'],
  ]],
  etc: ['기타', [['likes', '좋아하는 것 / 싫어하는 것'], ['etc', '기타 메모']]],
};

export default async function profile({ el, c, sub, head }) {
  const tab = PROFILE[sub] ? sub : 'basic';
  const [label, fields, mode] = PROFILE[tab];
  const p = c.profile || (c.profile = {});

  el.innerHTML = `
    ${head(`<button class="btn sm danger" data-act="discard">파일 폐기</button>`)}
    <div class="ph">
      <div>
        <button type="button" class="photo" data-act="photo" aria-label="사진 바꾸기">${imgTag(c.image_path, c.name) || '사진 올리기'}</button>
        ${c.image_path ? '<div class="photo-acts"><button class="btn sm ghost" data-act="photo-del">사진 삭제</button></div>' : ''}
      </div>
      <div class="ph-main">
        <div class="stamp-row">
          <label for="pk" class="hide">유형</label>
          <select id="pk" class="stamp">${KINDS.map((k) => `<option ${k === c.kind ? 'selected' : ''}>${k}</option>`).join('')}</select>
          <label for="pg" class="hide">장르 / 세계관</label>
          <input id="pg" class="line-input mono" style="font-size:12px;max-width:260px;color:var(--mute)" value="${esc(c.genre)}" placeholder="장르 / 세계관">
        </div>
        <label for="pn" class="hide">이름</label>
        <input id="pn" class="name-input" value="${esc(c.name)}" placeholder="캐릭터 이름">
        <label for="pi" class="hide">한 줄 소개</label>
        <input id="pi" class="line-input" style="color:var(--ink2)" value="${esc(c.intro)}" placeholder="한 줄 소개">
        <div class="palette" aria-label="대표 컬러">
          <label class="sw" style="background:${esc(c.color)};cursor:pointer" title="대표색 바꾸기"><input type="color" value="${esc(c.color)}" data-act="main-color" style="opacity:0;width:100%;height:100%;cursor:pointer" aria-label="대표색"></label>
          ${(c.palette || []).map((col, i) => `<button type="button" class="sw" style="background:${esc(col)}" data-pal="${i}" aria-label="${esc(col)} 지우기" title="${esc(col)} · 눌러서 지우기"></button>`).join('')}
          <label class="add" style="display:inline-flex;align-items:center;justify-content:center;cursor:pointer" title="색 추가">+<input type="color" data-act="pal-add" style="position:absolute;opacity:0;width:1px;height:1px" aria-label="팔레트 색 추가"></label>
          <span class="mono muted" style="font-size:11px;margin-left:10px">${esc(c.color)}</span>
        </div>
        <div class="songs">
          ${(c.songs || []).map((s, i) => `
            <div class="song"><span aria-hidden="true">♪</span>
              <input data-song="${i}" data-k="title" value="${esc(s.title)}" placeholder="곡 제목" aria-label="곡 제목" style="width:150px">
              <input data-song="${i}" data-k="artist" value="${esc(s.artist)}" placeholder="아티스트" aria-label="아티스트" style="width:110px">
              <input data-song="${i}" data-k="url" value="${esc(s.url)}" placeholder="링크" aria-label="링크" style="width:150px">
              ${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="듣기">▶</a>` : ''}
              ${iconBtn('song-del', '곡 삭제', 'x', 'del', `data-i="${i}"`)}
            </div>`).join('')}
          <button class="btn sm ghost" data-act="song-add" style="align-self:flex-start">+ 테마곡</button>
        </div>
      </div>
    </div>
    <div class="subtabs" role="tablist">${Object.entries(PROFILE).map(([k, [l]]) => `<a href="#/c/${c.id}/profile/${k}" role="tab" aria-selected="${k === tab}" class="subtab ${k === tab ? 'on' : ''}">${l}</a>`).join('')}</div>
    <div class="rows">
      ${fields.map(([k, l]) => mode === 'line'
        ? `<div class="frow"><label for="f-${k}">${esc(l)}</label><input id="f-${k}" class="line-input" data-f="${k}" value="${esc(p[k])}" placeholder="—"></div>`
        : `<div class="frow"><div class="k">${esc(l)}</div>${richHTML(k, p[k], '—')}</div>`).join('')}
    </div>`;
  hydrate(el);

  const save = (patch) => saveChar(c, patch);
  $(el, '#pn').oninput = (e) => save({ name: e.target.value });
  $(el, '#pi').oninput = (e) => save({ intro: e.target.value });
  $(el, '#pg').oninput = (e) => save({ genre: e.target.value });
  $(el, '#pk').onchange = (e) => save({ kind: e.target.value });
  $$(el, '[data-f]').forEach((i) => (i.oninput = () => { p[i.dataset.f] = i.value; save({ profile: p }); }));
  bindRich(el, (k, html) => { p[k] = html; save({ profile: p }); });

  $(el, '[data-act=main-color]').onchange = (e) => { save({ color: e.target.value }); profile({ el, c, sub, head }); };
  $(el, '[data-act=pal-add]').onchange = (e) => { save({ palette: [...(c.palette || []), e.target.value] }); profile({ el, c, sub, head }); };
  $$(el, '[data-pal]').forEach((b) => (b.onclick = () => { const pal = [...c.palette]; pal.splice(+b.dataset.pal, 1); save({ palette: pal }); profile({ el, c, sub, head }); }));

  $$(el, '[data-song]').forEach((i) => (i.oninput = () => { c.songs[+i.dataset.song][i.dataset.k] = i.value; save({ songs: c.songs }); }));
  $(el, '[data-act=song-add]').onclick = () => { save({ songs: [...(c.songs || []), { title: '', artist: '', url: '' }] }); profile({ el, c, sub, head }).then(() => $$(el, '[data-k=title]').at(-1)?.focus()); };
  $$(el, '[data-act=song-del]').forEach((b) => (b.onclick = () => { const s = [...c.songs]; s.splice(+b.dataset.i, 1); save({ songs: s }); profile({ el, c, sub, head }); }));

  $(el, '[data-act=photo]').onclick = async () => {
    const [f] = await pickFiles(); if (!f) return;
    await guard(async () => {
      const old = c.image_path;
      const path = await upload(await shrink(f, 1200), f.name);
      saveChar(c, { image_path: path });
      if (old) removeFiles([old]);
      profile({ el, c, sub, head });
    }, '사진을 바꿨어요');
  };
  $(el, '[data-act=photo-del]')?.addEventListener('click', () => { const old = c.image_path; saveChar(c, { image_path: null }); removeFiles([old]); profile({ el, c, sub, head }); });
  $(el, '[data-act=discard]').onclick = () => deleteChar(c);
}
