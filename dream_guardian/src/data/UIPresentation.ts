/**
 * UIPresentation.ts - 실게임 10페이지 순수 UI 표시 계약 (Issue #431 / UI-VIS-001)
 *
 * 개발 규칙 준수:
 * - 1080x2160 해상도 기반 순수 표시 레이아웃
 * - 10개 정식 페이지 ID 및 안정적 element ID/action ID 체계
 * - 11개 피트니스 존, 바닥 판정선, 신체 정렬 영역 등 보호 레이아웃 명시
 * - 닫힌 속성 허용목록 및 읽기 전용 dynamic fixture 바인딩 정의
 */

export const UI_PRESENTATION_ARTIFACT_KIND = 'dream-guardian-ui-presentation' as const;
export const UI_PRESENTATION_VERSION = '1.0.0' as const;

export const UI_DESIGN_CANVAS = Object.freeze({
  width: 1080,
  height: 2160,
});

export const UI_PRESENTATION_PAGE_IDS = [
  'main_home',
  'submenu',
  'options',
  'pause',
  'play_ready',
  'running_question',
  'answer_select',
  'hazard_evade',
  'boss_battle',
  'result',
] as const;

export type UIPresentationPageId = (typeof UI_PRESENTATION_PAGE_IDS)[number];

export const ALLOWED_ELEMENT_TYPES = ['text', 'image', 'button', 'container'] as const;
export type UIPresentationElementType = (typeof ALLOWED_ELEMENT_TYPES)[number];

export const ALLOWED_ACTION_IDS = [
  'nav_story',
  'nav_play',
  'nav_records',
  'nav_settings',
  'nav_credits',
  'nav_workout',
  'select_chapter_1',
  'select_chapter_2',
  'select_chapter_3',
  'select_chapter_4',
  'select_chapter_5',
  'close_submenu',
  'open_settings',
  'close_settings',
  'pause_resume',
  'pause_quit',
  'ready_start',
  'answer_select_0',
  'answer_select_1',
  'result_retry',
  'result_menu',
] as const;

export type UIActionId = (typeof ALLOWED_ACTION_IDS)[number];

export const DYNAMIC_FIXTURE_BINDINGS = [
  'preview_question_text',
  'preview_timer',
  'preview_combo',
  'preview_score',
  'preview_player_hp',
  'preview_boss_hp',
  'preview_answer_0_text',
  'preview_answer_1_text',
  'preview_accuracy',
  'preview_rank',
] as const;

export type UIDynamicFixtureBinding = (typeof DYNAMIC_FIXTURE_BINDINGS)[number];

export interface UIRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UIPresentationElement {
  id: string;
  name: string;
  type: UIPresentationElementType;
  bounds: UIRect;
  hitBounds?: UIRect;
  actionId?: UIActionId;
  text?: string;
  assetId?: string;
  fontSize?: number;
  dynamicBinding?: UIDynamicFixtureBinding;
  isProtected?: boolean;
}

export interface UIPresentationPage {
  pageId: UIPresentationPageId;
  elements: UIPresentationElement[];
}

export interface UIPresentationDocument {
  kind: typeof UI_PRESENTATION_ARTIFACT_KIND;
  version: typeof UI_PRESENTATION_VERSION;
  resolution: { width: number; height: number };
  pages: Record<UIPresentationPageId, UIPresentationPage>;
  manifest?: { assetIds: string[] };
}

export interface UIProtectedZone {
  id: string;
  name: string;
  bounds: UIRect;
  pageId?: UIPresentationPageId;
}

/**
 * 11개 피트니스 존 및 핵심 보호 영역 (1080x2160 절대 좌표)
 * - 11개 피트니스 존은 모션 상호작용이 일어나는 러닝/답안/위험/보스 페이지의 보호 영역
 */
