/**
 * UIScreenRegistry.ts - UI 에디터 10개 핵심 화면 및 컴포넌트 메타데이터 레지스트리
 */

export interface UIElementMeta {
  readonly id: string;
  readonly label: string;
  readonly defaultRect?: { x: number; y: number; width: number; height: number };
}

export interface ScreenDefinition {
  readonly id: string;
  readonly label: string;
  readonly elements: readonly UIElementMeta[];
}

export const SCREEN_DEFINITIONS: readonly ScreenDefinition[] = Object.freeze([
  {
    id: "menu_main",
    label: "1. 메인 홈 메뉴",
    elements: Object.freeze([
      { id: "card-story", label: "스토리 모드 카드", defaultRect: { x: 90, y: 350, width: 420, height: 260 } },
      { id: "card-play", label: "일반 플레이 카드", defaultRect: { x: 570, y: 350, width: 420, height: 260 } },
      { id: "card-records", label: "기록 모드 카드", defaultRect: { x: 90, y: 640, width: 420, height: 260 } },
      { id: "card-settings", label: "환경 설정 카드", defaultRect: { x: 570, y: 640, width: 420, height: 260 } },
      { id: "card-credits", label: "크레딧 카드", defaultRect: { x: 330, y: 930, width: 420, height: 260 } },
    ]),
  },
  {
    id: "menu_sub",
    label: "2. 서브 메뉴 (챕터 상세)",
    elements: Object.freeze([
      { id: "sub-header", label: "챕터 헤더 & 보스 정보", defaultRect: { x: 60, y: 120, width: 960, height: 180 } },
      { id: "sub-cell-1", label: "서브레벨 1 슬롯", defaultRect: { x: 80, y: 360, width: 440, height: 220 } },
      { id: "sub-cell-2", label: "서브레벨 2 슬롯", defaultRect: { x: 560, y: 360, width: 440, height: 220 } },
      { id: "sub-cell-3", label: "서브레벨 3 슬롯", defaultRect: { x: 80, y: 610, width: 440, height: 220 } },
      { id: "sub-cell-4", label: "서브레벨 4 슬롯", defaultRect: { x: 560, y: 610, width: 440, height: 220 } },
      { id: "sub-cell-5", label: "서브레벨 5 슬롯", defaultRect: { x: 80, y: 860, width: 440, height: 220 } },
      { id: "sub-cell-6", label: "서브레벨 6 슬롯", defaultRect: { x: 560, y: 860, width: 440, height: 220 } },
      { id: "sub-back-btn", label: "뒤로가기 버튼", defaultRect: { x: 60, y: 1120, width: 240, height: 80 } },
    ]),
  },
  {
    id: "settings",
    label: "3. 옵션 / 설정 메뉴",
    elements: Object.freeze([
      { id: "settings-dialog", label: "설정 창 본체", defaultRect: { x: 140, y: 240, width: 800, height: 1000 } },
      { id: "settings-sound-slider", label: "사운드 음량 슬라이더", defaultRect: { x: 200, y: 400, width: 680, height: 60 } },
      { id: "settings-sensitivity", label: "모션 감도 조절기", defaultRect: { x: 200, y: 520, width: 680, height: 60 } },
      { id: "settings-calibration-btn", label: "신체 캘리브레이션 버튼", defaultRect: { x: 200, y: 660, width: 680, height: 80 } },
      { id: "settings-close-btn", label: "설정 닫기 버튼", defaultRect: { x: 380, y: 1100, width: 320, height: 80 } },
    ]),
  },
  {
    id: "pause",
    label: "4. 일시정지 메뉴",
    elements: Object.freeze([
      { id: "pause-dialog", label: "일시정지 창 본체", defaultRect: { x: 180, y: 360, width: 720, height: 760 } },
      { id: "pause-resume-btn", label: "계속하기 버튼", defaultRect: { x: 260, y: 560, width: 560, height: 90 } },
      { id: "pause-exit-btn", label: "메인으로 나가기 버튼", defaultRect: { x: 260, y: 700, width: 560, height: 90 } },
    ]),
  },
  {
    id: "ready_position",
    label: "5. 플레이 준비 (신체 정렬)",
    elements: Object.freeze([
      { id: "ready-countdown", label: "카운트다운 숫자 (3..2..1)", defaultRect: { x: 440, y: 400, width: 200, height: 200 } },
      { id: "ready-silhouette", label: "신체 정렬 실루엣 가이드", defaultRect: { x: 240, y: 200, width: 600, height: 1200 } },
      { id: "ready-guide-text", label: "준비 자세 유도 문구", defaultRect: { x: 140, y: 1450, width: 800, height: 100 } },
    ]),
  },
  {
    id: "run_question",
    label: "6. 러닝 문제 페이즈",
    elements: Object.freeze([
      { id: "run-track", label: "8박 비트 러닝 트랙", defaultRect: { x: 90, y: 600, width: 900, height: 600 } },
      { id: "run-question-box", label: "수학 문제 수식 박스", defaultRect: { x: 140, y: 240, width: 800, height: 180 } },
      { id: "run-mana-gauge", label: "수호신 마나 게이지", defaultRect: { x: 90, y: 1300, width: 900, height: 50 } },
    ]),
  },
  {
    id: "answer_select",
    label: "7. 답변 선택 페이즈",
    elements: Object.freeze([
      { id: "answer-choice-1", label: "1번 답안 버튼", defaultRect: { x: 43, y: 890, width: 281, height: 250 } },
      { id: "answer-choice-2", label: "2번 답안 버튼", defaultRect: { x: 756, y: 890, width: 281, height: 250 } },
      { id: "answer-zone-anchors", label: "피트니스 존 타깃 앵커", defaultRect: { x: 43, y: 518, width: 994, height: 622 } },
    ]),
  },
  {
    id: "hazard_evade",
    label: "8. 오답 / 위험 회피 페이즈",
    elements: Object.freeze([
      { id: "hazard-overlay", label: "위험 장판 경고 오버레이", defaultRect: { x: 90, y: 650, width: 900, height: 500 } },
      { id: "hazard-timer", label: "회피 카운트다운 타이머", defaultRect: { x: 240, y: 300, width: 600, height: 60 } },
      { id: "hazard-warning-frame", label: "피격 위험 붉은 테두리", defaultRect: { x: 20, y: 20, width: 1040, height: 2120 } },
    ]),
  },
  {
    id: "boss_climax",
    label: "9. 보스 결전 페이즈",
    elements: Object.freeze([
      { id: "hud-player-hp-bar", label: "플레이어 HP 바", defaultRect: { x: 20, y: 20, width: 320, height: 32 } },
      { id: "hud-boss-hp-bar", label: "보스 대형 HP 바", defaultRect: { x: 740, y: 20, width: 320, height: 32 } },
      { id: "hud-combo", label: "콤보 표시기", defaultRect: { x: 540, y: 120, width: 200, height: 60 } },
      { id: "hud-boss-name", label: "보스 명칭 텍스트", defaultRect: { x: 740, y: 60, width: 320, height: 30 } },
      { id: "hud-combo-badge", label: "콤보 뱃지", defaultRect: { x: 896, y: 48, width: 160, height: 48 } },
    ]),
  },
  {
    id: "result",
    label: "10. 결과 정산 페이즈",
    elements: Object.freeze([
      { id: "result-grade-badge", label: "클리어 등급 배지", defaultRect: { x: 390, y: 240, width: 300, height: 300 } },
      { id: "result-calorie-box", label: "소비 칼로리 박스", defaultRect: { x: 140, y: 600, width: 800, height: 160 } },
      { id: "result-accuracy-stats", label: "정답률 통계 박스", defaultRect: { x: 140, y: 800, width: 800, height: 200 } },
      { id: "result-stardust-count", label: "획득 별빛(Stardust)", defaultRect: { x: 140, y: 1040, width: 800, height: 140 } },
      { id: "result-confirm-btn", label: "확인 / 다음 버튼", defaultRect: { x: 340, y: 1240, width: 400, height: 100 } },
    ]),
  },
]);

export function getScreenRegistry(): readonly ScreenDefinition[] {
  return SCREEN_DEFINITIONS;
}

export function getScreenElements(screenId: string): readonly UIElementMeta[] {
  const found = SCREEN_DEFINITIONS.find((s) => s.id === screenId);
  if (!found) {
    throw new Error(`UNKNOWN_SCREEN: 알 수 없는 화면 ID입니다: ${screenId}`);
  }
  return found.elements;
}
