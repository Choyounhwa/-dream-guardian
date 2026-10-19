[BOSS-ASSAULT-REC-03]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/593 | 직접 선행: REC-00 #588 목표 수 승인. 개별 승인 필수.
제목: 승인 목표 라운드 설정 단일화
목적: Factory5/Progress10 불일치를 정책 승인 후 데이터 단일 출처로 해소한다.
수정 대상:
- `dream_guardian/config/assault.config.ts` (Config, src/config 1개).
구현 내용:
- REC-00에서 승인한 목표 라운드 값·단위·프로필 버전을 readonly 설정으로 제공한다. 10은 아직 확정값이 아니다.
- 기존 타이밍/피해 설정을 보존한다. 목표 수의 소비와 기존 클래스 기본값 처리는 REC-04에 맡긴다.
유지 사항: #503 MVP HP100·피해10/5·8박 및 기존 config 값/불변성.
변경 금지: Core/Game 연결·조건함수·타이머·콘텐츠 순서·legacy DEFAULT_CONFIG 변경, 후보값 임의 채택.
완료 조건:
- [ ] 승인 URL/버전/단위와 설정 값 일치, 단일 목표 데이터 필드가 존재한다.
- [ ] 기존 profile/balance/readonly 계약 불변; 소비 코드를 이 카드에서 수정하지 않는다.
테스트: `dream_guardian/tests/unit/assault-recovery-target-config.test.ts` 신규. Baseline→승인 데이터/양의 정수/불변성 계약 Red→최소 config Green→전체 npm test100%Pass/npm run build. runtime validator 추가 금지. 미결이면 실행 차단.
관련 파일: DOC-16; Factory:311, ProgressController:116 (읽기 전용).
선행 카드: REC-00 목표 수 승인. 상태: OPEN / 정책 차단 및 개별 구현 승인 대기.
위험 방지: 설정과 Core를 한 카드로 수정하지 않는다. 구현 수치를 정책 승인 증거로 역추론하지 않는다.
관리: DOC-16 공통 계약; 실제 완료 후 gh issue comment(실제 TDD/전체100%Pass/build/조건/파일), HANDOVER 및 Rule13 서버 안내. 현재 코드/테스트 실행·커밋/푸시·NEXT 이동 금지.
