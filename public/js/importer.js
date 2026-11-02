// 기존 엑셀(.xlsm/.xlsx) → 웹 데이터 변환
// get(sheetName, 'A1') 형태의 셀 읽기 함수만 받으므로 브라우저(SheetJS)·테스트 양쪽에서 재사용합니다.
import { defaultCalc, defaultManager, SETDECK_KEYS } from './calc.js';

const SHEET_CALC = '덱 보정 계산기';
const SHEET_MGR = '덱 보정 관리기';

const clean = (v) => (v === null || v === undefined ? '' : v);
const bool = (v) => v === true || v === 1 || String(v).toUpperCase() === 'TRUE';
const str = (v) => (v === null || v === undefined || v === false ? '' : String(v).trim());
const numOrBlank = (v) => (v === null || v === undefined || v === '' ? '' : Number(v));

export function hasSheet(sheetNames, name) { return sheetNames.includes(name); }

export function importCalc(get) {
  const c = defaultCalc();
  const g = (a) => get(SHEET_CALC, a);
  c.settings = {
    batterBuff: str(g('H2')) || 'X', pitcherBuff: str(g('H3')) || 'X', catcherLead: str(g('H4')) || 'X',
    tactic: str(g('P2')) || '114', winTeam: str(g('O4')) || '기본', chaseTeam: str(g('P4')) || '기본',
  };
  c.batters = c.batters.map((b, i) => {
    const r = 7 + i;
    const bonus = Number(g('AE' + r)) || 0; // 매크로가 스탯에 이미 더해둔 POTM 보너스
    const base = (col) => { const v = g(col + r); return v === null || v === undefined || v === '' ? '' : Number(v) - bonus; };
    return {
      pos: str(g('B' + r)) || b.pos, name: str(g('C' + r)),
      power: base('E'), contact: base('F'), eye: base('G'), patience: base('H'),
      skill: numOrBlank(g('I' + r)), white: numOrBlank(g('J' + r)) || 0, cold: numOrBlank(g('K' + r)) || 0,
      fullSwing: str(g('L' + r)) || '범부', clutch: str(g('M' + r)) || '범부', gakjam: str(g('N' + r)) || '개방X',
      leftBat: bool(g('O' + r)), launch: numOrBlank(g('P' + r)), potm: bool(g('Q' + r)) || g('Q' + r) === false ? '' : str(g('Q' + r)),
    };
  });
  c.pitchers = c.pitchers.map((p, i) => {
    const r = 20 + i;
    const bonus = Number(g('AE' + r)) || 0;
    const base = (col) => { const v = g(col + r); return v === null || v === undefined || v === '' ? '' : Number(v) - bonus; };
    return {
      pos: str(g('B' + r)) || p.pos, name: str(g('C' + r)), stuff: base('E'), velo: base('F'), skill: numOrBlank(g('G' + r)),
      long: str(g('H' + r)) || '범부', calm: str(g('I' + r)) || '범부', gakjam: str(g('J' + r)) || '개방X', lefty: bool(g('K' + r)),
      potm: g('L' + r) === false || bool(g('L' + r)) ? '' : str(g('L' + r)),
    };
  });
  c.compare = {
    b: [9, 10].map((r) => ({ p: numOrBlank(g('T' + r)), c: numOrBlank(g('U' + r)), e: numOrBlank(g('V' + r)) })),
    p: [13, 14].map((r) => ({ velo: numOrBlank(g('T' + r)), stuff: numOrBlank(g('U' + r)) })),
  };
  return c;
}

