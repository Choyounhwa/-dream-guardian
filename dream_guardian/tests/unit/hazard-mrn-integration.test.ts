/**
 * hazard-mrn-integration.test.ts - EvadeJudge 및 Phase A 장판 투사체 통합 단위/통합 테스트
 *
 * @see docs/12_UNIFIED_MOTION_RHYTHM_ARCHITECTURE.md (§5 인터랙션 판정 모델, §9 MRN-10)
 * @see Issue #484 [MRN-10]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hazardPatternToMotionNote,
  hazardPatternsToMotionNotes,
  motionNoteToHazardPattern,
  hazardPatternToRenderItem,
  getHazardExpectedIntent,
} from '../../src/game/adapters/hazardAdapter.js';
import { EvadeJudge } from '../../src/game/interaction/EvadeJudge.js';
import {
  HazardZoneRenderer,
  type HazardRenderState,
} from '../../src/render/HazardZoneRenderer.js';
import { MotionNoteRenderer } from '../../src/render/MotionNoteRenderer.js';
import { MotionNoteTimeline } from '../../src/game/MotionNoteTimeline.js';
import type { MotionNote, MotionNoteRuntime } from '../../src/types/motion-note.js';
import type { MotionInputSnapshot } from '../../src/game/interaction/TapJudge.js';
import type { PhaseAHazardPattern } from '../../config/phase-a-hazard.config.js';

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
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 100 }),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
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

describe('MRN-10: EvadeJudge + Phase A 장판 투사체 통합', () => {
  describe('1. hazardAdapter (PhaseAHazardPattern -> MotionNote 변환)', () => {
    it('각 5대 회피 패턴을 interaction: "evade", profileId: "hazard_floor"를 가진 MotionNote로 변환해야 한다', () => {
      const leftNote = hazardPatternToMotionNote('left_step', { beat: 2 });
      expect(leftNote.interaction).toBe('evade');
      expect(leftNote.profileId).toBe('hazard_floor');
      expect(leftNote.source).toBe('hazard');
      expect(leftNote.beat).toBe(2);
      expect(leftNote.requirements).toEqual([{ part: 'leftFoot', zoneId: 9 }]);

      const rightNote = hazardPatternToMotionNote('right_step', { beat: 3 });
      expect(rightNote.interaction).toBe('evade');
      expect(rightNote.profileId).toBe('hazard_floor');
      expect(rightNote.requirements).toEqual([{ part: 'rightFoot', zoneId: 11 }]);

      const jumpNote = hazardPatternToMotionNote('jump', { beat: 4 });
      expect(jumpNote.interaction).toBe('evade');
      expect(jumpNote.profileId).toBe('hazard_floor');
      expect(jumpNote.requirements).toEqual([{ part: 'bothFeet', zoneId: 10 }]);

      const balLeftNote = hazardPatternToMotionNote('balance_left', { beat: 5 });
      expect(balLeftNote.interaction).toBe('evade');
      expect(balLeftNote.requirements).toEqual([{ part: 'rightFoot', zoneId: 11 }]);

      const balRightNote = hazardPatternToMotionNote('balance_right', { beat: 6 });
      expect(balRightNote.interaction).toBe('evade');
      expect(balRightNote.requirements).toEqual([{ part: 'leftFoot', zoneId: 9 }]);
    });

    it('motionNoteToHazardPattern을 통해 MotionNote에서 원본 패턴으로 왕복 변환되어야 한다', () => {
      const patterns: PhaseAHazardPattern[] = ['jump', 'left_step', 'right_step', 'balance_left', 'balance_right'];
      for (const pat of patterns) {
        const note = hazardPatternToMotionNote(pat);
        const restored = motionNoteToHazardPattern(note);
        expect(restored).toBe(pat);
      }
    });

    it('hazardPatternsToMotionNotes를 통해 여러 패턴을 비트 순서열로 일괄 변환할 수 있다', () => {
      const notes = hazardPatternsToMotionNotes(['left_step', 'right_step', 'jump']);
      expect(notes).toHaveLength(3);
      expect(notes[0].beat).toBe(1);
      expect(notes[1].beat).toBe(2);
      expect(notes[2].beat).toBe(3);
      expect(notes.every((n) => n.interaction === 'evade')).toBe(true);
    });

    it('hazardPatternToRenderItem으로 렌더 아이템을 올바르게 생성해야 한다', () => {
      const item = hazardPatternToRenderItem('jump', 0.6, { isResolved: false });
      expect(item.interaction).toBe('evade');
      expect(item.profileId).toBe('hazard_floor');
      expect(item.progress).toBeCloseTo(0.6, 5);
      expect(item.outcome).toBeUndefined();

      const itemEvaded = hazardPatternToRenderItem('left_step', 1.0, {
        isResolved: true,
        isEvaded: true,
      });
      expect(itemEvaded.outcome).toBe('miss'); // hazard_floor: miss = 회피 성공 (hazardEvade)

      const itemHit = hazardPatternToRenderItem('left_step', 1.0, {
        isResolved: true,
        isEvaded: false,
      });
      expect(itemHit.outcome).toBe('hit'); // hit = 피격
    });

    it('getHazardExpectedIntent가 각 패턴별 대응 인텐트를 반환해야 한다', () => {
      expect(getHazardExpectedIntent('jump')).toBe('jump');
      expect(getHazardExpectedIntent('left_step')).toBe('stepLeft');
      expect(getHazardExpectedIntent('right_step')).toBe('stepRight');
      expect(getHazardExpectedIntent('balance_left')).toBe('stepLeft');
      expect(getHazardExpectedIntent('balance_right')).toBe('stepRight');
    });
  });

  describe('2. EvadeJudge (판정 로직: 타이밍, pre-buffer, coyote, 존 체류)', () => {
    let judge: EvadeJudge;
    const landingTime = 2.0;

    beforeEach(() => {
      judge = new EvadeJudge({
        timingWindows: { early: 0.35, perfect: 0.10, good: 0.22, late: 0.35 },
        timingLeniency: { preBufferWindow: 0.20, postGraceWindow: 0.15, enablePreBuffer: true, enablePostGrace: true },
      });
    });

    function createRuntime(note: MotionNote): MotionNoteRuntime {
      return {
        note,
        landingTime,
        displayStart: 0.0,
        state: 'judging',
      };
    }

    it('비(非) evade 노트에 대해서는 판정하지 않고 null을 반환한다', () => {
      const tapNote: MotionNote = {
        id: 'star_1',
        patternId: 'star_1',
        beat: 1,
        requirements: [{ part: 'leftHand', zoneId: 1 }],
        interaction: 'tap',
        source: 'star',
      };
      const rt = createRuntime(tapNote);
      expect(judge.evaluate(rt, {}, 2.0)).toBeNull();
    });

    it('창 열리기 전(pre-buffer 이전)에는 null을 반환한다', () => {
      const note = hazardPatternToMotionNote('jump');
      const rt = createRuntime(note);
      // early = 0.35, preBuffer = 0.20 -> preBufferStart = 2.0 - 0.55 = 1.45
      expect(judge.evaluate(rt, {}, 1.0)).toBeNull();
    });

    it('정규 입력창 내에서 회피 인텐트가 발생하면 Perfect 또는 Good을 판정한다', () => {
      const note = hazardPatternToMotionNote('jump');
      const rt = createRuntime(note);

      // landingTime = 2.0, perfectWindow = 0.10
      const perfectInput: MotionInputSnapshot = {
        recentIntents: [{ type: 'jump', confidence: 0.9, timestamp: 2.02 }],
      };
      const res1 = judge.evaluate(rt, perfectInput, 2.02);
      expect(res1).not.toBeNull();
      expect(res1?.rating).toBe('Perfect');
      expect(res1?.success).toBe(true);

      // goodWindow = 0.22
      const goodInput: MotionInputSnapshot = {
        recentIntents: [{ type: 'jump', confidence: 0.9, timestamp: 2.18 }],
      };
      const res2 = judge.evaluate(rt, goodInput, 2.18);
      expect(res2).not.toBeNull();
      expect(res2?.rating).toBe('Good');
      expect(res2?.success).toBe(true);
    });

    it('선행 입력 버퍼(pre-buffer): 윈도우 개방 직전 인텐트를 버퍼링 후 정규 창 개방 시 Good으로 확정한다', () => {
      const note = hazardPatternToMotionNote('left_step');
      const rt = createRuntime(note);

      // preBufferStart = 1.45, normalStart = 1.65
      // 1.55초 (pre-buffer 윈도우 내부)
      const preInput: MotionInputSnapshot = {
        recentIntents: [{ type: 'stepLeft', confidence: 0.95, timestamp: 1.55 }],
      };

      // pre-buffer 시점에는 버퍼링되어 아직 소비되지 않고 null 반환
      const bufferedRes = judge.evaluate(rt, preInput, 1.55);
      expect(bufferedRes).toBeNull();

      // 정규 입력창 개방 시점 (1.65초) 도달 시 버퍼 소비되어 Good 확정
      const consumedRes = judge.evaluate(rt, {}, 1.65);
      expect(consumedRes).not.toBeNull();
      expect(consumedRes?.rating).toBe('Good');
      expect(consumedRes?.success).toBe(true);
      expect(consumedRes?.details?.viaPreBuffer).toBe(true);
    });

    it('후행 유예(Coyote Time): 정규 창 종료 후 coyote 윈도우 내 인텐트 발생 시 Good(viaGrace)으로 구제한다', () => {
      const note = hazardPatternToMotionNote('right_step');
      const rt = createRuntime(note);

      // normalEnd = 2.0 + 0.35 = 2.35, graceEnd = 2.35 + 0.15 = 2.50
      // 2.40초 (coyote time 내부)
      const graceInput: MotionInputSnapshot = {
        recentIntents: [{ type: 'stepRight', confidence: 0.9, timestamp: 2.40 }],
      };

      const res = judge.evaluate(rt, graceInput, 2.40);
      expect(res).not.toBeNull();
      expect(res?.rating).toBe('Good');
      expect(res?.success).toBe(true);
      expect(res?.details?.viaGrace).toBe(true);
    });

    it('위치 기반 회피: 착지 시점에 플레이어가 위험 존 밖에 위치하면 Perfect로 성공한다', () => {
      const note = hazardPatternToMotionNote('left_step'); // zoneId: 9
      const rt = createRuntime(note);

      // landingTime(2.0초)에 플레이어 발이 zone 10(중앙)에 위치 -> zone 9 밖
      const safeInput: MotionInputSnapshot = {
        cursorZones: { leftFoot: 10 } as any,
      };

      const res = judge.evaluate(rt, safeInput, 2.0);
      expect(res).not.toBeNull();
      expect(res?.success).toBe(true);
      expect(res?.rating).toBe('Perfect');
    });

    it('위치 기반 회피: 위험 존에 체류 중이면 만료 전까지는 대기하고, coyote 만료 시 Miss로 확정한다', () => {
      const note = hazardPatternToMotionNote('left_step'); // zoneId: 9
      const rt = createRuntime(note);

      // 플레이어가 위험 존(9)에 체류
      const dangerousInput: MotionInputSnapshot = {
        cursorZones: { leftFoot: 9 } as any,
      };

      // 착지 순간(2.0초)에는 아직 coyote 윈도우가 남아있으므로 즉시 Miss 확정하지 않고 null
      expect(judge.evaluate(rt, dangerousInput, 2.0)).toBeNull();
      expect(judge.evaluate(rt, dangerousInput, 2.30)).toBeNull();

      // graceEnd(2.50초) 초과 시 Miss 확정
      const missRes = judge.evaluate(rt, dangerousInput, 2.51);
      expect(missRes).not.toBeNull();
      expect(missRes?.success).toBe(false);
      expect(missRes?.rating).toBe('Miss');
    });

    it('위치 기반 회피: 착지 순간에는 위험 존에 있었으나 coyote 시간 내에 벗어나면 Good(viaGrace)으로 구제된다', () => {
      const note = hazardPatternToMotionNote('left_step'); // zoneId: 9
      const rt = createRuntime(note);

      // 착지 순간(2.0초): zone 9 체류
      judge.evaluate(rt, { cursorZones: { leftFoot: 9 } as any }, 2.0);

      // 2.38초 (coyote 구간): zone 10으로 벗어남
      const escapedInput: MotionInputSnapshot = {
        cursorZones: { leftFoot: 10 } as any,
      };
      const res = judge.evaluate(rt, escapedInput, 2.38);
      expect(res).not.toBeNull();
      expect(res?.success).toBe(true);
      expect(res?.rating).toBe('Good');
      expect(res?.details?.viaGrace).toBe(true);
    });

    it('MotionNoteTimeline에 EvadeJudge를 등록하여 타임라인 상에서 정상 판정되어야 한다', () => {
      const timeline = new MotionNoteTimeline({
        spb: 0.5,
        judges: [judge],
      });

      const note = hazardPatternToMotionNote('jump', { beat: 2 }); // landingTime = 0.5
      timeline.loadNotes([note], { sequenceStart: 0 });

      // sequenceStart = 0, beat 2 -> landingTime = 0 + (2 - 1) * 0.5 = 0.5
      const intentInput: MotionInputSnapshot = {
        recentIntents: [{ type: 'jump', confidence: 1.0, timestamp: 0.5 }],
      };

      const results = timeline.update(0.5, intentInput);
      expect(results).toHaveLength(1);
      expect(results[0].interaction).toBe('evade');
      expect(results[0].success).toBe(true);
      expect(results[0].rating).toBe('Perfect');
    });
  });

  describe('3. HazardZoneRenderer (투사체 MotionNoteRenderer 위임 및 바닥 경고 영역 유지)', () => {
    let renderer: HazardZoneRenderer;
    let ctx: CanvasRenderingContext2D;
    const vw = 1080;
    const vh = 2160;
    const vx = 540;
    const vy = 518.4;

    beforeEach(() => {
      renderer = new HazardZoneRenderer();
      ctx = createMockContext();
    });

    it('HazardZoneRenderer 생성 시 motionNoteRenderer 인스턴스가 기본 초기화된다', () => {
      expect(renderer.motionNoteRenderer).toBeDefined();
      expect(renderer.motionNoteRenderer).toBeInstanceOf(MotionNoteRenderer);
      expect(renderer.motionNoteRenderer.getProfiles().hazard_floor).toBeDefined();
    });

    it('외부에서 MotionNoteRenderer 인스턴스를 주입받을 수 있다', () => {
      const customMRN = new MotionNoteRenderer();
      const customRenderer = new HazardZoneRenderer(customMRN);
      expect(customRenderer.motionNoteRenderer).toBe(customMRN);
    });

    it('장판 비행 중(isResolved=false)일 때 MotionNoteRenderer.render가 hazard_floor 프로필로 위임 호출된다', () => {
      const spy = vi.spyOn(renderer.motionNoteRenderer, 'render');
      const state: HazardRenderState = {
        activePattern: 'jump',
        beatProgress: 0.5,
        vanishingX: vx,
        vanishingY: vy,
        isResolved: false,
      };

      renderer.render(ctx, vw, vh, state);

      expect(spy).toHaveBeenCalledTimes(1);
      const [calledCtx, calledItems, calledViewport, calledVanishing] = spy.mock.calls[0];
      expect(calledCtx).toBe(ctx);
      expect(calledViewport).toEqual({ width: vw, height: vh });
      expect(calledVanishing).toEqual({ x: vx, y: vy });

      expect(calledItems).toHaveLength(1);
      expect(calledItems[0].profileId).toBe('hazard_floor');
      expect(calledItems[0].interaction).toBe('evade');
      expect(calledItems[0].progress).toBeCloseTo(0.5, 5);
    });

    it('바닥 경고 영역 연출(바닥면 stroke/fill)이 위임 후에도 정상 유지된다', () => {
      const state: HazardRenderState = {
        activePattern: 'left_step',
        beatProgress: 0.8,
        vanishingX: vx,
        vanishingY: vy,
        isResolved: false,
      };

      renderer.render(ctx, vw, vh, state);

      // 바닥 충격파/레인 테두리 및 fill 호출 유지 확인
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
    });

    it('isResolved=true일 때는 비행 투사체 위임 대신 해결 시각 효과(소멸/폭발)가 표출된다', () => {
      const spy = vi.spyOn(renderer.motionNoteRenderer, 'render');
      const stateEvaded: HazardRenderState = {
        activePattern: 'right_step',
        beatProgress: 1.0,
        vanishingX: vx,
        vanishingY: vy,
        isResolved: true,
        isEvaded: true,
      };

      renderer.render(ctx, vw, vh, stateEvaded);

      // 비행 투사체 렌더러는 호출되지 않고, 바닥 소멸 이펙트만 표시
      expect(spy).not.toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });
});
