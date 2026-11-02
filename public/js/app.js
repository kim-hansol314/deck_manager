import { createStore, isDemo } from './store.js';
import { SITE_TITLE, ADMIN_EMAILS } from './config.js';
import { computeCalc, computeManager, defaultCalc, defaultManager } from './calc.js';
import { importCalc, importManager, SHEETS } from './importer.js';
import { bind, setPath, renderCalc, calcOutputs, renderManager, managerOutputs, MGR_TABS, datalists, esc, fmt } from './views.js';

const $ = (sel, el = document) => el.querySelector(sel);
const app = $('#app');
let store, me = null, authMsg = '';
let page = null; // { uid, member, deck, ro, tab, sub }
let saveTimer = null, saving = false, dirty = false;
let calcSort = null; // 멤버 목록 계산기 총점 정렬: null(기본) | 'desc' | 'asc'

document.title = SITE_TITLE;

// ---------------------------------------------------------------------
function blankDeck() { return { version: 1, calc: defaultCalc(), manager: defaultManager() }; }
function merge(def, got) {
  if (got === undefined || got === null) return def;
  if (Array.isArray(def)) return def.map((d, i) => merge(d, Array.isArray(got) ? got[i] : undefined));
  if (def && typeof def === 'object') {
    const o = { ...def };
    if (typeof got === 'object') for (const k of Object.keys(got)) o[k] = k in def ? merge(def[k], got[k]) : got[k];
    return o;
  }
  return got;
}
function normalize(deck) {
  const d = merge(blankDeck(), deck || {});
  // 예전 POTM '라올'은 '라올(타팀)'으로 바꿈 (저장된 덱·엑셀 모두)
  for (const r of [...d.calc.batters, ...d.calc.pitchers]) if (String(r.potm).trim() === '라올') r.potm = '라올(타팀)';
  return d;
}

function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200);
}
const timeAgo = (ts) => {
  if (!ts) return '기록 없음';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return '방금 전';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return new Date(ts).toLocaleDateString('ko-KR');
};
// 주소 형식: #home, #u-<uid>-calc, #u-<uid>-mgr-<탭>
const link = (uid, tab = 'calc', sub) => `#u-${uid}-${tab}${sub ? '-' + sub : ''}`;
// 화면에 보이는 이름: 직접 정한 닉네임 우선, 없으면 구글 이름
const dname = (m) => (m && (m.alias || m.name)) || '이름 없음';
const initials = (n) => (n || '?').trim().slice(0, 1).toUpperCase();
// 프로필 자리: 고른 구단 로고(public/img), 구단이 없으면 닉네임 첫 글자
const TEAM_BADGE = {
  'LG 트윈스': ['twins.png', '#C30452'], '삼성 라이온즈': ['lions.svg', '#074CA1'], 'KIA 타이거즈': ['tigers.svg', '#EA0029'],
  '두산 베어스': ['bears.svg', '#131230'], 'NC 다이노스': ['dinos.svg', '#315288'], 'SSG 랜더스': ['landers.png', '#CE0E2D'],
  '한화 이글스': ['eagles.svg', '#FC4E00'], '키움 히어로즈': ['heroes.png', '#820024'], 'kt 위즈': ['wiz.svg', '#1A1A1A'],
  '롯데 자이언츠': ['giants.svg', '#041E42'],
};
const avatar = (m, cls = '') => {
  const t = TEAM_BADGE[m.team];
  if (t) return `<span class="avatar team ${cls}" style="--team:${t[1]}" title="${esc(m.team)}"><img src="img/${t[0]}" alt="${esc(m.team)}"></span>`;
  return `<span class="avatar ${cls}">${esc(initials(dname(m)))}</span>`;
};

// ---------------------------------------------------------------------
//  레이아웃
// ---------------------------------------------------------------------
function header() {
  return `<header class="top">
    <a class="brand" href="#home"><span class="ball" aria-hidden="true"></span>${esc(SITE_TITLE)}</a>
    ${me ? `<nav>
      <a href="#home" class="${!page ? 'on' : ''}">멤버</a>
      <a href="${link(me.uid)}" class="${page && page.uid === me.uid ? 'on' : ''}">내 덱</a>
    </nav>
    <div class="me"><button type="button" class="me-btn" id="edit-alias" title="닉네임 변경">${avatar(me, 'sm')}<span class="me-name">${esc(dname(me))}</span></button>${me.admin ? '<span class="badge admin">관리자</span>' : ''}<button class="btn ghost sm" id="logout">로그아웃</button></div>` : ''}
  </header>
  ${isDemo ? '<div class="demo-bar">데모 모드 — 이 브라우저에만 저장됩니다. 실제 서비스는 README 안내대로 Firebase를 연결하세요.</div>' : ''}`;
}

