[ASSAULT-LOOP-03]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/696 | 선행: 없음. #697/#706의 필수 선행.
제목:
996줄 라운드 컨트롤러의 표시 조립만 제한 추출

목적:
루프 구현 전 1,000줄 제한 여유를 확보하며 판정/스케줄 동작은 보존한다.

수정 대상:
- `dream_guardian/src/game/assault/AssaultRoundController.ts`
- `dream_guardian/src/game/assault/AssaultRoundPresentationBuilder.ts` (신규)
Game 표시 조립 책임만 이전, src/config2개.

구현 내용:
- 기존 getPresentationSnapshot의 pair/hazard/text/progress DTO 조립만 신규 빌더로 이동하고 controller는 명시적 읽기 전용 입력을 제공·위임한다.
- 원본 getter 필드/선택적 필드 생략 규칙/동결/시간/판정 누출금지 계약을 그대로 유지한다. private 전체 객체를 any로 넘기는 God Object 이전 금지.
- 이 카드는 신규 run/rest 표시를 구현하지 않는다(LOOP-13). 대규모 타임라인/판정/읽기 계산 리팩터 금지.

유지 사항:
기존 모든 스냅샷/phase/콜백/TTS/입력/피해/라운드 종료 순서, #599 및 #673~674 동작.

변경 금지:
config/타입/Core/UI/Render, 새 루프 기능, 로직 수정·가독성 명목 무관한 변경.

완료 조건:
- [ ] 동일 fixture의 추출 전후 스냅샷 deepEqual 및 동결/정답 비노출 보존.
- [ ] controller 800줄 미만 권장(현996), 두 파일 모두1,000줄 미만.
- [ ] 기존 회귀 포함 전체100%Pass/build 성공.

테스트:
신규 `dream_guardian/tests/unit/assault-loop-presentation-extraction.test.ts`. Baseline npm test → 기존 throw/reading/pending/flying/wrong_locked/hit/timeout/squat/abort fixture characterization → 빌더 공개 포트 테스트 선작성, `npx vitest run tests/unit/assault-loop-presentation-extraction.test.ts` Red(신규 빌더 부재) → 별도 최소 추출 Green → 전체 npm test/npm run build. 기존 정상 동작 테스트를 일부러 깨뜨려 Red를 만들지 않는다. Pass/Fail 분리.

관련 파일:
DOC-19; REC-14 #599, `AssaultRoundTypes.ts`, `types/assault.ts` (읽기 전용).

선행 카드: 없음; 기능 카드 LOOP-04/13의 필수 선행. 상태: OPEN / 개별 구현 승인 대기.
관리: 범위 확대 시 중단. Rule12 실제완료 gh issue comment(파일/추출동등성/TDD/전체100%Pass/build/조건), HANDOVER, Rule13 npm run dev 및 http://localhost:3000/. 커밋 별도 요청 필요. 현재 코드/테스트/빌드/커밋/푸시/PR/서버 금지.
