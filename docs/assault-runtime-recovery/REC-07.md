[BOSS-ASSAULT-REC-07]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/604 | 직접 선행: REC-04 #597, REC-06 #591. 개별 승인 필수.
제목: 입력 공통 활성시계·라운드 원점 정규화
목적: performance.now/엔진elapsed/라운드상대시각 혼용과 지연보정 유실·중복을 방지한다.
수정 대상:
- `dream_guardian/src/core/AssaultClockAdapter.ts`
- `dream_guardian/src/core/AssaultSessionFactory.ts`
- `dream_guardian/src/core/AppBootstrap.ts` (Core, src/config3개).
구현 내용:
- 원본 pose 시각과 punchAdapter 반환 raw/compensatedTimestampMs를 보존하고 **130ms 정확히1회** 적용하는 변환 경계를 명시한다. clock/adapter 이중 차감 금지.
- 원본/엔진 시각의 기준 매핑과 session 활성초→round origin 상대ms/초 변환을 한 경로로 통일한다. 두번째 라운드/결전의 원점도 포트로 고정한다.
- 폴백 keyboard/touch는 카메라130ms를 무조건 적용하지 않고 출처별 승인 정책으로 정규화한다. inputId/동시손 batch를 보존한다.
- 입력을 경계와 시간순 소비하게 전달하고 같은deadline에서만 입력우선, 과거/이전라운드/stale입력 차단. Core는 판정 자체를 계산하지 않는다.
유지 사항: #503 130ms/170ms, Game 판정·공용 engine, 손회수/직립세대.
변경 금지: Input/Motion/Game/config 수정, performance.now와 elapsed 직접비교, 마감 유예 수치 변경.
완료 조건:
- [ ] 서로 다른 절대 원점에서도 같은 활성입력은 동일 판정시각; round2 즉시만료0.
- [ ] 보정 횟수1, fallback 과보정0, deadline 직전/동일/직후 순서가 정확하다.
테스트: `dream_guardian/tests/unit/assault-recovery-clock-wiring.test.ts` 신규. Baseline→큰 wall clock 오프셋·pause·보정·batch·2라운드 fixture Red→최소구현 Green→전체 npm test100%Pass/build; clock/punch/fallback 회귀.
관련 파일: DOC-16; AppBootstrap:591~655; PunchAdapter 이벤트 계약; Clock.normalizeInput (읽기 전용).
선행 카드: REC-04, REC-06. 상태: OPEN / 개별 구현 승인 대기.
위험 방지: 입력 어댑터 변경 필요하면 별도 카드로 분리. 허용3파일 범위의 시간 라우팅 외 정산/표시 수정 금지.
관리: DOC-16 공통 계약; 실제 완료 gh issue comment(TDD/전체100%Pass/build/파일/조건), HANDOVER/Rule13 서버. 현재 테스트/서버/커밋/푸시 금지·NEXT 불변.