function wireHeader() {
  const b = $('#logout');
  if (b) b.onclick = async () => { await flush(); await store.signOut(); location.hash = '#home'; };
  const e = $('#edit-alias');
  if (e) e.onclick = async () => { await flush(); renderAlias(true); };
}

// ---------------------------------------------------------------------
//  닉네임 설정 (첫 로그인 시 필수, 이후 상단 이름을 눌러 변경)
// ---------------------------------------------------------------------
const ALIAS_MAX = 20;
function renderAlias(editing = false) {
  page = null;
  app.innerHTML = `${header()}
  <main class="login">
    <form class="login-card" id="alias-form">
      <h1>${editing ? '닉네임 변경' : '닉네임 정하기'}</h1>
      <p>멤버 목록에 구글 계정 이름 대신 이 닉네임이 보입니다.</p>
      <input class="in alias-in" id="alias" maxlength="${ALIAS_MAX}" placeholder="닉네임 (최대 ${ALIAS_MAX}자)" value="${esc(me.alias || '')}" autocomplete="off" required>
      <p class="err" id="alias-err" hidden></p>
      <div class="dlg-actions">
        ${editing ? '<a class="btn ghost" href="#home" id="alias-cancel">취소</a>' : ''}
        <button class="btn google" type="submit">${editing ? '변경' : '시작하기'}</button>
      </div>
    </form>
  </main>`;
  wireHeader();
  const input = $('#alias'), err = $('#alias-err');
  input.focus();
  const cancel = $('#alias-cancel');
  if (cancel) cancel.onclick = (ev) => { ev.preventDefault(); route(); };
  const showErr = (t) => { err.textContent = t; err.hidden = false; };
  $('#alias-form').onsubmit = async (ev) => {
    ev.preventDefault();
    const alias = input.value.trim().replace(/\s+/g, ' ');
    if (!alias) return showErr('닉네임을 입력하세요.');
    if (alias.length > ALIAS_MAX) return showErr(`닉네임은 ${ALIAS_MAX}자까지 쓸 수 있습니다.`);
    try {
      const others = (await store.listMembers()).filter((m) => m.uid !== me.uid);
      if (others.some((m) => dname(m).toLowerCase() === alias.toLowerCase())) return showErr('이미 다른 멤버가 쓰는 닉네임입니다.');
      await store.setAlias(me.uid, alias);
      me.alias = alias;
      toast(editing ? '닉네임을 바꿨습니다.' : `${alias} 님, 환영합니다!`);
      route();
    } catch (e) { showErr('저장하지 못했습니다: ' + e.message); }
  };
}

// ---------------------------------------------------------------------
//  로그인 화면
// ---------------------------------------------------------------------
function renderLogin() {
  page = null;
  app.innerHTML = `${header()}
  <main class="login">
    <div class="login-card">
      <div class="board mini" aria-hidden="true"><span>D</span><span>E</span><span>C</span><span>K</span></div>
      <h1>${esc(SITE_TITLE)}</h1>
      <p>덱 보정 계산기와 관리기를 웹에서 씁니다. 구글 계정으로 로그인하면 내 덱을 저장하고, 다른 멤버의 덱을 볼 수 있습니다.</p>
      ${authMsg ? `<p class="err">${esc(authMsg)}</p>` : ''}
      <button class="btn google" id="login"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Google 계정으로 로그인</button>
      ${isDemo ? `<div class="demo-login">
        <p class="help">데모 모드에서는 아래 가상 계정으로 로그인해 권한을 시험해 볼 수 있습니다.</p>
        <div class="demo-accts">
          <button class="btn ghost" data-demo="관리자|admin@demo.local">관리자로 시작</button>
          <button class="btn ghost" data-demo="멤버 김선수|kim@example.com">멤버 김선수</button>
          <button class="btn ghost" data-demo="멤버 이투수|lee@example.com">멤버 이투수</button>
        </div>
      </div>` : ''}
    </div>
  </main>`;
  wireHeader();
  $('#login').onclick = async () => {
    try {
      if (isDemo) return document.querySelector('[data-demo]').click();
      await store.signIn();
    } catch (e) {
      if (e && e.code === 'auth/popup-closed-by-user') return;
      toast('로그인하지 못했습니다: ' + (e.message || e), 'err');
    }
  };
  app.querySelectorAll('[data-demo]').forEach((b) => (b.onclick = async () => {
    const [name, email] = b.dataset.demo.split('|');
    try { await store.signIn({ name, email }); } catch (e) { toast(e.message, 'err'); }
  }));
}

