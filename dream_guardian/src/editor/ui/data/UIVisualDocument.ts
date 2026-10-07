/**
 * UIVisualDocument.ts - 10페이지 편집 문서 저작 스키마 (Issue #432 / UI-VIS-002)
 *
 * 개발 규칙 준수:
 * - 1080x2160 해상도 기반 저작용 시각 문서
 * - 10개 정규 페이지, 안정 ID, 요소 계층/그룹 모델
 * - 잠금/편집가능 여부 및 렌더러 지원 여부(사유 포함) 명시
 * - 닫힌 속성 허용목록 및 리소스 참조 모델
 */

export const UI_VISUAL_DOCUMENT_KIND = 'dream-guardian-ui-visual-doc' as const;
export const UI_VISUAL_SCHEMA_VERSION = '1.0.0' as const;

export const UI_VISUAL_CANVAS = Object.freeze({
  width: 1080,
  height: 2160,
});

export const UI_VISUAL_PAGE_IDS = [
  'menu_main',
  'menu_sub',
  'settings',
  'pause',
  'ready_position',
  'run_question',
  'answer_select',
  'hazard_evade',
  'boss_climax',
  'result',
] as const;

export type UIVisualPageId = (typeof UI_VISUAL_PAGE_IDS)[number];

export const ALLOWED_VISUAL_ELEMENT_TYPES = ['text', 'image', 'button', 'container'] as const;
export type UIVisualElementType = (typeof ALLOWED_VISUAL_ELEMENT_TYPES)[number];

export interface UIRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UIVisualGroup {
  id: string;
  name: string;
  parentGroupId?: string;
}

export interface UIVisualElement {
  id: string;
  name: string;
  type: UIVisualElementType;
  bounds: UIRect;
  hitBounds?: UIRect;
  groupId?: string;
  actionId?: string;
  text?: string;
  assetId?: string;
  fontSize?: number;
  dynamicBinding?: string;
  isLocked?: boolean;
  lockReason?: string;
  isSupported?: boolean;
  unsupportedReason?: string;
}

export interface UIVisualPage {
  pageId: UIVisualPageId;
  name: string;
  elements: UIVisualElement[];
  groups?: UIVisualGroup[];
}

export interface UIVisualDocument {
  kind: typeof UI_VISUAL_DOCUMENT_KIND;
  schemaVersion: typeof UI_VISUAL_SCHEMA_VERSION;
  design: { width: number; height: number };
  pages: Record<UIVisualPageId, UIVisualPage>;
  resources?: { assetIds: string[] };
}

/**
 * 기본 UIVisualDocument 생성 팩토리 (10개 페이지 포함)
 */
