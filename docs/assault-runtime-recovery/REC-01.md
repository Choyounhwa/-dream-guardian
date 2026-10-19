[BOSS-ASSAULT-REC-01]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/589 | 직접 선행: #542. 상태: DONE (구현 완료).
제목: 선택 문항 풀 읽기 전용 공급 포트
목적: Core가 `_allRecords`/`_pool` 비공개 필드를 추측하지 않고 선택 레벨·서브레벨에 맞는 원본을 읽도록 한다.
수정 대상:
- `dream_guardian/src/question/QuestionBank.ts` (Question, src/config 1개).
구현 내용:
- 선택 범위와 출처를 확인할 수 있는 additive 읽기 전용 문항 snapshot 포트(`getPoolSnapshot()`, `QuestionPoolSnapshot`, `QuestionPoolRecord`) 구현.
- 원본 id/level/subLevel/shapeCode/template/eval 메타데이터를 보존하고 호출자의 배열/레코드 변형으로 원본/셔플큐가 바뀌지 않도록 Object.freeze 동결 반환.
- 기존 fallback 풀과 실제 선택 범위를 구분할 수 있는 `source: 'loaded' | 'fallback'` 및 `isFallback` 플래그 제공.
유지 사항: 기존 select/next/셔플·중복 방지·legacy fallback 및 CSV 불변.
변경 금지: Core 연결, 문제 재생성/평가기 RNG 수정, 기존 필터/챕터 재정의, config 변경.
완료 조건:
- [x] 레벨/서브레벨 변경 후 snapshot이 실제 선택 범위·메타데이터/출처를 보존한다.
- [x] snapshot 읽기·변형 시도에 큐 순서/원본/next 동작이 변하지 않는다.
테스트: `dream_guardian/tests/unit/assault-recovery-question-source.test.ts` 신규 (9개 테스트 100% Pass, 전체 381개 테스트 파일 5,226개 테스트 100% Pass, npm run build 성공).
관련 파일: DOC-16; QuestionBank.ts:34~88,144~170; AssaultQuestionEligibility.ts; AppBootstrap.ts:451 (읽기 전용).
선행 카드: #542 계약 참고. 상태: DONE / 구현 및 검증 완료.
위험 방지: 단일 QuestionBank.ts 외 타 레이어 수정 없음 (src 1개).
관리: DOC-16 공통 계약. gh issue comment 및 Rule13 로컬 서버 보고.
