# 로드맵·마일스톤·학습 기록

## 상세 페이지·기간·입력 형식 수정 (2026-10-06)

### 할 일 상세에서 학습 필기

학습 필기 작성 UI를 정리했다. 제목·공부 날짜는 상단에 두고 연결 정보는 접을 수 있는 요약으로 표시한다. 본문 상단의 일반 입력/Markdown 탭, 템플릿 버튼, 두 열 편집기를 한 영역에 모았다. 본문·코드 글자 크기와 대비를 높이고 저장 버튼은 하단에 고정한다. 기능과 저장 데이터는 변경하지 않는다.

마일스톤의 할 일 제목을 클릭하면 `/learning/tasks/:id`로 이동한다. 완료 체크·제목 수정·학습 일정 편집은 기존 공통 컴포넌트를 사용하고, 해당 할 일에 연결된 학습 필기 목록을 보여준다. `学習ノートを書く`는 로드맵·마일스톤·할 일을 기본 연결한다. 연결은 작성 화면에서 변경 가능하며 일반 입력/Markdown 및 임시 저장을 유지한다. 기록 조회와 작성 취소는 연결된 할 일로 돌아간다. 마일스톤의 목록은 소속 기록 전체를 계속 보여준다. 기록 저장은 완료 체크를 변경하지 않는다. 기존 API와 관계를 사용하므로 추가 SQL이나 DB 적용은 없다.

- 로드맵 카드 본문 클릭 → 로드맵 상세. 수정·삭제 버튼은 별도로 동작한다.
- 로드맵 상세의 마일스톤 제목 또는 상세보기 → `/learning/milestones/:id`. 펼치기 버튼은 아코디언만 제어한다.
- 마일스톤 상세에서 할 일·학습 일정·학습 기록을 함께 관리한다. 기록의 돌아가기와 캘린더 마감일 링크도 마일스톤 상세로 연결된다.
- 로드맵과 마일스톤의 시작일·마감일은 신규 저장 시 필수다. 마일스톤은 부모 기간 안에 있어야 하며 부모 기간 축소가 자식 기간을 벗어나면 거절한다. 화면·API·DB 트리거로 검사한다. 기존 날짜 미설정 데이터는 그대로 남기고 다음 편집 저장 시 기간을 입력한다.
- 로드맵 기간은 앱 캘린더에 시작일~마감일을 포함하는 막대로 표시한다. Google 캘린더 전송은 추가하지 않았다.
- 학습 기록은 `通常入力 / Markdown`을 선택한다. 일반 입력은 서식 없는 텍스트이며 조회에서도 그대로 출력한다. Markdown은 기존 편집기·미리보기를 사용한다. 원문 문자열은 `body_markdown`에 한 번 저장하고 `input_mode`만 추가한다. 전환은 문법 변환 없이 원문을 유지한다. 초안에도 모드를 저장한다.

추가 SQL: `backend/database/migrations/002_learning_periods.sql`. 로컬 `webProject`에 적용 완료했으므로 다시 실행하지 않는다. 새 개발 DB는 001 → 002 순서로 적용한다. 기존 001이 적용된 로컬 DB에서 002 적용 명령은 다음과 같다.

```powershell
cd backend
node database/migrations/applyLearningPeriods.js --apply
```

이 명령은 확인된 로컬 DB만 허용하며 기존 데이터나 샘플 데이터를 쓰지 않는다. 다른 환경은 SQL을 별도로 검토해 적용한다.

## 현재 상태

004_learning_comment_ranges.sql도 로컬에 적용 완료했다. 집에서 003까지 적용되어 있으면 004만 적용한다. 통합 learning_schema.sql에는 001~004가 모두 포함되어 있다. 줄 번호 영역 드래그로 같은 코드 블록의 연속 범위를 지정하고 ＋ コメント를 눌러 패널을 연다. 처음에는 패널이 닫혀 있으며 댓글 표시나 댓글 보기 버튼으로 열 수 있다. 닫기는 DB 저장을 하지 않으며 화면 내 입력은 유지한다.

