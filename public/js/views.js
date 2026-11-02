// 화면(HTML) 생성 — 입력칸은 data-path로 상태와 연결되고, 계산값은 data-out으로 갱신됩니다.
import { OPTIONS, SETDECK_KEYS, SETDECK_LABELS, potmBonus } from './calc.js';
import { DATA } from './data.js';

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (v, d = 2) => {
  if (v === '' || v === null || v === undefined) return '';
  if (typeof v !== 'number') return String(v);
  if (!Number.isFinite(v)) return '';
  return v.toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: 0 });
};
export const pct = (v) => (v === '' || v === null || v === undefined ? '–' : (v * 100).toLocaleString('ko-KR', { maximumFractionDigits: v < 0.001 ? 4 : 2 }) + '%');

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
export function setPath(obj, path, val) {
  const ks = path.split('.');
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) {
    if (o[ks[i]] == null) o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {};
    o = o[ks[i]];
  }
  o[ks[ks.length - 1]] = val;
}

// ---- 입력 위젯 ----------------------------------------------------------
let ctx = { state: null, ro: false };
export function bind(state, ro) { ctx = { state, ro }; }
const val = (p) => getPath(ctx.state, p);
const dis = () => (ctx.ro ? ' disabled' : '');

function num(p, o = {}) {
  const v = val(p);
  return `<input class="in num${o.cls ? ' ' + o.cls : ''}" type="number" inputmode="decimal" step="any" data-path="${p}" data-t="num" value="${esc(v ?? '')}"${o.min != null ? ` min="${o.min}"` : ''}${o.max != null ? ` max="${o.max}"` : ''} aria-label="${esc(o.label || p)}"${dis()}>`;
}
function txt(p, o = {}) {
  return `<input class="in txt${o.cls ? ' ' + o.cls : ''}" type="text" data-path="${p}" data-t="str" value="${esc(val(p) ?? '')}"${o.list ? ` list="${o.list}"` : ''} placeholder="${esc(o.ph || '')}" aria-label="${esc(o.label || p)}"${dis()}>`;
}
function sel(p, opts, o = {}) {
  const v = val(p) ?? '';
  const list = o.blank && !opts.includes('') ? ['', ...opts] : opts;
  return `<select class="in sel${o.cls ? ' ' + o.cls : ''}" data-path="${p}" data-t="${o.t || 'str'}" aria-label="${esc(o.label || p)}"${dis()}>${list
    .map((x) => `<option value="${esc(x)}"${String(x) === String(v) ? ' selected' : ''}>${esc(x === '' ? (o.blankLabel ?? '—') : x)}</option>`)
    .join('')}</select>`;
}
function chk(p, o = {}) {
  return `<label class="chk"><input type="checkbox" data-path="${p}" data-t="bool"${val(p) ? ' checked' : ''} aria-label="${esc(o.label || p)}"${dis()}><span></span></label>`;
}
const out = (k, cls = '') => `<output class="out ${cls}" data-out="${k}"></output>`;

export function datalists() {
  return `<datalist id="dl-skill-b">${DATA.skillBatter.map((r) => `<option value="${esc(r[0])}">`).join('')}</datalist>
  <datalist id="dl-skill-p">${DATA.skillPitcher.map((r) => `<option value="${esc(r[0])}">`).join('')}</datalist>`;
}

