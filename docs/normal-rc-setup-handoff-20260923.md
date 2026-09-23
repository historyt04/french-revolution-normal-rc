# RC 설정 및 학생 연결 체크포인트

## 기준과 배포
- 정식 기준 main: 8e1e26d973000a30e2d09212667c800347f273a7. 작업 후 원본 GitHub main SHA 동일 확인.
- 서버 구조 기준: 40462544c96443a4e19c155d12d5ba0a897d8e30.
- 독립 RC 초기 배포: 1e57127ef2142307889abc3504a77169bd78cad2.
- 현재 RC 학생 연결 배포: 78fe488f9d6b4e52684ddf060fdf7295b4157d45.
- Pages 실행 35815206793: completed / success, 해당 SHA 일치.
- 저장소: https://github.com/historyt04/french-revolution-normal-rc
- RC: https://historyt04.github.io/french-revolution-normal-rc/
- 교사: https://historyt04.github.io/french-revolution-normal-rc/teacher.html
- 학생 개발 검증: https://historyt04.github.io/french-revolution-normal-rc/student-preview.html
- 루트 안내와 manifest의 studentTrialReady=false 유지. 아직 학생 5~7명 수업 시험용 인계 상태가 아니다.

## 확인한 결과
| 항목 | 결과 | 측정/한계 |
|---|---|---|
| 독립 저장소·Git 이력·Pages | 성공 | 새 저장소 rc-preview/root |
| 기존 최고 관리자 인증 | 성공 | 안전한 입력 후 실제 교사 대시보드 확인 |
| 학생 로그인 화면·학교 bootstrap | 성공 | 동주중학교 표시 |
| 로컬 완료 큐 장애 검사 | 성공 | 77.4ms, 실제 서버 아님 |
| 로컬 도메인·트랜잭션 회귀 | 성공 | 452.9ms, 메모리 어댑터 |
| 실제 브라우저 IndexedDB 검사 | 성공 | 57.4ms, 서버 응답은 모형 |
| 실제 학생 인증 | 미완료 | 안전한 인증 입력이 사용자에 의해 중단됨. 이후 새 문서에서 로그인 폼 확인 |
| 실제 학생 완료·보상·팩·재접속 | 미실시 | 인증 이후 흐름 미검증 |
| 실제 5/15/30명 및 25명 로그인 | 미실시 | 성능 합격 판단 불가 |

브라우저 저장소 검사는 실제 IndexedDB 쓰기 완료, DB 닫기/다시 열기, 응답 유실 후 같은 ID 재전송, 모형 서버 효과 1회, 다른 학생 조회 분리를 확인했다. 57.4ms는 로그인/팩/완료 서버 반영 시간이 아니다.

## 변경 파일과 DB
학생 연결 커밋의 전체 목록과 위험은 normal-rc-client-checkpoint-20260923.md 참고. 이번 설정·클라이언트 연결 단계 DB 변경은 없다. 기존 history_v5와 history-normal-rc-api v3를 사용한다. 정식 history_rc와 기존 history-rc-api는 유지했다.

## 남은 작업
1. 학생 인증 후 현재 RC 화면의 완료·보상·팩 경로 확인.
2. 아직 연결하지 않은 게임 모드 완료 큐, 카드팩의 세션 간 요청 복구, 카드·도감·미션 분할 조회.
3. 실제 배포 서버·화면의 5→15→30명 전체 흐름과 25명 로그인 측정, 누락/중복 DB 대조.
4. 서버 정상 작동 체크포인트 후 고급 비활성화/메뉴 이동/FR-09 수정 별도 커밋.
5. 실제 학생 5~7명 시험 인계. 자동 시험만으로 수업 가능 판단하지 않는다.

## 되돌리기
학생 연결 커밋 78fe488을 새 저장소 rc-preview에서 revert하면 직전 RC 설정 상태로 복구할 수 있다. 이 단계는 DB 변경이 없어 데이터 역변환이 필요 없다. RC 공개 자체를 중단하려면 새 저장소 Pages source를 None으로 바꾼다. 원본 main/정식 배포는 변경하지 않았다.
