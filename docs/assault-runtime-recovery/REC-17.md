[BOSS-ASSAULT-REC-17]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/610 | 직접 선행: REC-09 #606, REC-12 #607, REC-16 #609. 개별 승인 필수.
제목: 종료·재시작 자원 수명 검증·복구
목적: raw dispose와 App wrapper 종료 사이에 stale토큰/구독/입력/표시가 남는지 검증한다.
수정 대상:
- `dream_guardian/src/core/AssaultSessionFactory.ts`
- `dream_guardian/src/core/AppBootstrap.ts`
- `dream_guardian/src/core/SessionLifecycle.ts` (Core, src/config3개).
구현 내용:
- raw.dispose(clock.reset만 수행)와 wrapper.dispose의 실제 정리범위를 계측한다. 활성round abort·pending명령/입력·note상태·adapter/SFX/HUD상태·session token을 기존공개포트로 정리한다.
- 메뉴/게임오버/결과/재시작/앱dispose의 소유자를 명확히 하고 리스너/구독을 각 소유자에서 정확히 해제한다. 전역앱 리스너를 세션마다 중복등록하지 않는다.
- 종료후 이전round callback/async 입력·의도·receipt는 무시하고 새세션의HP/진행/저장에 영향0. restart 옵션/선택범위가 stale상태로 섞이지 않게 한다.
유지 사항: 새세션 정상초기화·legacy저장무오염·공용카메라/엔진 수명·완료이력.
변경 금지: Input/Motion/Game/Audio 내부수정, private 필드 무단청소·git reset --hard·다른트랙작업 삭제.
완료 조건:
- [ ] 실제 메뉴왕복/재시작 반복 후 이전토큰·pending입력/콜백의효과0, 리스너/구독수 증가0.
- [ ] dispose 중복호출 안전·종료1·새세션상태독립·정상활성구독유지.
테스트: `dream_guardian/tests/unit/assault-recovery-lifecycle.test.ts` 신규. Baseline→구독수spy/이전토큰/메뉴·restart·dispose반복 Red(가설재현시)→최소구현 Green→전체 npm test100%Pass/build. 미재현이면 정상증거만 제출·임의수정금지.
관련 파일: DOC-16; Factory:392~395; AppBootstrap:534~540,821~837,3383~3394; 기존공개reset/dispose 포트 (읽기 전용).
선행 카드: REC-09,12,16. 상태: OPEN / 개별 구현 승인 대기.
위험 방지: adapter 공개정리API가 부족하면 별도도메인카드 필요, private우회로 범위 확대금지.
관리: DOC-16 공통 계약; 실제 완료 gh issue comment(TDD/전체100%Pass/build/파일/조건), HANDOVER/Rule13 서버. 현재 실행/커밋/푸시 금지·NEXT 불변.
