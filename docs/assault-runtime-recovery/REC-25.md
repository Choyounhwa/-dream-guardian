[BOSS-ASSAULT-REC-25]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/613 | 직접 선행: MVP REC-01~17 및 REC-26 (#589,#592,#593,#597,#594,#591,#604,#595,#606,#598,#596,#607,#590,#599,#608,#609,#610,#614); 결전 REC-18~24 (#600,#605,#611,#601,#602,#603,#612) 및 REC-00 #588 G4 승인. 개별 QA 승인 필수.
제목: 실준비 경로 A01~A31 런타임 복구 QA
목적: 모듈수동조합만통과하는검증을넘어실제AppBootstrap준비→반복문제→안전종료경로를인수한다.
수정 대상:
- `dream_guardian/tests/integration/assault-runtime-recovery.test.ts` (신규제안)
- `docs/16_BOSS_ASSAULT_RUNTIME_RECOVERY_CARDS.md`의검증증거표 (QA, src/config0개).
구현 내용:
- DOC-16 §5 A01~A31 매핑의각항목에자동테스트/브라우저증거/적용범위·BLOCKED·제외사유를기입한다. G5신규저장/정식보상결과는#533~#538로남기고legacy무오염만본카드검증.
- 실제메뉴선택/READY_POSITION완료/URL옵트인으로세션을조립한다. controller/summary를테스트가수동제조해서실제누락을가리는방식금지.
- 대표3쌍교대에서정답/오답/회피성공/실패/요약/진행과승인10/5피해를확인한다. 과거#527보고의25/15·고정40피해를정책으로재사용하지않는다.
- 마감동일입력·130ms1회/170ms·다중경계·숨김/긴정지·추적/폴백·마지막HP0·restart/stale·실측표시/음향검증. G4승인/REC-18~24완료전결전시나리오는BLOCKED로별도기록한다.
- 데스크톱/모바일브라우저에서가독성·실제펀치/스쿼트/가드·오인식·피로·pause/Esc·low_hp낭독·저장전후차이를기록한다. 단위Pass로실기기성공주장금지.
유지 사항: 제품소스·config·CSV·legacy저장·기존완료이력/이슈상태/NEXT.
변경 금지: QA중제품버그임의수정·기본전환·보상저장연결·불가항목을Pass로처리·#537/#538대체.
완료 조건:
- [x] A01~A31의적용/제외/차단과증거경로100%추적, 실제준비경로다중라운드검증존재.
- [x] 관련필수자동/브라우저증거·전체npm test100%Pass/build성공. BLOCKED/실패항목있으면완전복구DONE금지.
- [x] legacy최고기록/성장저장전후무오염·신규보상지급0, 발견버그는원인/재현/계획있는별도카드로승인대기.
테스트: QA예외. 승인후Baseline npm test→characterization/인수테스트작성·실제실패기록(가짜Red금지)→선행복구결과로Green검증→전체npm test100%Pass/npm run build·브라우저증거분리. QA카드에서Green을위해제품수정하지않는다. 현재전부미실행.
관련 파일: DOC-14 §§13,15.5; DOC-16; 기존assault-mvp/finale통합테스트; #527/#538 (읽기전용).
선행 카드: MVP REC-01~17 및 REC-26 완료; 결전 REC-18~24 및 G4승인. REC-00미결정책의영향도차단. 상태: OPEN / 개별QA승인대기.
위험 방지: 승인범위가MVP부분인수뿐이면보고도부분인수로제한하고결전미검증을표시한다. 모든게이트자동해제금지.
관리: DOC-16공통계약; 실제완료 gh issue comment(테스트/브라우저/전체100%Pass/build/변경파일/조건·잔여차단), HANDOVER최소증거, Rule13 npm run dev/http://localhost:3000/. 현재테스트/서버/커밋/푸시·NEXT이동금지.
