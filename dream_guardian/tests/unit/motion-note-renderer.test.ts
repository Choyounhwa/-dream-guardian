/**
 * motion-note-renderer.test.ts - MotionNoteRenderer 및 NotePainter 분리 구조 단위 테스트
 *
 * @see docs/12_UNIFIED_MOTION_RHYTHM_ARCHITECTURE.md (§7.2 Painter 인터페이스, §8 레이어별 책임)
 * @see Issue #479 [MRN-05]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MotionNoteRenderItem } from '../../src/types/motion-note.js';
import {
  DEFAULT_NOTE_PROFILES,
  STAR_HAND_PROFILE,
  type NoteRingProfile,
  type NoteBodyProfile,
  type NoteTrailProfile,
} from '../../config/motion-note-profile.config.js';
import type { NoteAnchor } from '../../src/render/NoteAnchorResolver.js';
import {
  NotePainterRegistry,
  createDefaultPainterRegistry,
  CircleRingPainter,
  RectRingPainter,
  OrbBodyPainter,
  SymbolBodyPainter,
  ImageBodyPainter,
  HazardSkullBodyPainter,
  ShieldBodyPainter,
  BeamTrailPainter,
  GradientTrailPainter,
  NoneTrailPainter,
  resolvePartColor,
  type RingPainter,
  type BodyPainter,
  type TrailPainter,
  type OverlayPainter,
} from '../../src/render/note-painters/NotePainters.js';
import {
  MotionNoteRenderer,
} from '../../src/render/MotionNoteRenderer.js';

function createMockContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    drawImage: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 20 }),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    roundRect: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
    globalAlpha: 1.0,
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('MotionNoteRenderer & NotePainter Architecture (#479 / MRN-05)', () => {
  let mockCtx: CanvasRenderingContext2D;

  beforeEach(() => {
    mockCtx = createMockContext();
  });

  describe('1. Painter Registry and Individual Painters', () => {
    it('초기 기본 Painter 레지스트리가 circle/rect 링, orb/image/symbol/hazardSkull/shield 바디, beam/gradient/none 트레일을 등록한다', () => {
      const registry = createDefaultPainterRegistry();

      expect(registry.getRing('circle')).toBeDefined();
      expect(registry.getRing('rect')).toBeDefined();

      expect(registry.getBody('orb')).toBeDefined();
      expect(registry.getBody('symbol')).toBeDefined();
      expect(registry.getBody('image')).toBeDefined();
      expect(registry.getBody('hazardSkull')).toBeDefined();
      expect(registry.getBody('shield')).toBeDefined();

      // 별칭 / 호환성 등록 확인 (star, stomp)
      expect(registry.getBody('star')).toBeDefined();
      expect(registry.getBody('stomp')).toBeDefined();

      expect(registry.getTrail('beam')).toBeDefined();
      expect(registry.getTrail('gradient')).toBeDefined();
      expect(registry.getTrail('none')).toBeDefined();

      expect(registry.getOverlay('default')).toBeDefined();
    });

    it('커스텀 Painter를 등록하고 정상 조회할 수 있다', () => {
      const registry = new NotePainterRegistry();
      const customRing: RingPainter = { draw: vi.fn() };
      const customBody: BodyPainter = { draw: vi.fn() };
      const customTrail: TrailPainter = { draw: vi.fn() };
      const customOverlay: OverlayPainter = { draw: vi.fn() };

      registry.registerRing('customRing', customRing);
      registry.registerBody('customBody', customBody);
      registry.registerTrail('customTrail', customTrail);
      registry.registerOverlay('customOverlay', customOverlay);

      expect(registry.getRing('customRing')).toBe(customRing);
      expect(registry.getBody('customBody')).toBe(customBody);
      expect(registry.getTrail('customTrail')).toBe(customTrail);
      expect(registry.getOverlay('customOverlay')).toBe(customOverlay);
    });

    it('CircleRingPainter는 전달된 anchor 및 scale에 맞게 원형 링을 stroke한다', () => {
      const ringPainter = new CircleRingPainter();
      const anchor: NoteAnchor = { x: 300, y: 400, radius: 40, mode: 'zoneCenter' };
      const style: NoteRingProfile = {
        painter: 'circle',
        color: '#28E6FF',
        startScale: 2.5,
        endScale: 1.0,
        strokeWidth: 4,
        glowBlur: 18,
        alpha: 0.8,
        landingPulse: true,
      };

      ringPainter.draw(mockCtx, anchor, 1.5, style, 0.5);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.arc).toHaveBeenCalledWith(300, 400, 60, 0, Math.PI * 2);
      expect(mockCtx.stroke).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('RectRingPainter는 anchor 영역 기준 사각형 링을 stroke한다', () => {
      const rectPainter = new RectRingPainter();
      const anchor: NoteAnchor = { x: 500, y: 600, radius: 50, mode: 'strikeLine' };
      const style: NoteRingProfile = {
        painter: 'rect',
        color: '#FFD166',
        startScale: 2.0,
        endScale: 1.0,
        strokeWidth: 3,
        glowBlur: 10,
        alpha: 0.7,
        landingPulse: false,
      };

      rectPainter.draw(mockCtx, anchor, 1.2, style, 0.8);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.strokeRect).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('OrbBodyPainter는 원형 바디를 채우고 테두리를 그리며 showLaneLabel이 true면 레인 문자를 표시한다', () => {
      const orbPainter = new OrbBodyPainter();
      const item: MotionNoteRenderItem = {
        id: 'note-stomp-left',
        requirements: [{ part: 'leftFoot', zoneId: 9 }],
        interaction: 'tap',
        profileId: 'stomp_foot',
        progress: 0.8,
        timeToLanding: 0.1,
      };
      const style: NoteBodyProfile = {
        painter: 'orb',
        symbol: '♪',
        baseRadius: 28,
        fillColor: 'rgba(12, 20, 36, 0.92)',
        borderColor: '#00E5FF',
        showLaneLabel: true,
      };

      orbPainter.draw(mockCtx, 200, 500, 35, style, item);

      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.arc).toHaveBeenCalledWith(200, 500, 35, 0, Math.PI * 2);
      expect(mockCtx.fill).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalledWith('L', 200, 500);
    });

    it('SymbolBodyPainter는 원형 바디 중앙에 지정된 symbol 텍스트를 그린다', () => {
      const symbolPainter = new SymbolBodyPainter();
      const item: MotionNoteRenderItem = {
        id: 'note-symbol',
        requirements: [{ part: 'head', zoneId: 2 }],
        interaction: 'tap',
        profileId: 'star_hand',
        progress: 0.5,
        timeToLanding: 0.25,
      };
      const style: NoteBodyProfile = {
        painter: 'symbol',
        symbol: '★',
        baseRadius: 30,
        fillColor: '#FFFFFF',
        borderColor: '#C889FF',
      };

      symbolPainter.draw(mockCtx, 400, 300, 30, style, item);

      expect(mockCtx.fill).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalledWith('★', 400, 300);
    });

    it('ImageBodyPainter는 이미지가 없거나 미로드 시 symbol 텍스트로 폴백한다', () => {
      const imagePainter = new ImageBodyPainter();
      const item: MotionNoteRenderItem = {
        id: 'note-image',
        requirements: [{ part: 'rightHand', zoneId: 6 }],
        interaction: 'tap',
        profileId: 'star_hand',
        progress: 0.7,
        timeToLanding: 0.15,
      };
      const style: NoteBodyProfile = {
        painter: 'image',
        symbol: '★',
        baseRadius: 30,
        fillColor: '#FFFFFF',
        borderColor: '#FFCB4D',
      };

      // 이미지 캐시 미등록 상태 호출 -> symbol 폴백 검증
      imagePainter.draw(mockCtx, 600, 300, 36, style, item);

      expect(mockCtx.fillText).toHaveBeenCalledWith('★', 600, 300);
      expect(mockCtx.drawImage).not.toHaveBeenCalled();
    });

    it('HazardSkullBodyPainter와 ShieldBodyPainter가 정상 동작한다', () => {
      const hazardPainter = new HazardSkullBodyPainter();
      const shieldPainter = new ShieldBodyPainter();
      const item: MotionNoteRenderItem = {
        id: 'note-hazard',
        requirements: [{ part: 'bothFeet', zoneId: 10 }],
        interaction: 'evade',
        profileId: 'hazard_floor',
        progress: 0.6,
        timeToLanding: 0.2,
      };
      const style: NoteBodyProfile = {
        painter: 'hazardSkull',
        symbol: '⚠',
        baseRadius: 36,
        fillColor: 'rgba(255, 30, 60, 0.35)',
        borderColor: '#FF1E3C',
      };

      hazardPainter.draw(mockCtx, 640, 500, 40, style, item);
      expect(mockCtx.fillText).toHaveBeenCalledWith('⚠', 640, 500);

      shieldPainter.draw(mockCtx, 640, 500, 40, { ...style, symbol: '🛡' }, item);
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('BeamTrailPainter는 from -> to 좌표로 광선 빔을 stroke한다', () => {
      const beamPainter = new BeamTrailPainter();
      const style: NoteTrailProfile = {
        painter: 'beam',
        lengthRatio: 0.25,
        alpha: 0.45,
      };

      beamPainter.draw(mockCtx, { x: 640, y: 360 }, { x: 500, y: 600 }, style, 1.2);

      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.moveTo).toHaveBeenCalledWith(640, 360);
      expect(mockCtx.lineTo).toHaveBeenCalledWith(500, 600);
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('GradientTrailPainter와 NoneTrailPainter가 정상 동작한다', () => {
      const gradPainter = new GradientTrailPainter();
      const nonePainter = new NoneTrailPainter();
      const styleGrad: NoteTrailProfile = { painter: 'gradient', lengthRatio: 0.3, alpha: 0.5 };
      const styleNone: NoteTrailProfile = { painter: 'none', lengthRatio: 0, alpha: 0 };

      gradPainter.draw(mockCtx, { x: 100, y: 100 }, { x: 200, y: 200 }, styleGrad, 1.0);
      expect(mockCtx.createLinearGradient).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();

      (mockCtx.stroke as any).mockClear();
      nonePainter.draw(mockCtx, { x: 100, y: 100 }, { x: 200, y: 200 }, styleNone, 1.0);
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('resolvePartColor는 4색 신체 부위 및 발 레인별 대표 색상을 정확히 반환한다', () => {
      expect(resolvePartColor('leftHand')).toBe('#28E6FF');
      expect(resolvePartColor('rightHand')).toBe('#FFCB4D');
      expect(resolvePartColor('head')).toBe('#C889FF');
      expect(resolvePartColor('hip')).toBe('#FF865E');

      expect(resolvePartColor('leftFoot')).toBe('#00E5FF');
      expect(resolvePartColor('centerFoot')).toBe('#FFD166');
      expect(resolvePartColor('rightFoot')).toBe('#FF8800');

      expect(resolvePartColor('unknownPart', '#FFFFFF')).toBe('#FFFFFF');
    });
  });

  describe('2. MotionNoteRenderer Flight Projection & Anchor Resolution', () => {
    it('NoteAnchorResolver와 NoteProjection을 결합하여 소실점에서 앵커로의 투영 좌표를 산출한다', () => {
      const renderer = new MotionNoteRenderer();
      const viewport = { width: 1280, height: 720 };
      const vanishingPoint = { x: 640, y: 360 };

      const itemStart: MotionNoteRenderItem = {
        id: 'note-proj-start',
        requirements: [{ part: 'leftHand', zoneId: 4 }],
        interaction: 'tap',
        profileId: 'star_hand',
        progress: 0.0,
        timeToLanding: 0.5,
      };

      const itemEnd: MotionNoteRenderItem = {
        id: 'note-proj-end',
        requirements: [{ part: 'leftHand', zoneId: 4 }],
        interaction: 'tap',
        profileId: 'star_hand',
        progress: 1.0,
        timeToLanding: 0.0,
      };

      const startResult = renderer.projectItem(itemStart, viewport, vanishingPoint);
      expect(startResult.flight.x).toBeCloseTo(640, 0);
      expect(startResult.flight.y).toBeCloseTo(360, 0);
      expect(startResult.flight.scale).toBeCloseTo(0.3, 2);

      const endResult = renderer.projectItem(itemEnd, viewport, vanishingPoint);
      expect(endResult.flight.x).toBeCloseTo(endResult.anchor.x, 1);
      expect(endResult.flight.y).toBeCloseTo(endResult.anchor.y, 1);
      expect(endResult.flight.scale).toBeCloseTo(1.2, 2);
    });

    it('비행 중간 시점(progress 0.5)은 easingExponent에 따른 가속 좌표를 반영한다', () => {
      const renderer = new MotionNoteRenderer();
      const viewport = { width: 1280, height: 720 };
      const itemMid: MotionNoteRenderItem = {
        id: 'note-proj-mid',
        requirements: [{ part: 'leftHand', zoneId: 4 }],
        interaction: 'tap',
        profileId: 'star_hand', // easingExponent = 2.0 (t = 0.5^2 = 0.25)
        progress: 0.5,
        timeToLanding: 0.25,
      };

      const midResult = renderer.projectItem(itemMid, viewport);
      expect(midResult.flight.t).toBeCloseTo(0.25, 4);
      // x = vx + (anchor.x - vx) * 0.25
      const expectedX = 640 + (midResult.anchor.x - 640) * 0.25;
      expect(midResult.flight.x).toBeCloseTo(expectedX, 1);
    });
  });

  describe('3. 착지 임박 순(timeToLanding 오름차순) 정렬 렌더링 검증', () => {
    it('입력 배열을 timeToLanding 오름차순으로 정렬하여 임박한 노트부터 순차적으로 그린다', () => {
      const renderedOrder: string[] = [];

      const mockBodyPainter: BodyPainter = {
        draw: vi.fn((_ctx, _x, _y, _r, _style, item) => {
          renderedOrder.push(item.id);
        }),
      };

      const customRegistry = createDefaultPainterRegistry();
      customRegistry.registerBody('image', mockBodyPainter);
      customRegistry.registerBody('orb', mockBodyPainter);

      const renderer = new MotionNoteRenderer({ registry: customRegistry });
      const viewport = { width: 1280, height: 720 };

      // 임의 순서의 3개 노트
      const items: MotionNoteRenderItem[] = [
        {
          id: 'note-late',
          requirements: [{ part: 'leftHand', zoneId: 4 }],
          interaction: 'tap',
          profileId: 'star_hand',
          progress: 0.2,
          timeToLanding: 0.8, // 가장 늦음
        },
        {
          id: 'note-soon',
          requirements: [{ part: 'rightHand', zoneId: 6 }],
          interaction: 'tap',
          profileId: 'star_hand',
          progress: 0.9,
          timeToLanding: 0.05, // 가장 빠름 (임박)
        },
        {
          id: 'note-mid',
          requirements: [{ part: 'head', zoneId: 2 }],
          interaction: 'tap',
          profileId: 'star_hand',
          progress: 0.5,
          timeToLanding: 0.3, // 중간
        },
      ];

      renderer.render(mockCtx, items, viewport);

      expect(renderedOrder).toEqual(['note-soon', 'note-mid', 'note-late']);
    });
  });

  describe('4. 프로필별 링/바디/트레일 렌더링 검증', () => {
    it('star_hand 프로필은 circle 링과 image(symbol 폴백) 바디를 올바른 부위 색상으로 호출한다', () => {
      const ringSpy = vi.fn();
      const bodySpy = vi.fn();

      const customRegistry = createDefaultPainterRegistry();
      customRegistry.registerRing('circle', { draw: ringSpy });
      customRegistry.registerBody('image', { draw: bodySpy });

      const renderer = new MotionNoteRenderer({ registry: customRegistry });
      const viewport = { width: 1280, height: 720 };

      const item: MotionNoteRenderItem = {
        id: 'star-note-cyan',
        requirements: [{ part: 'leftHand', zoneId: 4 }],
        interaction: 'tap',
        profileId: 'star_hand',
        progress: 0.7,
        timeToLanding: 0.15,
      };

      renderer.render(mockCtx, [item], viewport);

      expect(ringSpy).toHaveBeenCalledTimes(1);
      const [, anchorArg, scaleArg, ringStyleArg] = ringSpy.mock.calls[0];
      expect(anchorArg.mode).toBe('zoneCenter');
      expect(scaleArg).toBeGreaterThan(1.0); // approach ring 수축 도중
      expect(ringStyleArg.color).toBe('#28E6FF'); // byPart -> leftHand 시안

      expect(bodySpy).toHaveBeenCalledTimes(1);
      const [, xArg, yArg, radiusArg, bodyStyleArg] = bodySpy.mock.calls[0];
      expect(xArg).toBeGreaterThan(0);
      expect(yArg).toBeGreaterThan(0);
      expect(radiusArg).toBeGreaterThan(0);
      expect(bodyStyleArg.borderColor).toBe('#28E6FF');
    });

    it('stomp_foot 프로필은 beam 트레일, circle 링, orb 바디를 발 레인 색상으로 호출한다', () => {
      const trailSpy = vi.fn();
      const ringSpy = vi.fn();
      const bodySpy = vi.fn();

      const customRegistry = createDefaultPainterRegistry();
      customRegistry.registerTrail('beam', { draw: trailSpy });
      customRegistry.registerRing('circle', { draw: ringSpy });
      customRegistry.registerBody('orb', { draw: bodySpy });

      const renderer = new MotionNoteRenderer({ registry: customRegistry });
      const viewport = { width: 1280, height: 720 };

      const item: MotionNoteRenderItem = {
        id: 'stomp-note-center',
        requirements: [{ part: 'centerFoot', zoneId: 10 }],
        interaction: 'tap',
        profileId: 'stomp_foot',
        progress: 0.6,
        timeToLanding: 0.2,
      };

      renderer.render(mockCtx, [item], viewport);

      expect(trailSpy).toHaveBeenCalledTimes(1);
      const [, fromArg, toArg, trailStyleArg] = trailSpy.mock.calls[0];
      expect(fromArg).toBeDefined();
      expect(toArg).toBeDefined();
      expect(trailStyleArg.painter).toBe('beam');

      expect(ringSpy).toHaveBeenCalledTimes(1);
      expect(bodySpy).toHaveBeenCalledTimes(1);
      const [, , , , bodyStyleArg] = bodySpy.mock.calls[0];
      expect(bodyStyleArg.showLaneLabel).toBe(true);
      expect(bodyStyleArg.borderColor).toBe('#FFD166'); // centerFoot 노랑
    });

    it('hazard_floor 및 boss_slam 프로필은 ring이 null이므로 링 드로잉을 생략하고 바디만 그린다', () => {
      const ringSpy = vi.fn();
      const bodySpy = vi.fn();

      const customRegistry = createDefaultPainterRegistry();
      customRegistry.registerRing('circle', { draw: ringSpy });
      customRegistry.registerBody('hazardSkull', { draw: bodySpy });

      const renderer = new MotionNoteRenderer({ registry: customRegistry });
      const viewport = { width: 1280, height: 720 };

      const hazardItem: MotionNoteRenderItem = {
        id: 'hazard-1',
        requirements: [{ part: 'bothFeet', zoneId: 10 }],
        interaction: 'evade',
        profileId: 'hazard_floor',
        progress: 0.5,
        timeToLanding: 0.25,
      };

      renderer.render(mockCtx, [hazardItem], viewport);

      expect(ringSpy).not.toHaveBeenCalled(); // ring: null이므로 링 생략
      expect(bodySpy).toHaveBeenCalledTimes(1);
    });

    it('overlay 설정이 있는 경우 overlayPainter가 호출된다', () => {
      const overlaySpy = vi.fn();
      const customRegistry = createDefaultPainterRegistry();
      customRegistry.registerOverlay('pulse', { draw: overlaySpy });

      const customProfile = {
        ...STAR_HAND_PROFILE,
        profileId: 'custom_overlay_profile',
        overlay: {
          painter: 'pulse',
          params: { pulseIntensity: 1.5 },
        },
      };

      const renderer = new MotionNoteRenderer({
        registry: customRegistry,
        profiles: {
          ...DEFAULT_NOTE_PROFILES,
          custom_overlay_profile: customProfile,
        },
      });

      const item: MotionNoteRenderItem = {
        id: 'item-overlay',
        requirements: [{ part: 'leftHand', zoneId: 4 }],
        interaction: 'tap',
        profileId: 'custom_overlay_profile',
        progress: 0.9,
        timeToLanding: 0.05,
      };

      renderer.render(mockCtx, [item], { width: 1280, height: 720 });
      expect(overlaySpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('5. 예외 안전성 및 유효하지 않은 입력 처리', () => {
    it('빈 배열이거나 null/undefined일 때 예외 없이 무시한다', () => {
      const renderer = new MotionNoteRenderer();
      const viewport = { width: 1280, height: 720 };

      expect(() => renderer.render(mockCtx, [], viewport)).not.toThrow();
      expect(() => renderer.render(mockCtx, null as any, viewport)).not.toThrow();
      expect(() => renderer.render(mockCtx, undefined as any, viewport)).not.toThrow();
      expect(mockCtx.save).not.toHaveBeenCalled();
    });

    it('미등록된 profileId인 경우 기본 안전 폴백(star_hand)으로 정상 렌더링한다', () => {
      const renderer = new MotionNoteRenderer();
      const viewport = { width: 1280, height: 720 };

      const item: MotionNoteRenderItem = {
        id: 'unknown-profile-item',
        requirements: [{ part: 'rightHand', zoneId: 6 }],
        interaction: 'tap',
        profileId: 'non_existent_profile_xyz',
        progress: 0.5,
        timeToLanding: 0.3,
      };

      expect(() => renderer.render(mockCtx, [item], viewport)).not.toThrow();
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('requirements가 비어있는 비정상 항목도 안전하게 처리한다', () => {
      const renderer = new MotionNoteRenderer();
      const viewport = { width: 1280, height: 720 };

      const emptyReqItem: MotionNoteRenderItem = {
        id: 'empty-req',
        requirements: [],
        interaction: 'tap',
        profileId: 'star_hand',
        progress: 0.5,
        timeToLanding: 0.3,
      };

      expect(() => renderer.render(mockCtx, [emptyReqItem], viewport)).not.toThrow();
    });

    it('progress가 0 미만이거나 1 초과인 경우에도 예외 없이 클램프되어 안전 렌더링된다', () => {
      const renderer = new MotionNoteRenderer();
      const viewport = { width: 1280, height: 720 };

      const clampedItem: MotionNoteRenderItem = {
        id: 'out-of-range-progress',
        requirements: [{ part: 'head', zoneId: 2 }],
        interaction: 'tap',
        profileId: 'star_hand',
        progress: 1.5,
        timeToLanding: -0.2,
      };

      expect(() => renderer.render(mockCtx, [clampedItem], viewport)).not.toThrow();
      expect(mockCtx.save).toHaveBeenCalled();
    });
  });
});
