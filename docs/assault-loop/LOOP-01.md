[ASSAULT-LOOP-01]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/694 | 선행: 없음. 전체 의존성: DOC-19 §3.
제목:
러닝·선택·휴식 루프의 독립 타입 및 설정 계약

목적:
전투 encounter union에 run/rest를 끼워 넣지 않고 명시적 구간 계획을 표현한다.

수정 대상:
- `dream_guardian/src/types/assault-loop.ts` (신규)
- `dream_guardian/config/assault-loop.config.ts` (신규)
types/config 계약 단일 책임, src/config 합계 2개. 테스트는 아래 1개만 별도 허용.

구현 내용:
- 버전 있는 루프 프로필, 구간(run_question/answer/rest/squat), 불변 라운드 계획, 읽기 전용 구간 표시 계약을 정의한다. 기존 AssaultCompiledPlan은 참조/합성하고 수정하지 않는다.
- 설정 SSOT: run 8박, answer 4박, rest 2박, 기회 4개, squat 4박, 후보 gap 1/2/3 중 1~2개. 권장 스쿼트 내부안은 예고1+회피2+직립1박이며 본 카드 구현 승인 때 함께 승인받는다.
- 독립 loop 필드로 기존 Presentation과 합성할 수 있게 한다. phase/encounter kind union은 확장하지 않는다. 식별자·프로필/버전·박자/초 단위를 분명히 한다.
- 기존 HP100/wrong10/miss10/squatFail5/targetRounds10/BPM은 기존 config를 참조하고 복제하지 않는다. deepFreeze 재사용.

유지 사항:
DEFAULT_ASSAULT_CONFIG, DEFAULT_APPROACH_PATTERN 및 다중쌍 패턴, 기존 타입 소비자의 빌드 계약.

변경 금지:
기존 `types/assault.ts` union 확장, 런타임 실행/입력/화면/CSV 수정, 전역 기본값 전환, 챌린지/보상/결전/마나 연계.

완료 조건:
- [ ] 독립 계약으로 run8+(answer4+rest2)×4 및 squat 삽입을 표현한다.
- [ ] 전체 32+4N박(N=1,2), 기존 프로필 미변경, 설정 동결을 검증한다.
- [ ] 모든 소스 1,000줄 미만, 공통 계약 DRY, 전체 테스트100% Pass 및 build 성공.

테스트:
`dream_guardian/tests/unit/assault-loop-contract.test.ts` 신규. dream_guardian에서 `npm test` Baseline → 테스트 선작성 → `npx vitest run tests/unit/assault-loop-contract.test.ts` Red(계약/설정 부재) → 별도 턴 최소 Green → `npm test` 전체 + `npm run build`. 타입 검증은 tsc도 병행하고 런타임 테스트 실패를 위조하지 않는다. Pass 파일/케이스 수와 Fail 파일/케이스/원인을 분리 보고한다.

관련 파일:
DOC-19 `docs/19_BOSS_ASSAULT_LOOP_CARDS.md`; `types/assault.ts`, `config/assault.config.ts`, `utils/deepFreeze.ts` (읽기 전용). 경로 축약은 dream_guardian 기준이며 관련 파일은 allowlist가 아니다.

선행 카드: 없음. 상태: OPEN / 개별 구현 승인 대기. 카드 등록은 구현 승인이 아니다.
관리: 승인 범위 밖/네 번째 파일 필요 시 중단·별도 카드. 실제 구현 완료 시 `gh issue comment <이슈번호>`에 구현·파일·실제 TDD/전체100% Pass/build·완료 조건 증거 등록(Rule12), HANDOVER 최신화, Rule13 `npm run dev` 및 http://localhost:3000/ 상태 안내. 커밋은 사용자 명시 요청이 있을 때만. 현재 등록 단계에서는 구현/테스트/빌드/커밋/푸시/PR/서버 시작 금지.
