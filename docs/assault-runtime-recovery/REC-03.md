[BOSS-ASSAULT-REC-03]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/593 | 직접 선행: REC-00 #588. 상태: DONE (구현 완료).
제목: 승인 목표 라운드 설정 단일화
목적: Factory5/Progress10 불일치를 정책 승인 후 데이터 단일 출처로 해소한다.
수정 대상:
- `dream_guardian/config/assault.config.ts` (Config, src/config 1개).
구현 내용:
- REC-00에서 승인한 목표 라운드 값(`targetRounds = 10`)을 `AssaultTimingAndBalanceConfig` 및 `DEFAULT_ASSAULT_CONFIG`에 readonly 설정으로 제공.
- 기존 타이밍/피해/프로필 설정을 온전히 보존하며 deepFreeze 불변성 보장.
유지 사항: #503 MVP HP100·피해10/5·8박 및 기존 config 값/불변성.
변경 금지: Core/Game 연결·조건함수·타이머·콘텐츠 순서·legacy DEFAULT_CONFIG 변경, 후보값 임의 채택.
완료 조건:
- [x] 승인 URL/버전/단위와 설정 값 일치, 단일 목표 데이터 필드가 존재한다.
- [x] 기존 profile/balance/readonly 계약 불변; 소비 코드를 이 카드에서 수정하지 않는다.
테스트: `dream_guardian/tests/unit/assault-recovery-target-config.test.ts` 신규 (4개 테스트 100% Pass, 전체 슈트 회귀 100% Pass, npm run build 성공).
관련 파일: DOC-16; Factory:311, ProgressController:116 (읽기 전용).
선행 카드: REC-00 목표 수 승인. 상태: DONE / 구현 및 검증 완료.
위험 방지: 단일 Config 레이어 파일(`assault.config.ts`)만 수정하여 경계 준수.
관리: DOC-16 공통 계약 적용. gh issue comment 및 Rule13 안내 완료.
