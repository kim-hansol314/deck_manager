// =====================================================================
//  사이트 설정 — 배포 전에 이 파일만 수정하면 됩니다. (README.md 참고)
// =====================================================================

// 1) Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹) → "SDK 설정 및 구성"의 값을 붙여넣으세요.
//    apiKey가 비어 있으면 사이트가 "데모 모드"(브라우저에만 저장, 가짜 로그인)로 동작합니다.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

// 2) 관리자 구글 계정 이메일 목록 (인원 삭제 권한)
//    ※ firestore.rules 파일의 isAdmin() 목록도 똑같이 맞춰야 실제 권한이 적용됩니다.
export const ADMIN_EMAILS = ['maestro4123@gmail.com'];

// 3) 사이트 이름
export const SITE_TITLE = 'onesol 덱 보정 관리';
