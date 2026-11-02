# onesol 덱 보정 관리 (POTM 엑셀 웹 버전)

`onesol(클대) POTM.xlsm`의 **덱 보정 계산기 / 덱 보정 관리기** 수식과 **POTM 매크로(VBA)** 를 웹사이트로 옮긴 것입니다.

- 구글 계정으로 로그인 → 멤버마다 자기 덱(계산기 + 관리기)을 저장
- 본인 덱만 수정 가능, 다른 멤버 덱은 **보기 전용**
- 관리자 계정은 멤버 **삭제**(+ 재가입 차단 / 차단 해제) 가능
- 기존 엑셀 파일을 그대로 **가져오기** 가능 (내 덱 화면 → "엑셀 가져오기")
- 권한은 Firestore 보안 규칙(`firestore.rules`)이 서버에서 강제하므로 브라우저를 조작해도 남의 덱을 고칠 수 없습니다.

## 먼저 체험해 보기 (설치 없이)

`public/js/config.js`의 `apiKey`가 비어 있으면 **데모 모드**로 동작합니다(이 브라우저에만 저장, 가상 계정 로그인).

```bash
cd public
python3 -m http.server 8000     # 또는 npx serve
# 브라우저에서 http://localhost:8000 접속 → "관리자로 시작" / "멤버 김선수" 등으로 권한 확인
```

> `index.html`을 더블클릭해서 여는 방식(file://)은 모듈 로딩이 막혀 동작하지 않습니다. 꼭 위처럼 서버로 열어 주세요.

## 실제 서비스로 배포하기 (Firebase, 무료 요금제로 충분)

1. **프로젝트 만들기** — <https://console.firebase.google.com> → 프로젝트 추가.
2. **웹 앱 등록** — 프로젝트 설정(톱니바퀴) → 내 앱 → `</>` 웹 앱 추가 → 나오는 `firebaseConfig` 값을 `public/js/config.js`에 붙여넣기.
3. **구글 로그인 켜기** — Authentication → 시작하기 → Sign-in method → **Google** 사용 설정.
4. **데이터베이스 만들기** — Firestore Database → 데이터베이스 만들기 → 위치 `asia-northeast3 (서울)` → **프로덕션 모드**.
5. **관리자 지정** — 아래 두 곳의 이메일 목록을 똑같이 맞춥니다(지금은 `maestro4123@gmail.com`).
   - `public/js/config.js` → `ADMIN_EMAILS` (화면에 삭제 버튼 표시용)
   - `firestore.rules` → `isAdmin()` 안의 목록 (실제 권한)
6. **배포** (Node.js 설치 필요)
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add            # 위에서 만든 프로젝트 선택
   firebase deploy               # 보안 규칙 + 사이트 함께 배포
   ```
   완료되면 `https://<프로젝트ID>.web.app` 주소가 나옵니다. 이 주소를 클럽원에게 공유하면 됩니다.

다른 호스팅(GitHub Pages, Netlify 등)에 `public` 폴더만 올려도 됩니다. 이때는 Firebase 콘솔 → Authentication → 설정 → **승인된 도메인**에 그 주소를 추가하고, 보안 규칙은 Firestore → 규칙 탭에 `firestore.rules` 내용을 붙여넣고 게시하세요.

## 권한 정리

| 동작 | 본인 | 다른 멤버 | 관리자 |
|---|---|---|---|
| 멤버 목록 · 덱 보기 | ✅ | ✅ (로그인 필요) | ✅ |
| 덱 수정 | ✅ 본인 것만 | ❌ | 본인 것만 |
| 멤버 삭제 / 차단 해제 | ❌ | ❌ | ✅ |

- 삭제하면 그 멤버의 프로필과 덱 데이터가 지워집니다. "재가입 차단"을 체크하면 같은 구글 계정으로 다시 로그인해도 들어올 수 없습니다(멤버 화면 아래 "차단된 계정"에서 해제).
- 구글 로그인 계정 자체는 Firebase 콘솔 → Authentication → 사용자 탭에서 지울 수 있습니다(선택 사항).

## 엑셀 → 웹 대응

| 엑셀 | 웹 |
|---|---|
| 덱 보정 계산기 시트 | "덱 보정 계산기" 탭 |
| 덱 보정 관리기 시트 (팀정보 / 라인업 / 선수DB) | "덱 보정 관리기" 탭의 팀 정보 · 라인업 · 타자 DB · 투수 DB |
| 스킬점수표 · 참조 시트 | `public/js/data.js` (원본에서 자동 추출) |
| Sheet1 VBA `Worksheet_Change` / `POTMBonus` | POTM 선택 시 스탯마다 보너스 자동 가산 (`calc.js`의 `potmBonus`) |

**POTM 매크로 동작**: 원본은 POTM을 고르면 셀 값을 직접 바꿨지만, 웹은 "기본 스탯"과 "POTM"을 따로 저장하고 최종 스탯 = 기본 + 보너스로 계산합니다. 결과는 같고, POTM을 바꾸거나 해제해도 값이 꼬이지 않습니다. 엑셀 가져오기 때는 매크로가 더해 둔 보너스(AE열)를 빼서 기본 스탯으로 바꿔 넣습니다.

### 검증
- 원본 파일의 계산기 값(각 선수 보정스탯, 타자/투수 합, 총점 8001.614 등)과 소수점까지 일치.
- 관리기는 원본이 빈 양식이라, 무작위 테스트 데이터 22세트를 원본 수식으로 재계산(LibreOffice)한 결과와 셀 단위로 비교해 약 2만 개 값이 모두 일치.

### 원본 수식의 오류를 고친 부분
원본 그대로 옮기되, 명백한 오타 4가지는 의도대로 고쳤습니다.
1. 투수 DB `각잠점수`(T74~T93): 포틈 판정이 `$D$50`(타자 DB 첫 줄)을 보고 있어 → 각 투수 자신의 포틈 체크를 보도록 수정.
2. 투수 DB `특재스탯`(AH74~AH93): `AJK74`라는 없는 열을 참조해 항상 0이던 것 → `특재 변화×0.78 + 특재 구위`로 수정.
3. `스킬확률`(AB열): `INDIRECT("'[참조]'!…")` 참조 형식이 잘못되어 빈칸으로 나오던 것 → 의도대로 확률이 표시되게 수정. (투수는 원본처럼 선발 확률표를 사용)
4. 스킬 이름에 `~`가 들어간 경우(예: `선봉장(타순배치,주루130~141)`): 엑셀에서는 `~`가 와일드카드 기호로 처리돼 점수가 0이 되던 것 → 이름 그대로 찾도록 수정.

## 스킬점수표 등 기준표가 바뀌면

엑셀의 "스킬점수표" / "참조" 시트를 고친 뒤 아래를 실행하면 `data.js`가 새로 만들어집니다.

```bash
pip install openpyxl
python tools/extract_data.py "onesol POTM.xlsm" public/js/data.js
firebase deploy --only hosting
```

## 폴더 구조

```
firebase.json        Firebase 호스팅·규칙 설정
firestore.rules      권한 규칙 (서버에서 강제)
tools/extract_data.py  엑셀 → data.js 추출
public/
  index.html
  css/style.css
  js/config.js       ← Firebase 설정 · 관리자 이메일 (배포 전 수정)
  js/calc.js         계산 엔진 (엑셀 수식 + VBA 이식)
  js/data.js         기준표 (스킬점수표 · 참조)
  js/importer.js     엑셀 가져오기
  js/store.js        로그인/저장 (Firebase · 데모)
  js/views.js        화면
  js/app.js          화면 전환 · 저장 · 관리자 기능
```