export function importManager(get) {
  const m = defaultManager();
  const g = (a) => get(SHEET_MGR, a);
  const N = (a) => Number(g(a)) || 0;
  const t = m.team;
  t.team = str(g('B3')) || t.team; t.nickname = str(g('B4'));
  t.batterBuff = str(g('J3')) || 'X'; t.pitcherBuff = str(g('J4')) || 'X'; t.catcherLead = str(g('J5')) || 'X';
  t.tactic = str(g('J6')).replace(/^'/, '') || '114'; t.winTeam = str(g('J7')) || '기본'; t.chaseTeam = str(g('J8')) || '기본';
  t.captain = str(g('J9')); t.pitcherCaptain = str(g('J10'));
  t.locker = { p: N('M4'), c: N('M5'), e: N('M6'), i: N('M7'), v: N('M8'), g: N('M9') };
  t.captainBonus = { p: N('N4'), c: N('N5'), e: N('N6'), i: N('N7'), v: N('N8'), g: N('N9') };
  t.pCaptainBonus = { v: N('O8'), g: N('O9') };
  t.synergy = { live: N('S4'), impact: N('S5'), sig: N('S6') };
  t.liveAllstar = N('V4'); t.batterYear = clean(g('W4')); t.pitcherYear = clean(g('Y4'));
  ['V', 'X', 'Z'].forEach((col) => SETDECK_KEYS[col].forEach((k, i) => (t.setdeck[k] = str(g(col + (5 + i))))));

  m.lineupB = m.lineupB.map((L, i) => {
    const r = 15 + i;
    return { pos: L.pos, order: numOrBlank(g('D' + r)), name: str(g('I' + r)), ptLv: numOrBlank(g('AI' + r)), ptExtra: ['AJ', 'AK', 'AL', 'AM'].map((c) => numOrBlank(g(c + r))), major: str(g('AN' + r)), basic: str(g('AS' + r)) };
  });
  m.lineupP = m.lineupP.map((L, i) => {
    const r = 28 + i;
    return { pos: L.pos, role: i >= 5 && i <= 10 ? str(g('C' + r)) : undefined, name: str(g('I' + r)), ptLv: numOrBlank(g('AI' + r)), ptExtra: ['AJ', 'AK'].map((c) => numOrBlank(g(c + r))), major: str(g('AN' + r)), basic: str(g('AS' + r)) };
  });
  const tri = (r, cols) => cols.map((c3) => c3.map((c) => numOrBlank(g(c + r))));
  m.dbB = m.dbB.map((_, i) => {
    const r = 50 + i;
    return {
      s75: bool(g('A' + r)), s180: bool(g('B' + r)), s185: bool(g('C' + r)), potteum: bool(g('D' + r)),
      pos: str(g('E' + r)), type: str(g('F' + r)), awaken: str(g('G' + r)), year: clean(g('H' + r)), name: str(g('I' + r)),
      full: str(g('P' + r)), clutch: str(g('Q' + r)), song: str(g('R' + r)), gakjam: str(g('S' + r)),
      sk1: str(g('U' + r)), lv1: numOrBlank(g('V' + r)), sk2: str(g('W' + r)), lv2: numOrBlank(g('X' + r)), sk3: str(g('Y' + r)), lv3: numOrBlank(g('Z' + r)),
      train: tri(r, [['AI', 'AJ', 'AK'], ['AL', 'AM', 'AN'], ['AO', 'AP', 'AQ'], ['AR', 'AS', 'AT']]),
      hand: str(g('AU' + r)), launch: numOrBlank(g('AV' + r)), white: numOrBlank(g('AW' + r)), cold: numOrBlank(g('AX' + r)),
    };
  });
  m.dbP = m.dbP.map((_, i) => {
    const r = 74 + i;
    return {
      s75: bool(g('A' + r)), s180: bool(g('B' + r)), s190: bool(g('C' + r)), potteum: bool(g('D' + r)),
      pos: str(g('E' + r)), type: str(g('F' + r)), awaken: str(g('G' + r)), year: clean(g('H' + r)), name: str(g('I' + r)),
      jang: str(g('P' + r)), chim: str(g('Q' + r)), byun: str(g('R' + r)), gakjam: str(g('S' + r)),
      sk1: str(g('U' + r)), lv1: numOrBlank(g('V' + r)), sk2: str(g('W' + r)), lv2: numOrBlank(g('X' + r)), sk3: str(g('Y' + r)), lv3: numOrBlank(g('Z' + r)),
      train: tri(r, [['AI', 'AJ', 'AK'], ['AL', 'AM', 'AN']]),
      lefty: str(g('AU' + r)),
    };
  });
  return m;
}

export const SHEETS = { SHEET_CALC, SHEET_MGR };
