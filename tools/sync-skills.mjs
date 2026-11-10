// public/js/skills.js (V26 스킬 점수표) → public/js/data.js 의 skillBatter / skillPitcher 로 반영
// 사용법: node tools/sync-skills.mjs
// - 스킬 이름이 바뀌어도 이미 저장된 덱이 0점이 되지 않도록, 예전 이름 → 새 이름은 data.js 의 skillAlias 로 연결합니다.
//   새로 이름이 바뀌면 아래 ALIAS 에 한 줄 추가하세요.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsPath = path.join(root, 'public/js/skills.js');
const dataPath = path.join(root, 'public/js/data.js');

// 예전 이름 → 새 이름 (점수가 같은 스킬만)
const ALIAS = {
  batter: {
    '공포의하위타선(타순O)': '공포의하위타선(타순0)',
    '수비안정성(타순O)': '수비안정성(타순0)',
    '핵타선(타순O)': '핵타선(타순0)',
    '리드오프(타순O)': '리드오프(타순0)',
    '5툴플레이어(275299)': '5툴플레이어(주+수 275~299)',
    '5툴플레이어(267274)': '5툴플레이어(주+수 267~274)',
    '5툴플레이어(250266)': '5툴플레이어(주+수 250~266)',
    '5툴플레이어(234249)': '5툴플레이어(주+수 234~249)',
    '5툴플레이어(225233)': '5툴플레이어(주+수 225~233)',
    '5툴플레이어(200224)': '5툴플레이어(주+수 200~224)',
    '어퍼스윙': '어퍼스윙★',
    '매의눈': '매의눈★',
  },
  pitcher: {
    '긴급투입(추격조)': '긴급투입(추격조)(팀버프)',
    '긴급투입(롱릴리프)': '긴급투입(롱릴리프)(팀버프)',
    '긴급투입(선발)': '긴급투입(선발)(팀버프)',
    '긴급투입(필승조/마무리)': '긴급투입(필승조/마무리)(팀버프)',
    '철완(140149)': '철완(지구력 140~149)',
    '철완(134139)': '철완(지구력 134~139)',
    '철완(120133)': '철완(지구력 120~133)',
    '철완(117119)': '철완(지구력 117~119)',
    '철완(100116)': '철완(지구력 100~116)',
    '필승카드': '필승카드(팀버프)',
    '원투펀치(배치O)': '원투펀치(배치0)',
    '타선지원(선발/불펜)': '타선지원',
    '클러치피처': '클러치피쳐',
  },
};

// skills.js 는 window.* 에 값을 넣는 브라우저용 스크립트라 가짜 window 로 읽음
const win = {};
new Function('window', fs.readFileSync(skillsPath, 'utf8'))(win);
const levels = win.SKILL_LEVELS;
if (JSON.stringify(levels) !== JSON.stringify([5, 6, 7, 8, 9, 10])) throw new Error('SKILL_LEVELS 가 5~10 이 아닙니다: ' + levels);

const rows = (list) => list.map((x) => [x.name.trim(), ...levels.map((l) => (x.scores[l] ?? null))]);
// 원소마다 따로 문자열로 만듦 (스킬 이름 안의 쉼표는 건드리지 않음)
const fmtRows = (list) => list.map((r) => `    [${r.map((v) => JSON.stringify(v)).join(', ')}],`).join('\n');
const fmtAlias = (m) => Object.entries(m).map(([a, b]) => `      ${JSON.stringify(a)}: ${JSON.stringify(b)},`).join('\n');

const batter = rows(win.SKILL_SCORES.batter);
const pitcher = rows(win.SKILL_SCORES.pitcher);
// 별칭 대상은 그 이름 그대로 있거나, 투수라면 (선발)/(불펜) 등으로 나뉘어 있어야 함 (calc.js findSkill 과 같은 규칙)
const TAGS = ['선발', '불펜', '중계', '마무리'];
const exists = (names, to) => names.has(to) || TAGS.some((t) => {
  const m = to.match(/^(.*)\(([^()]*)\)$/);
  return names.has(`${to}(${t})`) || (m && names.has(`${m[1]}(${m[2]},${t})`));
});
for (const [kind, list] of [['batter', batter], ['pitcher', pitcher]]) {
  const names = new Set(list.map((r) => r[0]));
  for (const [from, to] of Object.entries(ALIAS[kind])) if (!exists(names, to)) throw new Error(`${kind} 별칭 대상이 skills.js 에 없음: ${from} → ${to}`);
}

let src = fs.readFileSync(dataPath, 'utf8');
const replaceBlock = (key, body) => {
  // 들여쓰기 2칸의 "  key: [ ... ]," 블록을 통째로 교체 (없으면 맨 끝에 추가)
  const re = new RegExp(`  ${key}: (\\[|\\{)\\n[\\s\\S]*?\\n  (\\]|\\}),\\n`);
  const block = `  ${key}: ${body}\n`;
  if (re.test(src)) src = src.replace(re, () => block);
  else src = src.replace(/\n};\s*$/, () => `\n${block}};\n`);
};
replaceBlock('skillBatter', `[\n${fmtRows(batter)}\n  ],`);
replaceBlock('skillPitcher', `[\n${fmtRows(pitcher)}\n  ],`);
replaceBlock('skillAlias', `{\n    batter: {\n${fmtAlias(ALIAS.batter)}\n    },\n    pitcher: {\n${fmtAlias(ALIAS.pitcher)}\n    },\n  },`);
fs.writeFileSync(dataPath, src);
console.log(`data.js 갱신: 타자 ${batter.length}개, 투수 ${pitcher.length}개, 별칭 ${Object.keys(ALIAS.batter).length + Object.keys(ALIAS.pitcher).length}개`);