export function createDefaultUIVisualDocument(): UIVisualDocument {
  const pages: Record<UIVisualPageId, UIVisualPage> = {
    menu_main: {
      pageId: 'menu_main',
      name: '메인 홈 메뉴',
      elements: [
        {
          id: 'card-story',
          name: '스토리 모드 카드',
          type: 'button',
          bounds: { x: 90, y: 350, width: 420, height: 260 },
          hitBounds: { x: 90, y: 350, width: 420, height: 260 },
          actionId: 'nav_story',
        },
        {
          id: 'card-play',
          name: '일반 플레이 카드',
          type: 'button',
          bounds: { x: 570, y: 350, width: 420, height: 260 },
          hitBounds: { x: 570, y: 350, width: 420, height: 260 },
          actionId: 'nav_play',
        },
        {
          id: 'card-records',
          name: '기록 모드 카드',
          type: 'button',
          bounds: { x: 90, y: 640, width: 420, height: 260 },
          hitBounds: { x: 90, y: 640, width: 420, height: 260 },
          actionId: 'nav_records',
        },
        {
          id: 'card-settings',
          name: '환경 설정 카드',
          type: 'button',
          bounds: { x: 570, y: 640, width: 420, height: 260 },
          hitBounds: { x: 570, y: 640, width: 420, height: 260 },
          actionId: 'nav_settings',
        },
        {
          id: 'card-credits',
          name: '크레딧 카드',
          type: 'button',
          bounds: { x: 330, y: 930, width: 420, height: 260 },
          hitBounds: { x: 330, y: 930, width: 420, height: 260 },
          actionId: 'nav_credits',
        },
        {
          id: 'menu-workout-btn',
          name: '운동 시작 버튼',
          type: 'button',
          bounds: { x: 140, y: 1800, width: 800, height: 120 },
          hitBounds: { x: 140, y: 1800, width: 800, height: 120 },
          actionId: 'nav_workout',
        },
      ],
      groups: [],
    },
    menu_sub: {
      pageId: 'menu_sub',
      name: '서브 메뉴 (챕터 선택)',
      elements: [
        {
          id: 'sub-header',
          name: '챕터 헤더 & 보스 정보',
          type: 'container',
          bounds: { x: 60, y: 120, width: 960, height: 180 },
        },
        {
          id: 'sub-cell-1',
          name: '서브레벨 1 슬롯',
          type: 'button',
          bounds: { x: 80, y: 360, width: 440, height: 220 },
          hitBounds: { x: 80, y: 360, width: 440, height: 220 },
          actionId: 'select_sublevel_1',
        },
        {
          id: 'sub-back-btn',
          name: '뒤로가기 버튼',
          type: 'button',
          bounds: { x: 60, y: 1950, width: 240, height: 80 },
          hitBounds: { x: 60, y: 1950, width: 240, height: 80 },
          actionId: 'close_submenu',
        },
      ],
      groups: [],
    },
    settings: {
      pageId: 'settings',
      name: '옵션 / 설정 메뉴',
      elements: [
        {
          id: 'settings-dialog',
          name: '설정 창 본체',
          type: 'container',
          bounds: { x: 140, y: 240, width: 800, height: 1000 },
        },
        {
          id: 'settings-close-btn',
          name: '설정 닫기 버튼',
          type: 'button',
          bounds: { x: 380, y: 1100, width: 320, height: 80 },
          hitBounds: { x: 380, y: 1100, width: 320, height: 80 },
          actionId: 'close_settings',
        },
      ],
      groups: [],
    },
    pause: {
      pageId: 'pause',
      name: '일시정지 메뉴',
      elements: [
        {
          id: 'pause-dialog',
          name: '일시정지 창 본체',
          type: 'container',
          bounds: { x: 180, y: 360, width: 720, height: 760 },
        },
        {
          id: 'pause-resume-btn',
          name: '계속하기 버튼',
          type: 'button',
          bounds: { x: 260, y: 560, width: 560, height: 90 },
          hitBounds: { x: 260, y: 560, width: 560, height: 90 },
          actionId: 'pause_resume',
        },
        {
          id: 'pause-exit-btn',
          name: '메인으로 나가기 버튼',
          type: 'button',
          bounds: { x: 260, y: 820, width: 560, height: 90 },
          hitBounds: { x: 260, y: 820, width: 560, height: 90 },
          actionId: 'pause_quit',
        },
      ],
      groups: [],
    },
    ready_position: {
      pageId: 'ready_position',
      name: '플레이 준비 (신체 정렬)',
      elements: [
        {
          id: 'ready-countdown',
          name: '카운트다운 숫자 (3..2..1)',
          type: 'text',
          bounds: { x: 440, y: 400, width: 200, height: 200 },
        },
        {
          id: 'ready-silhouette',
          name: '신체 정렬 실루엣 가이드',
          type: 'container',
          bounds: { x: 240, y: 200, width: 600, height: 1200 },
          isLocked: true,
          lockReason: '보호된 신체 정렬 구역',
        },
        {
          id: 'ready-guide-text',
          name: '준비 자세 유도 문구',
          type: 'text',
          bounds: { x: 140, y: 1450, width: 800, height: 100 },
        },
      ],
      groups: [],
    },
    run_question: {
      pageId: 'run_question',
      name: '러닝 문제 페이즈',
      elements: [
        {
          id: 'run-track',
          name: '8박 비트 러닝 트랙',
          type: 'container',
          bounds: { x: 90, y: 600, width: 900, height: 600 },
        },
        {
          id: 'run-question-box',
          name: '수학 문제 수식 박스',
          type: 'text',
          bounds: { x: 324, y: 518, width: 432, height: 180 },
          dynamicBinding: 'preview_question_text',
        },
        {
          id: 'run-mana-gauge',
          name: '수호신 마나 게이지',
          type: 'container',
          bounds: { x: 90, y: 1300, width: 900, height: 50 },
        },
      ],
      groups: [],
    },
    answer_select: {
      pageId: 'answer_select',
      name: '답변 선택 페이즈',
      elements: [
        {
          id: 'answer-choice-1',
          name: '1번 답안 버튼',
          type: 'button',
          bounds: { x: 43, y: 890, width: 281, height: 250 },
          hitBounds: { x: 43, y: 890, width: 281, height: 250 },
          actionId: 'answer_select_0',
          dynamicBinding: 'preview_answer_0_text',
        },
        {
          id: 'answer-choice-2',
          name: '2번 답안 버튼',
          type: 'button',
          bounds: { x: 756, y: 890, width: 281, height: 250 },
          hitBounds: { x: 756, y: 890, width: 281, height: 250 },
          actionId: 'answer_select_1',
          dynamicBinding: 'preview_answer_1_text',
        },
      ],
      groups: [],
    },
    hazard_evade: {
      pageId: 'hazard_evade',
      name: '오답 / 위험 회피 페이즈',
      elements: [
        {
          id: 'hazard-overlay',
          name: '위험 장판 경고 오버레이',
          type: 'container',
          bounds: { x: 324, y: 518, width: 432, height: 500 },
        },
        {
          id: 'hazard-timer',
          name: '회피 카운트다운 타이머',
          type: 'text',
          bounds: { x: 240, y: 300, width: 600, height: 60 },
        },
      ],
      groups: [],
    },
    boss_climax: {
      pageId: 'boss_climax',
      name: '보스 결전 페이즈',
      elements: [
        {
          id: 'hud-player-hp-bar',
          name: '플레이어 HP 바',
          type: 'container',
          bounds: { x: 20, y: 20, width: 320, height: 32 },
        },
        {
          id: 'hud-boss-hp-bar',
          name: '보스 대형 HP 바',
          type: 'container',
          bounds: { x: 740, y: 20, width: 320, height: 32 },
        },
      ],
      groups: [],
    },
    result: {
      pageId: 'result',
      name: '결과 정산 페이즈',
      elements: [
        {
          id: 'result-grade-badge',
          name: '클리어 등급 배지',
          type: 'container',
          bounds: { x: 390, y: 240, width: 300, height: 300 },
        },
        {
          id: 'result-confirm-btn',
          name: '확인 / 다음 버튼',
          type: 'button',
          bounds: { x: 340, y: 1240, width: 400, height: 100 },
          hitBounds: { x: 340, y: 1240, width: 400, height: 100 },
          actionId: 'result_menu',
        },
      ],
      groups: [],
    },
  };

  return {
    kind: UI_VISUAL_DOCUMENT_KIND,
    schemaVersion: UI_VISUAL_SCHEMA_VERSION,
    design: { width: UI_VISUAL_CANVAS.width, height: UI_VISUAL_CANVAS.height },
    pages,
    resources: { assetIds: [] },
  };
}
