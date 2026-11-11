[ASSAULT-LOOP-10]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/703 | 직접 선행: #698,#701,#702.
제목:
루프 입력 배선 및 휴식 중 회수·직립 관찰 검증

목적:
휴식은 공격입력을 소비하지 않으면서 다음선택/회피의 물리적 복귀 증거를 계속 유지한다.

수정 대상:
- `dream_guardian/src/core/bootstrap/AssaultInputRouter.ts`
- `dream_guardian/src/core/bootstrap/AssaultSessionWireHelper.ts`
Core 입력 배선 단일 책임, src/config2개.

구현 내용:
- run/rest에서도 punchAdapter.update와 squat/guard 관찰을 계속한다. 유효 standing 결과를 Game의 submitSquatResult로 전달하되 선택/공격성공은 Game 창으로 제한한다. 가짜직립/reset 금지.
- 현 handlePose의 ducking/guarding 전용 분기로 standing이 Game에 도달하지 않을 가능성은 재현가설이다. 실제 연속회피 시나리오를 먼저 검증하고 재현시에만 해당 필터를 최소 수정한다. 미재현은 정상증거 기록, 불필요한 버그수정0. REC-26 도메인판정 재구현 금지.
- 카메라 squatResult.timestampMs와 punch/fallback 모두 공통 clock을 거쳐 같은 round-relative ms로 전달되는지 검증하고 새 경로에서 손실없이 전달한다. 기존 어댑터 증거(isValid/standGeneration/deltaY) 보존.
- 과거/보정입력이 run/rest에서 발생했으면 다음쌍에 재귀속0. keyup/touchend/회수는 관찰하되 쉬는구간에서 입력실행/impact/SFX0, pause/hidden/tracking 안전정책 유지.

유지 사항:
#679 키1·2/터치/카메라, 손회수·직립세대/동시양손, legacy/결전 배타성, 정규화 단위.

변경 금지:
Motion/Input/Game/config 판정·baseline 임계값 수정, 추정버그 일괄수정, DEFAULT모드 변경.

완료 조건:
- [ ] 휴식중 standing/회수 증거 전달, 피해/선택/impact0, 새유효동작만 다음창에서 허용.
- [ ] camera/fallback ms·활성시계 일치, stale입력/holding/추적복귀 가짜성공0.
- [ ] 가설 재현/미재현·조건부수정 증거 분리, 전체100%Pass/build,1,000줄 미만.

테스트:
신규 `dream_guardian/tests/unit/assault-loop-input-routing.test.ts`. Baseline npm test → 배선 spy/연속squat characterization → `npx vitest run tests/unit/assault-loop-input-routing.test.ts` Red(루프관찰 계약 부재 또는 실제가설 재현) → 별도 최소 Green → 전체 npm test/npm run build. 미재현가설은 Red위조하지 않는다. Pass/Fail 파일·케이스·원인 분리.

관련 파일:
DOC-19; #614/#604/#606/#679, `AssaultClockAdapter.ts` 및 기존 input/motion 어댑터 (읽기 전용).

선행 카드: LOOP-05,08,09. 상태: OPEN / 개별 구현 승인 대기.
관리: 추가버그/다른레이어 필요시 별도 검증·수정카드 승인대기. 실제완료 Rule12 gh issue comment(증거/파일/TDD/전체100%Pass/build/조건), HANDOVER, Rule13 서버·http://localhost:3000/. 커밋 별도요청. 현재 구현/테스트/빌드/커밋/푸시/PR/서버 금지.
