# 부업 작업 정산 PWA

GitHub Pages + Google Apps Script + Google Sheets + Google Drive 자동백업으로 구성한 개인용 작업 정산 앱입니다.

## 계산 규칙
품목별로 **주인장 기준단가(A)** 하나만 저장합니다.

- 주인장 기준단가 = A
- 직원 단가 = A - 50원
- 직원 작업의 위쪽 보고단가 = A × 1.10 (원 단위 반올림)
- **주인장 A 본인 작업은 수수료 없음: 보고단가도 A 그대로**

예: A=200원 → 직원=150원 → 보고=220원

일일 집계에서는:
- ① 주인장 기준 총액 = A × (주인장 + 모든 직원의 전체 수량)
- ② 직원 지급 총액 = (A - 50) × 직원 수량만
- ③ 보고 총액 = `(A × A의 수량) + (A × 1.10 × 직원 수량)`

즉 A가 직접 한 작업에는 10%가 붙지 않고, **직원이 한 작업에만 10%가 붙습니다.**

작업 등록 당시 단가를 **스냅샷으로 저장**하므로 나중에 품목 단가를 바꿔도 과거 정산내역은 바뀌지 않습니다.

## 1. Google Apps Script 설치
1. script.google.com 에서 새 프로젝트를 만듭니다.
2. `apps-script/Code.gs` 내용을 복사하여 붙여넣습니다.
3. 프로젝트 설정에서 시간대를 `Asia/Seoul`로 설정합니다.
4. 함수 목록에서 `setupSystem`을 **최초 1회 실행**하고 Google 권한을 승인합니다.
5. 실행 로그에 출력되는 `WEB_APP_ACCESS_KEY`를 따로 보관합니다.
6. 배포 → 새 배포 → 유형: **웹 앱**
   - 실행 사용자: 나
   - 액세스 권한: 링크를 아는 사용자/Anyone (계정 UI에 표시되는 선택지에 맞춰 선택)
7. 배포된 `/exec` URL을 복사합니다.

`setupSystem()`은 자동으로 다음을 생성합니다.
- `부업_작업정산_DB` Google Spreadsheet
- `부업_작업정산_자동백업` Google Drive 폴더
- 주인장 A 작업자
- 샘플 품목 `블루메모리 / 200원`
- 매일 오전 3시 자동 JSON 백업 트리거

## 2. GitHub Pages 설치
1. GitHub에 새 저장소를 만듭니다. 예: `sidejob-settlement`
2. `frontend` 폴더 안의 파일들을 저장소 루트에 올립니다.
3. `config.js`의 `API_URL`에 Apps Script `/exec` URL을 입력합니다.
4. 저장소 Settings → Pages → Deploy from branch → `main / root`를 선택합니다.
5. 표시되는 GitHub Pages 주소로 접속합니다.
6. 처음 접속하면 `WEB_APP_ACCESS_KEY`를 입력합니다.

## 주요 기능
- 품목 DB 추가 / 수정 / 삭제(soft delete)
- 품목명 실시간 검색
- 작업자 무제한 추가 / 삭제
- 주인장 A 고정
- 날짜 + 작업자 + 품목 + 수량 빠른 입력
- 같은 품목 연속 +/− 수량 입력
- 날짜별 전체 정산
- 작업자별 / 품목별 집계
- 작업 당시 단가 스냅샷 보존
- Google Drive 매일 자동 백업
- 수동 즉시 백업
- PWA 설치 및 기본 오프라인 화면 캐시

## 데이터 시트 구조
### Products
`id | name | ownerPrice | active | createdAt | updatedAt`

### Workers
`id | name | role(owner/worker) | active | createdAt | updatedAt`

### Entries
`id | date | workerId | productId | qty | ownerPriceSnapshot | workerPriceSnapshot | reportPriceSnapshot | createdAt`

## 보안 메모
GitHub Pages는 정적 공개 프론트엔드이므로 접속키를 `config.js`에 넣지 않습니다. 사용자가 처음 접속할 때 브라우저에 입력하고 localStorage에 저장하며, Apps Script가 모든 요청에서 서버 측 Script Properties의 키와 비교합니다.

더 강한 인증이 필요하면 추후 Google OAuth/Cloudflare Access/Firebase Auth 방식으로 확장할 수 있습니다.

## v3 추가 기능
- **A(주인장) 작업의 +10% 수수료 제거**
- 월별 전용 탭 추가
- 월 전체 / 특정 작업자 필터 조회
- 월간 달력: 날짜별 수량, 기준금액, 직원지급, 보고금액 표시
- 달력 날짜 클릭 시 해당 날짜 일별 상세로 이동
- 월 안에서 작업자별 총합 카드 제공, 작업자 카드를 누르면 해당 사람만 필터
- 일별 조회에도 작업자 필터 추가
- 기존 DB 업데이트 시 누락된 시트를 자동 생성하는 setupSystem 보강

## v2 추가 기능
- 날짜별 조회 화면에 **월간 총합** 추가: 총 작업수량 / 주인장 기준 총액 / 직원 지급 총액 / 보고 총액
- 날짜를 바꾸면 해당 날짜가 속한 월로 월 조회 기준도 자동 변경
- 월별 일자 합계 표 제공
- PWA 설치 버튼 추가: Chrome/Edge 등에서는 설치 가능 시 상단에 `앱 설치` 버튼 표시
- iPhone/iPad에서는 `공유 → 홈 화면에 추가` 안내
- 192px / 512px PNG 앱 아이콘 추가 및 서비스워커 캐시 v2 적용


## v5 변경사항
- 일별 상세 작업내역 삭제 기능
- 월별 상세 작업내역 삭제 기능
- 작업 삭제는 soft delete 방식으로 처리되어 DB 행을 물리적으로 지우지 않음
- 삭제 즉시 일/월/사람별 합계 자동 재계산
- 기존 Entries 시트에 active, deletedAt 열 자동 추가 (setupSystem 1회 실행)
