[ASSAULT-LOOP-02]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/695 | 직접 선행: #694, #645 완료이력.
제목:
시드·라운드 번호 기반 36/40박 루프 계획 생성 및 사전 검증

목적:
게임 실행 전에 스쿼트 개수와 위치까지 확정한 불변 계획을 만든다.

수정 대상:
- `dream_guardian/src/game/assault/AssaultLoopPlanBuilder.ts` (신규)
Game 계획 생성 단일 책임, src/config 1개.

구현 내용:
- LOOP-01 프로필과 seed+roundNumber를 받아 후보 gap(선택1~2/2~3/3~4 사이) 중 중복 없이1~2개 선택. 기존 `seededRng.ts`를 재사용하고 계획을 시작 전 deepFreeze한다.
- run8 → answer4/rest2 네 번, 선택된 gap은 해당 rest2 종료 후 별도 squat4 삽입. 마지막 rest2를 반드시 포함. 총32+4N박,120BPM18/20초. 정답/오답 여부와 무관하게 계획 불변.
- 구간 목록과 전투 encounter 목록을 분리한다. 전투 목록에는 answer_pair4개와 squat1~2개만 넣고 run/rest는 넣지 않는다. 구간의 encounter 참조/고유 pairId/attackId를 명시한다.
- encounter 투영은 기존 validateAssaultPlan/compileAssaultPlan을 재사용한다. 기존 검증기는 간격을 허용하므로 무조건 교대/빈틈0 가정을 새로 만들지 않는다. 외부 구간 커버리지/마지막휴식/총길이/스쿼트 하위창은 이 빌더에서 별도로 검증한다.
- 기존 compiler의 answerBeats 난이도 override를 이 경로에 넘기지 않는다. 생성 결과는 라운드 전체 절대 상대박자이며 읽기8박을 나중에 재가산하지 않는다.

유지 사항:
기존 DEFAULT/EXTENDED/MULTI_PAIR 패턴과 레지스트리 바이트·출력, 기존 validator/compiler 공개 동작.

변경 금지:
approachPatterns.ts·기존 compiler/validator 변경, Math.random/Date.now, 실행 중 재추첨, 문제 생성/HP/입력/표시/전역 기본 패턴 변경.

완료 조건:
- [x] 동일 seed+round는 동일 계획, 후보3개/중복0/개수1~2, 전체 36/40박.
- [x] run8 1회, answer4/rest2 각4회, rest 대체0, squat 끝난 뒤 다음선택, 마지막 휴식 존재.
- [x] 잘못된 참조/경계/중첩/합계는 원자적 거부, 기존 컴파일 검증 통과.
- [x] 전체 테스트100% Pass/build 성공, 소스1,000줄 미만.

테스트:
신규 `dream_guardian/tests/unit/assault-loop-plan.test.ts`. Baseline `npm test` → `npx vitest run tests/unit/assault-loop-plan.test.ts` Red(빌더 부재) → 별도 최소 Green → 전체 `npm test`/`npm run build`. seed 다수의 불변식, BPM90/120/150, 마지막rest, 기존패턴동등성을 검증. 특정 두 seed 결과가 반드시 다르다는 불안정 단정 금지. Pass/Fail 분리 보고.

관련 파일:
DOC-19; `src/utils/seededRng.ts`, `AssaultPlanValidator.ts`, `AssaultPlanCompiler.ts`, `src/data/assault/approachPatterns.ts` (읽기 전용).

선행 카드: ASSAULT-LOOP-01; #645 RNG 완료 이력. 상태: [✔] 완료.
관리: allowlist 밖 변경 금지. 실제 완료 시 Rule12 `gh issue comment <이슈번호>`(구현/파일/실제TDD/전체100%Pass/build/조건), HANDOVER, Rule13 서버 및 http://localhost:3000/. 커밋 별도 명시 요청 필요. 현재는 카드작성만, 구현/테스트/빌드/커밋/푸시/PR/서버 금지.