코드 줄 댓글: 저장된 Markdown 학습 기록 상세에서 줄 번호/＋를 누르면 오른쪽 패널에서 설명을 작성한다. 같은 줄에 여러 댓글을 작성·수정·삭제할 수 있다. 코드 수정으로 원본 블록이나 위치가 바뀌면 변경 표시와 함께 인용과 댓글을 보존한다. 일반 입력 기록에서도 기존 댓글은 보존·표시되지만 새 코드 줄 선택은 Markdown에서만 가능하다. 댓글은 일반 텍스트로 저장한다.

003_learning_comments.sql은 현재 로컬 DB에 적용 완료했다. 집에서 001/002가 적용되어 있으면 003만 적용한다. 학습 테이블이 전혀 없다면 learning_schema.sql을 적용한다. 둘을 중복 실행하지 않는다. 자세한 내용은 backend/database/migrations/README.md를 참고한다. 신규 스키마는 기존 users/events 테이블을 전제로 하며 기본 앱 테이블 전체를 생성하는 SQL은 아니다.

2026-10-06 사용자 요청으로 기존 backend/.env가 연결하는 로컬 PostgreSQL의 webProject.public에 001_learning.sql을 적용했다. 신규 테이블 5개는 모두 0건이며 기존 users/events/checklists/메모/설정 테이블의 데이터 건수는 유지됐다. 샘플 SQL, 샘플 모드, 샘플 생성 코드는 제거했다. 모든 저장은 기존 로그인 세션과 실제 PostgreSQL API를 사용한다.

브라우저를 새로고침하면 이전 샘플 키 learning-demo-v1과 learning-draft-v1:demo: 접두사의 샘플 초안만 제거한다. 실제 사용자의 학습 기록 초안과 다른 데이터는 유지한다. 이전 demo=1 URL도 실제 모드로 전환한다.

## 실행과 화면 확인

백엔드와 프런트엔드를 각각 실행한다.

```powershell
cd backend
npm run dev
```

```powershell
cd front
npm run dev
```

기존 Google OAuth로 로그인하고 http://localhost:5173/learning/roadmaps 에서 시작한다. 처음에는 데이터가 없으므로 빈 화면이 정상이다.

사이드바의 ロードマップ은 아코디언이다. 클릭하면 목록·저장된 로드맵·생성 메뉴가 아래로 펼쳐지며 다시 클릭하면 접힌다. 학습 화면으로 직접 들어가면 자동으로 펼쳐진다.

로드맵 생성 → 상세에서 마일스톤 생성 → 할 일 추가 → 날짜와 ＋ 予定 → 캘린더 이동 → 記録を書く → 저장 후 마일스톤에서 확인한다. 캘린더의 완료 체크와 로드맵의 완료 체크는 같은 할 일을 변경한다. 예정일은 드래그 또는 날짜 입력으로 바꾼다.

## 스키마와 적용

| 테이블 | 데이터 |
|---|---|
| learning_roadmaps | 제목, 설명, 목표 완료일, 사용자 |
| learning_milestones | 필수 로드맵, 제목, 완료 기준, 마감일, 순서 |
| learning_tasks | 필수 마일스톤, 제목, 완료 상태, 순서 |
| learning_records | 공부 날짜, 제목, Markdown 본문, 선택적 마일스톤과 할 일 |
| learning_schedules | 할 일마다 여러 학습 예정일, 선택적 기존 events 관계 |

001_learning.sql은 기존 테이블을 수정하지 않고 테이블·외래키·인덱스·트리거를 추가한다. 서버 시작 시 자동 적용하지 않는다. 현재 webProject에는 이미 적용했으므로 재실행하지 않는다. 다른 DB에 최초 적용할 때만 아래 스크립트를 사용한다. 스크립트는 backend/.env를 읽고 트랜잭션으로 적용하며 샘플 데이터는 생성하지 않는다.

```powershell
cd backend
node database/migrations/applyLearning.js --apply
```

