[BOSS-ASSAULT-REC-12]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/607 | 직접 선행: REC-03 #593, REC-04 #597, REC-07 #604, REC-09 #606, REC-10 #598, REC-11 #596, REC-26 #614. 개별 승인 필수.
제목: 반복 라운드·진행 의도 Core 연결 복구
목적: 첫 문제에서 멈추지 않고 실제 요약으로 다음 라운드 또는 안전 종료/인계까지 진행한다.
수정 대상:
- `dream_guardian/src/core/AssaultSessionFactory.ts`
- `dream_guardian/src/core/AppBootstrap.ts` (Core, src/config2개).
구현 내용:
- onRoundComplete/요약 수신→progress evaluate를 연결하고 session범위 고유 roundId/attackId/pairId와 round-relative clock origin을 발급한다. 같은 콘텐츠 ID를 다음라운드 멱등키로 재사용하지 않는다.
- damage→death→summary→progress 순서로 한 번만 실행한다. completedQuestions와 hitCount를 분리하고 미완료/중단은 진행증가0.
- 다음문항1회·라운드 noteAdapter상태 초기화·원본계획불변을 보장하되 손회수/직립복귀를 강제reset해 자동타격을 허용하지 않는다.
- 최종라운드 HP0 즉시패배1회, 생존 목표도달이면 실측 인계snapshot만 보관한다. G4 미승인시 안전정지/종료이며 승리 위조0·추가문항0. finale 기본false 유지.
유지 사항: SessionLifecycle 종료권위·legacy기본·테스트세션 저장격리·기존 note규약.
변경 금지: Game/Question/config 내부변경, 목표10 하드코딩, 가짜완료통계·보상·자동G4 활성화.
완료 조건:
- [ ] 실제 준비경로로2라운드 이상 실행되어 고유ID·원점·요약·진행도가 일치한다.
- [ ] 완료당next1, 최종/HP0/인계후 추가생성0·종료1, stale 완료가 다음round를 전진시키지 않는다.
테스트: `dream_guardian/tests/unit/assault-recovery-progression.test.ts` 신규. Baseline→다중라운드·동일콘텐츠ID·최종HP0·중복콜백·회수유지 Red→최소구현 Green→전체 npm test100%Pass/build. 실측 운동량은 기존 tally API 재사용.
관련 파일: DOC-16; AppBootstrap.startAssaultPhase; ProgressController/NoteAdapter/ExerciseTally (읽기 전용).
선행 카드: REC-03,04,07,09,10,11,26. 상태: OPEN / 개별 구현 승인 대기.
위험 방지: Core가 집계공식을 복제하지 않고 Game 포트를 소비한다. 타레이어/4번째파일 필요 시 분리.
관리: DOC-16 공통 계약; 실제 완료 gh issue comment(실제TDD/전체100%Pass/build/파일/조건), HANDOVER/Rule13 서버. 현재 실행/커밋/푸시·NEXT 이동 금지.
