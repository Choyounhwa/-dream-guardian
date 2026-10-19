/**
 * dev-ui.config.ts - 인게임 UI 개발 패널 설정 (개발 전용)
 *
 * [DEVUI-006] (Issue #566)
 * - DEV_UI_SECTION_MAP: 화면(GameState) → 패널에서 펼칠 UI_LAYOUT 최상위 섹션.
 *   LAYOUT 카드가 UI_LAYOUT 에 새 섹션을 추가하면 여기에 매핑을 1줄 추가한다.
 * - DEV_UI_LOCKED_LAYOUT_PATHS: UI_LAYOUT 안에서 읽기 전용으로 둘 경로 ('*' = 한 단계 와일드카드).
 * - getDevUiLockedSources(): 판정 연동 좌표(피트니스 존 1~11, 예약 밴드, 바닥 판정선, 회피 레인).
 *   판정 좌표 잠금 정책(2026-10-11)에 따라 값 복사본만 제공하며 패널은 읽기 전용으로만 표시한다.
 */

import { DEFAULT_FITNESS_ZONES, RESERVED_BANDS } from './zone.config.js';
import {
  DEFAULT_STRIKE_LINE_Y_RATIO,
  DEFAULT_MAT_BASE_Y_TOP,
  DEFAULT_MAT_BASE_Y_BOTTOM,
  DEFAULT_ZONE_LANE_X_RATIOS,
  DEFAULT_LANE_SLOT_OFFSETS,
} from './running-mat.config.js';

export const DEV_UI_SECTION_MAP: Readonly<Record<string, readonly string[]>> = {
  MENU_MAIN: ['menu', 'bottomBar', 'settings', 'pause'],
  MENU_SUB: ['subMenu', 'bottomBar', 'settings'],
  STORY_INTRO: ['bottomBar'],
  READY_POSITION: ['hud', 'bottomBar', 'pause'],
  RUN_QUESTION: ['hud', 'bottomBar', 'pause'],
  ANSWER_SELECT: ['hud', 'bottomBar', 'pause'],
  STAR_COLLECT: ['hud', 'bottomBar', 'pause'],
  HAZARD_EVADE: ['hud', 'bottomBar', 'pause'],
  ROUND_RESOLVE: ['hud', 'bottomBar', 'pause'],
  BOSS_CLIMAX: ['hud', 'bottomBar', 'pause'],
  RESULT: ['result', 'bottomBar'],
  GAMEOVER: ['result', 'bottomBar'],
};

export const DEV_UI_LOCKED_LAYOUT_PATHS: readonly string[] = [
  // 챕터 번호는 좌표가 아닌 식별자
  'menu.chapterCards.*.chapter',
];

/** '*' 는 한 단계 와일드카드. 패턴이 경로의 접두(세그먼트 단위)와 일치하면 잠금 */
export function isLockedPath(path: string, patterns: readonly string[]): boolean {
  const segs = path.split('.');
  return patterns.some((pattern) => {
    const ps = pattern.split('.');
    if (ps.length > segs.length) return false;
    return ps.every((p, i) => p === '*' || p === segs[i]);
  });
}

export interface DevUiLockedSource {
  id: string;
  title: string;
  values: Record<string, number>;
}

/** 판정 연동 좌표 값 복사본 (원본 config 는 수정되지 않는다) */
export function getDevUiLockedSources(): DevUiLockedSource[] {
  const zones: Record<string, number> = {};
  for (const z of DEFAULT_FITNESS_ZONES) {
    zones[`zone${z.id}.x`] = z.x;
    zones[`zone${z.id}.y`] = z.y;
    zones[`zone${z.id}.width`] = z.width;
    zones[`zone${z.id}.height`] = z.height;
  }
  const bands: Record<string, number> = {};
  for (const [name, b] of Object.entries(RESERVED_BANDS)) {
    bands[`${name}.x`] = b.x;
    bands[`${name}.y`] = b.y;
    bands[`${name}.width`] = b.width;
    bands[`${name}.height`] = b.height;
  }
  return [
    { id: 'fitnessZones', title: '피트니스 존 1~11 (비율)', values: zones },
    { id: 'reservedBands', title: '예약 밴드 (비율)', values: bands },
    {
      id: 'floorLine',
      title: '바닥 판정선 (비율)',
      values: {
        strikeLineY: DEFAULT_STRIKE_LINE_Y_RATIO,
        matBaseYTop: DEFAULT_MAT_BASE_Y_TOP,
        matBaseYBottom: DEFAULT_MAT_BASE_Y_BOTTOM,
      },
    },
    {
      id: 'laneX',
      title: '회피 레인 (비율)',
      values: {
        'zoneLaneX.left': DEFAULT_ZONE_LANE_X_RATIOS.left,
        'zoneLaneX.center': DEFAULT_ZONE_LANE_X_RATIOS.center,
        'zoneLaneX.right': DEFAULT_ZONE_LANE_X_RATIOS.right,
        'laneSlot.left': DEFAULT_LANE_SLOT_OFFSETS.left,
        'laneSlot.center': DEFAULT_LANE_SLOT_OFFSETS.center,
        'laneSlot.right': DEFAULT_LANE_SLOT_OFFSETS.right,
      },
    },
  ];
}