export const DEFAULT_PROTECTED_ZONES: readonly UIProtectedZone[] = Object.freeze([
  // 11개 피트니스 존 (러닝·문제, 답안선택, 위험회피, 보스전)
  ...(['running_question', 'answer_select', 'hazard_evade', 'boss_battle'] as const).flatMap((pageId) => [
    { id: `zone_1_${pageId}`, name: '피트니스존 1 (좌상)', bounds: { x: 43, y: 86, width: 281, height: 346 }, pageId },
    { id: `zone_2_${pageId}`, name: '피트니스존 2 (상단)', bounds: { x: 400, y: 86, width: 281, height: 346 }, pageId },
    { id: `zone_3_${pageId}`, name: '피트니스존 3 (우상)', bounds: { x: 756, y: 86, width: 281, height: 346 }, pageId },
    { id: `zone_4_${pageId}`, name: '피트니스존 4 (좌)', bounds: { x: 43, y: 518, width: 281, height: 346 }, pageId },
    { id: `zone_5_${pageId}`, name: '피트니스존 5 (우)', bounds: { x: 756, y: 518, width: 281, height: 346 }, pageId },
    { id: `zone_6_${pageId}`, name: '피트니스존 6 (좌하)', bounds: { x: 43, y: 1253, width: 281, height: 346 }, pageId },
    { id: `zone_7_${pageId}`, name: '피트니스존 7 (중하)', bounds: { x: 400, y: 1253, width: 281, height: 346 }, pageId },
    { id: `zone_8_${pageId}`, name: '피트니스존 8 (우하)', bounds: { x: 756, y: 1253, width: 281, height: 346 }, pageId },
    { id: `zone_9_${pageId}`, name: '피트니스존 9 (좌저)', bounds: { x: 0, y: 1642, width: 360, height: 518 }, pageId },
    { id: `zone_10_${pageId}`, name: '피트니스존 10 (하단)', bounds: { x: 360, y: 1642, width: 360, height: 518 }, pageId },
    { id: `zone_11_${pageId}`, name: '피트니스존 11 (우저)', bounds: { x: 720, y: 1642, width: 360, height: 518 }, pageId },
  ]),

  // 바닥 판정선 (Strike Line - running_question, hazard_evade)
  {
    id: 'floor_strike_line_run',
    name: '바닥 판정 스트라이크 라인',
    bounds: { x: 130, y: 1845, width: 820, height: 35 },
    pageId: 'running_question',
  },
  {
    id: 'floor_strike_line_hazard',
    name: '바닥 판정 스트라이크 라인',
    bounds: { x: 130, y: 1845, width: 820, height: 35 },
    pageId: 'hazard_evade',
  },

  // 신체 정렬 구역 (Ready position alignment guide)
  {
    id: 'body_alignment_area',
    name: '신체 정렬 가이드 영역',
    bounds: { x: 240, y: 350, width: 600, height: 1350 },
    pageId: 'play_ready',
  },
]);

/**
 * 결정론적 기본 UI 표시 문서 팩토리
 */
