# 학습 기능 스키마 적용

기존 인증/캘린더 테이블(users/events)이 준비된 PostgreSQL에서 적용한다. 연결 대상은 backend/.env로 설정한다. 운영/공유 DB에 자동 적용하지 않는다.

- 신규 학습 스키마: 001_learning.sql → 002_learning_periods.sql → 003_learning_comments.sql
- 001과 002가 이미 적용되어 있다면 003만 적용한다.
- 통합 신규 학습 스키마: learning_schema.sql. 위 개별 마이그레이션과 중복 실행하지 않는다.

psql의 ON_ERROR_STOP을 활성화하거나 DB 도구에서 트랜잭션 단위로 실행한다. 이미 적용한 파일은 다시 실행하지 않는다.

기존 프로젝트의 연결 설정으로 댓글 스키마만 적용:

```powershell
cd backend
node database/migrations/applyLearningComments.js --apply
```

댓글은 학습 기록에 속한다. 사용자 복합 FK로 다른 사용자 기록에 연결할 수 없다. 로드맵/마일스톤/할 일 삭제 시 기록과 댓글은 유지하며, 학습 기록 삭제 시 댓글은 함께 삭제한다.

코드 위치는 블록 시작 줄(0부터), 원본 블록 전체, 블록 내부 줄 번호(1부터), 해당 줄 원문으로 저장한다. 원본 위치/블록이 달라지면 자동 재연결하지 않고 변경 표시와 함께 기존 인용을 보존한다. 코드 줄 댓글은 Markdown 조회 화면에서 사용한다. 댓글 내용은 일반 텍스트이며 HTML은 실행하지 않는다.
