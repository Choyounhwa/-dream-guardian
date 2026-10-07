/**
 * star-note-renderer.test.ts - 그리드 레일 궤적 기반 별가루 악기 노트 렌더러 단위 테스트
 *
 * @see Issue #192 [RENDER-KEYNOTE-001]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  StarNoteRenderer,
  type StarNoteRenderState,
} from '../../src/render/StarNoteRenderer.js';
import type { ActiveStarTarget } from '../../src/input/StarCollectionInput.js';
import type { StarTarget } from '../../src/types/star.js';
import { DEFAULT_FITNESS_ZONES } from '../../config/zone.config.js';
import {
  DEFAULT_STAR_NOTE_VISUAL_CONFIG,
  type StarNoteVisualConfig,
} from '../../config/beat-motion.config.js';
import {
  DEFAULT_STAR_PREVIEW_CONFIG,
  type StarBeatPreviewOptions,
} from '../../config/star-preview.config.js';

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

describe('StarNoteRenderer (Issue #192 - RENDER-KEYNOTE-001)', () => {
  let renderer: StarNoteRenderer;
  let ctx: CanvasRenderingContext2D;

  const vw = 1080;
  const vh = 2160;
  const vx = 540;
  const vy = vh * 0.24; // 518.4

  beforeEach(() => {
    renderer = new StarNoteRenderer();
    ctx = createMockContext();
  });

  describe('1. 노트 실시간 비행 좌표 및 타이밍 계산 (computeNotePosition)', () => {
    const landingTime = 4.0;
    const target: ActiveStarTarget = {
      patternId: 'p1',
      part: 'leftHand',
      zoneId: 4, // 좌측 중단 존
      beatIndex: 1,
      landingTime,
    };

    const zone4 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 4)!;
    const zone4CenterX = (zone4.x + zone4.width * 0.5) * vw;
    const zone4CenterY = (zone4.y + zone4.height * 0.5) * vh;

    it('비행 시작 시점(elapsedTime = landingTime - 0.5s)일 때 소실점 위치에 위치한다', () => {
      const pos = renderer.computeNotePosition(target, landingTime - 0.5, vx, vy, vw, vh);
      expect(pos.inFlight).toBe(true);
      expect(pos.progress).toBeCloseTo(0, 4);
      expect(pos.x).toBeCloseTo(vx, 2);
      expect(pos.y).toBeCloseTo(vy, 2);
      expect(pos.scale).toBeCloseTo(0.3, 2);
    });

    it('elapsedTime == landingTime일 때 노트 중심이 목표 존 중심과 1px 이내로 일치한다', () => {
      const pos = renderer.computeNotePosition(target, landingTime, vx, vy, vw, vh);
      expect(pos.inFlight).toBe(true);
      expect(pos.progress).toBeCloseTo(1.0, 4);
      expect(Math.abs(pos.x - zone4CenterX)).toBeLessThan(1.0);
      expect(Math.abs(pos.y - zone4CenterY)).toBeLessThan(1.0);
      expect(pos.scale).toBeCloseTo(1.2, 2);
    });

    it('비행 시간 이전(elapsedTime < landingTime - 0.5s)일 때 inFlight=false를 반환한다', () => {
      const pos = renderer.computeNotePosition(target, landingTime - 1.0, vx, vy, vw, vh);
      expect(pos.inFlight).toBe(false);
      expect(pos.progress).toBeLessThan(0);
    });

    it('Late 판정 윈도우 내부(landingTime <= elapsedTime <= landingTime + 0.40s)일 때 inFlight=true를 유지한다 (Issue #192)', () => {
      // 0.35s 경과는 0.40s lateWindow 이내이므로 노트가 계속 표시되어야 함
      const pos = renderer.computeNotePosition(target, landingTime + 0.35, vx, vy, vw, vh);
      expect(pos.inFlight).toBe(true);
      expect(pos.scale).toBeCloseTo(1.2, 2);
      expect(Math.abs(pos.x - zone4CenterX)).toBeLessThan(1.0);
      expect(Math.abs(pos.y - zone4CenterY)).toBeLessThan(1.0);
    });

    it('Late 판정 만료 이후(elapsedTime > landingTime + 0.40s)일 때 inFlight=false를 반환한다 (Issue #192)', () => {
      const pos = renderer.computeNotePosition(target, landingTime + 0.45, vx, vy, vw, vh);
      expect(pos.inFlight).toBe(false);
    });

    it('수집 완료(resolved=true 또는 isCollected=true)된 노트는 inFlight=false를 반환한다 (Issue #192)', () => {
      const resolvedTarget = { ...target, resolved: true };
      const posResolved = renderer.computeNotePosition(resolvedTarget as any, landingTime, vx, vy, vw, vh);
      expect(posResolved.inFlight).toBe(false);

      const collectedTarget = { ...target, isCollected: true };
      const posCollected = renderer.computeNotePosition(collectedTarget as any, landingTime, vx, vy, vw, vh);
      expect(posCollected.inFlight).toBe(false);
    });
  });

  describe('2. 타겟 부재, 수집 완료 및 비행 외 상태의 렌더링 무동작 검증', () => {
    it('target이 null일 때 캔버스에 어떤 드로잉도 하지 않는다', () => {
      const state: StarNoteRenderState = {
        target: null,
        elapsedTime: 4.0,
        vanishingX: vx,
        vanishingY: vy,
      };

      renderer.render(ctx, vw, vh, state);

      expect(ctx.stroke).not.toHaveBeenCalled();
      expect(ctx.fill).not.toHaveBeenCalled();
      expect(ctx.fillText).not.toHaveBeenCalled();
      expect(ctx.arc).not.toHaveBeenCalled();
    });

    it('수집 완료(resolved=true 또는 isCollected=true)된 단일 타겟은 캔버스에 어떤 드로잉도 하지 않는다 (Issue #192)', () => {
      const target: ActiveStarTarget = {
        patternId: 'p1',
        part: 'leftHand',
        zoneId: 4,
        beatIndex: 1,
        landingTime: 4.0,
        resolved: true,
      } as any;

      renderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 4.0,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(ctx.stroke).not.toHaveBeenCalled();
      expect(ctx.fill).not.toHaveBeenCalled();
      expect(ctx.fillText).not.toHaveBeenCalled();
    });

    it('targets 목록 중 이미 resolved된 노트는 제외하고 미해결 노트만 렌더링한다 (Issue #192)', () => {
      const noteResolved: ActiveStarTarget = {
        patternId: 'p1',
        part: 'leftHand',
        zoneId: 4,
        beatIndex: 1,
        landingTime: 4.0,
        resolved: true,
      } as any;

      const noteActive: ActiveStarTarget = {
        patternId: 'p2',
        part: 'rightHand',
        zoneId: 5,
        beatIndex: 2,
        landingTime: 4.5,
        resolved: false,
      } as any;

      renderer.render(ctx, vw, vh, {
        targets: [noteResolved, noteActive],
        elapsedTime: 4.3, // noteActive(4.5s)는 비행 중 (4.0 ~ 4.5)
        vanishingX: vx,
        vanishingY: vy,
      });

      // noteActive(rightHand, #FFCB4D)만 렌더링되어야 함
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.strokeStyle).toContain('FFCB4D');
      expect(ctx.strokeStyle).not.toContain('28E6FF'); // leftHand는 안 그려짐
    });

    it('비행 시간 이전(아직 출현 전)일 때 어떤 드로잉도 하지 않는다', () => {
      const target: ActiveStarTarget = {
        patternId: 'p1',
        part: 'rightHand',
        zoneId: 5,
        beatIndex: 1,
        landingTime: 4.0,
      };
      const state: StarNoteRenderState = {
        target,
        elapsedTime: 2.0, // 2초 전 (travelDuration 0.5s 이전)
        vanishingX: vx,
        vanishingY: vy,
      };

      renderer.render(ctx, vw, vh, state);

      expect(ctx.stroke).not.toHaveBeenCalled();
      expect(ctx.fill).not.toHaveBeenCalled();
    });
  });

  describe('3. 신체 부위별 4색 테두리 및 비주얼 렌더링', () => {
    it('왼손(leftHand) 타겟일 때 시안(#28E6FF) 색상으로 렌더링된다', () => {
      const target: ActiveStarTarget = {
        patternId: 'p1',
        part: 'leftHand',
        zoneId: 1,
        beatIndex: 1,
        landingTime: 4.0,
      };
      renderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 3.8,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.strokeStyle).toContain('28E6FF');
      expect(ctx.fillText).toHaveBeenCalledWith('★', expect.any(Number), expect.any(Number));
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('오른손(rightHand) 타겟일 때 노랑(#FFCB4D) 색상으로 렌더링된다', () => {
      const target: ActiveStarTarget = {
        patternId: 'p2',
        part: 'rightHand',
        zoneId: 3,
        beatIndex: 2,
        landingTime: 4.0,
      };
      renderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 3.8,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(ctx.strokeStyle).toContain('FFCB4D');
    });

    it('머리(head) 타겟일 때 보라(#C889FF) 색상으로 렌더링된다', () => {
      const target: ActiveStarTarget = {
        patternId: 'p3',
        part: 'head',
        zoneId: 2,
        beatIndex: 3,
        landingTime: 4.0,
      };
      renderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 3.8,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(ctx.strokeStyle).toContain('C889FF');
    });

    it('골반(hip) 타겟일 때 주황(#FF865E) 색상으로 렌더링된다', () => {
      const target: ActiveStarTarget = {
        patternId: 'p4',
        part: 'hip',
        zoneId: 10,
        beatIndex: 4,
        landingTime: 4.0,
      };
      renderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 3.8,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(ctx.strokeStyle).toContain('FF865E');
    });
  });

  describe('4. 안착 직전(±0.12s Perfect 판정 윈도우) 목표 존 테두리 펄스 링 연출', () => {
    it('안착 0.05s 전(Perfect 윈도우 내)에 목표 존 테두리 펄스 링이 그려진다', () => {
      const target: ActiveStarTarget = {
        patternId: 'p1',
        part: 'leftHand',
        zoneId: 4,
        beatIndex: 1,
        landingTime: 4.0,
      };

      renderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 3.95, // 0.05s 전 -> Perfect 윈도우(0.12s) 내부
        vanishingX: vx,
        vanishingY: vy,
      });

      // 목표 존에 펄스 링 또는 하이라이트가 발생해야 함 (roundRect, strokeRect, 또는 arc/ellipse)
      const strokeCalls = vi.mocked(ctx.stroke).mock.calls.length;
      expect(strokeCalls).toBeGreaterThanOrEqual(2); // 노트 테두리 + 목표 존 펄스 링
    });
  });

  describe('5. 목표 존 어프로치 링 (Approach Ring) 수축 계산 및 렌더링 (Issue #284 - VFX-JUDGMENT-001)', () => {
    it('진행도에 따른 어프로치 링 수축 배율을 올바르게 계산한다 (0.0일 때 2.5배, 1.0일 때 1.0배)', () => {
      // approachScale = 1.0 + 1.5 * (1.0 - progress)
      expect(renderer.computeApproachScale(0.0)).toBeCloseTo(2.5, 4);
      expect(renderer.computeApproachScale(0.5)).toBeCloseTo(1.75, 4);
      expect(renderer.computeApproachScale(1.0)).toBeCloseTo(1.0, 4);
      expect(renderer.computeApproachScale(-0.2)).toBeCloseTo(2.5, 4); // 하한 클램프
      expect(renderer.computeApproachScale(1.3)).toBeCloseTo(1.0, 4);  // 상한 클램프
    });

    it('노트 비행 중(progress = 0.5) 목표 존 테두리로 수축하는 타이밍 링을 렌더링한다', () => {
      const target: ActiveStarTarget = {
        patternId: 'p-approach',
        part: 'leftHand',
        zoneId: 4,
        beatIndex: 1,
        landingTime: 4.0,
      };

      // landingTime = 4.0, travelDuration = 0.5s -> 3.75s는 progress = 0.5
      renderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 3.75,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.arc).toHaveBeenCalled();

      // arc 호출 파라미터 검증 (zone4 원형 어프로치 링: 반경의 1.75배)
      const zone4 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 4)!;
      const expectedScale = 1.75;
      const arcCalls = vi.mocked(ctx.arc).mock.calls;
      expect(arcCalls.length).toBeGreaterThanOrEqual(1);
      const [, , r] = arcCalls[0];
      const baseR = Math.max(zone4.width * vw, zone4.height * vh) * 0.5 + 4;
      expect(r).toBeCloseTo(baseR * expectedScale, 0);
    });

    it('노트의 타겟 파트(rightHand)에 따른 고유 네온 색상(#FFCB4D)으로 어프로치 링을 렌더링한다', () => {
      const target: ActiveStarTarget = {
        patternId: 'p-righthand',
        part: 'rightHand',
        zoneId: 5,
        beatIndex: 1,
        landingTime: 4.0,
      };

      renderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 3.75,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(ctx.strokeStyle).toBe('#FFCB4D');
    });

    it('이미 판정/수집 완료된 노트(resolved/isCollected)는 어프로치 링을 렌더링하지 않는다', () => {
      const target: ActiveStarTarget & { resolved?: boolean } = {
        patternId: 'p-resolved',
        part: 'leftHand',
        zoneId: 4,
        beatIndex: 1,
        landingTime: 4.0,
        resolved: true,
      };

      vi.mocked(ctx.roundRect).mockClear();
      vi.mocked(ctx.stroke).mockClear();

      renderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 3.75,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(ctx.roundRect).not.toHaveBeenCalled();
      expect(ctx.stroke).not.toHaveBeenCalled();
    });

    it('비행 시작 시점(progress = 0.0)에는 2.5배 크기로 어프로치 링이 렌더링된다', () => {
      const target: ActiveStarTarget = {
        patternId: 'p-start',
        part: 'rightHand',
        zoneId: 5,
        beatIndex: 1,
        landingTime: 4.0,
      };

      renderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 3.5, // 0.5s 전 -> progress = 0.0
        vanishingX: vx,
        vanishingY: vy,
      });

      const zone5 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 5)!;
      const baseR = Math.max(zone5.width * vw, zone5.height * vh) * 0.5 + 4;
      const arcCalls = vi.mocked(ctx.arc).mock.calls;
      expect(arcCalls.length).toBeGreaterThanOrEqual(1);
      const [, , r] = arcCalls[0];
      expect(r).toBeCloseTo(baseR * 2.5, 0);
    });
  });

  describe('6. 설정(config) 기반 아이콘/심볼 및 비주얼 동적 렌더링 (Issue #316 - RENDER-NOTE-CONFIG-001)', () => {
    it('기본 visualConfig가 DEFAULT_STAR_NOTE_VISUAL_CONFIG와 일치하며 하드코딩 없이 적용된다', () => {
      const visualConfig: StarNoteVisualConfig = renderer.getVisualConfig();
      expect(visualConfig).toBeDefined();
      expect(visualConfig.baseRadius).toBe(DEFAULT_STAR_NOTE_VISUAL_CONFIG.baseRadius);
      expect(visualConfig.instrumentSymbols.foot).toBe(DEFAULT_STAR_NOTE_VISUAL_CONFIG.instrumentSymbols.foot);
      expect(visualConfig.instrumentSymbols.hand).toBe(DEFAULT_STAR_NOTE_VISUAL_CONFIG.instrumentSymbols.hand);
    });

    it('생성자 visualConfig 옵션을 통해 foot 악기 심볼을 커스텀 변경하면 해당 심볼이 렌더링된다', () => {
      const customRenderer = new StarNoteRenderer({
        visualConfig: {
          instrumentSymbols: {
            foot: '✨',
            hand: '⭐',
          },
        },
      });

      const target: ActiveStarTarget = {
        patternId: 'p-foot',
        part: 'hip',
        zoneId: 9,
        beatIndex: 1,
        landingTime: 4.0,
        instrument: 'foot',
      } as any;

      customRenderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 3.8,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(ctx.fillText).toHaveBeenCalledWith('✨', expect.any(Number), expect.any(Number));
    });

    it('커스텀 resolveSymbol 함수가 제공되면 target에 맞춰 동적 심볼을 반환하여 렌더링한다', () => {
      const customRenderer = new StarNoteRenderer({
        visualConfig: {
          resolveSymbol: (t) => `N-${t.zoneId}`,
        },
      });

      const target: ActiveStarTarget = {
        patternId: 'p-custom',
        part: 'leftHand',
        zoneId: 3,
        beatIndex: 1,
        landingTime: 4.0,
      };

      customRenderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 3.8,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(ctx.fillText).toHaveBeenCalledWith('N-3', expect.any(Number), expect.any(Number));
    });

    it('visualConfig의 폰트 크기 배율(symbolFontSizeFactor)이 텍스트 폰트 설정에 반영된다', () => {
      const customRenderer = new StarNoteRenderer({
        visualConfig: {
          symbolFontSizeFactor: 40,
        },
      });

      const target: ActiveStarTarget = {
        patternId: 'p-font',
        part: 'rightHand',
        zoneId: 5,
        beatIndex: 1,
        landingTime: 4.0,
      };

      customRenderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 4.0, // progress = 1.0 -> scale = 1.2
        vanishingX: vx,
        vanishingY: vy,
      });

      // scale 1.2 * factor 40 = 48px
      expect(ctx.font).toContain('48px');
    });

    it('visualConfig의 partColors 설정을 오버라이드하면 변경된 색상으로 테두리가 렌더링된다', () => {
      const customRenderer = new StarNoteRenderer({
        visualConfig: {
          partColors: {
            leftHand: '#FF0055',
          },
        },
      });

      const target: ActiveStarTarget = {
        patternId: 'p-color',
        part: 'leftHand',
        zoneId: 1,
        beatIndex: 1,
        landingTime: 4.0,
      };

      customRenderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 3.8,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(ctx.strokeStyle).toContain('FF0055');
    });
  });

  describe('9. 2박 사전 비행 및 첫 노트 1박 예외 렌더 계약 (Issue #407 - RHYTHM-INTRO-003)', () => {
    const t0 = 10.0;
    const secondsPerBeat = 0.5; // 120 BPM
    const previewOption: StarBeatPreviewOptions = {
      startTime: t0,
      secondsPerBeat,
      leadBeats: 2,
    };

    const target1: ActiveStarTarget = {
      patternId: 'p1',
      part: 'leftHand',
      zoneId: 4,
      beatIndex: 1,
      landingTime: t0 + 0.5, // 10.5 (1st star)
    };

    const target2: ActiveStarTarget = {
      patternId: 'p1',
      part: 'rightHand',
      zoneId: 5,
      beatIndex: 2,
      landingTime: t0 + 1.0, // 11.0 (2nd star)
    };

    const target3: ActiveStarTarget = {
      patternId: 'p1',
      part: 'head',
      zoneId: 2,
      beatIndex: 3,
      landingTime: t0 + 1.5, // 11.5 (3rd star)
    };

    it('기본 설정 DEFAULT_STAR_PREVIEW_CONFIG 값은 leadBeats=2, minSecondsPerBeat=0.05 이다', () => {
      expect(DEFAULT_STAR_PREVIEW_CONFIG.leadBeats).toBe(2);
      expect(DEFAULT_STAR_PREVIEW_CONFIG.minSecondsPerBeat).toBe(0.05);
    });

    describe('첫 번째 별 (착지 t0 + 0.5s): 1박 예외 처리 및 소실점 정규화', () => {
      it('elapsedTime < t0 (10.0) 일 때 inFlight=false로 보이지 않는다', () => {
        const pos = renderer.computeNotePosition(
          target1,
          9.9,
          vx,
          vy,
          vw,
          vh,
          DEFAULT_FITNESS_ZONES,
          previewOption,
        );
        expect(pos.inFlight).toBe(false);
      });

      it('분기 시작 시점(elapsedTime = 10.0)에 정확히 소실점(progress = 0.0)에서 출발한다 (중간 생성 방지)', () => {
        const pos = renderer.computeNotePosition(
          target1,
          10.0,
          vx,
          vy,
          vw,
          vh,
          DEFAULT_FITNESS_ZONES,
          previewOption,
        );
        expect(pos.inFlight).toBe(true);
        expect(pos.progress).toBeCloseTo(0.0, 4);
        expect(pos.x).toBeCloseTo(vx, 2);
        expect(pos.y).toBeCloseTo(vy, 2);
        expect(pos.scale).toBeCloseTo(0.3, 2);
      });

      it('elapsedTime = 10.25 (비행 절반)일 때 progress = 0.5 이다', () => {
        const pos = renderer.computeNotePosition(
          target1,
          10.25,
          vx,
          vy,
          vw,
          vh,
          DEFAULT_FITNESS_ZONES,
          previewOption,
        );
        expect(pos.inFlight).toBe(true);
        expect(pos.progress).toBeCloseTo(0.5, 4);
      });

      it('착지 시점(elapsedTime = 10.5)일 때 progress = 1.0으로 목표 존 중심에 도달한다', () => {
        const zone4 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 4)!;
        const zone4CenterX = (zone4.x + zone4.width * 0.5) * vw;
        const zone4CenterY = (zone4.y + zone4.height * 0.5) * vh;

        const pos = renderer.computeNotePosition(
          target1,
          10.5,
          vx,
          vy,
          vw,
          vh,
          DEFAULT_FITNESS_ZONES,
          previewOption,
        );
        expect(pos.inFlight).toBe(true);
        expect(pos.progress).toBeCloseTo(1.0, 4);
        expect(Math.abs(pos.x - zone4CenterX)).toBeLessThan(1.0);
        expect(Math.abs(pos.y - zone4CenterY)).toBeLessThan(1.0);
      });
    });

    describe('두 번째 별 (착지 t0 + 1.0s): 2박 예고 (지속 시간 1.0s)', () => {
      it('displayStart는 max(10.0, 11.0 - 2 * 0.5) = 10.0 이며, 10.0 이전에는 inFlight=false', () => {
        const before = renderer.computeNotePosition(
          target2,
          9.95,
          vx,
          vy,
          vw,
          vh,
          DEFAULT_FITNESS_ZONES,
          previewOption,
        );
        expect(before.inFlight).toBe(false);

        const start = renderer.computeNotePosition(
          target2,
          10.0,
          vx,
          vy,
          vw,
          vh,
          DEFAULT_FITNESS_ZONES,
          previewOption,
        );
        expect(start.inFlight).toBe(true);
        expect(start.progress).toBeCloseTo(0.0, 4);
      });

      it('elapsedTime = 10.5 (1박 경과)일 때 progress = 0.5 이다', () => {
        const mid = renderer.computeNotePosition(
          target2,
          10.5,
          vx,
          vy,
          vw,
          vh,
          DEFAULT_FITNESS_ZONES,
          previewOption,
        );
        expect(mid.inFlight).toBe(true);
        expect(mid.progress).toBeCloseTo(0.5, 4);
      });

      it('착지 시점(elapsedTime = 11.0)에 progress = 1.0 에 도달한다', () => {
        const end = renderer.computeNotePosition(
          target2,
          11.0,
          vx,
          vy,
          vw,
          vh,
          DEFAULT_FITNESS_ZONES,
          previewOption,
        );
        expect(end.inFlight).toBe(true);
        expect(end.progress).toBeCloseTo(1.0, 4);
      });
    });

    describe('세 번째 별 (착지 t0 + 1.5s): 2박 예고 (displayStart = t0 + 0.5)', () => {
      it('elapsedTime < 10.5 일 때는 아직 나타나지 않고 inFlight=false 이다', () => {
        const pos = renderer.computeNotePosition(
          target3,
          10.4,
          vx,
          vy,
          vw,
          vh,
          DEFAULT_FITNESS_ZONES,
          previewOption,
        );
        expect(pos.inFlight).toBe(false);
      });

      it('elapsedTime = 10.5 에서 소실점(progress = 0.0)으로 출현한다', () => {
        const pos = renderer.computeNotePosition(
          target3,
          10.5,
          vx,
          vy,
          vw,
          vh,
          DEFAULT_FITNESS_ZONES,
          previewOption,
        );
        expect(pos.inFlight).toBe(true);
        expect(pos.progress).toBeCloseTo(0.0, 4);
      });

      it('elapsedTime = 11.0 일 때 progress = 0.5, 착지 시점(11.5)에 progress = 1.0 이다', () => {
        const mid = renderer.computeNotePosition(
          target3,
          11.0,
          vx,
          vy,
          vw,
          vh,
          DEFAULT_FITNESS_ZONES,
          previewOption,
        );
        expect(mid.progress).toBeCloseTo(0.5, 4);

        const end = renderer.computeNotePosition(
          target3,
          11.5,
          vx,
          vy,
          vw,
          vh,
          DEFAULT_FITNESS_ZONES,
          previewOption,
        );
        expect(end.progress).toBeCloseTo(1.0, 4);
      });
    });

    describe('유효하지 않은 preview 데이터 fallback 처리', () => {
      it('secondsPerBeat <= 0 또는 minSecondsPerBeat(0.05) 미만일 때 기존 travelDuration(0.5s)으로 fallback한다', () => {
        const invalidPreview: StarBeatPreviewOptions = {
          startTime: 10.0,
          secondsPerBeat: 0,
        };
        // travelDuration은 0.5s이므로 landingTime 10.5에 대해 10.0 이전엔 inFlight=false, 10.0에서 progress=0.0
        const pos = renderer.computeNotePosition(
          target1,
          10.0,
          vx,
          vy,
          vw,
          vh,
          DEFAULT_FITNESS_ZONES,
          invalidPreview,
        );
        expect(pos.inFlight).toBe(true);
        expect(pos.progress).toBeCloseTo(0.0, 4);

        // secondsPerBeat = 0.01 (< 0.05) fallback
        const tooSmallPreview: StarBeatPreviewOptions = {
          startTime: 10.0,
          secondsPerBeat: 0.01,
        };
        const pos2 = renderer.computeNotePosition(
          target1,
          10.0,
          vx,
          vy,
          vw,
          vh,
          DEFAULT_FITNESS_ZONES,
          tooSmallPreview,
        );
        expect(pos2.inFlight).toBe(true);
        expect(pos2.progress).toBeCloseTo(0.0, 4);
      });

      it('secondsPerBeat 또는 startTime이 NaN / Infinity 일 때도 안전하게 fallback한다', () => {
        const nanPreview: StarBeatPreviewOptions = {
          startTime: NaN,
          secondsPerBeat: 0.5,
        };
        const pos = renderer.computeNotePosition(
          target1,
          10.25,
          vx,
          vy,
          vw,
          vh,
          DEFAULT_FITNESS_ZONES,
          nanPreview,
        );
        // fallback to travelDuration=0.5 -> at 10.25, progress = (10.25 - 10.0) / 0.5 = 0.5
        expect(pos.inFlight).toBe(true);
        expect(pos.progress).toBeCloseTo(0.5, 4);
      });

      it('beatPreview가 undefined인 경우 기존 0.5s travelDuration 동작을 100% 유지한다', () => {
        const pos = renderer.computeNotePosition(
          target1,
          10.0,
          vx,
          vy,
          vw,
          vh,
          DEFAULT_FITNESS_ZONES,
          undefined,
        );
        expect(pos.inFlight).toBe(true);
        expect(pos.progress).toBeCloseTo(0.0, 4);
      });
    });

    describe('render() 통합 및 렌더 우선순위 정렬', () => {
      it('state.beatPreview가 제공되면 render 시 반영되어 출현 전 노트는 그려지지 않는다', () => {
        const renderState: StarNoteRenderState = {
          target: target3, // landingTime = 11.5, displayStart = 10.5
          elapsedTime: 10.2, // 아직 출현 전
          vanishingX: vx,
          vanishingY: vy,
          beatPreview: previewOption,
        };

        renderer.render(ctx, vw, vh, renderState);
        expect(ctx.save).not.toHaveBeenCalled();
      });

      it('출현 후 비행 중인 상태에서는 정상적으로 canvas에 렌더링된다', () => {
        const renderState: StarNoteRenderState = {
          target: target1,
          elapsedTime: 10.25,
          vanishingX: vx,
          vanishingY: vy,
          beatPreview: previewOption,
        };

        renderer.render(ctx, vw, vh, renderState);
        expect(ctx.save).toHaveBeenCalled();
        expect(ctx.restore).toHaveBeenCalled();
      });

      it('여러 타겟이 전달되었을 때 landingTime이 더 이른 노트(가까운 착지)를 우선순위에 두고 렌더링한다', () => {
        const renderSpy = vi.spyOn(renderer as any, '_renderSingleTarget');

        const renderState: StarNoteRenderState = {
          targets: [target3, target1, target2], // 무작위 순서: 11.5, 10.5, 11.0
          elapsedTime: 10.6,
          vanishingX: vx,
          vanishingY: vy,
          beatPreview: previewOption,
        };

        renderer.render(ctx, vw, vh, renderState);

        expect(renderSpy).toHaveBeenCalledTimes(3);
        // 착지 시각 순서대로 정렬되어 호출되었는지 검증: target1(10.5) -> target2(11.0) -> target3(11.5)
        expect(renderSpy.mock.calls[0][3]).toBe(target1);
        expect(renderSpy.mock.calls[1][3]).toBe(target2);
        expect(renderSpy.mock.calls[2][3]).toBe(target3);

        renderSpy.mockRestore();
      });

      it('lateWindow 초과 시 inFlight=false 가 되어 렌더링되지 않는다', () => {
        const renderState: StarNoteRenderState = {
          target: target1, // landingTime = 10.5, lateWindow = 0.40 -> 10.9 초과 시 만료
          elapsedTime: 10.95,
          vanishingX: vx,
          vanishingY: vy,
          beatPreview: previewOption,
        };

        renderer.render(ctx, vw, vh, renderState);
        expect(ctx.save).not.toHaveBeenCalled();
      });
    });
  });

  describe('Issue #424 [RENDER-NOTE-IMAGE-001] 비트맵 이미지 렌더링 및 어프로치 박스 제어', () => {
    let rendererWithImage: StarNoteRenderer;
    let mockImg: any;

    beforeEach(() => {
      mockImg = { width: 512, height: 512, complete: true, naturalWidth: 512, naturalHeight: 512 };
      rendererWithImage = new StarNoteRenderer({
        visualConfig: {
          renderMode: 'image',
          showApproachRing: true,
          iconImages: {
            leftHand: '/img/stardust/stardust_icon_cyan.png',
            rightHand: '/img/stardust/stardust_icon_gold.png',
          },
        },
      });
      rendererWithImage.setImage('leftHand', mockImg);
      rendererWithImage.setImage('rightHand', mockImg);
    });

    it('DEFAULT_STAR_NOTE_VISUAL_CONFIG에 renderMode와 showApproachRing 기본값이 정의되어 있다', () => {
      expect((DEFAULT_STAR_NOTE_VISUAL_CONFIG as any).renderMode).toBe('image');
      expect((DEFAULT_STAR_NOTE_VISUAL_CONFIG as any).showApproachRing).toBe(true);
      expect((DEFAULT_STAR_NOTE_VISUAL_CONFIG as any).iconImages).toBeDefined();
    });

    it('renderMode가 image이고 이미지가 등록되어 있으면 ctx.drawImage를 호출하고 fillText는 호출하지 않는다', () => {
      const renderState: StarNoteRenderState = {
        target: { zoneId: 1, landingTime: 1.0, part: 'leftHand', instrument: 'hand' } as any,
        elapsedTime: 0.8,
        vanishingX: vx,
        vanishingY: vy,
      };

      rendererWithImage.render(ctx, vw, vh, renderState);

      expect(ctx.drawImage).toHaveBeenCalled();
      // 별 아이콘을 텍스트로 그리는 fillText는 호출되지 않아야 함
      expect(ctx.fillText).not.toHaveBeenCalled();
    });

    it('renderMode가 image이지만 이미지가 없으면 텍스트 fallback(ctx.fillText)으로 정상 동작한다', () => {
      const fallbackRenderer = new StarNoteRenderer({
        visualConfig: {
          renderMode: 'image',
        },
      });

      const renderState: StarNoteRenderState = {
        target: { zoneId: 1, landingTime: 1.0, part: 'head', instrument: 'hand' } as any,
        elapsedTime: 0.8,
        vanishingX: vx,
        vanishingY: vy,
      };

      fallbackRenderer.render(ctx, vw, vh, renderState);

      expect(ctx.fillText).toHaveBeenCalled();
      expect(ctx.drawImage).not.toHaveBeenCalled();
    });

    it('renderMode가 text이면 이미지가 등록되어 있어도 ctx.fillText를 호출한다', () => {
      const textRenderer = new StarNoteRenderer({
        visualConfig: {
          renderMode: 'text',
        },
      });
      textRenderer.setImage('leftHand', mockImg);

      const renderState: StarNoteRenderState = {
        target: { zoneId: 1, landingTime: 1.0, part: 'leftHand', instrument: 'hand' } as any,
        elapsedTime: 0.8,
        vanishingX: vx,
        vanishingY: vy,
      };

      textRenderer.render(ctx, vw, vh, renderState);

      expect(ctx.fillText).toHaveBeenCalled();
      expect(ctx.drawImage).not.toHaveBeenCalled();
    });

    it('showApproachRing이 false이면 어프로치 사각박스(Approach Ring) 렌더링이 생략된다', () => {
      const noRingRenderer = new StarNoteRenderer({
        visualConfig: {
          showApproachRing: false,
        },
      });

      const approachSpy = vi.spyOn(noRingRenderer as any, '_renderApproachRing');

      const renderState: StarNoteRenderState = {
        target: { zoneId: 1, landingTime: 1.0, part: 'leftHand', instrument: 'hand' } as any,
        elapsedTime: 0.7, // 진행 중
        vanishingX: vx,
        vanishingY: vy,
      };

      noRingRenderer.render(ctx, vw, vh, renderState);

      expect(approachSpy).not.toHaveBeenCalled();
    });

    it('showApproachRing이 true이면 어프로치 사각박스(Approach Ring) 렌더링이 호출된다', () => {
      const ringRenderer = new StarNoteRenderer({
        visualConfig: {
          showApproachRing: true,
        },
      });

      const approachSpy = vi.spyOn(ringRenderer as any, '_renderApproachRing');

      const renderState: StarNoteRenderState = {
        target: { zoneId: 1, landingTime: 1.0, part: 'leftHand', instrument: 'hand' } as any,
        elapsedTime: 0.7,
        vanishingX: vx,
        vanishingY: vy,
      };

      ringRenderer.render(ctx, vw, vh, renderState);

      expect(approachSpy).toHaveBeenCalled();
    });
  });

  describe('Issue #429 [RENDER-NOTE-CIRCLE-001] & #473 [BUG-NOTE-CIRCLE-001] StarNoteRenderer 내부 원형 어프로치 링 및 골반(hip) 스텝 검증', () => {
    it('DEFAULT_STAR_NOTE_VISUAL_CONFIG의 approachShape 기본값은 circle이다', () => {
      expect(DEFAULT_STAR_NOTE_VISUAL_CONFIG.approachShape).toBe('circle');
    });

    it('approachShape가 circle일 때 _renderApproachRing은 ctx.arc(원형)을 호출하여 링을 그린다', () => {
      const circleRenderer = new StarNoteRenderer({
        visualConfig: {
          approachShape: 'circle',
          showApproachRing: true,
        },
      });

      const target: StarTarget = {
        patternId: 'S001',
        zoneId: 1,
        landingTime: 1.0,
        part: 'leftHand',
        beatIndex: 1,
      };

      const renderState: StarNoteRenderState = {
        target,
        elapsedTime: 0.7,
        vanishingX: vx,
        vanishingY: vy,
      };

      circleRenderer.render(ctx, vw, vh, renderState);

      // arc가 원형 링(어프로치 링 + 노트 본체)을 위해 호출되어야 함
      expect(ctx.arc).toHaveBeenCalled();
      expect(ctx.roundRect).not.toHaveBeenCalled();
      expect(ctx.strokeRect).not.toHaveBeenCalled();
    });

    it('골반/스텝(hip 타겟, Zone 10) StarNoteRenderer 내부 렌더링 시 타입 우회(as any) 없이 원형 어프로치 링이 호출된다 (#473 정정)', () => {
      const circleRenderer = new StarNoteRenderer({
        visualConfig: {
          approachShape: 'circle',
          showApproachRing: true,
        },
      });

      const approachSpy = vi.spyOn(circleRenderer as any, '_renderApproachRing');

      // 골반/스텝 타겟 (Zone 10, 정식 타입 hip)
      // 실제 인게임 러닝 매트 발 노트(♪, L/C/R)는 RunningMatRenderer로 분리되어 있으며 MRN-08에서 통합됨
      const target: StarTarget = {
        patternId: 'S001',
        zoneId: 10,
        landingTime: 2.0,
        part: 'hip',
        beatIndex: 1,
      };

      const renderState: StarNoteRenderState = {
        target,
        elapsedTime: 1.7,
        vanishingX: vx,
        vanishingY: vy,
      };

      circleRenderer.render(ctx, vw, vh, renderState);

      expect(approachSpy).toHaveBeenCalled();
      expect(ctx.arc).toHaveBeenCalled();
    });

    it('착지 직전(Perfect 윈도우) 펄스 연출(_renderZonePulse)도 circle 모드에서는 ctx.arc로 렌더링된다 (hip, Zone 10, #473)', () => {
      const circleRenderer = new StarNoteRenderer({
        visualConfig: {
          approachShape: 'circle',
        },
      });

      const pulseSpy = vi.spyOn(circleRenderer as any, '_renderZonePulse');

      const target: StarTarget = {
        patternId: 'S001',
        zoneId: 10,
        landingTime: 2.0,
        part: 'hip',
        beatIndex: 1,
      };

      const renderState: StarNoteRenderState = {
        target,
        elapsedTime: 1.95, // landingTime - 0.05s (<= perfectWindow 0.12s)
        vanishingX: vx,
        vanishingY: vy,
      };

      circleRenderer.render(ctx, vw, vh, renderState);

      expect(pulseSpy).toHaveBeenCalled();
      expect(ctx.roundRect).not.toHaveBeenCalled();
      expect(ctx.strokeRect).not.toHaveBeenCalled();
    });

    it('approachShape가 rect로 명시되면 기존처럼 roundRect 또는 strokeRect로 사각박스를 그린다', () => {
      const rectRenderer = new StarNoteRenderer({
        visualConfig: {
          approachShape: 'rect',
          showApproachRing: true,
        },
      });

      const target: StarTarget = {
        patternId: 'S001',
        zoneId: 1,
        landingTime: 1.0,
        part: 'leftHand',
        beatIndex: 1,
      };

      const renderState: StarNoteRenderState = {
        target,
        elapsedTime: 0.7,
        vanishingX: vx,
        vanishingY: vy,
      };

      rectRenderer.render(ctx, vw, vh, renderState);

      expect(ctx.roundRect).toHaveBeenCalled();
    });

    it('#473 [BUG-NOTE-CIRCLE-001]: star-note-renderer.test.ts 내에 part: \'foot\' 타입 우회가 존재하지 않아야 한다', () => {
      const testFilePath = path.resolve(__dirname, 'star-note-renderer.test.ts');
      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).not.toMatch(/part:\s*['"]foot['"]/);
    });
  });
});
