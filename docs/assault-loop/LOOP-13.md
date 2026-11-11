[ASSAULT-LOOP-13]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/706 | 직접 선행: #694,#696,#697,#698.
제목:
루프 현재구간·남은박·기회수 읽기 전용 스냅샷

목적:
UI가 게임시간/랜덤계획을 재계산하지 않도록 Game의 실측상태를 전달한다.

수정 대상:
- `dream_guardian/src/game/assault/AssaultRoundController.ts`
- `dream_guardian/src/game/assault/AssaultRoundPresentationBuilder.ts`
Game 표시스냅샷 단일 책임, src/config2개.

구현 내용:
- LOOP-01 독립 loop 표시 계약을 기존 presentation에 선택합성한다. 현재구간/구간박진행·잔여박/선택기회1~4/전체4/허용행동·선택가능여부/휴식·직립안내를 타임라인 권위에서 산출한다.
- run/rest에는 pair/hazard/attackId를 활성으로 노출하지 않는다. 기존 currentEncounterIndex fallback으로 다음쌍을 미리 비행/공격 표시하지 않는다. squat에는해당 hazard만 노출, 마지막rest도별도표시.
- 총기회4·완료문제수/정답수·운동량을 혼동시키지 않는다. 정답위치(correctSide)나 수학적 정오를 판정 전 표시타입에 누출하지 않는다. deepFreeze.
- 기존 Controller/범용 Factory 직접 호출의 loop계획 미주입 fixture는 필드생략/스냅샷동등 유지. boss_assault UI 기본URL은 Core가 loop계획을 주입하므로 loop표시를 포함해야 한다. URL의 loop 파라미터 부재를 필드생략 조건으로 사용하지 않는다.

유지 사항:
기존 PresentationDTO/AssaultRoundPhase/EncounterKind, 기존 장면/음향 호환필드, #661~662 보조문구 완료여부와 별개.

변경 금지:
types/assault.ts 전역 union 확장, Core/UI/Render/config 변경, UI측 시간계산/가짜진행, 챌린지 보조문구 기능 재구현.

완료 조건:
- [ ] run→answer→rest→squat→rest끝의 구간/잔여박/기회가 계획과 일치.
- [ ] 휴식pair/hazard/attack 활성0, 미래공격 노출0, 정답누출0.
- [ ] 기존스냅샷동등/동결, 전체100%Pass/build,1,000줄 미만.

테스트:
신규 `dream_guardian/tests/unit/assault-loop-presentation.test.ts`. Baseline npm test → `npx vitest run tests/unit/assault-loop-presentation.test.ts` Red(loop표시 부재) → 별도 최소 Green → 전체 npm test/npm run build. early선택/각휴식/마지막휴식/스쿼트하위창/pause·resume/기존옵션미지정 검증. Pass/Fail 분리.

관련 파일:
DOC-19; REC-13~15 #590/#599/#608, #661/#662 보류범위, `types/assault-loop.ts` (읽기 전용).

선행 카드: LOOP-01,03,04,05. 상태: OPEN / 개별 구현 승인 대기.
관리: 범위 밖 중단. 실제완료 Rule12 gh issue comment(파일/TDD/전체100%Pass/build/조건), HANDOVER, Rule13 서버·http://localhost:3000/. 커밋 별도요청. 현재 구현/테스트/빌드/커밋/푸시/PR/서버 금지.
