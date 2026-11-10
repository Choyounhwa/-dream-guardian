[BOSS-ASSAULT-REC-13]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/590 | 직접 선행: #504 타입 계약 이력 참고. 개별 승인 필수.
제목: 읽기 전용 접근전 표시 타입 계약
목적: Game 표시 결과와 렌더러 입력의 누락을 additive DTO 계약으로 고정한다.
수정 대상:
- `dream_guardian/src/types/assault.ts` (Types, src/config1개).
구현 내용:
- 기존 RoundPresentation의 호환성을 보존하면서 pairId/attackId/좌우라벨/선택잠금/쌍취소·비행·도착/회피 상태·throwProgress 등 읽기전용 표시 필드를 정의한다.
- 판단용 correctSide/정답플래그·HP권위를 표시DTO로 누출하지 않는다. 이미 존재하는 Render pair/squat 형태와 구조적 호환을 확인하되 renderer import로 타입 소유권을 뒤집지 않는다.
- 선택/도착/유예deadline의 표시시간 의미·round상대단위를 명시한다. 런타임 함수나 기본수치 없음.
유지 사항: 기존 MotionNote·Assault DTO 소비자 호환과 readonly계약.
변경 금지: Game/Core/Render/UI 구현·상수·판정/HP복사·필수필드 추가로 기존소비자 파괴.
완료 조건:
- [ ] 정상 DTO 및 기존 코드 컴파일, 중첩쓰기/식별자누락/정답노출을 부정타입테스트로 거부한다.
- [ ] 상태취소/도착/회피를 명확히 표현하며 표시DTO에 함수·default없음.
테스트: `dream_guardian/tests/unit/assault-recovery-presentation-types.test.ts` 신규. Baseline→실제 타입검사에 포함되는 부정 fixture Red→최소타입 Green→전체 npm test100%Pass/npm run build. Vitest만으로 타입검사 통과 주장 금지; 빌드설정 수정 필요하면 중단.
관련 파일: DOC-16; assault.ts:180~191; AssaultPairPainter/AssaultSceneRenderer/AssaultHUD 포트 (읽기 전용).
선행 카드: #504 타입계약 이력. 상태: OPEN / 개별 구현 승인 대기.
위험 방지: 타입과 Game을 같은턴/카드로 수정하지 않는다. 단일Types 밖 변경 필요 시 분리.
관리: DOC-16 공통 계약; 실제 완료 gh issue comment(타입Red/Green·전체100%Pass/build/파일/조건)·HANDOVER·Rule13 서버. 현재 실행/커밋/푸시 금지·NEXT 불변.
