// =====================================================================
//  onesol POTM 엑셀 → 웹 계산 엔진
//  원본: "덱 보정 계산기" / "덱 보정 관리기" 시트의 수식 + Sheet1 VBA(POTM 매크로)
//  모든 함수는 순수 함수(입력 → 결과)이며 화면/저장과 분리되어 있습니다.
// =====================================================================
import { DATA } from './data.js';

const n = (v) => {
  if (v === true) return 1;
  if (v === false || v === null || v === undefined || v === '') return 0;
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const s = (v) => (v === null || v === undefined ? '' : String(v)).trim();
const left2 = (v) => s(v).slice(0, 2);
const sum = (a) => a.reduce((t, x) => t + n(x), 0);
const large = (arr, k) => {
  const sorted = arr.map(n).sort((a, b) => b - a);
  return sorted[k - 1] ?? 0;
};
// 엑셀 LOOKUP(COUNTIF(>x) + COUNTIF(앞쪽~자신, x)) 순위 (동점은 위쪽 행이 먼저)
const rankOf = (arr, i) => {
  const x = n(arr[i]);
  let r = 0;
  arr.forEach((v, j) => {
    if (n(v) > x) r++;
    if (j <= i && n(v) === x) r++;
  });
  return r;
};

// ---------------------------------------------------------------------
//  공통 옵션 테이블
// ---------------------------------------------------------------------
export const OPTIONS = {
  buffBatter: ['X', '5렙', '6렙'],
  buffPitcher: ['X', '5렙', '6렙'],
  catcherLead: ['X', '5렙', '6렙', '7렙', '8렙', '9렙', '10렙'],
  tactic: ['114', '240', '141', '330'],
  winTeam: ['기본', '적극', '분업'],
  chaseTeam: ['기본', '적극'],
  sr: ['범부', 'S', 'SR', 'SR+'],
  gakjamCalc: ['개방X', 'C', 'C+', 'S'],
  potm: ['', '골글', '시그', '임팩', '라올(타팀)', '라올(자팀)', '라이브(5성)', '라이브(4성)', '라이브(3성이하)'],
  teams: ['LG 트윈스', '삼성 라이온즈', 'KIA 타이거즈', '두산 베어스', 'NC 다이노스', 'SSG 랜더스', '한화 이글스', '키움 히어로즈', 'kt 위즈', '롯데 자이언츠', '❌ 팀 미선택 ❌'],
  cardType: ['골글', '시그', '시그(F)', '임팩', '임팩(F)', '국대', '라올'],
  awaken: ['10강', '1각', '2각', '3각', '4각', '5각', '6각', '7각', '8각', '9각'],
  grade: ['-', 'E', 'D', 'D+', 'C', 'C+', 'B', 'B+', 'A', 'A+', 'S', 'S+', 'SS', 'SS+', 'SR', 'SR+'],
  batterPos: ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'],
  pitcherPos: ['SP', 'RP', 'CP'],
  hand: ['좌', '우', '양'],
  ox: ['O', 'X'],
  side: ['', '좌', '우'],
  skillLv: [5, 6, 7, 8, 9, 10],
  rpRoles: ['승리1', '승리2', '셋업1', '셋업2', '추격1', '추격2', '추격3', '추격4', '롱릴1', '롱릴2', '롱릴3', '롱릴4'],
};

// 국가대표(국에) / 포수리드 버프
const buffBatter = (v) => ({ '5렙': 1.85, '6렙': 3.7 }[s(v)] || 0);
const buffPitcher = (v) => ({ '5렙': 2.4, '6렙': 4.8 }[s(v)] || 0);
const buffCatcher = (v) => ({ '5렙': 1.05, '6렙': 2.4, '7렙': 2.4, '8렙': 3.45, '9렙': 3.45, '10렙': 4.8 }[s(v)] || 0);

// =====================================================================
//  1) VBA 매크로 (Sheet1.Worksheet_Change → POTMBonus)
//     원본은 POTM 선택 시 해당 행 스탯 칸에 +보너스를 직접 더하고, 이후 스탯을
//     새로 입력하면 그 값에 보너스를 다시 더했습니다. 웹에서는 "기본 스탯"과
//     "POTM"을 따로 저장하고 최종 스탯 = 기본 + 보너스로 계산합니다(결과 동일).
// =====================================================================
export function potmBonus(item) {
  if (item === true || item === false || item == null) return 0;
  let t = String(item).trim().replace(/ /g, '').replace(/（/g, '(').replace(/）/g, ')').toLowerCase();
  switch (t) {
    case '골글': return 1;
    case '시그': return 2;
    case '임팩': return 2;
    case '라올': // 예전 값 (= 타팀)
    case '라올(타팀)': return 3;
    case '라올(자팀)': return 6;
    case '라이브(5성)': return 8;
    case '라이브(4성)': return 14;
    case '라이브(3성이하)': return 18;
    default: return 0;
  }
}

// =====================================================================
//  2) 덱 보정 계산기
// =====================================================================
const fullSwingPts = (v) => ({ S: 5, SR: 7, 'SR+': 14 }[s(v)] || 0);
const clutchPts = (v) => ({ S: 4, SR: 5, 'SR+': 10 }[s(v)] || 0);
const gakjamPts = (v) => ({ C: 3, 'C+': 6.5, S: 10 }[s(v)] || 0);
const longPts = (v) => ({ S: 5, SR: 7, 'SR+': 16 }[s(v)] || 0);
// 침착 SR+ : 1SP~5RP 행은 9점, 6RP·CP 행은 원본 수식상 8점
const calmPts = (v, srPlus) => ({ S: 3, SR: 4, 'SR+': srPlus }[s(v)] || 0);
// 발사각(13~25) + 파워 기준치 이상일 때 보너스
const LAUNCH_TABLE = { 13: [169, 1], 14: [166, 2], 15: [163, 3], 16: [160, 4], 17: [163, 4.5], 18: [166, 5], 19: [169, 5], 20: [172, 5], 21: [175, 5], 22: [178, 5], 23: [181, 5], 24: [184, 5], 25: [187, 5] };

export const CALC_BATTER_POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
export const CALC_PITCHER_POS = ['1SP', '2SP', '3SP', '4SP', '5SP', '1RP', '2RP', '3RP', '4RP', '5RP', '6RP', 'CP'];

export function relayOrder(tactic) {
  return ({ '330': '셋1 추1 셋2 승1 추2 추3', '240': '승1 추1 승2 추2 추3 추4', '114': '승1 추1 롱1 롱2 롱3 롱4', '141': '승1 추1 추2 롱1 추3 추4' })[s(tactic)] || '투수전술 선택';
}

const blankBatter = (pos = '') => ({ pos, name: '', power: '', contact: '', eye: '', patience: '', skill: '', white: 0, cold: 0, fullSwing: '범부', clutch: '범부', gakjam: '개방X', leftBat: false, launch: '', potm: '' });
const blankPitcher = (pos = '') => ({ pos, name: '', stuff: '', velo: '', skill: '', long: '범부', calm: '범부', gakjam: '개방X', lefty: false, potm: '' });

export function defaultCalc() {
  return {
    settings: { batterBuff: '6렙', pitcherBuff: '6렙', catcherLead: '6렙', tactic: '114', winTeam: '기본', chaseTeam: '기본' },
    batters: CALC_BATTER_POS.map(blankBatter),
    pitchers: CALC_PITCHER_POS.map(blankPitcher),
    compare: { b: [{ p: '', c: '', e: '' }, { p: '', c: '', e: '' }], p: [{ velo: '', stuff: '' }, { velo: '', stuff: '' }] },
    // 선수 비교 칸 (타자 2명, 투수 2명)
    playerCmp: { b: [blankBatter(), blankBatter()], p: [blankPitcher(), blankPitcher()] },
  };
}

// 타자 한 명의 보정스탯 (타자 표·선수 비교 공통)
function batterScore(b, bBuff) {
  const bonus = potmBonus(b.potm);
  const has = (v) => s(v) !== '';
  const power = has(b.power) ? n(b.power) + bonus : 0;
  const contact = has(b.contact) ? n(b.contact) + bonus : 0;
  const eye = has(b.eye) ? n(b.eye) + bonus : 0;
  const pat = has(b.patience) ? n(b.patience) + bonus : 0;
  const L = LAUNCH_TABLE[n(b.launch)];
  const launchBonus = L && power >= L[0] ? L[1] : 0;
  const score = power + contact * 0.85 + eye * 0.4 + pat * 0.15 + n(b.skill) - n(b.white) * 1.5 - n(b.cold) * 3
    + fullSwingPts(b.fullSwing) + clutchPts(b.clutch) + gakjamPts(b.gakjam) - (b.leftBat ? 2.5 : 0) + bBuff + launchBonus;
  return { bonus, power, contact, eye, patience: pat, launchBonus, score };
}

// 투수 한 명의 보정스탯 (calmSrPlus: 침착 SR+ 점수, tactic: 중계 전술 보너스)
function pitcherScore(p, pBuff, cBuff, calmSrPlus = 9, tactic = 0) {
  const bonus = potmBonus(p.potm);
  const has = (v) => s(v) !== '';
  const stuff = has(p.stuff) ? n(p.stuff) + bonus : 0;
  const velo = has(p.velo) ? n(p.velo) + bonus : 0;
  const score = stuff * 1.05 + velo * 1.35 + n(p.skill) + longPts(p.long) + calmPts(p.calm, calmSrPlus)
    + (p.lefty ? 1 : 0) + gakjamPts(p.gakjam) + pBuff + cBuff + tactic;
  return { bonus, stuff, velo, tactic, score };
}

export function computeCalc(st) {
  const S = st.settings;
  const tac = s(S.tactic);
  const bBuff = buffBatter(S.batterBuff);
  const pBuff = buffPitcher(S.pitcherBuff);
  const cBuff = buffCatcher(S.catcherLead);

  const batters = st.batters.map((b) => batterScore(b, bBuff));

  // 중계 전술 보너스(행마다 원본 수식이 다름 → 그대로 이식)
  const W = s(S.winTeam), C = s(S.chaseTeam);
  const tacticBonus = [
    0, 0, 0, 0, 0,
    /*1RP*/ (tac === '330' && W === '분업') ? 4.8 : (tac === '330' && W === '적극') ? 2.4 : (tac === '240' && W === '적극') ? 2.4 : 0,
    /*2RP*/ tac === '114' ? 0 : (C === '적극' ? 2.4 : 0),
    /*3RP*/ (tac === '330' && W === '분업') ? 4.8 : (tac === '330' && W === '적극') ? 2.4 : (tac === '240' && W === '적극') ? 2.4 : (tac === '141' && C === '적극') ? 2.4 : 0,
    /*4RP*/ (tac === '330' && W === '분업') ? 4.8 : (tac === '330' && W === '적극') ? 2.4 : (tac === '240' && C === '적극') ? 2.4 : 0,
    /*5RP*/ tac === '114' ? 0 : (C === '적극' ? 2.4 : 0),
    /*6RP*/ tac === '114' ? 0 : (C === '적극' ? 2.4 : 0),
    /*CP*/ 0,
  ];

  const pitchers = st.pitchers.map((p, i) => pitcherScore(p, pBuff, cBuff, i >= 10 ? 8 : 9, tacticBonus[i]));

  const bs = batters.map((b) => b.score);
  const core = (large(bs, 1) + large(bs, 2) + large(bs, 3)) / 3;
  const upper = (large(bs, 4) + large(bs, 5)) / 2;
  const middle = (large(bs, 6) + large(bs, 7)) / 2;
  const lower = (large(bs, 8) + large(bs, 9)) / 2;
  const batterSum = core * 1.3 * 3 + upper * 1.15 * 2 + middle * 1 * 2 + lower * 0.75 * 2;

  const sp = pitchers.slice(0, 5).map((p) => p.score);
  const starterSum = large(sp, 1) * 1.4 + large(sp, 2) * 1.3 + large(sp, 3) * 1.3 + large(sp, 4) * 1.3 + large(sp, 5) * 1.2;
  const P = pitchers.map((p) => p.score);
  const relieverSum = P[5] * 0.8 + P[6] * 0.7 + P[7] * 0.5 + P[8] * 0.3 + P[9] * 0.1;
  const closerSum = P[11] * 0.8;
  const pitcherSum = starterSum + relieverSum + closerSum;

  const cmp = st.compare || { b: [], p: [] };
  const pc = st.playerCmp || { b: [], p: [] };
  return {
    batters, pitchers,
    total: batterSum + pitcherSum,
    batterSum, pitcherSum, starterSum, relieverSum, closerSum,
    batterAvg: batterSum / 9.7, pitcherAvg: pitcherSum / 9.7,
    groups: { core, upper, middle, lower },
    starterAvg: starterSum / 6.5, relieverAvg: relieverSum / 2.4, closer: P[11],
    relayOrder: relayOrder(tac),
    compare: {
      b: (cmp.b || []).map((r) => n(r.p) + n(r.c) * 0.85 + n(r.e) * 0.4),
      p: (cmp.p || []).map((r) => n(r.velo) + n(r.stuff) * 0.78),
    },
    playerCmp: {
      b: (pc.b || []).map((b) => batterScore(b, bBuff)),
      p: (pc.p || []).map((p) => pitcherScore(p, pBuff, cBuff)),
    },
  };
}

// =====================================================================
//  3) 덱 보정 관리기
// =====================================================================
export const SETDECK_KEYS = {
  V: [40, 60, 70, 75, 80, 95],
  X: [100, 115, 120, 135, 140, 145],
  Z: [155, 160, 165, 175, 180, 200],
};
export const SETDECK_LABELS = {
  40: '타자+1 vs 투수+1', 60: '타자+1 vs 투수+1', 70: '선발+1 vs 불펜+2', 75: '연도 파정+3 vs 연도 구+3', 80: '타자+1 vs 투수+1', 95: '내포 인+2 vs 외지 선+2',
  100: '타자+1 vs 투수+1', 115: '하위 정+2 vs 불펜 구+2', 120: '중심+2 vs 선발+1', 135: '중심 정+2 vs 선발 구+1', 140: '하위+1 vs 불펜+1', 145: '상위 정선+2 vs 선발 구+1',
  155: '상위 파선인+2 vs 선발 변+1', 160: '타자+1 vs 투수+1', 165: '타자 정+1 vs 투수 변+1', 175: '타자 파선인+1 vs 투수 구+1', 180: '연도+1 (타자:좌 / 투수:우)', 200: '타자+2 vs 투수+2',
};
export const MGR_BATTER_POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
export const MGR_PITCHER_POS = ['1SP', '2SP', '3SP', '4SP', '5SP', '1RP', '2RP', '3RP', '4RP', '5RP', '6RP', 'CP'];
const RELAY_ROLES = {
  '114': ['승리1', '추격1', '롱릴1', '롱릴2', '롱릴3', '롱릴4'],
  '141': ['승리1', '추격1', '추격2', '롱릴1', '추격3', '추격4'],
  '240': ['승리1', '추격1', '승리2', '추격2', '추격3', '추격4'],
  '330': ['셋업1', '추격1', '셋업2', '승리1', '추격2', '추격3'],
};
const RELAY_WEIGHTS = [0.8, 0.7, 0.5, 0.3, 0.1, 0];

const emptyTrain = (k) => Array.from({ length: k }, () => ['', '', '']);
export function emptyBatterDB() {
  return { s75: false, s180: false, s185: false, potteum: false, pos: '', type: '', awaken: '', year: '', name: '', full: '', clutch: '', song: '', gakjam: '', sk1: '', lv1: '', sk2: '', lv2: '', sk3: '', lv3: '', train: emptyTrain(4), hand: '', launch: '', white: '', cold: '' };
}
export function emptyPitcherDB() {
  return { s75: false, s180: false, s190: false, potteum: false, pos: '', type: '', awaken: '', year: '', name: '', jang: '', chim: '', byun: '', gakjam: '', sk1: '', lv1: '', sk2: '', lv2: '', sk3: '', lv3: '', train: emptyTrain(2), lefty: '' };
}
export function defaultManager() {
  const sd = {};
  [...SETDECK_KEYS.V, ...SETDECK_KEYS.X, ...SETDECK_KEYS.Z].forEach((k) => (sd[k] = ''));
  return {
    team: {
      team: 'LG 트윈스', nickname: '', batterBuff: 'X', pitcherBuff: 'X', catcherLead: 'X', tactic: '114', winTeam: '기본', chaseTeam: '기본', captain: '', pitcherCaptain: '',
      locker: { p: 0, c: 0, e: 0, i: 0, v: 0, g: 0 }, captainBonus: { p: 0, c: 0, e: 0, i: 0, v: 0, g: 0 }, pCaptainBonus: { v: 0, g: 0 },
      synergy: { live: 0, impact: 0, sig: 0 }, liveAllstar: 0, batterYear: 1982, pitcherYear: 1982, setdeck: sd,
    },
    lineupB: MGR_BATTER_POS.map((pos) => ({ pos, order: '', name: '', ptLv: '', ptExtra: ['', '', '', ''], major: '', basic: '' })),
    lineupP: MGR_PITCHER_POS.map((pos, i) => ({ pos, role: i >= 5 && i <= 10 ? '' : undefined, name: '', ptLv: '', ptExtra: ['', ''], major: '', basic: '' })),
    dbB: Array.from({ length: 20 }, emptyBatterDB),
    dbP: Array.from({ length: 20 }, emptyPitcherDB),
  };
}

// --- 덱 보정 계산기 → 선수 DB 불러오기 ----------------------------------
// 계산기 스탯(입력값 + POTM 보너스)을 DB "기본" 칸에 넣고, 종류·각성은 비워 공통 보정이 중복되지 않게 함.
// 계산기의 스킬점수는 숫자라 DB(스킬 이름+레벨)로 옮길 수 없음.
const POTM_TO_TYPE = { '골글': '골글', '시그': '시그', '임팩': '임팩', '라올': '라올', '라올(타팀)': '라올', '라올(자팀)': '라올' };
const CALC_GRADE = (v) => (['S', 'SR', 'SR+', 'C', 'C+'].includes(s(v)) ? s(v) : '');
function calcStat(v, bonus) { return s(v) === '' ? '' : n(v) + bonus; }

function batterFromCalc(b) {
  const bonus = potmBonus(b.potm);
  return {
    pos: OPTIONS.batterPos.includes(s(b.pos)) ? s(b.pos) : '', type: POTM_TO_TYPE[s(b.potm)] || '', awaken: '', name: s(b.name),
    full: CALC_GRADE(b.fullSwing), clutch: CALC_GRADE(b.clutch), gakjam: CALC_GRADE(b.gakjam),
    train: [b.power, b.contact, b.eye, b.patience].map((v) => [calcStat(v, bonus), '', '']),
    hand: b.leftBat ? '좌' : '', launch: b.launch ?? '', white: b.white ?? '', cold: b.cold ?? '',
  };
}
function pitcherFromCalc(p) {
  const bonus = potmBonus(p.potm);
  const pos = s(p.pos).replace(/^\d/, '');
  return {
    pos: OPTIONS.pitcherPos.includes(pos) ? pos : '', type: POTM_TO_TYPE[s(p.potm)] || '', awaken: '', name: s(p.name),
    jang: CALC_GRADE(p.long), chim: CALC_GRADE(p.calm), gakjam: CALC_GRADE(p.gakjam),
    train: [p.stuff, p.velo].map((v) => [calcStat(v, bonus), '', '']),
    lefty: p.lefty ? 'O' : '',
  };
}

// kind: 'b' | 'p'. db 배열을 직접 고치고 결과 개수를 돌려줌.
// - 계산기에서 불러온 행(fromCalc)과 이름이 같으면 갱신
// - 직접 입력한 행과 이름이 같으면 건너뜀
// - 그 외는 빈 행에 추가 (빈 행이 없으면 full)
export function importCalcToDB(kind, calcRows, db) {
  const conv = kind === 'b' ? batterFromCalc : pitcherFromCalc;
  const empty = kind === 'b' ? emptyBatterDB : emptyPitcherDB;
  const res = { added: [], updated: [], skipped: [], full: [] };
  const seen = new Set();
  for (const row of calcRows) {
    const name = s(row.name);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const data = conv(row);
    const i = db.findIndex((r) => s(r.name) === name);
    if (i >= 0) {
      if (!db[i].fromCalc) { res.skipped.push(name); continue; }
      db[i] = { ...db[i], ...data, fromCalc: true };
      res.updated.push(name);
      continue;
    }
    const j = db.findIndex((r) => !s(r.name) && !s(r.type));
    if (j < 0) { res.full.push(name); continue; }
    db[j] = { ...empty(), ...data, fromCalc: true };
    res.added.push(name);
  }
  return res;
}

// --- 참조 테이블 조회 --------------------------------------------------
// 예전 스킬 이름(skillAlias)도 새 이름의 점수로 찾음 — 이미 저장된 덱이 0점이 되지 않게
const skillMap = (rows, alias = {}) => {
  const m = new Map();
  rows.forEach((r) => { if (!m.has(s(r[0]))) m.set(s(r[0]), r.slice(1)); });
  Object.entries(alias).forEach(([from, to]) => { if (!m.has(s(from)) && m.has(s(to))) m.set(s(from), m.get(s(to))); });
  return m;
};
const SKILL_B = skillMap(DATA.skillBatter, DATA.skillAlias?.batter);
const SKILL_P = skillMap(DATA.skillPitcher, DATA.skillAlias?.pitcher);
function skillScore(map, name, lv) {
  const row = map.get(s(name));
  const L = n(lv);
  if (!row || !Number.isInteger(L) || L < 5 || L > 10) return 0;
  return n(row[L - 5]);
}
// 정렬된 [기준값, 확률] 목록에서 x 이하 최대값(MATCH type 1)
function approx(rows, x) {
  if (!rows) return '';
  let hit = '';
  for (const [k, v] of rows) { if (k <= x) hit = v; else break; }
  return hit;
}
function exact(rows, x) {
  if (!rows) return '';
  const r = rows.find(([k]) => k === x);
  return r ? r[1] : '';
}
function potential(grade, idx /*0 풀,1 클,2 장,3 침,4 각잠*/) {
  const r = DATA.potential[s(grade)];
  return r ? n(r[idx]) : 0;
}
function pottukSum(refRow, lv, extra) {
  const L = Math.floor(n(lv));
  if (L < 1) return 0; // 원본: 레벨 공란이면 OFFSET 오류 → 0 (추가값도 무시됨)
  const row = DATA.pottukRows[refRow - 6] || [];
  return sum(row.slice(0, Math.min(L, 20))) + n(extra);
}
function commonStat(isBatter, type, awaken, k) {
  if (s(type) === '' || s(awaken) === '') return 0;
  const aw = (isBatter ? DATA.batterAwaken : DATA.pitcherAwaken)[left2(type)];
  const a = aw && aw[s(awaken)] ? n(aw[s(awaken)][k]) : 0;
  const t = (isBatter ? DATA.batterTypeCommon : DATA.pitcherTypeCommon)[left2(type)];
  return a + (t ? n(t[k]) : 0);
}
const BASE_SKILL_TYPES = { '골글': [6, 6, 6], '시그': [6, 5, 5], '시그(F)': [6, 5, 5], '임팩': [6, 5, 5], '임팩(F)': [6, 5, 5] };

// --- 선수 DB 행 계산 ---------------------------------------------------
export function computeBatterDB(r) {
  const T = s(r.type);
  const isImp = left2(T) === '임팩';
  const pt = r.potteum ? n(DATA.potteum[T]) : 0;
  const tr = r.train || emptyTrain(4);
  const baseSums = [0, 1, 2, 3].map((k) => sum(tr[k] || []) + commonStat(true, T, r.awaken, k) + pt); // BG~BJ
  const y = (r.s75 ? 3 : 0);
  const k180 = (r.s180 ? 1 : 0) + (r.s185 ? 1 : 0);
  const stats = [
    baseSums[0] + (isImp ? y : y + k180),
    baseSums[1] + (isImp ? y : y + k180),
    baseSums[2] + (isImp ? 0 : k180),
    baseSums[3] + (isImp ? 0 : k180),
  ];
  const skill = skillScore(SKILL_B, r.sk1, r.lv1) + skillScore(SKILL_B, r.sk2, r.lv2) + skillScore(SKILL_B, r.sk3, r.lv3);
  const pf = (v) => (r.potteum ? Math.max(0, v) : v);
  const gak = pf(potential(r.full, 0)) + pf(potential(r.clutch, 1)) + potential(r.gakjam, 4);
  const score = stats[0] + stats[1] * 0.85 + stats[2] * 0.4 + stats[3] * 0.15 + skill + gak - 1.25 * n(r.white) - 2.5 * n(r.cold) - (s(r.hand) === '좌' ? 2 : 0);
  const lv = BASE_SKILL_TYPES[T];
  const rawSkill = lv ? skillScore(SKILL_B, r.sk1, lv[0]) + skillScore(SKILL_B, r.sk2, lv[1]) + skillScore(SKILL_B, r.sk3, lv[2]) : 0;
  const trn = [0, 1, 2, 3].map((k) => (tr[k] || [])[1]);
  const spc = [0, 1, 2, 3].map((k) => (tr[k] || [])[2]);
  const joined = (a) => (a.map(s).join('/') === '///' ? '' : a.map(s).join('/'));
  return {
    score, stats, baseSums, skill, gak,
    rawSkillText: rawSkill === 0 || skill === 0 ? '' : `${round2(rawSkill)} / ${round2(skill)}`,
    rawSkill,
    skillProb: approxSafe(DATA.skillProbBatter[left2(T)], rawSkill),
    trainText: joined(trn), trainProb: approxSafe(DATA.trainProb[left2(T)], n(trn[0]) + n(trn[1])), trainStat: n(trn[0]) + n(trn[1]) * 0.85 + n(trn[2]) * 0.4,
    specialText: joined(spc), specialProb: exact(DATA.specialProb[T], n(spc[0]) + n(spc[1])), specialStat: n(spc[0]) + n(spc[1]) * 0.85 + n(spc[2]) * 0.4,
  };
}
export function computePitcherDB(r) {
  const T = s(r.type);
  const isImp = left2(T) === '임팩';
  const pt = r.potteum ? n(DATA.potteum[T]) : 0;
  const tr = r.train || emptyTrain(2);
  const baseSums = [0, 1].map((k) => sum(tr[k] || []) + commonStat(false, T, r.awaken, k) + pt); // BG(변화), BI(구위)
  const stats = [
    baseSums[0] + (isImp ? 0 : (r.s180 ? 1 : 0) + (r.s190 ? 3 : 0)),
    baseSums[1] + (isImp ? (r.s75 ? 3 : 0) : (r.s75 ? 3 : 0) + (r.s180 ? 1 : 0) + (r.s190 ? 1 : 0)),
  ];
  const skill = skillScore(SKILL_P, r.sk1, r.lv1) + skillScore(SKILL_P, r.sk2, r.lv2) + skillScore(SKILL_P, r.sk3, r.lv3);
  // 원본은 투수 포틈 판정이 $D$50(타자DB 1행)을 참조하는 오타 → 각 투수 행의 포틈으로 수정
  const pf = (v) => (r.potteum ? Math.max(0, v) : v);
  const gak = pf(potential(r.jang, 2)) + pf(potential(r.chim, 3)) + potential(r.gakjam, 4);
  const score = stats[0] * 1.05 + stats[1] * 1.35 + skill + gak + (s(r.lefty) === 'O' ? 1 : 0);
  const lv = BASE_SKILL_TYPES[T];
  const rawSkill = lv ? skillScore(SKILL_P, r.sk1, lv[0]) + skillScore(SKILL_P, r.sk2, lv[1]) + skillScore(SKILL_P, r.sk3, lv[2]) : 0;
  const trn = [0, 1].map((k) => (tr[k] || [])[1]);
  const spc = [0, 1].map((k) => (tr[k] || [])[2]);
  const joined = (a) => (a.map(s).join('/') === '/' ? '' : a.map(s).join('/'));
  return {
    score, stats, baseSums, skill, gak, rawSkill,
    rawSkillText: rawSkill === 0 || skill === 0 ? '' : `${round2(rawSkill)} / ${round2(skill)}`,
    skillProb: approxSafe(DATA.skillProbPitcher[left2(T)], rawSkill),
    trainText: joined(trn), trainProb: approxSafe(DATA.trainProb[left2(T)], n(trn[0]) + n(trn[1])), trainStat: n(trn[0]) * 0.78 + n(trn[1]),
    // 원본 AH 열은 "AJK74"(존재하지 않는 열) 오타 → 특재 변화*0.78 + 특재 구위로 수정
    specialText: joined(spc), specialProb: exact(DATA.specialProb[T], n(spc[0]) + n(spc[1])), specialStat: n(spc[0]) * 0.78 + n(spc[1]),
  };
}
function approxSafe(rows, x) { const v = approx(rows, x); return v === undefined ? '' : v; }
function round2(x) { return Math.round(x * 100) / 100; }

// --- 세트덱 보너스 (원본 BB~BE 열) -----------------------------------
function setdeckBatter(T, sd, h, f, d, rowIdx) {
  const W4 = s(T.batterYear), Y4 = s(T.pitcherYear);
  const yB = s(h) !== '' && s(h) === W4;
  const yP = s(h) !== '' && s(h) === Y4;
  const L = (k) => s(sd[k]) === '좌';
  const R = (k) => s(sd[k]) === '우';
  const D = n(d);
  const ral = s(f) === '라올' ? n(T.liveAllstar) : 0;
  const imp = left2(f) === '임팩';
  const common = (yB ? 1 : 0) + ral + (L(40) ? 1 : 0) + (L(60) ? 1 : 0) + (L(80) ? 1 : 0) + (L(100) ? 1 : 0)
    + (D >= 3 && D <= 5 && L(120) ? 2 : 0) + (D >= 6 && L(140) ? 1 : 0) + (L(160) ? 1 : 0)
    + (L(180) && yB ? 1 : 0) + (R(180) && yP ? 1 : 0) + (L(200) ? 2 : 0);
  const y75 = L(75) && (yB || imp) ? 3 : 0;
  const top155 = D >= 1 && D <= 2 && L(155) ? 2 : 0;
  const infield = rowIdx <= 4; // C,1B,2B,3B,SS
  return [
    common + y75 + top155 + (L(175) ? 1 : 0),                                                     // 파워
    common + y75 + (D >= 6 && L(115) ? 2 : 0) + (D >= 3 && D <= 5 && L(135) ? 2 : 0) + (D >= 1 && D <= 2 && L(145) ? 2 : 0) + (L(165) ? 1 : 0), // 정확
    common + (!infield && R(95) ? 2 : 0) + (D >= 1 && D <= 2 && L(145) ? 2 : 0) + top155 + (L(175) ? 1 : 0), // 선구
    common + (infield && L(95) ? 2 : 0) + top155 + (L(175) ? 1 : 0),                              // 인내
  ];
}
function setdeckPitcher(T, sd, h, f, isStarter) {
  const W4 = s(T.batterYear), Y4 = s(T.pitcherYear);
  const yB = s(h) !== '' && s(h) === W4;
  const yP = s(h) !== '' && s(h) === Y4;
  const L = (k) => s(sd[k]) === '좌';
  const R = (k) => s(sd[k]) === '우';
  const ral = s(f) === '라올' ? n(T.liveAllstar) : 0;
  const imp = left2(f) === '임팩';
  const tail = (R(180) && yP ? 1 : 0) + (L(180) && yB ? 1 : 0) + (R(200) ? 2 : 0);
  const base = ral + (R(40) ? 1 : 0) + (R(60) ? 1 : 0) + (R(80) ? 1 : 0) + (R(100) ? 1 : 0) + (R(160) ? 1 : 0) + tail;
  const v75 = R(75) && (yP || imp) ? 3 : 0;
  if (isStarter) {
    return [
      (yP ? 3 : 0) + base + (L(70) ? 1 : 0) + (R(120) ? 1 : 0) + (R(155) ? 1 : 0) + (R(165) ? 1 : 0),
      (yP ? 1 : 0) + base + (L(70) ? 1 : 0) + v75 + (R(120) ? 1 : 0) + (R(135) ? 1 : 0) + (R(145) ? 1 : 0) + (R(175) ? 1 : 0),
    ];
  }
  return [
    (yP ? 3 : 0) + base + (R(70) ? 2 : 0) + (R(140) ? 1 : 0) + (R(165) ? 1 : 0),
    (yP ? 1 : 0) + base + (R(70) ? 2 : 0) + v75 + (R(115) ? 2 : 0) + (R(140) ? 1 : 0) + (R(175) ? 1 : 0),
  ];
}

export function computeManager(st) {
  const T = st.team;
  const sd = T.setdeck || {};
  const tac = s(T.tactic), W = s(T.winTeam), C = s(T.chaseTeam);
  const syn = T.synergy || {};
  const lk = T.locker || {}, cb = T.captainBonus || {}, pcb = T.pCaptainBonus || {};

  const dbB = st.dbB.map(computeBatterDB);
  const dbP = st.dbP.map(computePitcherDB);
  const findB = (name) => (s(name) === '' ? -1 : st.dbB.findIndex((r) => s(r.name) === s(name)));
  const findP = (name) => (s(name) === '' ? -1 : st.dbP.findIndex((r) => s(r.name) === s(name)));

  // ---- 타자 라인업 ----
  const bBuff = buffBatter(T.batterBuff);
  const lineupB = st.lineupB.map((L, i) => {
    const idx = findB(L.name);
    const r = idx >= 0 ? st.dbB[idx] : null;
    const c = idx >= 0 ? dbB[idx] : null;
    const f = r ? s(r.type) : '', g = r ? s(r.awaken) : '', h = r ? s(r.year) : '';
    const set = setdeckBatter(T, sd, h, f, L.order, i);
    const pt = [0, 1, 2, 3].map((k) => pottukSum(6 + i * 4 + k, L.ptLv, (L.ptExtra || [])[k]));
    const isCap = s(L.name) !== '' && s(L.name) === s(T.captain);
    const keys = ['p', 'c', 'e', 'i'];
    const stats = [0, 1, 2, 3].map((k) => (c ? c.baseSums[k] : 0) + set[k] + pt[k] + n(lk[keys[k]]) + (isCap ? n(cb[keys[k]]) : 0) + n(syn.live) + n(syn.impact));
    const skill = c ? c.skill : 0;
    const gak = c ? c.gak : 0;
    const leftPen = r && s(r.hand) === '좌' ? -2.5 : 0;
    const zonePen = r ? n(r.white) * -1.5 + n(r.cold) * -3 : 0;
    const la = r ? n(r.launch) : 0;
    const thr = la < 13 ? 'X' : Math.abs(16 - la) * 3 + 160;
    const lpts = thr === 'X' ? 0 : Math.min(5, la <= 16 ? la - 12 : 4 + (la - 16) * 0.5);
    const lBonus = thr === 'X' ? 0 : stats[0] >= thr ? lpts : 0;
    const launchText = thr === 'X' ? 'NO BONUS' : stats[0] >= thr ? `O (${lpts}점) / +${round2(stats[0] - thr)}` : `X (${lpts}점) / -${round2(thr - stats[0])}`;
    const score = stats[0] + stats[1] * 0.85 + stats[2] * 0.4 + stats[3] * 0.15 + skill + zonePen + gak + leftPen + bBuff + lBonus;
    return {
      found: !!r, type: f, awaken: g, year: h, stats, skill, gak, set, pt, launchText, lBonus, leftPen, zonePen, score,
      grades: r ? { full: r.full, clutch: r.clutch, song: r.song, gakjam: r.gakjam } : {},
      skills: r ? [r.sk1, r.lv1, r.sk2, r.lv2, r.sk3, r.lv3] : [],
      db: c,
    };
  });
  const bScores = lineupB.map((x) => x.score);
  lineupB.forEach((x, i) => {
    const rk = rankOf(bScores, i);
    x.group = rk <= 3 ? '코어' : rk <= 5 ? '상위' : rk <= 7 ? '중위' : '하위';
    x.weight = { 코어: 1.3, 상위: 1.15, 중위: 1, 하위: 0.75 }[x.group];
  });
  const batterSum = lineupB.reduce((t, x) => t + x.weight * x.score, 0);

  // ---- 투수 라인업 ----
  const pBuff = buffPitcher(T.pitcherBuff);
  const cBuff = buffCatcher(T.catcherLead);
  const roles = RELAY_ROLES[tac];
  const rpRoles = st.lineupP.slice(5, 11).map((p) => s(p.role));
  const lineupP = st.lineupP.map((L, i) => {
    const idx = findP(L.name);
    const r = idx >= 0 ? st.dbP[idx] : null;
    const c = idx >= 0 ? dbP[idx] : null;
    const f = r ? s(r.type) : '', g = r ? s(r.awaken) : '', h = r ? s(r.year) : '';
    const isSP = i < 5;
    const set = setdeckPitcher(T, sd, h, f, isSP);
    const pt = [0, 1].map((k) => pottukSum(42 + i * 2 + k, L.ptLv, (L.ptExtra || [])[k]));
    const isCap = s(L.name) !== '' && s(L.name) === s(T.captain);
    const isPCap = s(L.name) !== '' && s(L.name) === s(T.pitcherCaptain);
    const keys = ['v', 'g'];
    const stats = [0, 1].map((k) => (c ? c.baseSums[k] : 0) + set[k] + pt[k] + n(lk[keys[k]]) + (isCap ? n(cb[keys[k]]) : 0) + (isPCap ? n(pcb[keys[k]]) : 0) + n(syn.live) + n(syn.sig));
    const skill = c ? c.skill : 0;
    const gak = c ? c.gak : 0;
    const lefty = r && s(r.lefty) === 'O' ? 1 : 0;
    // 전술 보너스 (1RP~6RP 행, 원본 BH33~BH38)
    let tb = 0;
    const role = s(L.role);
    const chase = role.slice(0, 2) === '추격';
    if (i === 5) tb = ((tac !== '114' && tac !== '141' && W === '적극') ? 2.4 : (tac === '330' && W === '분업') ? 4.8 : 0) + (chase && C === '적극' ? 2.4 : 0);
    else if (i === 6) tb = (chase ? 0 : W === '적극' ? 2.4 : (tac === '330' && W === '분업') ? 4.8 : 0) + (chase && tac !== '114' && C === '적극' ? 2.4 : 0);
    else if (i === 7) tb = (tac !== '330' ? 0 : W === '적극' ? 2.4 : W === '분업' ? 4.8 : 0) + (chase && C === '적극' ? 2.4 : 0);
    else if (i >= 8 && i <= 10) tb = chase && C === '적극' ? 2.4 : 0;
    const score = stats[0] * 1.05 + stats[1] * 1.35 + skill + gak + lefty + tb + cBuff + pBuff;
    let weight = 0;
    if (i >= 5 && i <= 10) {
      const dup = rpRoles.filter((x) => x === role).length > 1;
      const pos = roles ? roles.indexOf(role) : -1;
      weight = dup || pos < 0 ? 0 : RELAY_WEIGHTS[pos];
    } else if (i === 11) weight = 0.8;
    return {
      found: !!r, type: f, awaken: g, year: h, stats, skill, gak, set, pt, lefty, tactic: tb, score, weight,
      grades: r ? { jang: r.jang, chim: r.chim, byun: r.byun, gakjam: r.gakjam } : {},
      skills: r ? [r.sk1, r.lv1, r.sk2, r.lv2, r.sk3, r.lv3] : [],
      db: c,
    };
  });
  const spScores = lineupP.slice(0, 5).map((x) => x.score);
  lineupP.slice(0, 5).forEach((x, i) => {
    const rk = rankOf(spScores, i);
    x.group = rk <= 1 ? '확신의 1선발' : rk <= 4 ? '적당한 선발' : '똥싸는 선발';
    x.weight = { '확신의 1선발': 1.4, '적당한 선발': 1.3, '똥싸는 선발': 1.2 }[x.group];
  });
  const starterSum = lineupP.slice(0, 5).reduce((t, x) => t + x.weight * x.score, 0);
  const relieverSum = lineupP.slice(5, 11).reduce((t, x) => t + x.weight * x.score, 0);
  const closerSum = lineupP[11].score * 0.8;
  const pitcherSum = starterSum + relieverSum + closerSum;

  const zeroCount = lineupP.slice(5, 11).filter((x) => x.weight === 0).length;
  const status = (tac !== '330' && W === '분업') ? '분업은 330만!' : zeroCount !== 1 ? '🚨 중계 배치 오류' : '✅ 중계 배치 정상';

  return {
    dbB, dbP, lineupB, lineupP,
    total: batterSum + pitcherSum, batterSum, pitcherSum, starterSum, relieverSum, closerSum,
    batterAvg: batterSum / 9.7, pitcherAvg: pitcherSum / 9.7,
    groups: {
      core: (large(bScores, 1) + large(bScores, 2) + large(bScores, 3)) / 3,
      upper: (large(bScores, 4) + large(bScores, 5)) / 2,
      middle: (large(bScores, 6) + large(bScores, 7)) / 2,
      lower: (large(bScores, 8) + large(bScores, 9)) / 2,
    },
    starterAvg: starterSum / 6.5, relieverAvg: relieverSum / 2.4, closer: lineupP[11].score,
    status, relayRoles: roles || [],
  };
}
