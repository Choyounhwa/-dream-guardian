/**
 * RunningMatTypes.ts - 러닝 매트 렌더러 및 기하 계산용 타입 및 상수 정의
 *
 * Issue #620 (REFACTOR-RENDER-002)
 */

import type { RunningMatViewModel } from '../RunningMatPresenter.js';
import type {
  UIPresentationDocument,
  UIPresentationPageId,
} from '../../data/UIPresentation.js';
import type { BaseSlotOverride } from '../../types/presentation.js';

export interface Point2D {
  x: number;
  y: number;
}

export interface RunningMatBounds {
  x: number;
  y: number;
  w: number;
  h: number;
  width: number;
  height: number;
  isProtected?: boolean;
}

export interface RunningMatSlotOverride extends BaseSlotOverride {
  backgroundColor?: string;
  glowWidth?: number;
}

export interface RunningMatPresentationContext {
  presentationDocument?: UIPresentationDocument;
  pageId?: UIPresentationPageId | string;
  matVisual?: RunningMatSlotOverride;
  strikeLine?: RunningMatSlotOverride;
  statusHeader?: RunningMatSlotOverride;
  upcomingPreview?: RunningMatSlotOverride;
  footprintSlots?: RunningMatSlotOverride;
  targetAnchors?: RunningMatSlotOverride;
  vanishingPoint?: { x?: number; y?: number } | RunningMatSlotOverride;
}

export const RUNNING_MAT_SLOT_IDS = [
  'matVisual',
  'strikeLine',
  'statusHeader',
  'upcomingPreview',
  'zone_9_mat_cell',
  'zone_10_mat_cell',
  'zone_11_mat_cell',
  'strike_line_geometry',
  'vanishing_point_geometry',
  'footprint_slot_left',
  'footprint_slot_center',
  'footprint_slot_right',
  'target_anchors',
] as const;

export const PROTECTED_RUNNING_MAT_SLOT_IDS = [
  'zone_9_mat_cell',
  'zone_10_mat_cell',
  'zone_11_mat_cell',
  'strike_line_geometry',
  'vanishing_point_geometry',
  'footprint_slot_left',
  'footprint_slot_center',
  'footprint_slot_right',
  'target_anchors',
] as const;

export type ProtectedRunningMatSlotId =
  (typeof PROTECTED_RUNNING_MAT_SLOT_IDS)[number];

export interface FootprintSlotCoords {
  left: Point2D;
  center: Point2D;
  right: Point2D;
  leftOut: Point2D;
  rightOut: Point2D;
  leftHome: Point2D;
  rightHome: Point2D;
  footWidth: number;
  footHeight: number;
}

export interface MatTrapezoid {
  vx: number;
  vy: number;
  yTop: number;
  yBottom: number;
  halfWTop: number;
  halfWBottom: number;
  scaleTop: number;
  topLeft: Point2D;
  topRight: Point2D;
  bottomRight: Point2D;
  bottomLeft: Point2D;
}

export interface StrikeLineGeometry {
  yStrike: number;
  overhang: number;
  xStart: number;
  xEnd: number;
  leftAnchorX: number;
  centerAnchorX: number;
  rightAnchorX: number;
}

export interface TargetAnchorItem {
  id: 'left' | 'center' | 'right';
  x: number;
  y: number;
  label: string;
  isActive: boolean;
  isNext: boolean;
}

export interface FootprintItem {
  x: number;
  y: number;
  w: number;
  h: number;
  isLeft: boolean;
  style: 'home' | 'current' | 'next' | 'preview2';
}

export interface DirectionArrowLayout {
  text: string;
  color: string;
  x: number;
  y: number;
  font: string;
}

export interface UpcomingPreviewNode {
  readonly label: string;
  readonly actionText: string;
  readonly displayTxt: string;
  readonly style: 'current' | 'preview1' | 'preview2';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface UpcomingPreviewLayout {
  readonly nodes: UpcomingPreviewNode[];
  readonly previewTextScale: number;
}

export interface StatusHeaderLayout {
  headerY: number;
  badgeText: string;
  badgeColor: string;
  badgeFontSize: number;
  countText: string;
  countFontSize: number;
  countX: number;
}

export interface NextRingLayout {
  x: number;
  y: number;
  rx: number;
  ry: number;
  fontSize: number;
}

export interface RunningMatFixtureDTO {
  viewModel?: Partial<RunningMatViewModel> | null;
  view?: Partial<RunningMatViewModel> | null;
  beatIndex?: number;
  beatProgress?: number;
  actionText?: string;
  cueText?: string;
  currentActionId?: string;
  currentFootSlot?: 'left' | 'right' | 'center' | 'out' | 'home';
  nextActionId?: string;
  nextFootSlot?: 'left' | 'right' | 'center' | 'out' | 'home';
  elapsedTime?: number;
  deltaTime?: number;
  vanishingPoint?: { x: number; y: number };
  presentationContext?: RunningMatPresentationContext;
}

export const DEFAULT_RUNNING_MAT_FIXTURE: RunningMatFixtureDTO = Object.freeze({
  actionText: '제자리 달리기',
  cueText: '쿵 짝 리듬 스텝',
  currentActionId: 'step_left',
  currentFootSlot: 'left',
  nextActionId: 'step_right',
  nextFootSlot: 'right',
  beatIndex: 1,
  beatProgress: 0.25,
});

export const KNEE_LIFT_MAT_FIXTURE: RunningMatFixtureDTO = Object.freeze({
  actionText: '무릎 높이 들기',
  cueText: '무릎을 가슴까지 업!',
  currentActionId: 'knee_left',
  currentFootSlot: 'left',
  nextActionId: 'knee_right',
  nextFootSlot: 'right',
  beatIndex: 3,
  beatProgress: 0.5,
});

export const SIDE_STEP_LEFT_MAT_FIXTURE: RunningMatFixtureDTO = Object.freeze({
  actionText: '왼발 사이드 스텝',
  cueText: '왼쪽 발판 딛기',
  currentActionId: 'side_step_left',
  currentFootSlot: 'left',
  nextActionId: 'center_return',
  nextFootSlot: 'center',
  beatIndex: 5,
  beatProgress: 0.75,
});

export interface RunningMatRenderOptions {
  vanishingPoint?: { x: number; y: number };
  elapsedTime?: number;
  beatProgress?: number;
  deltaTime?: number;
}