// =====================================================================
//  덱 보정 계산기
// =====================================================================
export function renderCalc(st) {
  const P = 'calc';
  const s = `${P}.settings`;
  const bRows = st.calc.batters.map((b, i) => {
    const p = `${P}.batters.${i}`;
    return `<tr>
      <th class="pos">${esc(b.pos)}</th>
      <td>${txt(p + '.name', { cls: 'name', label: '타자 이름' })}</td>
      <td class="score">${out(`c.b.${i}.score`)}</td>
      ${['power', 'contact', 'eye', 'patience'].map((k) => `<td>${num(`${p}.${k}`, { label: k })}<small class="plus" data-out="c.b.${i}.plus"></small></td>`).join('')}
      <td>${num(p + '.skill', { label: '스킬점수' })}</td>
      <td>${num(p + '.white', { cls: 'xs', min: 0, label: '흰존' })}</td>
      <td>${num(p + '.cold', { cls: 'xs', min: 0, label: '콜존' })}</td>
      <td>${sel(p + '.fullSwing', OPTIONS.sr)}</td>
      <td>${sel(p + '.clutch', OPTIONS.sr)}</td>
      <td>${sel(p + '.gakjam', OPTIONS.gakjamCalc)}</td>
      <td class="c">${chk(p + '.leftBat', { label: '좌타' })}</td>
      <td>${num(p + '.launch', { cls: 'xs', label: '발사각' })}<small class="hint" data-out="c.b.${i}.launch"></small></td>
      <td>${sel(p + '.potm', OPTIONS.potm, { blankLabel: '없음' })}</td>
    </tr>`;
  }).join('');
  const pRows = st.calc.pitchers.map((x, i) => {
    const p = `${P}.pitchers.${i}`;
    return `<tr>
      <th class="pos">${esc(x.pos)}</th>
      <td>${txt(p + '.name', { cls: 'name', label: '투수 이름' })}</td>
      <td class="score">${out(`c.p.${i}.score`)}</td>
      <td>${num(p + '.stuff', { label: '변화' })}<small class="plus" data-out="c.p.${i}.plus"></small></td>
      <td>${num(p + '.velo', { label: '구위' })}<small class="plus" data-out="c.p.${i}.plus"></small></td>
      <td>${num(p + '.skill', { label: '스킬점수' })}</td>
      <td>${sel(p + '.long', OPTIONS.sr)}</td>
      <td>${sel(p + '.calm', OPTIONS.sr)}</td>
      <td>${sel(p + '.gakjam', OPTIONS.gakjamCalc)}</td>
      <td class="c">${chk(p + '.lefty', { label: '좌완' })}</td>
      <td>${sel(p + '.potm', OPTIONS.potm, { blankLabel: '없음' })}</td>
      <td class="out-c">${out(`c.p.${i}.tactic`)}</td>
    </tr>`;
  }).join('');
  return `
  <section class="panel">
    <h3>공통 설정</h3>
    <div class="fields">
      <label>타자 국에 ${sel(s + '.batterBuff', OPTIONS.buffBatter)}</label>
      <label>투수 국에 ${sel(s + '.pitcherBuff', OPTIONS.buffPitcher)}</label>
      <label>포수리드 ${sel(s + '.catcherLead', OPTIONS.catcherLead)}</label>
      <label>투수전술 ${sel(s + '.tactic', OPTIONS.tactic)}</label>
      <label>승리조 ${sel(s + '.winTeam', OPTIONS.winTeam)}</label>
      <label>추격조 ${sel(s + '.chaseTeam', OPTIONS.chaseTeam)}</label>
      <div class="field-note">중계 순서 <b data-out="c.relay"></b><br><span>중간계투는 배율이 다르니 이 순서대로 1RP~6RP에 입력하세요.</span></div>
    </div>
  </section>
  <section class="panel">
    <div class="panel-head"><h3>타자</h3><div class="mini-sum">보정 합 <b data-out="c.bsum"></b> · 평균 <b data-out="c.bavg"></b></div></div>
    <p class="help">스탯은 POTM 보너스를 뺀 <b>기본값</b>을 입력하세요. POTM을 고르면 원본 매크로처럼 스탯마다 보너스가 자동으로 더해집니다(작은 회색 숫자). 발사각에는 숫자만 입력합니다.</p>
    <div class="tbl-wrap"><table class="grid">
      <thead><tr><th>포지션</th><th>이름</th><th>보정스탯</th><th>파워</th><th>정확</th><th>선구</th><th>인내</th><th>스킬점수</th><th>흰존</th><th>콜존</th><th>풀스윙</th><th>클러치</th><th>각잠</th><th>좌타</th><th>발사각</th><th>POTM</th></tr></thead>
      <tbody>${bRows}</tbody>
    </table></div>
    <div class="groups">
      <div><span>코어 (상위 3명 평균 ×1.3)</span><b data-out="c.g.core"></b></div>
      <div><span>상위 (4·5위 ×1.15)</span><b data-out="c.g.upper"></b></div>
      <div><span>중위 (6·7위 ×1)</span><b data-out="c.g.middle"></b></div>
      <div><span>하위 (8·9위 ×0.75)</span><b data-out="c.g.lower"></b></div>
    </div>
  </section>
  <section class="panel">
    <div class="panel-head"><h3>투수</h3><div class="mini-sum">보정 합 <b data-out="c.psum"></b> · 평균 <b data-out="c.pavg"></b></div></div>
    <div class="tbl-wrap"><table class="grid">
      <thead><tr><th>포지션</th><th>이름</th><th>보정스탯</th><th>변화</th><th>구위</th><th>스킬점수</th><th>장억</th><th>침착</th><th>각잠</th><th>좌완</th><th>POTM</th><th>전술</th></tr></thead>
      <tbody>${pRows}</tbody>
    </table></div>
    <div class="groups">
      <div><span>선발 합 (1위 ×1.4, 2~4위 ×1.3, 5위 ×1.2)</span><b data-out="c.sp"></b></div>
      <div><span>선발 평균 (÷6.5)</span><b data-out="c.spavg"></b></div>
      <div><span>중계 합 (1~5RP ×0.8/0.7/0.5/0.3/0.1)</span><b data-out="c.rp"></b></div>
      <div><span>중계 평균 (÷2.4)</span><b data-out="c.rpavg"></b></div>
      <div><span>마무리 (×0.8)</span><b data-out="c.cp"></b></div>
    </div>
  </section>
  <section class="panel two">
    <div>
      <h3>훈재·특재 비교 계산기</h3>
      <p class="help">파몰·구몰 확인용. 타자는 파1·정0.85·선0.4, 투수는 구1·변0.78.</p>
      <table class="grid compact">
        <thead><tr><th></th><th>파워</th><th>정확</th><th>선구</th><th>보정</th></tr></thead>
        <tbody>${[0, 1].map((i) => `<tr><th>타자 ${i + 1}</th><td>${num(`calc.compare.b.${i}.p`)}</td><td>${num(`calc.compare.b.${i}.c`)}</td><td>${num(`calc.compare.b.${i}.e`)}</td><td class="score">${out(`c.cmp.b.${i}`)}</td></tr>`).join('')}</tbody>
      </table>
      <table class="grid compact">
        <thead><tr><th></th><th>구위</th><th>변화</th><th>보정</th></tr></thead>
        <tbody>${[0, 1].map((i) => `<tr><th>투수 ${i + 1}</th><td>${num(`calc.compare.p.${i}.velo`)}</td><td>${num(`calc.compare.p.${i}.stuff`)}</td><td class="score">${out(`c.cmp.p.${i}`)}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="notes">
      <h3>계산 기준 (원본 패치노트)</h3>
      <ul>
        <li>풀스윙 S +5 · SR +7 · SR+ +14 / 클러치 S +4 · SR +5 · SR+ +10</li>
        <li>장억 S +5 · SR +7 · SR+ +16 / 침착 S +3 · SR +4 · SR+ +9 (6RP·CP는 +8)</li>
        <li>각잠 C +3 · C+ +6.5 · S +10</li>
        <li>흰존 −1.5 · 콜존 −3 · 좌타 −2.5 · 좌완 +1</li>
        <li>발사각 13~25도 + 파워 기준 충족 시 1~5점 (18도 이상 5점 고정)</li>
        <li>국에 5렙/6렙: 타자 +1.85/+3.7, 투수 +2.4/+4.8 · 포수리드 5~10렙 +1.05~+4.8</li>
        <li>POTM 보너스: 골글 +1 · 시그/임팩 +2 · 라올 +3 · 라이브 5성 +8 · 4성 +14 · 3성 이하 +18</li>
      </ul>
    </div>
  </section>`;
}

export function calcOutputs(st, r) {
  const o = {};
  r.batters.forEach((b, i) => {
    o[`c.b.${i}.score`] = fmt(b.score);
    o[`c.b.${i}.plus`] = b.bonus ? `+${b.bonus}` : '';
    o[`c.b.${i}.launch`] = b.launchBonus ? `+${b.launchBonus}` : '';
  });
  r.pitchers.forEach((p, i) => {
    o[`c.p.${i}.score`] = fmt(p.score);
    o[`c.p.${i}.plus`] = p.bonus ? `+${p.bonus}` : '';
    o[`c.p.${i}.tactic`] = p.tactic ? `+${p.tactic}` : '';
  });
  Object.assign(o, {
    'c.relay': r.relayOrder, 'c.bsum': fmt(r.batterSum), 'c.bavg': fmt(r.batterAvg), 'c.psum': fmt(r.pitcherSum), 'c.pavg': fmt(r.pitcherAvg),
    'c.g.core': fmt(r.groups.core), 'c.g.upper': fmt(r.groups.upper), 'c.g.middle': fmt(r.groups.middle), 'c.g.lower': fmt(r.groups.lower),
    'c.sp': fmt(r.starterSum), 'c.spavg': fmt(r.starterAvg), 'c.rp': fmt(r.relieverSum), 'c.rpavg': fmt(r.relieverAvg), 'c.cp': fmt(r.closerSum),
    'c.cmp.b.0': fmt(r.compare.b[0]), 'c.cmp.b.1': fmt(r.compare.b[1]), 'c.cmp.p.0': fmt(r.compare.p[0]), 'c.cmp.p.1': fmt(r.compare.p[1]),
  });
  return o;
}

// =====================================================================
//  덱 보정 관리기
// =====================================================================
export const MGR_TABS = [['team', '팀 정보'], ['lineup', '라인업'], ['dbB', '타자 DB'], ['dbP', '투수 DB']];

export function renderManager(st, sub) {
  if (sub === 'lineup') return mgrLineup(st);
  if (sub === 'dbB') return mgrDbB(st);
  if (sub === 'dbP') return mgrDbP(st);
  return mgrTeam(st);
}

function mgrTeam(st) {
  const t = 'manager.team';
  const bNames = st.manager.dbB.map((r) => r.name).filter(Boolean);
  const pNames = st.manager.dbP.map((r) => r.name).filter(Boolean);
  const statRows = [['p', '파워'], ['c', '정확'], ['e', '선구'], ['i', '인내'], ['v', '변화'], ['g', '구위']];
  const sdCol = (col) => SETDECK_KEYS[col].map((k) => `<label class="sd"><span class="sd-k">${k}</span><span class="sd-l">${esc(SETDECK_LABELS[k])}</span>${sel(`${t}.setdeck.${k}`, ['', '좌', '우'], { blankLabel: '미적용' })}</label>`).join('');
  return `
  <section class="panel">
    <div class="panel-head"><h3>팀 정보</h3><div class="status" data-out="m.status"></div></div>
    <div class="fields">
      <label>팀 ${sel(t + '.team', OPTIONS.teams)}</label>
      <label>닉네임 ${txt(t + '.nickname', { ph: '게임 닉네임' })}</label>
      <label>타자 국에 ${sel(t + '.batterBuff', OPTIONS.buffBatter)}</label>
      <label>투수 국에 ${sel(t + '.pitcherBuff', OPTIONS.buffPitcher)}</label>
      <label>포수리드 ${sel(t + '.catcherLead', OPTIONS.catcherLead)}</label>
      <label>투수전술 ${sel(t + '.tactic', OPTIONS.tactic)}</label>
      <label>승리조 ${sel(t + '.winTeam', OPTIONS.winTeam)}</label>
      <label>추격조 ${sel(t + '.chaseTeam', OPTIONS.chaseTeam)}</label>
      <label>주장 ${sel(t + '.captain', [...bNames, ...pNames], { blank: true, blankLabel: '선택 안 함' })}</label>
      <label>투수조장 ${sel(t + '.pitcherCaptain', pNames, { blank: true, blankLabel: '선택 안 함' })}</label>
    </div>
  </section>
  <section class="panel two">
    <div>
      <h3>내실</h3>
      <table class="grid compact">
        <thead><tr><th></th><th>라커룸</th><th>주장</th><th>투수조장</th></tr></thead>
        <tbody>${statRows.map(([k, l]) => `<tr><th>${l}</th><td>${num(`${t}.locker.${k}`, { min: 0, max: 10 })}</td><td>${num(`${t}.captainBonus.${k}`, { min: 0, max: 10 })}</td><td>${k === 'v' || k === 'g' ? num(`${t}.pCaptainBonus.${k}`, { min: 0, max: 10 }) : '<span class="muted">–</span>'}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <div>
      <h3>시너지 · 연도</h3>
      <div class="fields col">
        <label>라이브 시너지 (전원) ${num(t + '.synergy.live')}</label>
        <label>임팩 시너지 (타자) ${num(t + '.synergy.impact')}</label>
        <label>시그 시너지 (투수) ${num(t + '.synergy.sig')}</label>
        <label>라이브/올스타 기용 보너스 ${num(t + '.liveAllstar')}<small>세트덱 30·90·150·170 선택팀 +6</small></label>
        <label>타자 연도 ${num(t + '.batterYear')}</label>
        <label>투수 연도 ${num(t + '.pitcherYear')}</label>
      </div>
    </div>
  </section>
  <section class="panel">
    <h3>세트덱 효과</h3>
    <p class="help">좌 = 앞쪽 효과(주로 타자), 우 = 뒤쪽 효과(주로 투수). 200은 비워 두면 꺼집니다. 세트덱 180은 타자면 좌, 투수면 우를 고릅니다.</p>
    <div class="setdeck">${sdCol('V')}${sdCol('X')}${sdCol('Z')}</div>
  </section>
  <section class="panel notes">
    <h3>사용 가이드</h3>
    <ul>
      <li>팀 정보 → 라인업 → 선수 DB 순서로 구성됩니다. 선수는 먼저 DB에 등록하고 라인업에서 이름을 고르세요.</li>
      <li>보관함(DB)의 셋포 75·180·185(190) 체크는 연도 적용 시 값을 비교해 보는 용도이며 라인업 점수에는 들어가지 않습니다.</li>
      <li>포틈은 DB에서 체크만 하면 됩니다(올스타 스알플은 직접 수정). 포특 스킬은 기록용입니다.</li>
      <li>3·4성 라이브는 보정이 들어가 있지 않습니다.</li>
    </ul>
  </section>`;
}

function mgrLineup(st) {
  const L = 'manager.lineupB';
  const bNames = st.manager.dbB.map((r) => r.name).filter(Boolean);
  const pNames = st.manager.dbP.map((r) => r.name).filter(Boolean);
  const bRows = st.manager.lineupB.map((x, i) => {
    const p = `${L}.${i}`;
    return `<tr>
      <td class="out-c">${out(`m.lb.${i}.group`)}</td>
      <td>${num(p + '.order', { cls: 'xs', min: 1, max: 9, label: '타순' })}</td>
      <th class="pos">${esc(x.pos)}</th>
      <td>${sel(p + '.name', bNames, { blank: true, cls: 'name', label: '타자 선택' })}</td>
      <td class="out-c">${out(`m.lb.${i}.info`)}</td>
      <td class="score">${out(`m.lb.${i}.score`)}</td>
      ${[0, 1, 2, 3].map((k) => `<td class="out-c">${out(`m.lb.${i}.s${k}`)}</td>`).join('')}
      <td class="out-c">${out(`m.lb.${i}.skill`)}</td>
      <td class="out-c">${out(`m.lb.${i}.grades`)}</td>
      <td class="out-c">${out(`m.lb.${i}.launch`)}</td>
      <td>${num(p + '.ptLv', { cls: 'xs', min: 0, max: 20, label: '포특 레벨' })}</td>
      ${[0, 1, 2, 3].map((k) => `<td>${num(`${p}.ptExtra.${k}`, { cls: 'xs', min: 0, max: 6 })}</td>`).join('')}
      <td>${txt(p + '.major', { cls: 'mid' })}</td>
      <td>${txt(p + '.basic', { cls: 'mid' })}</td>
    </tr>`;
  }).join('');
  const P = 'manager.lineupP';
  const pRows = st.manager.lineupP.map((x, i) => {
    const p = `${P}.${i}`;
    const role = i >= 5 && i <= 10 ? sel(p + '.role', OPTIONS.rpRoles, { blank: true, label: '중계 역할' }) : out(`m.lp.${i}.group`);
    return `<tr>
      <td class="out-c">${role}<small class="hint" data-out="m.lp.${i}.w"></small></td>
      <th class="pos">${esc(x.pos)}</th>
      <td>${sel(p + '.name', pNames, { blank: true, cls: 'name', label: '투수 선택' })}</td>
      <td class="out-c">${out(`m.lp.${i}.info`)}</td>
      <td class="score">${out(`m.lp.${i}.score`)}</td>
      <td class="out-c">${out(`m.lp.${i}.s0`)}</td><td class="out-c">${out(`m.lp.${i}.s1`)}</td>
      <td class="out-c">${out(`m.lp.${i}.skill`)}</td>
      <td class="out-c">${out(`m.lp.${i}.grades`)}</td>
      <td class="out-c">${out(`m.lp.${i}.tactic`)}</td>
      <td>${num(p + '.ptLv', { cls: 'xs', min: 0, max: 20, label: '포특 레벨' })}</td>
      <td>${num(`${p}.ptExtra.0`, { cls: 'xs', min: 0, max: 6 })}</td><td>${num(`${p}.ptExtra.1`, { cls: 'xs', min: 0, max: 6 })}</td>
      <td>${txt(p + '.major', { cls: 'mid' })}</td>
      <td>${txt(p + '.basic', { cls: 'mid' })}</td>
    </tr>`;
  }).join('');
  return `
  <section class="panel">
    <div class="panel-head"><h3>타자 라인업</h3><div class="mini-sum">타자 합계 <b data-out="m.bsum"></b> · 평균 <b data-out="m.bavg"></b></div></div>
    ${bNames.length ? '' : '<p class="empty">타자 DB에 선수를 먼저 등록하면 여기서 고를 수 있습니다.</p>'}
    <div class="tbl-wrap"><table class="grid">
      <thead><tr><th>구분</th><th>타순</th><th>포지션</th><th>이름</th><th>종류·각성·연도</th><th>보정스탯</th><th>파워</th><th>정확</th><th>선구</th><th>인내</th><th>스킬점수</th><th>풀/클/송/각잠</th><th>발사각 보너스</th><th>포특 Lv</th><th>+파</th><th>+정</th><th>+선</th><th>+인</th><th>메이저스킬</th><th>기본스킬</th></tr></thead>
      <tbody>${bRows}</tbody>
    </table></div>
    <div class="groups">
      <div><span>코어 (3)</span><b data-out="m.g.core"></b></div><div><span>상위 (2)</span><b data-out="m.g.upper"></b></div>
      <div><span>중위 (2)</span><b data-out="m.g.middle"></b></div><div><span>하위 (2)</span><b data-out="m.g.lower"></b></div>
    </div>
  </section>
  <section class="panel">
    <div class="panel-head"><h3>투수 라인업</h3><div class="mini-sum">투수 합계 <b data-out="m.psum"></b> · 평균 <b data-out="m.pavg"></b></div></div>
    <p class="help">1RP~6RP는 중계 역할을 고르세요. 현재 전술의 순서: <b data-out="m.roles"></b> (가중치 0.8 / 0.7 / 0.5 / 0.3 / 0.1 / 0). <span class="status" data-out="m.status"></span></p>
    ${pNames.length ? '' : '<p class="empty">투수 DB에 선수를 먼저 등록하면 여기서 고를 수 있습니다.</p>'}
    <div class="tbl-wrap"><table class="grid">
      <thead><tr><th>구분</th><th>포지션</th><th>이름</th><th>종류·각성·연도</th><th>보정스탯</th><th>변화</th><th>구위</th><th>스킬점수</th><th>장/침/변/각잠</th><th>전술</th><th>포특 Lv</th><th>+변</th><th>+구</th><th>메이저스킬</th><th>기본스킬</th></tr></thead>
      <tbody>${pRows}</tbody>
    </table></div>
    <div class="groups">
      <div><span>선발 합 / 평균</span><b data-out="m.sp"></b></div>
      <div><span>중계 합 / 평균</span><b data-out="m.rp"></b></div>
      <div><span>마무리</span><b data-out="m.cp"></b></div>
    </div>
  </section>`;
}

function trainCells(base, k) {
  return [0, 1, 2].map((j) => `<td>${num(`${base}.train.${k}.${j}`, { cls: 'xs' })}</td>`).join('');
}
function mgrDbB(st) {
  const rows = st.manager.dbB.map((r, i) => {
    const p = `manager.dbB.${i}`;
    return `<tr>
      <td class="c">${chk(p + '.s75', { label: '셋포75' })}</td><td class="c">${chk(p + '.s180', { label: '셋포180' })}</td><td class="c">${chk(p + '.s185', { label: '셋포185' })}</td><td class="c">${chk(p + '.potteum', { label: '포틈' })}</td>
      <td>${sel(p + '.pos', OPTIONS.batterPos, { blank: true })}</td>
      <td>${sel(p + '.type', OPTIONS.cardType, { blank: true })}</td>
      <td>${sel(p + '.awaken', OPTIONS.awaken, { blank: true })}</td>
      <td>${num(p + '.year', { cls: 'sm' })}</td>
      <td class="sticky">${txt(p + '.name', { cls: 'name', ph: '이름', label: '선수 이름' })}</td>
      <td class="score">${out(`m.db.${i}.score`)}</td>
      ${[0, 1, 2, 3].map((k) => `<td class="out-c">${out(`m.db.${i}.s${k}`)}</td>`).join('')}
      <td class="out-c">${out(`m.db.${i}.skill`)}</td>
      ${['full', 'clutch', 'song', 'gakjam'].map((k) => `<td>${sel(`${p}.${k}`, OPTIONS.grade, { blank: true })}</td>`).join('')}
      <td class="out-c">${out(`m.db.${i}.gak`)}</td>
      ${[1, 2, 3].map((k) => `<td>${txt(`${p}.sk${k}`, { cls: 'skill', list: 'dl-skill-b' })}</td><td>${sel(`${p}.lv${k}`, OPTIONS.skillLv, { blank: true, t: 'num' })}</td>`).join('')}
      <td class="out-c">${out(`m.db.${i}.raw`)}</td><td class="out-c">${out(`m.db.${i}.sprob`)}</td>
      <td class="out-c">${out(`m.db.${i}.tt`)}</td><td class="out-c">${out(`m.db.${i}.tp`)}</td><td class="out-c">${out(`m.db.${i}.ts`)}</td>
      <td class="out-c">${out(`m.db.${i}.st`)}</td><td class="out-c">${out(`m.db.${i}.sp`)}</td><td class="out-c">${out(`m.db.${i}.ss`)}</td>
      ${trainCells(p, 0)}${trainCells(p, 1)}${trainCells(p, 2)}${trainCells(p, 3)}
      <td>${sel(p + '.hand', OPTIONS.hand, { blank: true })}</td>
      <td>${num(p + '.launch', { cls: 'xs' })}</td><td>${num(p + '.white', { cls: 'xs', min: 0 })}</td><td>${num(p + '.cold', { cls: 'xs', min: 0 })}</td>
    </tr>`;
  }).join('');
  return `
  <section class="panel">
    <div class="panel-head"><h3>타자 DB (보관함)</h3></div>
    <p class="help">셋포 75: 연도타자 파정+3 · 180: 연도선수 +1 · 185: 연도타자 +1 (임팩은 75만). 깡보정스탯은 발사각 보너스 없이 단순 비교용입니다. 재분 확률은 파정만 반영합니다.</p>
    <div class="tbl-wrap tall"><table class="grid db">
      <thead>
        <tr class="grp"><th colspan="4">셋포·포틈</th><th colspan="5">기본 정보</th><th colspan="6">결과</th><th colspan="5">잠재</th><th colspan="8">타자 스킬</th><th colspan="6">재분 현황</th><th colspan="3">파워</th><th colspan="3">정확</th><th colspan="3">선구</th><th colspan="3">인내</th><th colspan="4">기본</th></tr>
        <tr><th>75</th><th>180</th><th>185</th><th>포틈</th><th>포지션</th><th>종류</th><th>각성</th><th>연도</th><th class="sticky">이름</th><th>깡보정</th><th>파워</th><th>정확</th><th>선구</th><th>인내</th><th>스킬점수</th><th>풀</th><th>클</th><th>송</th><th>각잠</th><th>각잠점수</th><th>스킬1</th><th>Lv</th><th>스킬2</th><th>Lv</th><th>스킬3</th><th>Lv</th><th>원점수/적용</th><th>스킬확률</th><th>훈재분</th><th>훈재확률</th><th>훈재스탯</th><th>특재분</th><th>특재확률</th><th>특재스탯</th><th>기본</th><th>훈련</th><th>특훈</th><th>기본</th><th>훈련</th><th>특훈</th><th>기본</th><th>훈련</th><th>특훈</th><th>기본</th><th>훈련</th><th>특훈</th><th>유형</th><th>발사각</th><th>흰존</th><th>콜존</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table></div>
  </section>`;
}
function mgrDbP(st) {
  const rows = st.manager.dbP.map((r, i) => {
    const p = `manager.dbP.${i}`;
    return `<tr>
      <td class="c">${chk(p + '.s75', { label: '셋포75' })}</td><td class="c">${chk(p + '.s180', { label: '셋포180' })}</td><td class="c">${chk(p + '.s190', { label: '셋포190' })}</td><td class="c">${chk(p + '.potteum', { label: '포틈' })}</td>
      <td>${sel(p + '.pos', OPTIONS.pitcherPos, { blank: true })}</td>
      <td>${sel(p + '.type', OPTIONS.cardType, { blank: true })}</td>
      <td>${sel(p + '.awaken', OPTIONS.awaken, { blank: true })}</td>
      <td>${num(p + '.year', { cls: 'sm' })}</td>
      <td class="sticky">${txt(p + '.name', { cls: 'name', ph: '이름', label: '선수 이름' })}</td>
      <td class="score">${out(`m.dp.${i}.score`)}</td>
      <td class="out-c">${out(`m.dp.${i}.s0`)}</td><td class="out-c">${out(`m.dp.${i}.s1`)}</td>
      <td class="out-c">${out(`m.dp.${i}.skill`)}</td>
      ${['jang', 'chim', 'byun', 'gakjam'].map((k) => `<td>${sel(`${p}.${k}`, OPTIONS.grade, { blank: true })}</td>`).join('')}
      <td class="out-c">${out(`m.dp.${i}.gak`)}</td>
      ${[1, 2, 3].map((k) => `<td>${txt(`${p}.sk${k}`, { cls: 'skill', list: 'dl-skill-p' })}</td><td>${sel(`${p}.lv${k}`, OPTIONS.skillLv, { blank: true, t: 'num' })}</td>`).join('')}
      <td class="out-c">${out(`m.dp.${i}.raw`)}</td><td class="out-c">${out(`m.dp.${i}.sprob`)}</td>
      <td class="out-c">${out(`m.dp.${i}.tt`)}</td><td class="out-c">${out(`m.dp.${i}.tp`)}</td><td class="out-c">${out(`m.dp.${i}.ts`)}</td>
      <td class="out-c">${out(`m.dp.${i}.st`)}</td><td class="out-c">${out(`m.dp.${i}.sp`)}</td><td class="out-c">${out(`m.dp.${i}.ss`)}</td>
      ${trainCells(p, 0)}${trainCells(p, 1)}
      <td>${sel(p + '.lefty', OPTIONS.ox, { blank: true })}</td>
    </tr>`;
  }).join('');
  return `
  <section class="panel">
    <div class="panel-head"><h3>투수 DB (보관함)</h3></div>
    <p class="help">셋포 75: 연도투수 구+3 · 180: 연도선수 +1 · 190: 연도투수 변+3, 구+1 (셋포55와의 합). 재분 확률은 변구만 반영합니다.</p>
    <div class="tbl-wrap tall"><table class="grid db">
      <thead>
        <tr class="grp"><th colspan="4">셋포·포틈</th><th colspan="5">기본 정보</th><th colspan="4">결과</th><th colspan="5">잠재</th><th colspan="8">투수 스킬</th><th colspan="6">재분 현황</th><th colspan="3">변화</th><th colspan="3">구위</th><th>기본</th></tr>
        <tr><th>75</th><th>180</th><th>190</th><th>포틈</th><th>포지션</th><th>종류</th><th>각성</th><th>연도</th><th class="sticky">이름</th><th>깡보정</th><th>변화</th><th>구위</th><th>스킬점수</th><th>장</th><th>침</th><th>변</th><th>각잠</th><th>각잠점수</th><th>스킬1</th><th>Lv</th><th>스킬2</th><th>Lv</th><th>스킬3</th><th>Lv</th><th>원점수/적용</th><th>스킬확률</th><th>훈재분</th><th>훈재확률</th><th>훈재스탯</th><th>특재분</th><th>특재확률</th><th>특재스탯</th><th>기본</th><th>훈련</th><th>특훈</th><th>기본</th><th>훈련</th><th>특훈</th><th>좌완</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table></div>
  </section>`;
}

export function managerOutputs(st, r) {
  const o = {};
  r.lineupB.forEach((x, i) => {
    const has = !!st.manager.lineupB[i].name;
    o[`m.lb.${i}.group`] = `${x.group} ×${x.weight}`;
    o[`m.lb.${i}.info`] = x.found ? [x.type, x.awaken, x.year].filter((v) => v !== '').join(' · ') : has ? 'DB에 없음' : '';
    o[`m.lb.${i}.score`] = fmt(x.score);
    x.stats.forEach((v, k) => (o[`m.lb.${i}.s${k}`] = fmt(v)));
    o[`m.lb.${i}.skill`] = fmt(x.skill);
    o[`m.lb.${i}.grades`] = x.found ? [x.grades.full, x.grades.clutch, x.grades.song, x.grades.gakjam].map((v) => v || '·').join('/') : '';
    o[`m.lb.${i}.launch`] = x.launchText;
  });
  r.lineupP.forEach((x, i) => {
    const has = !!st.manager.lineupP[i].name;
    if (i < 5) o[`m.lp.${i}.group`] = x.group;
    if (i === 11) o[`m.lp.${i}.group`] = '마무리';
    o[`m.lp.${i}.w`] = `×${x.weight}`;
    o[`m.lp.${i}.info`] = x.found ? [x.type, x.awaken, x.year].filter((v) => v !== '').join(' · ') : has ? 'DB에 없음' : '';
    o[`m.lp.${i}.score`] = fmt(x.score);
    o[`m.lp.${i}.s0`] = fmt(x.stats[0]); o[`m.lp.${i}.s1`] = fmt(x.stats[1]);
    o[`m.lp.${i}.skill`] = fmt(x.skill);
    o[`m.lp.${i}.grades`] = x.found ? [x.grades.jang, x.grades.chim, x.grades.byun, x.grades.gakjam].map((v) => v || '·').join('/') : '';
    o[`m.lp.${i}.tactic`] = x.tactic ? `+${x.tactic}` : '';
  });
  const dbo = (pre, list, rows) => list.forEach((d, i) => {
    const filled = !!(rows[i].name || rows[i].type);
    o[`${pre}.${i}.score`] = filled ? fmt(d.score) : '';
    d.stats.forEach((v, k) => (o[`${pre}.${i}.s${k}`] = filled ? fmt(v) : ''));
    o[`${pre}.${i}.skill`] = filled ? fmt(d.skill) : '';
    o[`${pre}.${i}.gak`] = filled ? fmt(d.gak) : '';
    o[`${pre}.${i}.raw`] = d.rawSkillText;
    o[`${pre}.${i}.sprob`] = d.rawSkillText ? pct(d.skillProb) : '';
    o[`${pre}.${i}.tt`] = d.trainText; o[`${pre}.${i}.tp`] = d.trainText ? pct(d.trainProb) : ''; o[`${pre}.${i}.ts`] = d.trainText ? fmt(d.trainStat) : '';
    o[`${pre}.${i}.st`] = d.specialText; o[`${pre}.${i}.sp`] = d.specialText ? pct(d.specialProb) : ''; o[`${pre}.${i}.ss`] = d.specialText ? fmt(d.specialStat) : '';
  });
  dbo('m.db', r.dbB, st.manager.dbB);
  dbo('m.dp', r.dbP, st.manager.dbP);
  Object.assign(o, {
    'm.status': r.status, 'm.roles': r.relayRoles.join(' · '),
    'm.bsum': fmt(r.batterSum), 'm.bavg': fmt(r.batterAvg), 'm.psum': fmt(r.pitcherSum), 'm.pavg': fmt(r.pitcherAvg),
    'm.g.core': fmt(r.groups.core), 'm.g.upper': fmt(r.groups.upper), 'm.g.middle': fmt(r.groups.middle), 'm.g.lower': fmt(r.groups.lower),
    'm.sp': `${fmt(r.starterSum)} / ${fmt(r.starterAvg)}`, 'm.rp': `${fmt(r.relieverSum)} / ${fmt(r.relieverAvg)}`, 'm.cp': fmt(r.closer),
  });
  return o;
}

export { potmBonus };
