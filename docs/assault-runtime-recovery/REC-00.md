[BOSS-ASSAULT-REC-00]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/588 | 직접 선행: #503. 상태: DONE (정책 결정 완료).
제목: 잔여 정책·G4 승인 증거 결정
목적: 이번 등록에서 수행한 사실 대조를 재완료하지 않고, 아직 승인되지 않은 런타임 정책만 결정한다.
수정 대상:
- `docs/16_BOSS_ASSAULT_RUNTIME_RECOVERY_CARDS.md`의 미결 결정 원장 (문서 단일 책임, src/config 0개).
구현 내용:
- targetRounds Factory5/Progress10의 채택값·단일 config 소유자·기존 호출 호환 정책: 10라운드 채택, `assault.config.ts` 단일 SSOT, 호출 시 fallback 호환 확정.
- 8박/유형하한/문항 minReadSeconds/길이가산/상한 있는 추정TTS 조합식: 누적 가산 (Additive) 방식 채택.
- G4 결전 프로필·HP·피해·패턴/종료 정책: 별도 승인 증거 부재로 차단 유지 (BLOCKED) 확정. REC-18~24 착수 금지.
- 결전 피해 명령 typed 계약: G4 차단 유지에 따라 결정 보류 (BLOCKED 유지). G5 보상 역시 제외 유지.
유지 사항: #503 MVP 130ms/170ms·HP100·접근피해10/5 및 기존 문서·완료 이력·NEXT.
변경 금지: 제품 코드/테스트/config 수정·실행, 새 수치 임의 확정, 현재 등록 대조를 구현완료로 표기.
완료 조건:
- [x] 각 미결에 승인 증거 또는 BLOCKED와 영향 카드가 있다. 결정되지 않은 카드는 착수 불가.
- [x] G4 승인과 개별 구현 승인, G5 제외가 분리되어 있다. 정책 결정 결과는 사용자 검토를 받는다.
테스트: 문서 전용. TDD Red→Green·npm test/build 해당 없음/미실행. 승인 링크·단위·버전·상충 결정·부재 시 차단을 수동 검토한다. 허위 Pass 금지.
관련 파일: DOC-14 v0.3 §§5,10,15; DOC-15 §2; Factory:311; ProgressController:116; #503/#528~#532 (읽기 전용).
선행 카드: #503. 상태: DONE / 사용자 결정 완료.
위험 방지: G4 복구 REC-18~24는 차단 유지.
관리: DOC-16 공통 계약 적용. 실제 문서 결정 완료 시 해당 이슈에 변경 문서/수동 대조/미실행 항목을 `gh issue comment`로 기록하며 테스트100%Pass를 위조하지 않는다.
