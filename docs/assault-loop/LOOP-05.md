[ASSAULT-LOOP-05]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/698 | 직접 선행: #697.
제목:
선택4박·휴식 무피해·스쿼트 하위창 입력 귀속

목적:
비행 난이도나 lateGrace가 선택창을 줄이거나 휴식까지 침범하지 않게 한다.

수정 대상:
- `dream_guardian/src/game/assault/AssaultRoundController.ts`
- `dream_guardian/src/game/assault/AssaultLoopTimeline.ts`
- `dream_guardian/src/game/assault/AssaultRoundTypes.ts`
Game 입력 귀속 단일 책임, src/config3개.

구현 내용:
- 새 루프에서 선택 가능한 시간은 정확히4박. 기존 easy3/normal2/hard1.5박은 이 경로 판정창에 적용하지 않는다. 우선 새 경로 비행도4박으로 맞추고 향후 난이도별 시각 비행 분리는 별도 카드.
- 선택 종료 정각 입력을 먼저 처리한 뒤 오답/timeout 정산, 그 후 rest 진입. 유예170ms를 휴식으로 흘리지 않는다. 기존 PairJudge에 이 경로만 lateGraceMs=0과 명시 windowStart/arrival을 주입해 재사용; 기존 config/판정기 기본값은 유지한다.
- run/rest/스쿼트 복귀박의 펀치/답선택/피해 명령0. rest 구간은 무공격·무선택·무피해. 종료 전 정산이 rest에서 뒤늦게 발행되지 않게 경계 순서를 고정한다.
- 스쿼트 권장1박 예고+2박 회피+1박 직립 안의 회피 마감에서만 실패정산, 마지막직립박은 무피해. SquatJudge의 창/arrival/유예를 명시 주입; 실제 standing은 전 구간 관찰하되 성공으로 소비하지 않는다.
- 입력 하나는 해당시각의 단일 활성 전투조우에만 귀속. 이전 currentEncounterIndex fallback으로 휴식/다음쌍을 오판정하지 않는다. 회수/직립 세대는 보존하고 강제reset 금지. 조기선택 잠금 이후에도 슬롯은 축소0.

유지 사항:
HP100/wrong·miss10/squatFail5, 기존 손방향/동시양손/멱등키/직립 소비 규칙, 기존 경로 유예170ms.

변경 금지:
PairJudge/SquatJudge/config/Input/Core 변경, 전체정답 강제, 이전오답을 회피로 취소, 휴식 공격 삽입.

완료 조건:
- [ ] 선택시작/4박정각은 유효, 종료후 ε는 무효; rest 전구간 정산명령0.
- [ ] 조기정답/오답/무응답 모두 슬롯4박+rest2 유지, 중복/늦은입력 다음쌍 영향0.
- [ ] 스쿼트1~2회만 판정, holding/직립복귀/세대소비 기존 보호 유지.
- [ ] 전체100%Pass/build, 소스1,000줄 미만.

테스트:
신규 `dream_guardian/tests/unit/assault-loop-input-windows.test.ts`. Baseline npm test → `npx vitest run tests/unit/assault-loop-input-windows.test.ts` Red(현 구간외 입력/유예 침범 계약 미지원) → 별도 최소 Green → 전체 npm test/npm run build. easy/normal/hard 전부4박, 경계±1ms, 양손충돌/회수없음/직립복귀, 늦은timestamp/긴dt 검증. 실패가 재현되지 않은 의심 사례를 버그로 단정하지 않는다. Pass/Fail 분리.

관련 파일:
DOC-19; #591/#614/#673/#679 완료 이력; PairJudge/SquatJudge (읽기 전용).

선행 카드: LOOP-04. 상태: OPEN / 개별 구현 승인 대기.
관리: 범위 밖 수정 중단. 실제 완료 Rule12 gh issue comment(구현/파일/실제TDD/전체100%Pass/build/조건), HANDOVER, Rule13 npm run dev 및 http://localhost:3000/. 커밋 별도 요청. 현재 구현/테스트/빌드/커밋/푸시/PR/서버 금지.
