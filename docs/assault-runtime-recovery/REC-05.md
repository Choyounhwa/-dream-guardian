[BOSS-ASSAULT-REC-05]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/594 | 직접 선행: REC-00 #588. 상태: DONE (구현 완료).
제목: 읽기 시간 입력·소비 계약 복구
목적: 적격성 minReadSeconds와 유형·길이·추정 TTS 시간을 실제 라운드 생각 구간에 반영한다.
수정 대상:
- `dream_guardian/src/game/assault/AssaultRoundController.ts` (Game, src/config 1개).
구현 내용:
- question/options의 읽기 메타데이터 포트(`minReadSeconds`, `type`, `level`)를 명시하고 REC-00 승인 조합식(Additive: 유형하한 + 글자수당 추정TTS 상한 클램프 + minReadSeconds 누적 결합) 구현.
- readable부터 최소 8개의 완전 활성박(minRoundBeats)을 보장하고 필요시간 이상인 다음 박자 경계(Beat Boundary)로 올림 정렬. 투척 시간(throwDurationSeconds)은 온전히 제외.
- TTS는 문제당 최초 update 시 1회 비대기(Non-waiting) 요청하며, 실제 낭독 완료를 기다리지 않고 유한한 시간 진행 보장.
유지 사항: #503 시간 기반 비대기 정책·기존 config 수치, 순수 Game/외부 활성시계.
변경 금지: Question/Core/config 수정, DOM·setTimeout·새 시계, TTS 지연을 무한 대기 조건으로 사용.
완료 조건:
- [x] 긴문장/유형/레벨/고BPM fixture가 승인 하한과 8박을 만족하고 투척시간은 제외한다.
- [x] 숨김·pause·긴정지에서 입력된 활성시간이 동결되면 읽기시간 소급완료0.
- [x] TTS 실패·비활성·장시간 발화 모두 정해진 시간으로 진행, 요청1회.
테스트: `dream_guardian/tests/unit/assault-recovery-reading.test.ts` 신규 (8개 테스트 100% Pass, 전체 슈트 회귀 100% Pass, npm run build 성공).
관련 파일: DOC-14 §5/§15 B3,C1; DOC-16; Eligibility.calculateMinReadSeconds; assault.config (읽기 전용).
선행 카드: REC-00 읽기 조합식 승인. 상태: DONE / 구현 및 검증 완료.
위험 방지: 단일 Game 레이어 파일(`AssaultRoundController.ts`)만 수정하여 경계 준수.
관리: DOC-16 공통 계약 적용. gh issue comment 및 Rule13 안내 완료.
