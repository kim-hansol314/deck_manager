// =====================================================================
//  로그인 / 저장소 계층
//   - Firebase 모드: Google 로그인 + Cloud Firestore (권한은 firestore.rules가 서버에서 강제)
//   - 데모 모드: config.js에 Firebase 설정이 없을 때. 브라우저 localStorage에만 저장
// =====================================================================
import { firebaseConfig, ADMIN_EMAILS } from './config.js';

const FB_VER = '10.12.2';
export const isDemo = !firebaseConfig.apiKey;

export function isAdminEmail(email) {
  if (isDemo && email === 'admin@demo.local') return true; // 데모 모드 전용 가상 관리자
  return !!email && ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(String(email).toLowerCase());
}

// ---------------------------------------------------------------------
//  Firebase 구현
// ---------------------------------------------------------------------
async function firebaseStore() {
  const base = `https://www.gstatic.com/firebasejs/${FB_VER}`;
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-firestore.js`),
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const provider = new A.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  return {
    mode: 'firebase',
    onAuth(cb) {
      return A.onAuthStateChanged(auth, async (u) => {
        if (!u) return cb(null);
        const user = { uid: u.uid, name: u.displayName || u.email, email: u.email, photo: '', admin: isAdminEmail(u.email) && u.emailVerified };
        try {
          const blocked = await F.getDoc(F.doc(db, 'blocked', u.uid));
          if (blocked.exists()) { await A.signOut(auth); return cb(null, '관리자가 삭제한 계정입니다. 다시 사용하려면 관리자에게 차단 해제를 요청하세요.'); }
          const ref = F.doc(db, 'users', u.uid);
          const snap = await F.getDoc(ref);
          const now = Date.now();
          if (!snap.exists()) {
            await F.setDoc(ref, { name: user.name, email: user.email || '', photo: user.photo, calcTotal: 0, mgrTotal: 0, createdAt: now, updatedAt: now, lastLogin: now });
          } else {
            user.alias = snap.data().alias || '';
            user.team = snap.data().team || '';
            await F.updateDoc(ref, { name: user.name, photo: user.photo, lastLogin: now });
          }
        } catch (e) { console.error(e); return cb(null, '프로필을 저장하지 못했습니다: ' + e.message); }
        cb(user);
      });
    },
    async signIn() { await A.signInWithPopup(auth, provider); },
    async signOut() { await A.signOut(auth); },
    // 멤버 목록에 보일 닉네임 (구글 이름 대신 표시)
    async setAlias(uid, alias) { await F.updateDoc(F.doc(db, 'users', uid), { alias, updatedAt: Date.now() }); },
    async listMembers() {
      const qs = await F.getDocs(F.collection(db, 'users'));
      return qs.docs.map((d) => ({ uid: d.id, ...d.data() }));
    },
    async getMember(uid) {
      const s = await F.getDoc(F.doc(db, 'users', uid));
      return s.exists() ? { uid, ...s.data() } : null;
    },
    async getDeck(uid) {
      const s = await F.getDoc(F.doc(db, 'decks', uid));
      if (!s.exists()) return null;
      try { return JSON.parse(s.data().json); } catch { return null; }
    },
    async saveDeck(uid, deck, summary) {
      const now = Date.now();
      await F.setDoc(F.doc(db, 'decks', uid), { json: JSON.stringify(deck), updatedAt: now });
      await F.updateDoc(F.doc(db, 'users', uid), { ...summary, updatedAt: now });
    },
    async deleteMember(m, block) {
      const uid = m.uid;
      const batch = F.writeBatch(db);
      batch.delete(F.doc(db, 'decks', uid));
      batch.delete(F.doc(db, 'users', uid));
      if (block) batch.set(F.doc(db, 'blocked', uid), { at: Date.now(), name: m.name || '', alias: m.alias || '', email: m.email || '' });
      await batch.commit();
    },
    async listBlocked() {
      const qs = await F.getDocs(F.collection(db, 'blocked'));
      return qs.docs.map((d) => ({ uid: d.id, ...d.data() }));
    },
    async unblock(uid) { await F.deleteDoc(F.doc(db, 'blocked', uid)); },
  };
}

// ---------------------------------------------------------------------
//  데모 구현 (localStorage)
// ---------------------------------------------------------------------
function demoStore() {
  const K = 'potm-demo-v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(K)) || { users: {}, decks: {}, blocked: {}, session: null }; } catch { return { users: {}, decks: {}, blocked: {}, session: null }; } };
  const save = (d) => { try { localStorage.setItem(K, JSON.stringify(d)); } catch {} };
  let listener = null;
  const emit = () => {
    const d = load();
    const s = d.session;
    if (!s) return listener && listener(null);
    if (d.blocked[s.uid]) { d.session = null; save(d); return listener && listener(null, '관리자가 삭제한 계정입니다.'); }
    listener && listener({ ...s, alias: (d.users[s.uid] && d.users[s.uid].alias) || '', team: (d.users[s.uid] && d.users[s.uid].team) || '', admin: isAdminEmail(s.email) });
  };
  const guard = (uid) => { const s = load().session; if (!s || s.uid !== uid) throw new Error('본인 데이터만 수정할 수 있습니다.'); };
  const guardAdmin = () => { const s = load().session; if (!s || !isAdminEmail(s.email)) throw new Error('관리자만 삭제할 수 있습니다.'); };
  return {
    mode: 'demo',
    onAuth(cb) { listener = cb; setTimeout(emit, 0); return () => (listener = null); },
    async signIn(account) {
      // account: { name, email }
      const d = load();
      const uid = 'demo' + account.email.replace(/[^a-z0-9]/gi, '');
      if (d.blocked[uid]) throw new Error('관리자가 삭제한 계정입니다.');
      const now = Date.now();
      d.users[uid] = { ...(d.users[uid] || { calcTotal: 0, mgrTotal: 0, createdAt: now, updatedAt: now }), name: account.name, email: account.email, photo: '', lastLogin: now };
      d.session = { uid, name: account.name, email: account.email, photo: '' };
      save(d); emit();
    },
    async signOut() { const d = load(); d.session = null; save(d); emit(); },
    async setAlias(uid, alias) { guard(uid); const d = load(); d.users[uid] = { ...d.users[uid], alias, updatedAt: Date.now() }; save(d); },
    async listMembers() { const d = load(); return Object.entries(d.users).map(([uid, u]) => ({ uid, ...u })); },
    async getMember(uid) { const u = load().users[uid]; return u ? { uid, ...u } : null; },
    async getDeck(uid) { const j = load().decks[uid]; return j ? JSON.parse(j) : null; },
    async saveDeck(uid, deck, summary) {
      const s = load().session;
      if (!(s && isAdminEmail(s.email))) guard(uid);
      const d = load(); const now = Date.now();
      d.decks[uid] = JSON.stringify(deck);
      d.users[uid] = { ...d.users[uid], ...summary, updatedAt: now };
      save(d);
    },
    async deleteMember(m, block) {
      guardAdmin();
      const uid = m.uid;
      const d = load();
      delete d.decks[uid]; delete d.users[uid];
      if (block) d.blocked[uid] = { at: Date.now(), name: m.name || '', alias: m.alias || '', email: m.email || '' };
      save(d);
    },
    async listBlocked() { return Object.entries(load().blocked).map(([uid, b]) => ({ uid, ...b })); },
    async unblock(uid) { guardAdmin(); const d = load(); delete d.blocked[uid]; save(d); },
  };
}

export async function createStore() {
  return isDemo ? demoStore() : firebaseStore();
}
