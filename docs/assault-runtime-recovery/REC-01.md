[BOSS-ASSAULT-REC-01]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/589 | 직접 선행: #542 계약 이력 참고. 개별 승인 필수.
제목: 선택 문항 풀 읽기 전용 공급 포트
목적: Core가 `_allRecords`/`_pool` 비공개 필드를 추측하지 않고 선택 레벨·서브레벨에 맞는 원본을 읽도록 한다.
수정 대상:
- `dream_guardian/src/question/QuestionBank.ts` (Question, src/config 1개).
구현 내용:
- 선택 범위와 출처를 확인할 수 있는 additive 읽기 전용 문항 snapshot 포트를 정의한다. 실제 API 이름은 착수 시 확정한다.
- 원본 id/level/subLevel/shapeCode/template/eval 메타데이터를 보존하고 호출자의 배열/레코드 변형으로 원본/셔플큐가 바뀌지 않게 한다.
- 기존 fallback 풀과 실제 선택 범위를 구분할 수 있어 assault 진입에서 무관한 예제 풀을 정상 데이터로 오인하지 않게 한다. 기존 next()/legacy fallback 의미는 유지한다.
유지 사항: 기존 select/next/셔플·중복 방지·legacy fallback 및 CSV 불변.
변경 금지: Core 연결, 문제 재생성/평가기 RNG 수정, 기존 필터/챕터 재정의, config 변경.
완료 조건:
- [ ] 레벨/서브레벨 변경 후 snapshot이 실제 선택 범위·메타데이터/출처를 보존한다.
- [ ] snapshot 읽기·변형 시도에 큐 순서/원본/next 동작이 변하지 않는다.
테스트: `dream_guardian/tests/unit/assault-recovery-question-source.test.ts` 신규. 승인 후 npm test Baseline→선택범위/도형/빈풀/불변 포트 테스트 선작성→대상 Red→별도 턴 최소 구현 Green→전체 npm test100%Pass/npm run build. 기존 QuestionBank 회귀 포함.
관련 파일: DOC-16; QuestionBank.ts:34~88,144~170; AssaultQuestionEligibility.ts; AppBootstrap.ts:451 (읽기 전용).
선행 카드: #542 계약 참고. 상태: OPEN / 개별 구현 승인 대기.
위험 방지: 현행 포트로 요구 충족 시 characterization 증거만 제출하고 불필요 리팩터 금지. 다른 레이어/4번째 파일 필요 시 중단·분리·재승인.
관리: DOC-16 공통 계약. 실제 구현 완료 시 해당 번호에 gh issue comment(변경파일/실제 Red·Green/전체100%Pass/build/조건 증거), HANDOVER 최소 기록, Rule13 npm run dev 및 http://localhost:3000/ 상태 보고. 현재 테스트/서버/커밋/푸시 금지, NEXT 불변.
