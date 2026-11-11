[ASSAULT-LOOP-14]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/707 | 직접 선행: #706.
제목:
루프 러닝·휴식 장면의 공격 표시 억제

목적:
휴식인데 공격이 계속 보이거나 선택할 수 있는 것처럼 보이는 혼동을 제거한다.

수정 대상:
- `dream_guardian/src/render/AssaultSceneRenderer.ts`
Render 장면 표시 단일 책임, src/config1개.

구현 내용:
- loop 표시계약을 읽어 run에는 문제와러닝안내, answer에는4박 고정 보기, rest에는휴식·복귀안내, squat에는해당예고/회피/직립을 그린다.
- run/rest의 pair painter/공격 telegraph/위험경고 호출0. 이전pair/hazard 캐시를 유지해 휴식에 재표시하지 않는다. 문제텍스트는 run8 안에서 즉시 가독성 확보, 추가 투척 비행대기0.
- 기존 visual config 자원/수치를 재사용하며 신규 좌표/색상 상수산재 금지. 새스타일값 필요시 config카드 분리. loop표시 없는 기존 render 직접 호출 fixture만 동등 보존한다. boss_assault UI 기본URL은 Core가 전달한 loop표시를 사용하며 추가 loop URL이 없다고 구형 표시로 돌아가지 않는다.

유지 사항:
4색커서·바닥판정좌표/카메라·기존pair판정시각·VFX, #663 챌린지 분수라벨 범위는 보류.

변경 금지:
Game/Core/UI/config/PairPainter 수정, 상태전이·시간/정답계산·입력리스너 추가, 그림으로 선택창 변경.

완료 조건:
- [ ] mock ctx/spy로 휴식공격표시0, run문제즉시표시, 선택/스쿼트구분.
- [ ] viewport별 기존레이아웃충돌0 및 기본렌더동등, 전체100%Pass/build,1,000줄 미만.

테스트:
신규 `dream_guardian/tests/unit/assault-loop-render.test.ts`. Baseline npm test → `npx vitest run tests/unit/assault-loop-render.test.ts` Red(run/rest 표시계약 미소비) → 별도 최소 Green → 전체 npm test/npm run build. 전구간mock/반복render부작용0/세로·가로뷰포트 검증; 실제브라우저가독성은 LOOP-16에 별도증거. Pass/Fail 분리.

관련 파일:
DOC-19; `AssaultPairPainter.ts`, `config/assault-visual.config.ts`, #690~692, #663 (읽기 전용).

선행 카드: LOOP-13. 상태: OPEN / 개별 구현 승인 대기.
관리: 범위 밖 중단. 실제완료 Rule12 gh issue comment(구현/파일/TDD/전체100%Pass/build/조건), HANDOVER, Rule13 서버·http://localhost:3000/. 커밋 별도요청. 현재 구현/테스트/빌드/커밋/푸시/PR/서버 금지.
