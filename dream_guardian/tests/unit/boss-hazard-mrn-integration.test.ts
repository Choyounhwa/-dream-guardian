/**
 * boss-hazard-mrn-integration.test.ts
 *
 * JumpJudge + 보스 장판(dual_slam/alternating_stomp/sweep) MRN-11 통합 단위/통합 테스트
 *
 * @see docs/12_UNIFIED_MOTION_RHYTHM_ARCHITECTURE.md (§5 인터랙션 판정 모델, §8, §9 MRN-11)
 * @see Issue #485 [MRN-11]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  bossHazardToMotionNote,
  bossHazardsToMotionNotes,
  motionNoteToBossHazard,
  bossHazardToRenderItem,
  getBossHazardExpectedIntent,
  bossHazardToRequirements,
  bossHazardToInteraction,
  type BossHazardType,
} from '../../src/game/adapters/bossHazardAdapter.js';
import { JumpJudge } from '../../src/game/interaction/JumpJudge.js';
import {
  BossClimaxRenderer,
  type BossClimaxRenderState,
} from '../../src/render/BossClimaxRenderer.js';
import { MotionNoteRenderer } from '../../src/render/MotionNoteRenderer.js';
import type { MotionNote, MotionNoteRuntime } from '../../src/types/motion-note.js';
import type { MotionInputSnapshot } from '../../src/game/interaction/TapJudge.js';
import type { MotionIntent, MotionIntentType } from '../../src/types/motion-intent.js';

function createIntent(type: MotionIntentType, timestamp: number, confidence: number = 1.0): MotionIntent {
  return { type, timestamp, confidence };
}

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
    measureText: vi.fn().mockReturnValue({ width: 80 }),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
    globalAlpha: 1.0,
    globalCompositeOperation: 'source-over',
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('[MRN-11 / Issue #485] 보스 장판 + JumpJudge 통합 테스트', () => {
  describe('1. bossHazardAdapter (패턴 -> MotionNote / RenderItem 변환)', () => {
    it('dual_slam 패턴을 jump 인터랙션, bothFeet(Zone 10), boss_slam 프로필의 MotionNote로 변환해야 한다', () => {
      const note = bossHazardToMotionNote('dual_slam', { beat: 2 });

      expect(note.interaction).toBe('jump');
      expect(note.requirements).toEqual([{ part: 'bothFeet', zoneId: 10 }]);
      expect(note.profileId).toBe('boss_slam');
      expect(note.beat).toBe(2);
      expect(note.source).toBe('boss');
    });

    it('alternating_stomp_left 패턴을 evade 인터랙션, leftFoot(Zone 9), boss_slam 프로필의 MotionNote로 변환해야 한다', () => {
      const note = bossHazardToMotionNote('alternating_stomp_left', { beat: 3 });

      expect(note.interaction).toBe('evade');
      expect(note.requirements).toEqual([{ part: 'leftFoot', zoneId: 9 }]);
      expect(note.profileId).toBe('boss_slam');
      expect(note.beat).toBe(3);
    });

    it('alternating_stomp_right 패턴을 evade 인터랙션, rightFoot(Zone 11), boss_slam 프로필의 MotionNote로 변환해야 한다', () => {
      const note = bossHazardToMotionNote('alternating_stomp_right', { beat: 4 });

      expect(note.interaction).toBe('evade');
      expect(note.requirements).toEqual([{ part: 'rightFoot', zoneId: 11 }]);
      expect(note.profileId).toBe('boss_slam');
      expect(note.beat).toBe(4);
    });

    it('sweep 패턴을 jump 인터랙션, bothFeet(Zone 10), boss_slam 프로필의 MotionNote로 변환해야 한다', () => {
      const note = bossHazardToMotionNote('sweep', { beat: 5 });

      expect(note.interaction).toBe('jump');
      expect(note.requirements).toEqual([{ part: 'bothFeet', zoneId: 10 }]);
      expect(note.profileId).toBe('boss_slam');
      expect(note.beat).toBe(5);
    });

    it('bossHazardToRequirements 헬퍼가 각 패턴별 요구 부위/존을 올바르게 반환해야 한다', () => {
      expect(bossHazardToRequirements('dual_slam')).toEqual([{ part: 'bothFeet', zoneId: 10 }]);
      expect(bossHazardToRequirements('alternating_stomp_left')).toEqual([{ part: 'leftFoot', zoneId: 9 }]);
      expect(bossHazardToRequirements('alternating_stomp_right')).toEqual([{ part: 'rightFoot', zoneId: 11 }]);
      expect(bossHazardToRequirements('sweep')).toEqual([{ part: 'bothFeet', zoneId: 10 }]);
    });

    it('bossHazardToInteraction 헬퍼가 각 패턴별 인터랙션 타입을 올바르게 반환해야 한다', () => {
      expect(bossHazardToInteraction('dual_slam')).toBe('jump');
      expect(bossHazardToInteraction('alternating_stomp_left')).toBe('evade');
      expect(bossHazardToInteraction('alternating_stomp_right')).toBe('evade');
      expect(bossHazardToInteraction('sweep')).toBe('jump');
    });

    it('getBossHazardExpectedIntent가 각 패턴별 대응 인텐트를 반환해야 한다', () => {
      expect(getBossHazardExpectedIntent('dual_slam')).toBe('jump');
      expect(getBossHazardExpectedIntent('alternating_stomp_left')).toBe('stepLeft');
      expect(getBossHazardExpectedIntent('alternating_stomp_right')).toBe('stepRight');
      expect(getBossHazardExpectedIntent('sweep')).toBe('jump');
    });

    it('bossHazardToRenderItem이 비행 렌더 아이템을 올바른 프로필 및 outcome으로 생성해야 한다', () => {
      const flyingItem = bossHazardToRenderItem('dual_slam', 0.65);
      expect(flyingItem.profileId).toBe('boss_slam');
      expect(flyingItem.progress).toBe(0.65);
      expect(flyingItem.interaction).toBe('jump');
      expect(flyingItem.outcome).toBeUndefined();

      // 회피 성공 시 miss outcome (장판 빗나감)
      const evadedItem = bossHazardToRenderItem('dual_slam', 1.0, {
        isResolved: true,
        isEvaded: true,
      });
      expect(evadedItem.outcome).toBe('miss');

      // 피격 시 hit outcome (장판 명중)
      const hitItem = bossHazardToRenderItem('dual_slam', 1.0, {
        isResolved: true,
        isEvaded: false,
      });
      expect(hitItem.outcome).toBe('hit');
    });

    it('motionNoteToBossHazard가 MotionNote를 역변환해야 한다', () => {
      const noteSlam = bossHazardToMotionNote('dual_slam');
      expect(motionNoteToBossHazard(noteSlam)).toBe('dual_slam');

      const noteLeft = bossHazardToMotionNote('alternating_stomp_left');
      expect(motionNoteToBossHazard(noteLeft)).toBe('alternating_stomp_left');

      const noteRight = bossHazardToMotionNote('alternating_stomp_right');
      expect(motionNoteToBossHazard(noteRight)).toBe('alternating_stomp_right');

      const noteSweep = bossHazardToMotionNote('sweep');
      expect(motionNoteToBossHazard(noteSweep)).toBe('sweep');
    });

    it('bossHazardsToMotionNotes가 패턴 목록을 연속된 비트 시퀀스로 일괄 변환해야 한다', () => {
      const patterns: BossHazardType[] = ['dual_slam', 'alternating_stomp_left', 'alternating_stomp_right'];
      const notes = bossHazardsToMotionNotes(patterns, 1, 2);

      expect(notes).toHaveLength(3);
      expect(notes[0].beat).toBe(1);
      expect(notes[1].beat).toBe(3);
      expect(notes[2].beat).toBe(5);
    });
  });

  describe('2. JumpJudge (점프 판정: 타이밍 윈도우, pre-buffer, grace, Miss)', () => {
    let judge: JumpJudge;
    const landingTime = 2.0;

    beforeEach(() => {
      judge = new JumpJudge({
        timingWindows: { early: 0.25, perfect: 0.10, good: 0.25, late: 0.25 },
        timingLeniency: {
          preBufferWindow: 0.15,
          postGraceWindow: 0.15,
          enablePreBuffer: true,
          enablePostGrace: true,
        },
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

    it('비(非) jump 인터랙션 노트는 판정하지 않고 null을 반환해야 한다', () => {
      const evadeNote: MotionNote = {
        id: 'evade_1',
        patternId: 'left_step',
        beat: 1,
        requirements: [{ part: 'leftFoot', zoneId: 9 }],
        interaction: 'evade',
      };
      const rt = createRuntime(evadeNote);
      expect(judge.evaluate(rt, { recentIntents: [createIntent('jump', 2.0)] }, 2.0)).toBeNull();
    });

    it('이미 해결된(resolved) 노트는 판정하지 않고 null을 반환해야 한다', () => {
      const note = bossHazardToMotionNote('dual_slam');
      const rt: MotionNoteRuntime = {
        note,
        landingTime,
        displayStart: 0.0,
        state: 'resolved',
      };
      expect(judge.evaluate(rt, { recentIntents: [createIntent('jump', 2.0)] }, 2.0)).toBeNull();
    });

    it('판정 창 열리기 전(pre-buffer 이전)에는 null을 반환해야 한다', () => {
      const note = bossHazardToMotionNote('dual_slam');
      const rt = createRuntime(note);

      // landingTime 2.0, early 0.25, preBuffer 0.15 -> bufferStart = 1.60
      const input: MotionInputSnapshot = {
        recentIntents: [createIntent('jump', 1.50)],
      };
      expect(judge.evaluate(rt, input, 1.50)).toBeNull();
    });

    it('착지 시점 기준 Perfect 윈도우(±0.10s) 안에서 jump 발생 시 Perfect로 판정해야 한다', () => {
      const note = bossHazardToMotionNote('dual_slam');
      const rt = createRuntime(note);

      const input: MotionInputSnapshot = {
        recentIntents: [createIntent('jump', 2.04)],
      };
      const res = judge.evaluate(rt, input, 2.04);

      expect(res).not.toBeNull();
      expect(res?.success).toBe(true);
      expect(res?.rating).toBe('Perfect');
      expect(res?.interaction).toBe('jump');
      expect(res?.matchedParts).toEqual(['bothFeet']);
    });

    it('착지 시점 기준 Good 윈도우(±0.25s) 안에서 jump 발생 시 Good으로 판정해야 한다', () => {
      const note = bossHazardToMotionNote('dual_slam');
      const rt = createRuntime(note);

      const input: MotionInputSnapshot = {
        recentIntents: [createIntent('jump', 1.80)], // diff: -0.20s
      };
      const res = judge.evaluate(rt, input, 1.80);

      expect(res).not.toBeNull();
      expect(res?.success).toBe(true);
      expect(res?.rating).toBe('Good');
      expect(res?.interaction).toBe('jump');
    });

    it('선행 입력(pre-buffer) 구간 [1.60s ~ 1.75s)에 발생한 jump는 정규 창 진입 시 Good(viaPreBuffer)으로 처리되어야 한다', () => {
      const note = bossHazardToMotionNote('dual_slam');
      const rt = createRuntime(note);

      // 1.65s (pre-buffer 구간)에 점프 발생
      const earlyInput: MotionInputSnapshot = {
        recentIntents: [createIntent('jump', 1.65)],
      };
      const preRes = judge.evaluate(rt, earlyInput, 1.65);
      expect(preRes).toBeNull(); // 아직 정규 창 이전이므로 보류(버퍼링)

      // 1.75s (정규 조기 창 도달)
      const drainRes = judge.evaluate(rt, {}, 1.75);
      expect(drainRes).not.toBeNull();
      expect(drainRes?.success).toBe(true);
      expect(drainRes?.rating).toBe('Good');
      expect(drainRes?.details?.viaPreBuffer).toBe(true);
    });

    it('후행 유예(post-grace / coyote) 구간 (2.25s ~ 2.40s]에 발생한 jump는 Good(viaGrace)으로 구제되어야 한다', () => {
      const note = bossHazardToMotionNote('dual_slam');
      const rt = createRuntime(note);

      // 2.32s (normalEnd 2.25s 초과, graceEnd 2.40s 이하)에 점프 발생
      const graceInput: MotionInputSnapshot = {
        recentIntents: [createIntent('jump', 2.32)],
      };
      const res = judge.evaluate(rt, graceInput, 2.32);

      expect(res).not.toBeNull();
      expect(res?.success).toBe(true);
      expect(res?.rating).toBe('Good');
      expect(res?.details?.viaGrace).toBe(true);
    });

    it('점프 인텐트가 발생하지 않고 전체 판정 창(graceEnd 2.40s) 만료 시 Miss로 판정해야 한다', () => {
      const note = bossHazardToMotionNote('dual_slam');
      const rt = createRuntime(note);

      // 2.10s (판정 창 내부이지만 점프 없음) -> 대기(null)
      expect(judge.evaluate(rt, {}, 2.10)).toBeNull();

      // 2.41s (graceEnd 만료) -> Miss
      const missRes = judge.evaluate(rt, {}, 2.41);
      expect(missRes).not.toBeNull();
      expect(missRes?.success).toBe(false);
      expect(missRes?.rating).toBe('Miss');
      expect(missRes?.details?.reason).toBe('jump_not_detected');
    });

    it('점프가 아닌 다른 인텐트(예: squat, stepLeft)만 발생한 경우 점프로 인정되지 않고 창 만료 시 Miss여야 한다', () => {
      const note = bossHazardToMotionNote('dual_slam');
      const rt = createRuntime(note);

      const otherInput: MotionInputSnapshot = {
        recentIntents: [
          createIntent('squat', 2.0),
          createIntent('stepLeft', 2.05),
        ],
      };

      expect(judge.evaluate(rt, otherInput, 2.05)).toBeNull();

      const missRes = judge.evaluate(rt, otherInput, 2.45);
      expect(missRes).not.toBeNull();
      expect(missRes?.success).toBe(false);
      expect(missRes?.rating).toBe('Miss');
    });

    it('clear() 호출 시 내부 버퍼가 깨끗이 비워져야 한다', () => {
      const note = bossHazardToMotionNote('dual_slam');
      const rt = createRuntime(note);

      judge.bufferIntent(note.id, createIntent('jump', 1.65));
      judge.clear();

      // 정규 창 진입 시에도 버퍼 비워졌으므로 즉시 처리되지 않음
      expect(judge.evaluate(rt, {}, 1.76)).toBeNull();
    });
  });

  describe('3. BossClimaxRenderer 장판 비행 렌더링 MotionNoteRenderer 위임 검증', () => {
    let renderer: BossClimaxRenderer;
    let mockMotionRenderer: MotionNoteRenderer;
    let ctx: CanvasRenderingContext2D;

    const vw = 1080;
    const vh = 2160;

    const baseState: BossClimaxRenderState = {
      bossHp: 10,
      bossMaxHp: 10,
      isEnraged: false,
      minionCount: 3,
      guardianStage: 1,
      stardust: 15,
      feverCombo: 0,
      hazard: null,
      barrageActive: false,
      barrageProgress: 0,
      elapsedTime: 1.0,
    };

    beforeEach(() => {
      ctx = createMockContext();
      mockMotionRenderer = new MotionNoteRenderer();
      vi.spyOn(mockMotionRenderer, 'render');
      renderer = new BossClimaxRenderer(mockMotionRenderer);
    });

    it('기본 보스 본체, 미니언 V자 편대 및 상태 HUD 렌더링이 그대로 보존되어야 한다', () => {
      renderer.render(ctx, vw, vh, baseState);

      // 보스 HP 및 HUD 관련 텍스트 호출 확인
      expect(ctx.fillText).toHaveBeenCalled();
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('BossClimaxRenderer 인스턴스가 MotionNoteRenderer를 보유하고 있어야 한다', () => {
      expect(renderer.motionNoteRenderer).toBeDefined();
      expect(renderer.motionNoteRenderer).toBeInstanceOf(MotionNoteRenderer);
    });

    it('dual_slam 장판 활성화 시 renderFlyingHazard가 boss_slam 프로필의 MotionNoteRenderItem을 위임 렌더링해야 한다', () => {
      const state: BossClimaxRenderState = {
        ...baseState,
        hazard: {
          activePattern: 'dual_slam',
          progress: 0.5,
          isResolved: false,
          isEvaded: false,
        },
      };

      renderer.render(ctx, vw, vh, state);

      expect(mockMotionRenderer.render).toHaveBeenCalled();
      const calledItems = vi.mocked(mockMotionRenderer.render).mock.calls[0][1];
      expect(calledItems).toHaveLength(1);
      expect(calledItems[0].profileId).toBe('boss_slam');
      expect(calledItems[0].interaction).toBe('jump');
      expect(calledItems[0].progress).toBe(0.5);
    });

    it('alternating_stomp_left 장판 활성화 시 boss_slam 프로필, evade 인터랙션으로 위임되어야 한다', () => {
      const state: BossClimaxRenderState = {
        ...baseState,
        hazard: {
          activePattern: 'alternating_stomp_left',
          progress: 0.4,
          isResolved: false,
          isEvaded: false,
        },
      };

      renderer.render(ctx, vw, vh, state);

      expect(mockMotionRenderer.render).toHaveBeenCalled();
      const calledItems = vi.mocked(mockMotionRenderer.render).mock.calls[0][1];
      expect(calledItems).toHaveLength(1);
      expect(calledItems[0].profileId).toBe('boss_slam');
      expect(calledItems[0].interaction).toBe('evade');
      expect(calledItems[0].progress).toBe(0.4);
    });

    it('renderFlyingHazard를 직접 호출하여 장판 투사체 단독 위임 렌더링이 가능해야 한다', () => {
      renderer.renderFlyingHazard(ctx, vw, vh, 540, 600, {
        activePattern: 'sweep',
        progress: 0.8,
        isResolved: false,
      });

      expect(mockMotionRenderer.render).toHaveBeenCalled();
      const calledItems = vi.mocked(mockMotionRenderer.render).mock.calls[0][1];
      expect(calledItems[0].profileId).toBe('boss_slam');
      expect(calledItems[0].interaction).toBe('jump');
      expect(calledItems[0].progress).toBe(0.8);
    });
  });
});
