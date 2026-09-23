# 별도 RC 배포 확인

- 승인: 사용자 `설정해`.
- 기준 소스: 40462544c96443a4e19c155d12d5ba0a897d8e30.
- 신규 저장소: https://github.com/historyt04/french-revolution-normal-rc
- RC 주소: https://historyt04.github.io/french-revolution-normal-rc/
- 교사 인증: https://historyt04.github.io/french-revolution-normal-rc/teacher.html
- 배포 브랜치/폴더: rc-preview / root, HTTPS 강제.
- 배포 커밋: 1e57127ef2142307889abc3504a77169bd78cad2.
- GitHub Pages 실행: 35813780475, completed / success, 배포 SHA 일치.

## 성공한 검증
- 기존 Git 이력 가져오기 완료. 기존 main 및 서버 작업 브랜치 SHA 보존 확인.
- 브라우저에 RC 검증 중 안내와 교사 인증 링크가 표시됨.
- 교사 로그인 화면이 표시되고 bootstrap 후 학교가 동주중학교로 채워짐.
- 실제 Pages의 다음 5개 파일 HTTP 200 및 로컬 배포 커밋 파일과 바이트 동일:
  - index.html: 1,122 bytes / 도구 왕복 8.211초
  - teacher.html: 1,841 bytes / 8.068초
  - config.rc.js: 291 bytes / 8.051초
  - game-api.js: 9,688 bytes / 8.076초
  - rc-preview-manifest.json: 390 bytes / 8.021초
- 위 시간은 작업 환경 HTTP 조회 시간이며 학생 로그인 성능이 아니다.
- 원본 french-revolution-v42-rc의 main은 8e1e26d973000a30e2d09212667c800347f273a7로 유지됨.
- DB 변경 없음. 기존 Supabase 프로젝트의 history_v5/history-normal-rc-api 사용. CORS 허용 출처 변경 없음.

## 변경한 파일
index.html, teacher.html, config.rc.js, game-api.js, student-preview.html, rc-preview-manifest.json, .nojekyll, docs/normal-rc-hosting-20260923.md. 새 RC 배포 브랜치에서만 변경했다.

## 미검증 / 다음 단계
- 후속 확인: 안전한 인증 입력 후 기존 최고 관리자 로그인이 성공했고, 교사 대시보드와 학교·단원 범위를 실제 화면에서 확인했다.
- 학생용 최소 로그인·완료 outbox·전체 게임 모드 연결, 실 화면 5/15/30명 시험과 목표 성능은 아직 미완료.
- 원본 학생 화면은 student-preview.html에 그대로 보존했으며 아직 학생 시험용으로 안내하지 않는다.
- UI 요청은 서버 성공 체크포인트 뒤 별도 커밋으로 진행한다.

## 남은 위험 / 되돌리기
- 신규 RC도 기존 Supabase의 물리 자원을 공유하므로 부하 시험 중 자원 간섭 가능성이 있다.
- 같은 GitHub Pages origin 내에서 세션은 새 API URL/저장 범위로 분리했다. 학생 상태/outbox의 저장소 분리는 후속 구현·검증 대상이다.
- 새 저장소 Settings → Pages에서 source branch를 None으로 변경하면 RC 공개만 중단할 수 있다.
- 정식 학생 사이트의 배포 브랜치나 기존 API를 바꾸지 않았으므로 정식 주소의 rollback은 필요 없다.
