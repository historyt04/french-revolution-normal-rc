# 별도 RC 저장소 및 Pages 설정

- 사용자 승인: 별도 GitHub 저장소와 Pages 설정에 대해 `설정해`.
- 신규 공개 저장소: historyt04/french-revolution-normal-rc.
- 원본 저장소: historyt04/french-revolution-v42-rc. 이 설정 작업에서 원본 브랜치를 갱신하지 않는다.
- GitHub Importer로 기존 파일과 Git 이력을 복사했다. 신규 저장소에서도 main=8e1e26d973000a30e2d09212667c800347f273a7, rc/server-restructure-20260923=40462544c96443a4e19c155d12d5ba0a897d8e30을 확인했다.
- 신규 Pages 배포용 브랜치: rc-preview, 기준 4046254. 원본 main과 독립.
- 예정 Pages 주소: https://historyt04.github.io/french-revolution-normal-rc/
- 신규 Supabase 함수 history-normal-rc-api / history_v5를 유지한다. DB 변경은 이 배포 설정 단계에 없다.
- 신규 저장소는 같은 historyt04.github.io origin이므로 Supabase CORS 허용 출처 추가가 필요 없다.

## 최초 배포 파일
- config.rc.js: 신규 함수, 별도 세션 저장 범위, 서울 실행 지역.
- game-api.js: 신규 함수 경로 허용 및 forceFunctionRegion 지정. 기존 서비스로 자동 전환하지 않는다.
- teacher.html: 기존 교사 화면/기능을 유지하면서 검증용 표시 추가.
- index.html: 서버 개편 검증 중인 상태와 교사 인증 진입점.
- student-preview.html: 기준 학생 화면을 바이트 동일하게 보존. 아직 최소 로그인/완료 outbox와 연결되지 않아 학생 시험 링크로 안내하지 않는다.
- rc-preview-manifest.json: 소스 기준과 시험 준비 여부 명시.
- .nojekyll: 정적 파일 원문 배포.

이 진입점은 설정 확인용이며, 사용자 요청의 정상 게임을 대체하는 축소판이 아니다. 학생 게임 코드는 그대로 보존하고 데이터 처리 연결을 계속 완성해야 한다. 서버/실제 화면 동시 시험 및 별도 UI 커밋은 아직 남았다.

## 배포 전 검사
- student-preview.html SHA256: 5b6c014937e8d5b9dbb18cacf8c98931f458c78e2a784f39217e3fe3e187a335 (기준 index.html과 일치).
- 시작/교사 페이지의 로컬 스크립트·스타일·링크 경로 존재 확인.
- game-api.js 문법 검사, git diff --check 통과.
- 실 주소 HTTP/브라우저 확인 결과는 배포 후 별도 후속 기록에 남긴다.

## 되돌리기 및 다음 단계
- 신규 저장소의 Pages 설정에서 소스를 None으로 되돌리면 RC 공개만 중단한다. 원본 사이트에는 영향 없다.
- rc-preview를 기존 정식 저장소 main에 병합하지 않는다. 학생 시험 합격 전에 정식 환경을 승격하지 않는다.
- 다음: 신규 Pages 배포 확인 → 기존 교사 계정 보안 인증 → 실제 서버 기능 검증 → 학생 흐름과 완료 outbox 연결 → 5/15/30명 실제 화면 시험.
