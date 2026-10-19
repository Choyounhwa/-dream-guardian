[BOSS-ASSAULT-REC-08]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/595 | 직접 선행: REC-06 #591. 개별 승인 필수.
제목: 공격 재개 준비박 판정 차단 검증·복구
목적: 예고 재시작+1박 준비 계약이 단순 도착시간 연장 아닌 실제 입력 차단으로 동작하게 한다.
수정 대상:
- `dream_guardian/src/game/assault/AssaultRoundController.ts` (Game, src/config1개).
구현 내용:
- 현 resume()의 startSeconds/판정기창을 검증하여 준비1박 동안 입력/만료/피해0을 보장한다. 미해결 공격은 예고부터 재시작한다.
- pause중 pending입력은 폐기하고 이미 확정·적용된 결과/공격은 재시작·재정산하지 않는다. THINK는 남은 활성시간 계속.
- 반복 pause/resume 및 직전 경계에서 공격·후속스케줄을 보존하고 다른 손회수/직립 상태를 임의 준비로 만들지 않는다.
유지 사항: #503 DEC-B8 1박·실제 활성시각·이미 완료 공격·TTS문제당1회.
변경 금지: Core DOM/visibility 연결, config수치, Input/Motion reset, HP 변경.
완료 조건:
- [ ] 준비박 전/동일/직후 입력의 유효성 경계가 계약대로이며 준비 중 성공·피해0.
- [ ] 정답/오답확정/피해적용 후 pause 변형에서 기존 결과·receipt 중복0.
테스트: `dream_guardian/tests/unit/assault-recovery-resume.test.ts` 신규. Baseline→준비박 실제 판정/완료공격·THINK·반복정지 Red→최소구현 Green→전체 npm test100%Pass/build. 미재현이면 변경하지 않고 증거/계획 재검토.
관련 파일: DOC-14 §15 B8/A28; DOC-16; RoundController:381~425 (읽기 전용 근거).
선행 카드: REC-06. 상태: OPEN / 개별 구현 승인 대기.
위험 방지: 단순 시간을1박 늘려 입력은 즉시받는 우회 금지. 타레이어 필요 시 중단·분리.
관리: 실제 완료 gh issue comment(파일/실제TDD/전체100%Pass/build/조건), HANDOVER/Rule13 npm run dev/http://localhost:3000/. 현재 실행/커밋/푸시/NEXT 이동 금지. DOC-16 공통 계약 적용.
