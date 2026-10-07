/**
 * MotionNoteRenderer.ts - 통합 모션 리듬 노트 렌더러
 *
 * @see docs/12_UNIFIED_MOTION_RHYTHM_ARCHITECTURE.md (§7.2 Painter 인터페이스, §8 레이어별 책임)
 * @see Issue #479 [MRN-05]
 *
 * 핵심 역할:
 * - Timeline에서 전달받은 MotionNoteRenderItem[] 스냅샷을 받아 착지 임박 순으로 정렬
 * - NoteAnchorResolver와 NoteProjection을 결합하여 비행 궤적 및 어프로치 스케일 산출
 * - 외형 프로필(NoteVisualProfile)에 정의된 Ring/Body/Trail/Overlay Painter에 위임하여 캔버스에 렌더링
 * - 렌더러는 판정이나 타이밍 계산을 일체 수행하지 않는 순수 프레젠테이션 계층
 */

import type { MotionNoteRenderItem } from '../types/motion-note.js';
import {
  DEFAULT_NOTE_PROFILES,
  DEFAULT_FALLBACK_PROFILE_ID,
  STAR_HAND_PROFILE,
  type NoteVisualProfile,
  type NoteRingProfile,
  type NoteBodyProfile,
} from '../../config/motion-note-profile.config.js';
import {
  DEFAULT_FITNESS_ZONES,
  type FitnessZone,
} from '../../config/zone.config.js';
import {
  resolveAnchor,
  type NoteAnchor,
  type ViewportSize,
  type FloorLayoutOptions,
} from './NoteAnchorResolver.js';
import {
  projectFlight,
  computeApproachScale,
  type FlightProjectionResult,
} from './NoteProjection.js';
import {
  NotePainterRegistry,
  createDefaultPainterRegistry,
  resolvePartColor,
} from './note-painters/NotePainters.js';

/**
 * 렌더러 생성 설정 옵션
 */
export interface MotionNoteRendererOptions {
  /** 사용할 Painter 레지스트리 (기본값: createDefaultPainterRegistry()) */
  readonly registry?: NotePainterRegistry;
  /** 사용할 비주얼 프로필 맵 (기본값: DEFAULT_NOTE_PROFILES) */
  readonly profiles?: Record<string, NoteVisualProfile>;
  /** 기본 피트니스 존 목록 */
  readonly zones?: readonly FitnessZone[];
  /** 바닥 판정선 커스텀 레이아웃 옵션 */
  readonly floorLayout?: FloorLayoutOptions;
  /** 정렬 모드: 'timeToLandingAsc' (기본값) | 'timeToLandingDesc' | 'none' */
  readonly sortOrder?: 'timeToLandingAsc' | 'timeToLandingDesc' | 'none';
}

/**
 * 투영 계산 결과 스냅샷
 */
export interface ProjectedNoteItem {
  readonly item: MotionNoteRenderItem;
  readonly profile: NoteVisualProfile;
  readonly anchor: NoteAnchor;
  readonly flight: FlightProjectionResult;
  readonly vanishingPoint: { readonly x: number; readonly y: number };
}

/**
 * 모션 리듬 노트 통합 렌더러
 */
export class MotionNoteRenderer {
  private readonly _registry: NotePainterRegistry;
  private readonly _profiles: Record<string, NoteVisualProfile>;
  private readonly _options: MotionNoteRendererOptions;

  constructor(options?: MotionNoteRendererOptions) {
    this._options = options ?? {};
    this._registry = options?.registry ?? createDefaultPainterRegistry();
    this._profiles = options?.profiles ?? DEFAULT_NOTE_PROFILES;
  }

  /**
   * 등록된 Painter 레지스트리 반환
   */
  getRegistry(): NotePainterRegistry {
    return this._registry;
  }

  /**
   * 등록된 비주얼 프로필 맵 반환
   */
  getProfiles(): Readonly<Record<string, NoteVisualProfile>> {
    return this._profiles;
  }

  /**
   * 단일 노트를 소실점 -> 목표 앵커로 비행 투영 계산
   */
  projectItem(
    item: MotionNoteRenderItem,
    viewport: ViewportSize,
    vanishingPoint?: { x: number; y: number },
    zones?: readonly FitnessZone[],
    floorLayout?: FloorLayoutOptions,
  ): ProjectedNoteItem {
    const profile =
      this._profiles[item.profileId] ??
      this._profiles[DEFAULT_FALLBACK_PROFILE_ID] ??
      STAR_HAND_PROFILE;

    const req = item.requirements?.[0] ?? { part: 'leftHand' as const, zoneId: 1 };
    const activeZones = zones ?? this._options.zones ?? DEFAULT_FITNESS_ZONES;
    const activeFloor = floorLayout ?? this._options.floorLayout;
    const anchor = resolveAnchor(req, viewport, activeZones, activeFloor);

    const vx = vanishingPoint?.x ?? (viewport.width || 0) * 0.5;
    const vy = vanishingPoint?.y ?? (viewport.height || 0) * 0.5;

    const clampedProgress = Math.max(0, Math.min(1.0, item.progress ?? 0));
    const flight = projectFlight(
      vx,
      vy,
      anchor.x,
      anchor.y,
      clampedProgress,
      profile.flight,
    );

    return {
      item,
      profile,
      anchor,
      flight,
      vanishingPoint: { x: vx, y: vy },
    };
  }

