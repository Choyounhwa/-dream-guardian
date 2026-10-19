[BOSS-ASSAULT-REC-18]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/600 | 직접 선행: REC-00 #588 G4 별도 승인 증거. G4 차단·개별 승인 필수.
제목: 결전 정산 명령 typed 계약 정합화
목적: damage 확장/as any와 기존 피해량없는 명령타입 충돌을 별도 Types 책임으로 해결한다.
수정 대상:
- `dream_guardian/src/types/assault.ts` (Types, src/config1개).
구현 내용:
- REC-00 승인된 결전 phase/profile/action 식별계약을 additive 판별유니온으로 표현한다. approach와finale 정산 의미를 구분해 명령이 임의수치를 권위로 주지 않게 한다.
- boss_damage 및 결전행동 의미의 승인범위만 타입으로 지원한다. legacy/접근전 명령호환·session/attack/effect 멱등키계약 유지.
- effect/target/action 잘못된조합·미승인프로필/종류·식별자누락을 부정타입 fixture로 검증한다. 값 검증/피해계산은 Game카드에 둔다.
유지 사항: 기존 타입소비자·불변DTO·단일HP·접근전보스HP불변.
변경 금지: Game/Core/config 구현·raw damage 무조건허용·새피버/보상/기본활성화.
완료 조건:
- [ ] 승인된결전명령만 표현되고 기존approach 컴파일호환·readonly 보존.
- [ ] as any 없이 승인효과/대상/행동을 구분하는 타입검사증거가 있다.
테스트: `dream_guardian/tests/unit/assault-recovery-finale-types.test.ts` 신규. 승인후 Baseline→실제부정타입 Red→최소타입 Green→전체 npm test100%Pass/build; Vitest만으로타입검사주장금지.
관련 파일: DOC-16; assault.ts:134~159; FinaleController:630~665/Settlement:87~140 (읽기 전용).
선행 카드: REC-00 **G4 수치·정산의미 승인URL 필수**. 상태: OPEN / G4 차단·개별 구현 승인 대기.
위험 방지: #528~#532 완료코멘트를 승인으로 간주하지 않는다. 타입확장과Game수정은별도.
관리: DOC-16 공통 계약; 실제 완료 gh issue comment(타입TDD/전체100%Pass/build/파일/조건)·HANDOVER·Rule13 서버. 현재 실행/커밋/푸시·NEXT 이동 금지.
