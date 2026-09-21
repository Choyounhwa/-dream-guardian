---
description: 작업 카드 완료 시 GitHub 이슈 코멘트 등록(Rule 12), 커밋/푸시, 로컬 서버 가동(Rule 13)
agent: card-pm
---
작업 카드 $ARGUMENTS 완료 절차를 아래 순서로 엄격히 수행해줘:

1. **테스트 100% 검증**:
   - `dream_guardian` 디렉토리에서 `npm test`를 실행하여 100% Pass를 확인. 실패 시 작업 중단.
2. **GitHub Issue 카드 코멘트 등록 (Rule 12)**:
   - 해당 이슈($ARGUMENTS)에 대해 다음 항목이 포함된 마크다운 본문을 작성:
     - [x] 작업 목적 및 구현 내용
     - [x] 변경된 파일 목록
     - [x] 테스트 결과 (전체 테스트 개수 및 100% Pass 증빙)
     - [x] 카드의 완료 조건 체크리스트 완료 표시
   - `gh issue comment $ARGUMENTS --body "..."` 명령어로 GitHub 이슈 카드에 코멘트를 등록.
3. **Git 동기화**:
   - `git status` 및 `git diff` 검토 후 컨벤션에 맞춰 커밋하고 `origin main`에 푸시.
4. **인수인계 문서 최신화**:
   - `dream_guardian/HANDOVER.md`에 완료 내역과 다음 작업 카드를 명시.
5. **로컬 테스트 서버 가동 (Rule 13)**:
   - 사용자가 브라우저에서 바로 동작을 검증할 수 있도록 로컬 개발 서버(`npm run dev`)를 가동하고 테스트 URL(`http://localhost:3000/`)을 안내.