// ---------------------------------------------------------------------
//  멤버 목록 (홈)
// ---------------------------------------------------------------------
// 이름 아래 작은 글씨: 팀 · 닉네임 ('팀 미선택'은 표시하지 않음)
function memberSub(m) {
  const team = m.team && !m.team.includes('미선택') ? m.team : '';
  const parts = [team, m.nickname].filter(Boolean).map(esc);
  return parts.length ? `<small>${parts.join(' · ')}</small>` : '';
}

async function renderHome() {
  page = null;
  app.innerHTML = `${header()}<main class="wrap"><p class="loading">멤버 목록을 불러오는 중…</p></main>`;
  wireHeader();
  let members = [];
  try { members = await store.listMembers(); } catch (e) { $('main').innerHTML = `<p class="err">멤버 목록을 불러오지 못했습니다: ${esc(e.message)}</p>`; return; }
  const defaultOrder = (a, b) => (a.uid === me.uid ? -1 : b.uid === me.uid ? 1 : (b.mgrTotal || 0) + (b.calcTotal || 0) - (a.mgrTotal || 0) - (a.calcTotal || 0));
  const sortMembers = () => {
    if (!calcSort) return members.sort(defaultOrder);
    const dir = calcSort === 'asc' ? 1 : -1;
    return members.sort((a, b) => dir * ((a.calcTotal || 0) - (b.calcTotal || 0)) || defaultOrder(a, b));
  };
  const rowsHtml = () => members.map((m) => `<tr>
        <td><a class="who" href="${link(m.uid)}">${avatar(m)}<span><b>${esc(dname(m))}</b>${m.uid === me.uid ? ' <span class="badge">나</span>' : ''}${memberSub(m)}</span></a></td>
        <td class="r num-cell">${fmt(m.calcTotal || 0)}</td>
        <td class="r num-cell">${fmt(m.mgrTotal || 0)}</td>
        <td class="r hide-sm muted">${timeAgo(m.updatedAt)}</td>
        ${me.admin ? `<td class="r">${m.uid === me.uid ? '' : `<button class="btn danger sm" data-del="${esc(m.uid)}">삭제</button>`}</td>` : ''}
      </tr>`).join('');
  const sortArrow = () => (calcSort === 'desc' ? '▼' : calcSort === 'asc' ? '▲' : '↕');
  const ariaSort = () => (calcSort === 'desc' ? 'descending' : calcSort === 'asc' ? 'ascending' : 'none');
  sortMembers();
  let blocked = [];
  if (me.admin) { try { blocked = await store.listBlocked(); } catch {} }
  $('main').innerHTML = `
    <div class="page-head">
      <h1>멤버</h1>
      <p>${members.length}명 · 이름을 누르면 덱을 볼 수 있습니다. 수정은 본인 덱만 가능합니다.</p>
    </div>
    <table class="members">
      <thead><tr><th>멤버</th><th class="r" id="calc-sort-th" aria-sort="${ariaSort()}"><button type="button" class="sort-btn" id="calc-sort" title="계산기 총점으로 정렬">계산기 총점 <span class="arrow">${sortArrow()}</span></button></th><th class="r">관리기 총점</th><th class="r hide-sm">최근 수정</th>${me.admin ? '<th></th>' : ''}</tr></thead>
      <tbody>${rowsHtml()}</tbody>
    </table>
    ${me.admin && blocked.length ? `<section class="panel"><h3>차단된 계정</h3><p class="help">삭제하면서 재가입을 막은 계정입니다. 차단을 풀면 다시 로그인해서 새로 시작할 수 있습니다.</p>
      <ul class="blocked">${blocked.map((b) => `<li><span>${esc(b.name || b.uid)} <small class="muted">${esc(b.email || '')}</small></span><button class="btn ghost sm" data-unblock="${esc(b.uid)}">차단 해제</button></li>`).join('')}</ul></section>` : ''}`;
  const wireDelete = () => app.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => confirmDelete(members.find((m) => m.uid === b.dataset.del))));
  wireDelete();
  $('#calc-sort').onclick = () => {
    // 기본 → 내림차순 → 오름차순 → 기본
    calcSort = calcSort === null ? 'desc' : calcSort === 'desc' ? 'asc' : null;
    sortMembers();
    $('table.members tbody').innerHTML = rowsHtml();
    $('#calc-sort .arrow').textContent = sortArrow();
    $('#calc-sort-th').setAttribute('aria-sort', ariaSort());
    wireDelete();
  };
  app.querySelectorAll('[data-unblock]').forEach((b) => (b.onclick = async () => {
    try { await store.unblock(b.dataset.unblock); toast('차단을 해제했습니다.'); renderHome(); } catch (e) { toast('차단 해제 실패: ' + e.message, 'err'); }
  }));
}

