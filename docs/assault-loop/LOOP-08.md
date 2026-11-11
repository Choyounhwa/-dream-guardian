[ASSAULT-LOOP-08]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/701 | 선행: 없음. #703/#705의 필수 선행.
제목:
997줄 배선 헬퍼의 입력 라우팅만 제한 추출

목적:
휴식 관찰/러닝 포트를 추가하기 전에 배선 파일의 길이 한계를 안전하게 해소한다.

수정 대상:
- `dream_guardian/src/core/bootstrap/AssaultSessionWireHelper.ts`
- `dream_guardian/src/core/bootstrap/AssaultInputRouter.ts` (신규)
Core 입력 배선 책임만 추출, src/config2개.

구현 내용:
- wrapper handlePose의 어댑터/정규화/전달 및 _dispatchFallbackEvent의 전달만 신규 router로 이전한다. 필요한 clock/round/finale/impact 콜백을 좁은 인터페이스로 주입한다.
- wire는 생명주기/세션조립 소유자로 남고 입력위임만 한다. 캔버스/키1·2/회수/기존 timestamp 변환·정지정책·결전 입력은 동작동등 보존.
- 신규run/rest 동작, standing누락 의심수정, baseline 재설계는 이 카드에서 하지 않는다. 추출 후 LOOP-10에서 별도 승인·검증한다.

유지 사항:
#679 카메라/키보드/터치 라운드상대ms, #669 punch 호출, #670 정규화, #675 결전 동작 소유권, VFX 콜백/옵션/restart.

변경 금지:
Input/Motion/Game/config/AppBootstrap 수정, 판정/임계값/폴백 매핑 변경, 전역 배선 대형 리팩터.

완료 조건:
- [ ] 입력별 동일 인자/호출수/순서, 종료·정지·fallback·결전 동등.
- [ ] wire 800줄 미만 권장(현997), 두파일1,000줄 미만.
- [ ] 전체100%Pass/build.

테스트:
신규 `dream_guardian/tests/unit/assault-loop-input-extraction.test.ts`. Baseline npm test → 기존 입력 characterization → `npx vitest run tests/unit/assault-loop-input-extraction.test.ts` Red(신규router 위임포트 부재) → 별도 최소 추출 Green → 전체 npm test/npm run build. #679/REC-07/09/17 회귀를 함께 실행. 가짜Red금지, Pass/Fail 분리.

관련 파일:
DOC-19; #616 원 추출은 완료 이력으로 보존하며 재등록 대상 아님. WireHelper 현재997줄, AssaultClockAdapter/AssaultImpactWireHelper (읽기 전용).

선행 카드: 없음. LOOP-10/12 필수 선행. 상태: OPEN / 개별 구현 승인 대기.
관리: 다른책임 이전 금지. 실제완료 Rule12 gh issue comment(추출동등성/파일/TDD/전체100%Pass/build/조건), HANDOVER, Rule13 서버·http://localhost:3000/. 커밋 별도 요청. 현재 구현/테스트/빌드/커밋/푸시/PR/서버 금지.