  /**
   * 렌더링 순서 정렬: 착지 임박 순 (timeToLanding 오름차순 기본)
   */
  sortItems(items: readonly MotionNoteRenderItem[]): MotionNoteRenderItem[] {
    if (!items || !Array.isArray(items)) return [];

    const order = this._options.sortOrder ?? 'timeToLandingAsc';
    if (order === 'none') {
      return [...items];
    }
    if (order === 'timeToLandingDesc') {
      return [...items].sort((a, b) => (b.timeToLanding ?? 0) - (a.timeToLanding ?? 0));
    }
    return [...items].sort((a, b) => (a.timeToLanding ?? 0) - (b.timeToLanding ?? 0));
  }

  /**
   * MotionNoteRenderItem 배열을 캔버스에 렌더링
   *
   * @param ctx 캔버스 2D 컨텍스트
   * @param items 렌더링 대상 모션 노트 스냅샷 목록
   * @param viewport 캔버스 해상도
   * @param vanishingPoint 소실점 좌표 (기본값: 뷰포트 중앙)
   * @param zones 피트니스 존 목록 (기본값: DEFAULT_FITNESS_ZONES)
   * @param floorLayout 바닥 판정선 레이아웃 오버라이드
   */
  render(
    ctx: CanvasRenderingContext2D,
    items: readonly MotionNoteRenderItem[],
    viewport: ViewportSize,
    vanishingPoint?: { x: number; y: number },
    zones?: readonly FitnessZone[],
    floorLayout?: FloorLayoutOptions,
  ): void {
    if (!ctx || !items || !Array.isArray(items) || items.length === 0) {
      return;
    }

    const sortedItems = this.sortItems(items);
    const activeZones = zones ?? this._options.zones ?? DEFAULT_FITNESS_ZONES;
    const activeFloor = floorLayout ?? this._options.floorLayout;
    const vx = vanishingPoint?.x ?? (viewport.width || 0) * 0.5;
    const vy = vanishingPoint?.y ?? (viewport.height || 0) * 0.5;

    for (const item of sortedItems) {
      if (!item) continue;

      const profile =
        this._profiles[item.profileId] ??
        this._profiles[DEFAULT_FALLBACK_PROFILE_ID] ??
        STAR_HAND_PROFILE;

      const req = item.requirements?.[0] ?? { part: 'leftHand' as const, zoneId: 1 };
      const anchor = resolveAnchor(req, viewport, activeZones, activeFloor);

      const clampedProgress = Math.max(0, Math.min(1.0, item.progress ?? 0));
      const flight = projectFlight(
        vx,
        vy,
        anchor.x,
        anchor.y,
        clampedProgress,
        profile.flight,
      );

      // 1. 비행 트레일 (소실점 -> 현재 위치)
      if (profile.trail && profile.trail.painter !== 'none') {
        const trailPainter = this._registry.getTrail(profile.trail.painter);
        if (trailPainter) {
          const tailRatio = profile.trail.lengthRatio ?? 0;
          const tailProgress = Math.max(0, flight.progress - tailRatio);
          const tailExp = profile.flight?.easingExponent ?? 2.0;
          const fromPos = {
            x: vx + (anchor.x - vx) * Math.pow(tailProgress, tailExp),
            y: vy + (anchor.y - vy) * Math.pow(tailProgress, tailExp),
          };
          const toPos = { x: flight.x, y: flight.y };
          trailPainter.draw(ctx, fromPos, toPos, profile.trail, flight.scale, item);
        }
      }

      // 2. 목표 앵커 어프로치 링 (ring이 null이면 링 드로잉 생략)
      if (profile.ring !== null && profile.ring !== undefined) {
        const ringPainter = this._registry.getRing(profile.ring.painter);
        if (ringPainter) {
          const approachScale = computeApproachScale(
            flight.progress,
            profile.ring.startScale,
            profile.ring.endScale,
          );
          const ringColor =
            profile.ring.color === 'byPart'
              ? resolvePartColor(req.part)
              : profile.ring.color;
          const ringStyle: NoteRingProfile = {
            ...profile.ring,
            color: ringColor,
          };
          ringPainter.draw(ctx, anchor, approachScale, ringStyle, flight.t, item);
        }
      }

      // 3. 노트 바디 렌더링
      const bodyPainter = this._registry.getBody(profile.body.painter);
      if (bodyPainter) {
        const radius = (profile.body.baseRadius ?? 28) * flight.scale;
        const borderColor =
          profile.body.borderColor === 'byPart'
            ? resolvePartColor(req.part)
            : profile.body.borderColor;
        const bodyStyle: NoteBodyProfile = {
          ...profile.body,
          borderColor,
        };
        bodyPainter.draw(ctx, flight.x, flight.y, radius, bodyStyle, item, anchor);
      }

      // 4. 상태별 오버레이 렌더링
      if (profile.overlay) {
        const overlayPainter = this._registry.getOverlay(profile.overlay.painter);
        if (overlayPainter) {
          overlayPainter.draw(ctx, anchor, item, profile.overlay.params);
        }
      }
    }
  }
}
