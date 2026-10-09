# 학습 기능 스키마 적용

빈 DB 전체 설치는 `../schema.sql`을 사용합니다. 기본 테이블부터 009까지 포함한 실제 DB 전체 스키마이며, 아래 마이그레이션을 중복 적용하지 않습니다. 데이터까지 이전하려면 프로젝트 루트의 `DATABASE_SETUP.md`를 참고하세요. 기존 DB에서 단어 기능을 갱신할 때는 008_pdf_note_words.sql 다음 009_word_mastery.sql을 적용합니다.

## PDF 노트 서식 (007)

006까지 설치한 환경은 backend 폴더에서 `node database/migrations/applyPdfNoteFormat.js --apply`를 실행한다. 기존 PDF 문제별 노트 테이블에 body_format 칼럼 하나만 추가하며 기존 글은 plain으로 유지한다. 새 환경은 006 다음 007_pdf_note_format.sql을 적용한다. 새 DB나 테이블은 만들지 않는다.

## PDF 학습 노트 (006)

001~005가 준비된 로컬 DB에서 `node database/migrations/applyPdfNotes.js --apply`를 실행한다. PDF 노트와 문제별 풀이 테이블을 추가하며 기존 학습 데이터는 유지한다. 다른 컴퓨터에도 006_pdf_notes.sql 적용과 PDF 저장 폴더 복원이 필요하다. 통합 learning_schema.sql에는 006이 포함되지 않으므로 추가로 적용한다. 상세 사용·백업 안내는 프로젝트의 PDF_NOTES.md를 참고한다.

## 할 일 기간과 이동 (005)

004까지 적용된 DB는 005_learning_task_periods.sql만 추가 적용한다. 기존 할 일의 날짜는 NULL로 유지하며 편집 모달에서 입력할 수 있다. 신규 할 일은 이름·시작일·목표일을 필수로 입력한다. 기간은 학습 일정과 별개이며 일정을 자동 생성하지 않는다. 같은 학습 목표 안의 세부 목표로 이동할 수 있고 노트·댓글·일정·완료 상태는 유지한다. 노트의 복합 FK를 지연 가능하게 변경하여 서버 트랜잭션 안에서 할 일과 노트의 부모를 함께 갱신한다.

```powershell
cd backend
node database/migrations/applyLearningTasks.js --apply
```

통합 learning_schema.sql에는 001~005가 포함되어 있다. 신규 학습 DB에만 사용하고 개별 마이그레이션과 중복 실행하지 않는다.

기존 인증/캘린더 테이블(users/events)이 준비된 PostgreSQL에서 적용한다. 연결 대상은 backend/.env로 설정한다. 운영/공유 DB에 자동 적용하지 않는다.

- 신규 학습 스키마: 001_learning.sql → 002_learning_periods.sql → 003_learning_comments.sql → 004_learning_comment_ranges.sql
- 001과 002가 이미 적용되어 있다면 003 → 004를 적용한다. 003까지 적용했다면 004만 적용한다.
- 통합 신규 학습 스키마: learning_schema.sql. 위 개별 마이그레이션과 중복 실행하지 않는다.

psql의 ON_ERROR_STOP을 활성화하거나 DB 도구에서 트랜잭션 단위로 실행한다. 이미 적용한 파일은 다시 실행하지 않는다.

기존 프로젝트의 연결 설정으로 댓글 스키마만 적용:

```powershell
cd backend
node database/migrations/applyLearningComments.js --apply
node database/migrations/applyLearningComments.js --apply --ranges
```

댓글은 학습 기록에 속한다. 사용자 복합 FK로 다른 사용자 기록에 연결할 수 없다. 로드맵/마일스톤/할 일 삭제 시 기록과 댓글은 유지하며, 학습 기록 삭제 시 댓글은 함께 삭제한다.

코드 위치는 블록 시작 줄(0부터), 원본 블록 전체, 블록 내부 줄 번호(1부터), 해당 줄 원문으로 저장한다. 원본 위치/블록이 달라지면 자동 재연결하지 않고 변경 표시와 함께 기존 인용을 보존한다. 코드 줄 댓글은 Markdown 조회 화면에서 사용한다. 댓글 내용은 일반 텍스트이며 HTML은 실행하지 않는다.

004는 끝 줄(end_line)을 추가하고 기존 한 줄 댓글을 시작 줄과 같은 끝 줄로 채운다. line_text에는 선택한 연속 줄의 원문을 저장한다. 같은 코드 블록의 줄 번호 영역을 드래그해 선택하고 ＋ コメント로 패널을 연다. 패널을 닫아도 컴포넌트는 유지되어 입력 내용이 남지만, 페이지를 나가거나 새로고침하면 저장하지 않은 댓글은 없어질 수 있다.
