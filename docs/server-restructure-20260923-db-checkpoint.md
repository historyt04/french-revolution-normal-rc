# Supabase 연결 후 서버 개편 체크포인트

## 상태
- **후속 상태:** 역할 전환 승인·적용 및 SQL 무결성 검증 결과는 `server-restructure-20260923-role-validation.md` 참조. 아래 내용은 b61648a 당시의 이력이다.
- 2026-09-23. 기준 커밋은 8e1e26d973000a30e2d09212667c800347f273a7.
- 작업 브랜치: rc/server-restructure-20260923.
- 서버 구현 초안 및 격리 DB 적용 완료. **성공한 서버 개편 체크포인트가 아니며, 실제 로그인 시험 전 권한 오류로 중단한 작업 체크포인트**이다.
- 사용자가 인증·권한·외부 설정 변경이 필요하면 멈추라고 요청했으므로, 신규 역할의 SET 권한 변경은 적용하지 않았다.
- 기존 main·학생 배포·history-rc-api·history_rc 데이터는 이번 작업에서 수정하지 않았다.

## 실제 확인한 구조
- Supabase 프로젝트 history-learning-test, mrrvuknoxkpowlqcwahk, 서울 리전, ACTIVE_HEALTHY, PostgreSQL 17.
- 실제 history-rc-api version 11의 서버 소스 5개는 GitHub 기준 소스와 공백 정규화 비교에서 일치했다.
- 실제 public.rc_snapshot은 history_rc.namespaces의 공통 행을 FOR SHARE로 잠근 후 table_catalog의 모든 테이블을 JSON으로 모은다.
- 실제 public.rc_commit은 동일 행을 FOR UPDATE로 잠그고 공통 revision을 증가시킨다.
- 확인 시 전체 snapshot 텍스트 크기: 7,697,911 bytes. 학생 39명, 세션 38개, 시도 69개, 완료기록 6개, 카드 행 90개, 요청 영수증 378개.
- table_catalog에는 기준 도메인에서 사용하지 않는 studentGameUnlocks(0행), teacherGiftOpenings(1행)도 존재한다. 기존 테이블은 보존했고 신규 도메인에서 임의로 해석하지 않았다. 이후 교사 지급 이력 보존 범위를 검토한다.
- 실사용 중인 기존 namespace revision은 읽기 시점에 531에서 532로 바뀌었다. 기존 환경에서 다른 요청이 계속 발생할 수 있으며 이 작업은 기존 namespace를 쓰지 않았다.

## 적용한 새 DB 구조
- migration: isolated_normal_rc_student_transactions.
- SQL 파일: supabase/migrations/20260923022805_isolated_normal_rc_student_transactions.sql (후속 작업에서 실제 원격 migration 시각으로 파일명 정렬).
- 별도 스키마 history_v5를 만들고 기존 논리 테이블별 물리 테이블을 분리 유지했다. 학생 소유자 컬럼과 인덱스를 추가했다.
- 학생·교사 명부 및 교사/게임/미션/보상 등 설정 320행을 새 환경에 복사했다. 학생 39명, 새 완료기록 0개.
- 동일 복사본을 private settings_checkpoint에도 보관했다. 앱 작업용 역할에는 이 체크포인트 접근 권한을 주지 않았다.
- 이전 학생 게임·카드·팩·경험치 기록은 새 RC에 옮기지 않았다. 기존 DB 기록 자체를 삭제하지 않았다.
- 새 스키마 테이블에서 RLS 비활성 테이블 0개. public/anon/authenticated/service_role 직접 접근을 차단했다.
- history_v5_worker는 NOLOGIN이며 새 스키마에만 앱 읽기·입력·갱신 권한을 부여했다.
- 세션 토큰, 완료 시도, 요청 영수증, 팩 개봉, 출석, 미션 수령의 유일 인덱스 및 재고 음수 방지 제약을 추가했다.
- load_scope는 학생별 인덱스 범위와 공통 설정을 읽는다. write_rows는 변경 테이블별 INSERT SELECT로 묶어서 쓴다.

## 서버 변경 파일과 의도
| 파일 | 변경 내용 |
|---|---|
| supabase/functions/_shared/transaction-service.mjs | 실제 DB 트랜잭션 안에서 기존 도메인 판정 및 난수 추첨 실행, 학생별 잠금, 학생 소유 변경 검증, 로그인 재시도 영수증 암호화 |
| supabase/functions/history-normal-rc-api/index.ts | 새 함수 전용 진입점, DB 연결·트랜잭션, 제한된 작업 역할 전환, 응답 Server-Timing |
| supabase/functions/_shared/rc-service.mjs | 기존 실행기에 선택적 경량 로그인/분리 rate 설정 추가. 기존 함수 기본 동작은 유지 |
| supabase/functions/_shared/gas-v6-domain.mjs | 새 서버에서만 로그인 후 출석·전체 상태 계산을 미룰 수 있도록 옵션 추가 |
| supabase/migrations/20260923022805_isolated_normal_rc_student_transactions.sql (후속 작업에서 실제 원격 migration 시각으로 파일명 정렬) | 별도 스키마, 설정 체크포인트, 인덱스·제약·RLS·로드/저장 함수 |
| docs/pending/enable-normal-rc-worker.sql | 적용 전인 구체적 SET 역할 권한 변경과 되돌리기 SQL |

