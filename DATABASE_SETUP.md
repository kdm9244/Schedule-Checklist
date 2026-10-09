# 집 PC에서 DB 설치·복원

`backend/database/schema.sql`은 2026-10-09 실제 로컬 PostgreSQL DB에서 추출한 전체 public 스키마입니다. 데이터 없이 16개 테이블, 시퀀스, 제약조건, 인덱스, 함수, 트리거를 포함합니다. 기본 인증·일정·체크리스트·메모, 학습, PDF, 단어장 및 009 암기 상태까지 포함합니다. PostgreSQL 18에서 생성·복원을 검증합니다.

아래 두 방법 중 하나만 선택하세요. 기존 DB에는 전체 스키마를 실행하지 마세요. 전체 스키마나 전체 백업을 설치한 뒤 001~009를 다시 실행하지 않습니다. 이후 새 변경은 해당 신규 마이그레이션만 적용합니다.

## 1. 기존 내용 없이 새로 시작

PostgreSQL 18을 설치하고 `backend/.env`를 README에 따라 설정합니다. 프로젝트 루트에서 실행합니다. PostgreSQL 도구가 PATH에 없으면 설치 폴더의 `bin`을 PATH에 추가합니다. 예: `$env:Path = 'C:\Program Files\PostgreSQL\18\bin;' + $env:Path`.

```powershell
createdb -h localhost -U postgres schedule_checklist
psql -X -h localhost -U postgres -d schedule_checklist --set=ON_ERROR_STOP=1 --single-transaction --file=backend/database/schema.sql
```

위 DB 이름은 예시입니다. `backend/.env`의 DB_NAME과 일치시킵니다. 사용자 이름도 환경에 맞게 바꿉니다. 스키마만 설치하면 기존 노트·단어·체크리스트·사용자는 복원되지 않습니다.

## 2. 현재 내용까지 가져가기 (권장)

백업 중에는 앱 서버를 종료하고 DB 변경 및 PDF 업로드·삭제를 멈춥니다. 프로젝트 루트에서:

```powershell
cd backend
$env:PG_DUMP_PATH = 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe'
node database/backup.cjs
```

생성된 `backups/<시간>/` 폴더 전체를 USB 등으로 가져갑니다. `database.dump`는 스키마와 실제 데이터 및 시퀀스 값을 포함하고, `pdf/`는 PDF 원본을 포함합니다. 이 폴더는 Git에서 제외됩니다. 개인정보가 있으므로 공개 저장소에 올리지 않습니다. 백업 이후 편집한 내용은 백업에 포함되지 않습니다.

집에서는 **새 빈 DB**를 만든 뒤 프로젝트 루트에서:

```powershell
createdb -h localhost -U postgres schedule_checklist
pg_restore -h localhost -U postgres -d schedule_checklist --no-owner --no-privileges --exit-on-error --single-transaction '가져온폴더/database.dump'
New-Item -ItemType Directory -Force backend/storage/pdf
Copy-Item -Path '가져온폴더/pdf/*' -Destination backend/storage/pdf -Recurse
```

전체 백업 복원 시 `schema.sql`을 먼저 실행하지 않습니다. PDF가 없는 백업이라면 PDF 복사 단계를 생략합니다. PDF_STORAGE_DIR을 별도로 설정했다면 그 폴더로 복원합니다. DB 안의 파일 키와 파일명을 연결하므로 PDF 파일명을 바꾸지 마세요.

`.env`의 OAuth 및 DB 연결 설정은 백업에 포함되지 않습니다. 별도로 안전하게 옮기고 집 PC의 DB 이름·계정·비밀번호 및 URL에 맞게 조정합니다. Google Calendar 일정은 Google 계정에서 불러오며 이 백업이 Google 계정 전체를 백업하지는 않습니다. 브라우저의 미저장 초안도 옮겨지지 않으므로 이동 전에 저장 버튼을 누릅니다.

각각 `backend`와 `front`에서 `npm ci`를 실행하고 README의 개발 서버 명령으로 시작합니다. 같은 Google 계정으로 로그인해서 학습 노트·단어·체크리스트가 보이는지, PDF가 열리는지 확인하세요.
