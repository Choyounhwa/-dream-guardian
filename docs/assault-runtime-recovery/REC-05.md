[BOSS-ASSAULT-REC-05]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/594 | 직접 선행: REC-00 #588 읽기 조합식 승인. 개별 승인 필수.
제목: 읽기 시간 입력·소비 계약 복구
목적: 적격성 minReadSeconds와 유형·길이·추정 TTS 시간을 실제 라운드 생각 구간에 반영한다.
수정 대상:
- `dream_guardian/src/game/assault/AssaultRoundController.ts` (Game, src/config 1개).
구현 내용:
- question/options의 읽기 메타데이터 포트를 명시하고 REC-00 승인 조합식으로 유형하한·길이가산 결과·상한 있는 추정TTS를 소비한다. 중복 가산 금지.
- readable부터 최소8개의 완전 활성박을 확보하고 필요시간 이상인 다음 박자 경계에서 시작한다. throw 시간 제외.
- TTS는 문제당1회 요청만 하며 status/onEnd/실제 낭독 완료를 기다리지 않는다. 실패/비활성에도 유한 진행.
유지 사항: #503 시간 기반 비대기 정책·기존 config 수치, 순수 Game/외부 활성시계.
변경 금지: Question/Core/config 수정, DOM·setTimeout·새 시계, TTS 지연을 무한 대기 조건으로 사용.
완료 조건:
- [ ] 긴문장/유형/레벨/고BPM fixture가 승인 하한과8박을 만족하고 투척시간은 제외한다.
- [ ] 숨김·pause·긴정지에서 입력된 활성시간이 동결되면 읽기시간 소급완료0.
- [ ] TTS 실패·비활성·장시간 발화 모두 정해진 시간으로 진행, 요청1회.
테스트: `dream_guardian/tests/unit/assault-recovery-reading.test.ts` 신규. Baseline→현 minRead 소비 누락·조합/박자경계 Red→최소구현 Green→전체 npm test100%Pass/build. 실제 숨김 배선은 REC-09/25에서 따로 검증.
관련 파일: DOC-14 §5/§15 B3,C1; DOC-16; Eligibility.calculateMinReadSeconds; assault.config (읽기 전용).
선행 카드: REC-00 읽기 조합식 승인. 상태: OPEN / 정책 및 개별 구현 승인 대기.
위험 방지: 기존 숫자를 승인값으로 단정하지 않고 승인 출처 불명 시 중단. 타 레이어 필요 시 분리.
관리: 실제 완료 후 gh issue comment(변경파일/실제TDD/전체100%Pass/build/조건), HANDOVER, Rule13 npm run dev/http://localhost:3000/. 현재 실행/커밋/푸시 금지·NEXT 불변. DOC-16 공통 계약 적용.
