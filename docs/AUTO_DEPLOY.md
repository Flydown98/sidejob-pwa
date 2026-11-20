# 자동 업데이트 최초 연결

현재 사이트: https://flydown98.github.io/sidejob-pwa/

이 저장소의 `.github/workflows/deploy.yml`과 `scripts/deploy-apps-script.sh`는 준비된 파일이며, GitHub에 반영하고 아래 연결을 마쳐야 실행됩니다. Google 계정 인증이나 실제 배포까지 완료된 상태는 아닙니다.

## 1. Google Apps Script API 허용

웹 앱을 소유한 Google 계정으로 https://script.google.com/home/usersettings 에 접속하고 **Google Apps Script API**를 켭니다.

## 2. 내 PC에서 한 번 로그인

Node.js 22 이상이 설치된 개인 PC의 터미널에서 실행합니다. Windows는 PowerShell을 사용합니다.

```sh
npx --yes --package @google/clasp@3.4.1 clasp login
```

브라우저에서 기존 Apps Script를 수정할 수 있는 계정으로 로그인합니다. 만들어진 사용자 홈 폴더의 `.clasprc.json` 전체 내용을 다음 단계의 GitHub Secret에 넣습니다. 이 파일에는 재사용 가능한 Google 인증 정보가 들어 있으므로 채팅이나 저장소에 올리지 마세요. 로그인 제한이 발생하면 오류 문구만 공유하세요. Google 조직 정책에 따라 별도 OAuth 클라이언트 설정이 필요할 수 있습니다.

Windows에서 파일 열기:

```powershell
notepad "$env:USERPROFILE\.clasprc.json"
```

macOS에서 파일 열기:

```sh
open -e "$HOME/.clasprc.json"
```

## 3. GitHub Actions에 인증과 ID 등록

https://github.com/Flydown98/sidejob-pwa/settings/secrets/actions

- Secrets → New repository secret: 이름 `CLASPRC_JSON`, 값은 `.clasprc.json`의 전체 JSON.
- Variables → New repository variable: 이름 `APPS_SCRIPT_ID`, 값은 Apps Script 편집기 → 프로젝트 설정(톱니바퀴) → 스크립트 ID. `/macros/s/.../exec`의 배포 ID와 다릅니다.
- Variables → New repository variable: 이름 `APPS_SCRIPT_DEPLOYMENT_ID`, 값은 현재 `config.js`의 API URL에서 `/s/` 다음부터 `/exec` 앞까지의 문자열입니다. Apps Script → 배포 → 배포 관리에서도 확인할 수 있습니다. 새 배포를 만들지 말고 기존 웹 앱 배포를 사용합니다.

Google OAuth 정보가 유출되면 Google 계정의 연결된 앱 권한을 해제하고 다시 로그인하여 Secret을 교체합니다. 앱 로그인용 접속키는 이 배포 인증과 별개이며 여기에 넣지 않습니다.

## 4. GitHub Pages 연결

https://github.com/Flydown98/sidejob-pwa/settings/pages

Build and deployment → Source를 **GitHub Actions**로 선택합니다. 저장소 Settings → Actions → General에서 Actions 사용을 허용해야 합니다.

## 5. 코드 반영 및 첫 실행

준비한 사진 기능, 자동 배포 파일을 GitHub `main`에 반영합니다. 코드가 클라우드 작업 공간에만 있으면 Actions는 실행되지 않습니다. 이 대화에서 GitHub 반영까지 진행해 달라고 요청하거나, 변경사항을 PR로 올려 병합할 수 있습니다. 클라우드 연결의 권한 범위에 따라 Secret·Variable 목록 조회는 제한될 수 있습니다. 등록 여부와 실제 인증 성공은 첫 Actions 실행 결과로 확인합니다.

그다음 https://github.com/Flydown98/sidejob-pwa/actions 에서 **Deploy app → Run workflow → main → Run workflow**로 실행할 수 있습니다. 이후 지정된 앱 파일을 수정해 main에 반영하면 자동 실행됩니다. main 이외의 브랜치에서는 운영 배포하지 않습니다.

배포는 기존 프로젝트를 임시 디렉터리로 가져와 원래 manifest와 다른 스크립트 파일을 유지하고 Code 파일만 교체합니다. 기존 배포 ID로 새 버전을 지정하므로 URL이 유지됩니다. 서버 배포가 성공해야 프론트엔드를 게시합니다. 두 서비스가 한 번에 원자적으로 바뀌는 구조는 아닙니다. 운영 Apps Script 편집기에서 동시에 코드를 수정하지 마세요.

## 앞으로 함께 작업하는 방식

요청 → 제가 코드 수정·테스트 → GitHub main에 반영 → Actions가 배포 → 사이트 확인 순서입니다. 이 클라우드에서 GitHub 쓰기가 허용되어야 제가 직접 push/PR까지 처리할 수 있습니다. 쓰기가 차단된 동안에는 변경사항 반영만 사용자가 해야 합니다. Google 인증이 만료되면 PC에서 다시 로그인하고 Secret을 갱신합니다.

## 실패 확인

- `Set GitHub Actions ...`: 해당 Secret 또는 Variable을 등록합니다.
- API disabled/access denied: Apps Script API 설정, 계정의 프로젝트 편집 권한을 확인합니다.
- invalid_grant: 다시 로그인하고 CLASPRC_JSON을 교체합니다.
- Deployment ID must match: `config.js`의 현재 배포 ID와 Variable을 일치시킵니다.
- Expected exactly one existing Code: 원격 프로젝트의 Code 파일 이름을 확인합니다.
- Pages 오류: Source가 GitHub Actions인지, Actions/환경 배포 권한이 허용되는지 확인합니다.

API GET 상태 확인만 자동으로 수행합니다. 실제 접속키를 사용하는 데이터 동기화/사진 저장은 배포 후 앱에서 확인해야 합니다. 자동 배포는 `setupSystem()`을 실행하거나 Google DB/백업 폴더를 새로 만들지 않습니다. Apps Script는 배포 관리에서 이전 버전으로 되돌릴 수 있으며, 프론트엔드는 GitHub에서 이전 정상 코드로 되돌린 뒤 재배포합니다.
