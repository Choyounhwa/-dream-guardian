[BOSS-ASSAULT-REC-09]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/606 | 직접 선행: REC-07 #604, REC-08 #595, REC-26 #614. 안전 수치 변경은 REC-00 #588 승인 추가 필수.
제목: 정지·숨김·추적 안전 라우팅 검증·복구
목적: 이미 있는 모드가드를 보존하고 clock 동결과 실제 Game pause/resume·입력 폐기를 연결한다.
수정 대상:
- `dream_guardian/src/core/AppBootstrap.ts`
- `dream_guardian/src/core/SceneDirector.ts`
- `dream_guardian/src/core/AssaultSessionFactory.ts` (Core, src/config3개).
구현 내용:
- UI/Esc pause·visibilitychange·추적상실/복구·긴정지를 clock/현재round의 pause/resume 포트에 일관 전달한다. clock 동결만으로 Game 입력이 남지 않게 한다.
- 추적 재준비가 끝나기 전 카메라 의사타격 차단; fallback은 카메라 추적 여부로 정지시키지 않는다. 이미 존재하는 리스너/모드가드를 중복 등록하지 않는다.
- 접근전 ownership 밖 jump/step 소비0, 양팔가드 경로와 직립/standGeneration 전달을 검증한다. low_hp TTS억제·X pause비활성·화면/Esc수단은 회귀 보존한다.
- 숨김/긴정지 wall time 소급 인정·복귀 입력 재사용·SFX 폭풍 재생0. 미승인 안전 수치는 REC-00 결정 전 변경 금지.
유지 사항: SceneDirector:554/615 기존 가드, legacy pause/voice/입력·공용루프.
변경 금지: Game/Input/Motion/Audio/UI/config 내부 수정, 무조건 카메라보정, 기본모드 전환.
완료 조건:
- [ ] 실제 pose/keyboard·UI pause/visibility 신호로 THINK/공격 동결·복귀1박·정지중입력폐기가 검증된다.
- [ ] A19/A24/A25/A26 충족 및 기존 legacy 모드가드 회귀0.
테스트: `dream_guardian/tests/unit/assault-recovery-safety-wiring.test.ts` 신규. Baseline→실제 Core 조립 신호 테스트 Red→최소구현 Green→전체 npm test100%Pass/build. 기존 가드 정상부분은 characterization으로 기록, 가짜Red 금지.
관련 파일: DOC-16; SceneDirector:554,615,661,893~909; Clock 공개상태 (읽기 전용).
선행 카드: REC-07, REC-08, REC-26; 안전임계값 변경 시 REC-00 승인 추가 필수. 상태: OPEN / 개별 구현 승인 대기.
위험 방지: Game 변경이 필요하면 REC-08 또는 별도 승인으로 분리. 타레이어/4번째파일 즉시 중단.
관리: DOC-16 공통 계약; 실제 완료 gh issue comment(TDD/전체100%Pass/build/조건/파일)·HANDOVER·Rule13 서버. 현재 실행/커밋/푸시 금지·NEXT 불변.
