# Schedule Checklist

개인 일정과 일정별 준비 체크리스트를 한 곳에서 관리하는 웹 애플리케이션입니다.  
Google Calendar의 일정을 불러오고, 일정에 필요한 준비 작업·메모·일반 체크리스트를 함께 관리할 수 있습니다.

## 주요 기능

- Google Calendar OAuth 로그인 및 일정 조회
- 월간 캘린더와 날짜별 일정 목록
- 인접 월 날짜 클릭 및 마우스 휠을 통한 월 이동
- 일정 생성·수정·삭제
- 종일 일정, 여러 날 일정, 반복 일정 인스턴스 처리
- 일정별 준비 체크리스트 추가·완료·삭제·순서 변경
- 일정별 체크리스트 진행률 표시
- 날짜별 일반 체크리스트와 메모
- 매일·평일·주말·사용자 지정 요일 체크리스트 템플릿
- 설명 HTML의 안전한 텍스트·링크 변환
- 미저장 변경 보호 및 충돌 방지
- 반응형 UI

## 기술 스택

### Frontend

- Vue 3
- Vite
- Vue Router
- FullCalendar
- Axios

### Backend

- Node.js
- Express
- PostgreSQL
- Google APIs
- Express Session

## 프로젝트 구조

```text
.
├─ backend/       # Express API, Google Calendar 연동, PostgreSQL 접근
├─ front/         # Vue 3 클라이언트
├─ .gitignore
└─ EVENT_MANAGEMENT_TESTING.md
```

## 실행 환경

- Node.js `22.18.0` 이상 또는 `24.12.0` 이상
- PostgreSQL
- Google Cloud 프로젝트
  - Google Calendar API 활성화
  - OAuth 2.0 클라이언트 생성
  - OAuth redirect URI 등록

## 설치

각 디렉터리에서 의존성을 설치합니다.

```powershell
cd backend
npm install

cd ..\front
npm install
```

## 환경변수

`backend/.env` 파일을 만들고 다음 값을 설정합니다.

```env
PORT=3000
FRONTEND_URL=http://localhost:5173
SESSION_SECRET=change-this-to-a-long-random-value

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-password
DB_NAME=your-database

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

프런트엔드는 기본적으로 `http://localhost:3000`의 백엔드 API를 사용합니다. 다른 주소를 사용할 경우 `front/.env.local`에 설정합니다.

```env
VITE_API_ORIGIN=http://localhost:3000
```

`.env` 파일에는 비밀번호와 OAuth 보안 정보가 포함될 수 있으므로 Git에 커밋하지 마세요.

## 개발 서버 실행

백엔드와 프런트엔드를 각각 별도 터미널에서 실행합니다.

### Backend

```powershell
cd backend
npm run dev
```

### Frontend

```powershell
cd front
npm run dev
```

브라우저에서 [http://localhost:5173](http://localhost:5173)을 엽니다.

## 테스트 및 빌드

### Backend 테스트

```powershell
cd backend
npm test
```

PostgreSQL 통합 테스트를 실행하려면 테스트용 데이터베이스 환경을 준비한 뒤 다음을 실행합니다.

```powershell
$env:RUN_DB_TEST='1'
npm test
```

### Frontend 테스트 및 빌드

```powershell
cd front
node --test src/utils/*.test.js
npm run build
```

격리된 UI 테스트 방법과 상세 검증 범위는 [EVENT_MANAGEMENT_TESTING.md](./EVENT_MANAGEMENT_TESTING.md)를 참고하세요.

## 보안 및 운영 참고

- OAuth client secret, session secret, DB 비밀번호는 환경변수로만 관리합니다.
- Google Calendar와 PostgreSQL 변경은 하나의 원자적 트랜잭션이 아니므로 부분 실패 시 재시도가 필요할 수 있습니다.
- 실제 Google 계정으로 일정 생성·수정·삭제를 검증할 때는 테스트용 캘린더와 일정을 사용하는 것을 권장합니다.
- 현재 앱은 개인용 사용을 목표로 하며, 공유 캘린더·참석자 관리·알림 등 Google Calendar의 모든 기능을 대체하지는 않습니다.

## 라이선스

현재 별도의 라이선스 파일은 포함되어 있지 않습니다.
