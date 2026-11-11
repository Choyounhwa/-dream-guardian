[ASSAULT-LOOP-16]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/710 | 선행: #694~#709 전부 실제완료/개별인수.
제목:
실제 진입 경로 루프·사망·기록호환 통합 인수

목적:
부품조합만 통과하는 검증을 넘어 새36/40박 루프를 실준비경로에서 인수한다.

수정 대상:
- `dream_guardian/tests/integration/assault-loop.test.ts` (신규)
- `docs/19_BOSS_ASSAULT_LOOP_CARDS.md` 검증증거표만
QA 단일책임, src/config0개.

구현 내용:
- 실제 `http://localhost:3000/?mode=boss_assault`만으로 AppBootstrap/READY_POSITION→10문제 또는사망→안전종료→UI restart/메뉴왕복 경로를 검증한다. 추가 `loop` 파라미터나 테스트의 loopProfile 수동주입 없이 Core가 새 루프를 기본 선택해야 한다. controller/summary/진입옵션을 수동제조하여 실제 연결 누락을 가리지 않는다.
- seed고정 N1/N2 계획, run8+(answer4/rest2)×4+N×squat4, TTS1회/추가투척·읽기0, 4개기회동일문제정답·혼합결과진행·마지막휴식까지완료0→1 검증.
- 전구간입력경계/유예·휴식피해0·직립/회수·양손·폴백/카메라·pause/hidden/tracking/큰dt/동일프레임사망우선·10번째사망/11번째0·stale/restart검증.
- 실제요약 answer4/squatN/total5or6/완료문제1/18or20초 및 실측runStep/activeDuration검증. 장면/HUD/메트로놈·공격음의구간정합성 포함.
- Storage는구현하지않고 기존AssaultResultStore의엄격roundKeys/count관계와 plannedAnswerOpportunities 비교identity를 fixture로검증한다. 10문제×4=40계획기회(하드코딩대신계획에서산출), 중간사망시실측≤계획. loop rulesVersion/profileId로구형기록과비교격리 가능함을확인. 실제저장/보상연결은#537 보류범위, 테스트세션쓰기0/legacy키무오염.
- 브라우저 Chrome가로/세로에서 **일반 개발URL `http://localhost:3000/?mode=boss_assault`**의 카메라·키1/2·클릭·휴식·스쿼트1/2·UI 재시작 가독성/피로를 기록한다. URL/시작·재시작 증거를 남기며 추가 loop URL만으로 인수하지 않는다. Safari/Firefox/모바일하드웨어없으면미검증으로명시. 단위Pass를실기기Pass로대체금지.
- 새가설(예: squat baseline/음향두번째회피/추적복구) 발견시재현·원인·수정계획카드등록후별도승인, 이카드에서제품수정0.

유지 사항:
소스/config/CSV/저장스키마·기존기록·G4/G5차단·기존NEXT, #613 기존인수완료이력. 동등성 보존은 비boss legacy/범용 Factory 직접 호출/기존 패턴 데이터이며 boss_assault UI 기본 루프는 변경·인수 대상이다.

변경 금지:
실패를고치기위한제품수정, 가짜Red/가짜100%Pass, 챌린지/보상/결전/마나연결, 기존이슈재완료.

완료 조건:
- [ ] 적용계약전부에자동/브라우저증거및Pass/Fail/미검증을기록, 필수미검증/실패시DONE금지.
- [ ] 추가 loop URL/loopProfile 수동주입 없는 `?mode=boss_assault` UI 첫 시작과 restart에서 새36/40박 루프 실행 증거가 있다. 기본경로가 구형 루프이면 미연결 실패이며 DONE 금지.
- [ ] 신규통합+전체npm test100%Pass/npm run build성공, 기본패턴/legacy/저장무오염.
- [ ] 발견결함은별도등록·승인대기, 총계획기회와실측/사망요약호환증거존재.

테스트:
승인후 dream_guardian에서 Baseline `npm test` → `tests/integration/assault-loop.test.ts` 인수테스트선작성 → `npx vitest run tests/integration/assault-loop.test.ts` 실제실패/Pass를그대로기록(QA예외, 억지Red금지) → 선행카드구현결과로Green확인 → 전체 `npm test`/`npm run build`. QA는최소Green제품수정대신결함카드/조건부수정을별도승인받는다. Pass파일·케이스수/Fail파일·케이스·에러/미검증분리보고.

관련 파일:
DOC-19; #613(기존REC인수), #665(챌린지인수보류), #537/#535/#538(저장·최종실기기별도). 관련파일읽기전용.

선행 카드: LOOP-01~15 및15a 전부실제완료/개별인수. 상태: OPEN / 개별 QA 승인 대기.
관리: 실제완료 Rule12 `gh issue comment <이슈번호>`(실제검증/파일/전체100%Pass/build/조건/잔여미검증), HANDOVER, Rule13 `npm run dev` 및 http://localhost:3000/ 상태안내. 커밋은별도명시요청시만. 현재카드작성단계는테스트/빌드/커밋/푸시/PR/서버금지.