학생별 트랜잭션은 서로 호환되는 공통 설정 읽기 잠금과 학생별 쓰기 잠금을 사용한다. 교사 동작은 현재 초안에서 공통 배타 잠금으로 일관성을 보장하며, 교사 조회·지급이 학생 요청에 주는 지연은 향후 실제 시험 및 범위 세분화 대상이다.

## 실제 시험 결과
| 항목 | 결과 | 측정 / 한계 |
|---|---|---|
| 새 스키마 migration | 성공 | 도구 success 응답 및 후속 조회로 확인 |
| 명부·설정 체크포인트 | 성공 | 320행 / 학생 39명 |
| 기존 도메인 회귀 시험 | 성공 | tests/v43-speed-server.test.mjs 통과. 메모리 시험이므로 실제 성능 근거 아님 |
| 변경 JavaScript 문법 검사 | 성공 | node --check |
| 새 Edge Function 배포 | 성공 | history-normal-rc-api version 2, ACTIVE. 웹 학생 RC 배포와 다름 |
| 새 public.bootstrap | 성공 | HTTP 200, 작업 환경 왕복 8.941초, Server-Timing app 2.7ms. DB를 읽지 않는 경로임 |
| DB 진입 진단 요청 | 실패 | HTTP 400, SQLSTATE 42501, 왕복 11.139초, app 2299.6ms. 유효 학생 로그인 시험 아님 |
| SQL 역할 전환 재현 | 실패 | permission denied to set role history_v5_worker |
| 실제 학생 5/15/30명 흐름 | 미실행 | 위 권한 오류 및 프런트 연결 미완료 |
| 25명 로그인 성능 | 미실행 | 합격 판정 불가 |
| 새 학생 RC 주소 | 미배포 | 학생용 config는 기존 주소 그대로 |
| UI 별도 변경 | 미착수 | 서버 검증 성공 후에만 진행 |

## 필요한 권한 변경 — 미적용
읽기 조회에서 postgres → history_v5_worker membership을 확인했다:
- admin_option = true
- inherit_option = false
- set_option = false

새 함수의 SET LOCAL ROLE이 위 set_option 때문에 거부된다. 다음 한 줄로 명시적 역할 전환만 허용하는 변경을 준비했다:

```sql
GRANT history_v5_worker TO postgres WITH SET TRUE;
```

학생·교사 사용자에게 권한을 주는 변경이 아니다. DB 실행 계정 postgres가 기존보다 제한된 신규 RC 작업 역할로 전환할 수 있도록 한다. 이 권한은 DB에 유지되며 SET FALSE로 되돌릴 수 있다. 기존 membership의 ADMIN/INHERIT 옵션은 변경하지 않는다.

## 남은 구현·위험
- 현재 코드는 구현 초안이다. 새 login은 최소 세션만 반환하므로 프런트 연결 전에는 기존 학생 화면을 새 API로 전환하면 안 된다.
- 출석·초기 화면 상태 분리, 카드/도감/미션 지연 로딩, IndexedDB 완료 outbox, 모든 게임 모드의 로컬 진행·서버 재검증 연결은 미완료.
- 학생 순위 조회의 여러 학생 데이터 조회 범위를 아직 새 load_scope에 연결하지 않았다. 현재 초안의 개인 파티션만으로 순위를 계산하면 전체 순위가 아니다.
- 교사 기능의 범위별 로딩·권한·백업/복구·일괄 등록을 실제 DB에서 검증해야 한다.
- 새 worker 역할에 기존 history_rc 접근이 없는지 및 익명 RPC 직접 접근 차단을 실제 부정 요청으로 검증해야 한다.
- 실제 테스트 계정·명부 준비와 사용자 화면 경로 동시시험이 남았다. 허위 성능 수치는 만들지 않았다.
- rollback/응답 유실/중복 요청/다른 학생 권한/팩 잔액/광휘 및 도감 보상 세부 규칙을 새 트랜잭션 경로에서 확인해야 한다.

## 되돌리기
- 현재 학생 config는 기존 API를 유지하므로 학생 주소에 전환을 되돌릴 작업은 없다.
- 새 함수와 스키마는 격리돼 있다. 실패한 신규 RC를 사용하지 않고 작업 브랜치를 보존하면 현재 게임에 영향을 주지 않는다.
- 파괴적인 DROP SCHEMA/역할 삭제는 실행하지 않았다. 새 데이터가 생긴 후에는 보존 확인 없이 삭제하지 않는다.
- 대기 중 권한 변경을 승인·적용한 뒤 되돌리려면 GRANT history_v5_worker TO postgres WITH SET FALSE를 사용한다.

## 다음 단계
1. 사용자에게 준비한 SET 역할 권한 변경 승인 확인.
2. 승인되면 전용 추가 migration으로 적용하고 실제 역할 전환 재검사.
3. 서버 기능/권한 시험 및 프런트 데이터 처리·완료 outbox 구현 계속.
4. 성공한 서버 체크포인트 이후에만 UI 별도 커밋.
5. 실제 배포 화면 5→15→30명 및 25명 로그인 시험, 별도 RC 주소 인계.