function ask(title, body, okLabel) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dlg';
    dlg.innerHTML = `<form method="dialog"><h3>${esc(title)}</h3><p>${esc(body)}</p>
      <div class="dlg-actions"><button class="btn ghost" value="cancel">취소</button><button class="btn danger" value="ok">${esc(okLabel)}</button></div></form>`;
    document.body.appendChild(dlg);
    dlg.showModal();
    dlg.addEventListener('close', () => { resolve(dlg.returnValue === 'ok'); dlg.remove(); });
  });
}

function confirmDelete(m) {
  const dlg = document.createElement('dialog');
  dlg.className = 'dlg';
  dlg.innerHTML = `<form method="dialog">
    <h3>${esc(dname(m))} 님을 삭제할까요?</h3>${m.alias && m.name ? `<p class="help">구글 이름: ${esc(m.name)}${m.email ? ` (${esc(m.email)})` : ''}</p>` : ''}
    <p>이 멤버의 계산기·관리기 데이터가 모두 지워지고 되돌릴 수 없습니다.</p>
    <label class="row"><input type="checkbox" id="blk" checked> 다시 로그인해도 가입되지 않게 차단</label>
    <div class="dlg-actions"><button class="btn ghost" value="cancel">취소</button><button class="btn danger" value="ok" id="okdel">삭제</button></div>
  </form>`;
  document.body.appendChild(dlg);
  dlg.showModal();
  dlg.addEventListener('close', async () => {
    const block = $('#blk', dlg).checked;
    const ok = dlg.returnValue === 'ok';
    dlg.remove();
    if (!ok) return;
    try { await store.deleteMember(m, block); toast(`${dname(m)} 님을 삭제했습니다.`); renderHome(); }
    catch (e) { toast('삭제하지 못했습니다: ' + e.message, 'err'); }
  });
}

// ---------------------------------------------------------------------
//  멤버 덱 화면
// ---------------------------------------------------------------------
async function openDeck(uid, tab, sub) {
  const same = page && page.uid === uid;
  if (!same) {
    await flush();
    app.innerHTML = `${header()}<main class="wrap"><p class="loading">덱을 불러오는 중…</p></main>`;
    wireHeader();
    let member, deck;
    try {
      [member, deck] = await Promise.all([store.getMember(uid), store.getDeck(uid)]);
    } catch (e) { $('main').innerHTML = `<p class="err">불러오지 못했습니다: ${esc(e.message)}</p>`; return; }
    if (!member) { $('main').innerHTML = '<p class="err">없는 멤버이거나 삭제된 멤버입니다. <a href="#home">멤버 목록으로</a></p>'; return; }
    page = { uid, member, deck: normalize(deck), ro: uid !== me.uid };
  }
  page.tab = tab === 'mgr' ? 'mgr' : 'calc';
  page.sub = MGR_TABS.some(([k]) => k === sub) ? sub : 'team';
  renderDeck();
}