SQL 미적용 환경에서는 HTTP 503과 LEARNING_SCHEMA_NOT_READY를 반환한다. 로그인 오류와 초기 설정 미완료는 화면에서 구분한다.

## 날짜·진행률·삭제

DATE는 SQL에서 YYYY-MM-DD 문자열로 반환한다. 마감일 due_date, 예정일 scheduled_date, 공부 날짜 study_date는 서로 다르다. 날짜만 있는 값을 UTC로 변환해 저장하지 않는다.

진행률은 완료된 할 일 / 전체 할 일이다. 할 일이 없으면 0%이고 미완료다. 마일스톤은 할 일이 하나 이상이며 모두 완료됐을 때만 완료다. 기록 작성으로 진행률이 오르지 않는다. 다음 할 일은 마일스톤과 할 일 순서에서 첫 번째 미완료 작업이다.

로드맵 또는 마일스톤 삭제 시 소속 할 일과 학습 일정은 삭제하고, 학습 기록은 연결을 해제해 보존한다. 할 일만 삭제하면 기록의 마일스톤은 유지하고 할 일 연결만 해제한다. 일정 삭제는 기록과 할 일을 보존한다. 삭제 전 UI가 영향 범위와 개수를 안내한다. DB 트리거는 직접 SQL 삭제에서도 기록을 보존한다. 사용자 소유권은 세션 userId, 사용자별 복합 외래키와 API 검사로 보호한다.

## API와 편집기

GET /api/learning은 로그인한 사용자 데이터를 조회한다. POST /api/learning/{roadmaps|milestones|tasks|records|schedules}는 생성, PATCH /api/learning/{kind}/{id}는 수정, DELETE는 삭제다. POST /api/learning/milestones/reorder는 roadmap_id와 전체 ids 배열을 받는다. 사용자 ID는 요청 본문이 아닌 기존 세션에서 결정한다.

Vue 3, Vue Router, Axios, FullCalendar와 기존 디자인을 재사용한다. 별도 상태 라이브러리 대신 useLearning composable을 사용한다. Markdown은 md-editor-v3, 일본어 locale, DOMPurify, 로컬 highlight.js로 작성·조회한다. HTML 해석을 끄고 출력 HTML도 정화한다. 원본 코드 복사는 탭, 빈 줄, 마지막 줄바꿈을 보존한다. Markdown 파서의 CRLF 정규화 및 문법상 들여쓰기 제거는 적용된다.

초안은 사용자와 작성 위치별로 localStorage에 저장하며 저장 성공 후 정리한다. 초안은 기기 간 동기화되지 않는다. 일본어 학습 템플릿과 실행 결과 항목은 선택 사항이다. 코드 실행 기능은 없다.

## 검증과 제한

```powershell
cd backend
npm test
$env:RUN_LEARNING_SQL_TEST='1'
node --test tests/learning.test.js
```

```powershell
cd front
node --test src/utils/calendar.test.js src/utils/eventDetail.test.js src/utils/learning.test.js
npm run build
```

신규 SQL/API의 쓰기 검증은 임시 테이블에서 수행하고 롤백한다. 영구 DB에는 시험 기록이나 샘플 데이터를 추가하지 않는다. 스키마 적용 후 실제 DB의 테이블·관계·트리거와 빈 목록 조회를 확인했다. 과거 샘플 화면 검증 예시는 outputs/learning에 보관돼 있으며 현재 앱 데이터가 아니다.

학습 일정은 앱 내부 PostgreSQL을 원본으로 캘린더와 로드맵에서 공유한다. Google Calendar 자체로 내보내거나 양방향 동기화하지 않는다. 선택적 event_id는 API/스키마 수준의 관계이며 기존 Google 일정 선택 UI는 없다. 개인용 데이터 규모를 대상으로 하며 대량 기록 페이지네이션과 별도 탭 실시간 동기화는 없다. 모바일, 코드 실행, 복습 예약, 주간 회고, 알림, 공유 기능은 제외했다.