export function createDefaultUIPresentationDocument(): UIPresentationDocument {
  const pages: Record<UIPresentationPageId, UIPresentationPage> = {
    main_home: {
      pageId: 'main_home',
      elements: [
        {
          id: 'home_title',
          name: '메인 타이틀',
          type: 'text',
          bounds: { x: 140, y: 220, width: 800, height: 120 },
          text: '꿈의 수호신 (Dream Guardian)',
          fontSize: 48,
        },
        {
          id: 'btn_story',
          name: '스토리 모드 버튼',
          type: 'button',
          bounds: { x: 140, y: 450, width: 800, height: 100 },
          hitBounds: { x: 140, y: 450, width: 800, height: 100 },
          actionId: 'nav_story',
          text: '스토리 모드',
        },
        {
          id: 'btn_play',
          name: '자유 모드 버튼',
          type: 'button',
          bounds: { x: 140, y: 580, width: 800, height: 100 },
          hitBounds: { x: 140, y: 580, width: 800, height: 100 },
          actionId: 'nav_play',
          text: '플레이 모드',
        },
      ],
    },
    submenu: {
      pageId: 'submenu',
      elements: [
        {
          id: 'sub_title',
          name: '챕터 선택 타이틀',
          type: 'text',
          bounds: { x: 140, y: 200, width: 800, height: 100 },
          text: '챕터를 선택하세요',
          fontSize: 40,
        },
        {
          id: 'btn_ch1',
          name: '챕터 1 버튼',
          type: 'button',
          bounds: { x: 140, y: 360, width: 800, height: 90 },
          hitBounds: { x: 140, y: 360, width: 800, height: 90 },
          actionId: 'select_chapter_1',
          text: 'Ch.1 포겟의 숲',
        },
        {
          id: 'btn_close_sub',
          name: '닫기 버튼',
          type: 'button',
          bounds: { x: 140, y: 1950, width: 800, height: 90 },
          hitBounds: { x: 140, y: 1950, width: 800, height: 90 },
          actionId: 'close_submenu',
          text: '뒤로가기',
        },
      ],
    },
    options: {
      pageId: 'options',
      elements: [
        {
          id: 'opt_title',
          name: '설정 모달 타이틀',
          type: 'text',
          bounds: { x: 200, y: 400, width: 680, height: 80 },
          text: '환경 설정',
          fontSize: 40,
        },
        {
          id: 'btn_opt_close',
          name: '설정 닫기 버튼',
          type: 'button',
          bounds: { x: 240, y: 1500, width: 600, height: 90 },
          hitBounds: { x: 240, y: 1500, width: 600, height: 90 },
          actionId: 'close_settings',
          text: '확인',
        },
      ],
    },
    pause: {
      pageId: 'pause',
      elements: [
        {
          id: 'pause_title',
          name: '일시정지 문구',
          type: 'text',
          bounds: { x: 200, y: 500, width: 680, height: 100 },
          text: '일시 정지',
          fontSize: 48,
        },
        {
          id: 'btn_pause_resume',
          name: '계속하기 버튼',
          type: 'button',
          bounds: { x: 240, y: 800, width: 600, height: 100 },
          hitBounds: { x: 240, y: 800, width: 600, height: 100 },
          actionId: 'pause_resume',
          text: '계속하기',
        },
        {
          id: 'btn_pause_quit',
          name: '나가기 버튼',
          type: 'button',
          bounds: { x: 240, y: 950, width: 600, height: 100 },
          hitBounds: { x: 240, y: 950, width: 600, height: 100 },
          actionId: 'pause_quit',
          text: '메인 메뉴로',
        },
      ],
    },
    play_ready: {
      pageId: 'play_ready',
      elements: [
        {
          id: 'ready_guide_text',
          name: '준비 안내 문구',
          type: 'text',
          bounds: { x: 140, y: 180, width: 800, height: 100 },
          text: '화면 중앙 실루엣에 맞춰 서주세요',
          fontSize: 36,
        },
      ],
    },
    running_question: {
      pageId: 'running_question',
      elements: [
        {
          id: 'run_header',
          name: '상단 HUD 러닝 영역',
          type: 'container',
          bounds: { x: 50, y: 20, width: 980, height: 60 },
        },
        {
          id: 'run_question_banner',
          name: '문제 텍스트 밴드',
          type: 'text',
          bounds: { x: 324, y: 518, width: 432, height: 346 },
          dynamicBinding: 'preview_question_text',
          text: '12 + 15 = ?',
          fontSize: 52,
        },
      ],
    },
    answer_select: {
      pageId: 'answer_select',
      elements: [
        {
          id: 'ans_btn_left',
          name: '답안 0 (좌측)',
          type: 'button',
          bounds: { x: 43, y: 890, width: 281, height: 250 },
          hitBounds: { x: 43, y: 890, width: 281, height: 250 },
          actionId: 'answer_select_0',
          dynamicBinding: 'preview_answer_0_text',
          text: '27',
        },
        {
          id: 'ans_btn_right',
          name: '답안 1 (우측)',
          type: 'button',
          bounds: { x: 756, y: 890, width: 281, height: 250 },
          hitBounds: { x: 756, y: 890, width: 281, height: 250 },
          actionId: 'answer_select_1',
          dynamicBinding: 'preview_answer_1_text',
          text: '25',
        },
      ],
    },
    hazard_evade: {
      pageId: 'hazard_evade',
      elements: [
        {
          id: 'hazard_warning',
          name: '경고 알림',
          type: 'text',
          bounds: { x: 324, y: 518, width: 432, height: 100 },
          text: '위험! 장판을 회피하세요!',
          fontSize: 40,
        },
      ],
    },
    boss_battle: {
      pageId: 'boss_battle',
      elements: [
        {
          id: 'boss_hud',
          name: '보스 HUD 컨테이너',
          type: 'container',
          bounds: { x: 50, y: 20, width: 980, height: 60 },
        },
      ],
    },
    result: {
      pageId: 'result',
      elements: [
        {
          id: 'res_title',
          name: '결과 타이틀',
          type: 'text',
          bounds: { x: 140, y: 250, width: 800, height: 120 },
          text: '스테이지 완료!',
          fontSize: 56,
        },
        {
          id: 'btn_res_retry',
          name: '다시하기 버튼',
          type: 'button',
          bounds: { x: 140, y: 1700, width: 380, height: 110 },
          hitBounds: { x: 140, y: 1700, width: 380, height: 110 },
          actionId: 'result_retry',
          text: '다시 도전',
        },
        {
          id: 'btn_res_menu',
          name: '메뉴로 버튼',
          type: 'button',
          bounds: { x: 560, y: 1700, width: 380, height: 110 },
          hitBounds: { x: 560, y: 1700, width: 380, height: 110 },
          actionId: 'result_menu',
          text: '메인 메뉴',
        },
      ],
    },
  };

  return {
    kind: UI_PRESENTATION_ARTIFACT_KIND,
    version: UI_PRESENTATION_VERSION,
    resolution: { width: UI_DESIGN_CANVAS.width, height: UI_DESIGN_CANVAS.height },
    pages,
    manifest: { assetIds: [] },
  };
}