function renderDeck() {
  const P = page;
  bind(P.deck, P.ro);
  const nick = P.deck.manager.team.nickname;
  app.innerHTML = `${header()}
  <main class="wrap deck ${P.ro ? 'readonly' : ''}">
    <div class="deck-head">
      <div class="who big">${avatar(P.member, 'lg')}<div>
        <h1>${esc(dname(P.member))}${nick ? ` <small>${esc(nick)}</small>` : ''}</h1>
        <p>${P.ro ? '<span class="badge view">보기 전용</span> 다른 멤버의 덱은 볼 수만 있습니다.' : '내 덱 · 입력하면 자동으로 저장됩니다. <span class="save" id="savestate">저장됨</span>'}</p>
      </div></div>
      ${P.ro ? '' : `<div class="deck-actions">
        <label class="btn ghost" title="기존 POTM 엑셀(.xlsm) 내용을 불러옵니다">엑셀 가져오기<input type="file" id="xl" accept=".xlsm,.xlsx,.xls" hidden></label>
        <button class="btn ghost" id="reset-tab">이 탭 비우기</button>
      </div>`}
    </div>
    <div class="board" role="group" aria-label="점수판">
      <div class="cell main"><span class="lbl">${P.tab === 'calc' ? '계산기 총 보정' : '관리기 총 보정'}</span><b id="sb-total">0</b></div>
      <div class="cell"><span class="lbl">타자 합</span><b id="sb-bat">0</b></div>
      <div class="cell"><span class="lbl">투수 합</span><b id="sb-pit">0</b></div>
      <div class="cell"><span class="lbl">타자 평균</span><b id="sb-bavg">0</b></div>
      <div class="cell"><span class="lbl">투수 평균</span><b id="sb-pavg">0</b></div>
    </div>
    <div class="tabs" role="tablist">
      <a role="tab" href="${link(P.uid)}" class="${P.tab === 'calc' ? 'on' : ''}">덱 보정 계산기</a>
      <a role="tab" href="${link(P.uid, 'mgr', P.sub)}" class="${P.tab === 'mgr' ? 'on' : ''}">덱 보정 관리기</a>
    </div>
    ${P.tab === 'mgr' ? `<div class="subtabs">${MGR_TABS.map(([k, l]) => `<a href="${link(P.uid, 'mgr', k)}" class="${P.sub === k ? 'on' : ''}">${l}</a>`).join('')}</div>` : ''}
    <div id="view">${P.tab === 'calc' ? renderCalc(P.deck) : renderManager(P.deck, P.sub)}</div>
    ${datalists()}
  </main>`;
  wireHeader();
  const view = $('#view');
  if (!P.ro) {
    view.addEventListener('input', onEdit);
    view.addEventListener('change', onEdit);
    $('#xl').onchange = onImport;
    $('#reset-tab').onclick = resetTab;
  }
  refreshOutputs();
}

function parseInput(el) {
  const t = el.dataset.t;
  if (t === 'bool') return el.checked;
  if (t === 'num') {
    if (el.value === '') return '';
    const x = Number(el.value);
    return Number.isFinite(x) ? x : '';
  }
  return el.value;
}
function onEdit(e) {
  const el = e.target;
  if (!el.dataset || !el.dataset.path || page.ro) return;
  if (e.type === 'input' && (el.tagName === 'SELECT' || el.type === 'checkbox')) return;
  setPath(page.deck, el.dataset.path, parseInput(el));
  refreshOutputs();
  scheduleSave();
}

function results() {
  const c = computeCalc(page.deck.calc);
  const m = computeManager(page.deck.manager);
  return { c, m };
}
function refreshOutputs() {
  const { c, m } = results();
  const o = page.tab === 'calc' ? calcOutputs(page.deck, c) : managerOutputs(page.deck, m);
  document.querySelectorAll('[data-out]').forEach((el) => {
    const k = el.dataset.out;
    if (k in o) el.textContent = o[k];
  });
  const r = page.tab === 'calc' ? c : m;
  $('#sb-total').textContent = fmt(r.total, 1);
  $('#sb-bat').textContent = fmt(r.batterSum, 1);
  $('#sb-pit').textContent = fmt(r.pitcherSum, 1);
  $('#sb-bavg').textContent = fmt(r.batterAvg, 1);
  $('#sb-pavg').textContent = fmt(r.pitcherAvg, 1);
  document.querySelectorAll('.status').forEach((el) => el.classList.toggle('bad', !String(el.textContent).startsWith('✅')));
}

// ---- 저장 ----
function setSaveState(t, cls = '') { const el = $('#savestate'); if (el) { el.textContent = t; el.className = 'save ' + cls; } }
function scheduleSave() {
  dirty = true;
  setSaveState('저장 대기…', 'pending');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 800);
}
async function flush() {
  clearTimeout(saveTimer);
  if (!dirty || !page || page.ro || saving) return;
  saving = true; dirty = false;
  setSaveState('저장 중…', 'pending');
  try {
    const { c, m } = results();
    const team = page.deck.manager.team.team || '';
    await store.saveDeck(page.uid, page.deck, { calcTotal: round1(c.total), mgrTotal: round1(m.total), nickname: page.deck.manager.team.nickname || '', team });
    setSaveState('저장됨');
    if (page.uid === me.uid && me.team !== team) {
      // 구단을 바꾸면 화면의 아이콘도 바로 바꿈
      me.team = team; page.member.team = team;
      document.querySelectorAll('.top .avatar, .deck-head .avatar').forEach((el) => (el.outerHTML = avatar(me, el.classList.contains('lg') ? 'lg' : 'sm')));
    }
  } catch (e) {
    dirty = true;
    setSaveState('저장 실패', 'err');
    toast('저장하지 못했습니다: ' + e.message, 'err');
  } finally {
    saving = false;
    if (dirty) scheduleSave();
  }
}
const round1 = (x) => Math.round(x * 10) / 10;
window.addEventListener('beforeunload', (e) => { if (dirty) { flush(); e.preventDefault(); } });

// ---- 엑셀 가져오기 ----
async function loadSheetJS() {
  if (window.XLSX) return window.XLSX;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = res; s.onerror = () => rej(new Error('엑셀 읽기 도구를 불러오지 못했습니다.'));
    document.head.appendChild(s);
  });
  return window.XLSX;
}
async function onImport(e) {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const XLSX = await loadSheetJS();
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
    const get = (sh, a) => { const ws = wb.Sheets[sh]; const c = ws && ws[a]; return c ? c.v : null; };
    const hasC = wb.SheetNames.includes(SHEETS.SHEET_CALC), hasM = wb.SheetNames.includes(SHEETS.SHEET_MGR);
    if (!hasC && !hasM) throw new Error(`'${SHEETS.SHEET_CALC}' 또는 '${SHEETS.SHEET_MGR}' 시트가 없는 파일입니다.`);
    const parts = [hasC && '계산기', hasM && '관리기'].filter(Boolean).join('·');
    if (!(await ask(`${f.name}의 ${parts} 내용으로 지금 데이터를 덮어쓸까요?`, '지금 입력된 값은 사라집니다.', '덮어쓰기'))) return;
    if (hasC) page.deck.calc = normalize({ calc: importCalc(get) }).calc;
    if (hasM) page.deck.manager = normalize({ manager: importManager(get) }).manager;
    renderDeck();
    scheduleSave();
    toast(`${parts} 데이터를 가져왔습니다.`);
  } catch (err) { toast('가져오지 못했습니다: ' + err.message, 'err'); }
}
async function resetTab() {
  const name = page.tab === 'calc' ? '덱 보정 계산기' : '덱 보정 관리기';
  if (!(await ask(`${name}의 입력값을 모두 지울까요?`, '되돌릴 수 없습니다.', '모두 지우기'))) return;
  if (page.tab === 'calc') page.deck.calc = defaultCalc(); else page.deck.manager = defaultManager();
  renderDeck();
  scheduleSave();
}

// ---------------------------------------------------------------------
//  라우터
// ---------------------------------------------------------------------
function route() {
  if (!me) return renderLogin();
  if (!me.alias) return renderAlias();
  const m = location.hash.match(/^#u-([A-Za-z0-9_-]+?)-(calc|mgr)(?:-(team|lineup|dbB|dbP))?$/);
  if (m) return openDeck(m[1], m[2], m[3]);
  return renderHome();
}
window.addEventListener('hashchange', route);

(async function main() {
  app.innerHTML = '<p class="loading">불러오는 중…</p>';
  try { store = await createStore(); } catch (e) { app.innerHTML = `<p class="err">초기화 실패: ${esc(e.message)} — config.js의 Firebase 설정을 확인하세요.</p>`; return; }
  store.onAuth((u, msg) => {
    const changed = (me && me.uid) !== (u && u.uid);
    me = u; authMsg = msg || '';
    if (changed) page = null;
    route();
  });
})();
