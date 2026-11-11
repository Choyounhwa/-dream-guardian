/**
 * assault-approach-guide.test.ts
 *
 * 보스 접근전(Boss Assault) 답안 판정 목표 가이드(원형 어프로치 링) 및
 * 2박/난이도별 원근 체공 속도 검증 단위 테스트
 *
 * 1. 목표 타깃 가이드 및 어프로치 링이 레거시 별모으기 방식의 원형(ctx.arc)으로 렌더링되는지 검증
 * 2. 진행도(progress)에 따라 외부 원형 링이 중심 앵커로 수축하는지 검증
 * 3. 기본 답안 체공/선택 박자(answerBeats)가 2박으로 설정되고, 난이도(easy/normal/hard)에 따라 가변 적용되는지 검증
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssaultPairPainter, type AssaultPairRenderSnapshot } from '../../src/render/AssaultPairPainter.js';
import {
  DEFAULT_ASSAULT_CONFIG,
  getAssaultAnswerBeats,
  type AssaultTimingAndBalanceConfig,
} from '../../config/assault.config.js';
import { DEFAULT_ASSAULT_VISUAL_CONFIG } from '../../config/assault-visual.config.js';

function createMockContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 12 })),
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    globalAlpha: 1.0,
    strokeStyle: '#ffffff',
    fillStyle: '#ffffff',
    lineWidth: 1,
    shadowColor: 'transparent',
    shadowBlur: 0,
    font: '16px sans-serif',
    textAlign: 'center',
    textBaseline: 'middle',
  } as unknown as CanvasRenderingContext2D;
}

describe('보스 접근전 답안 가이드(원형 어프로치) 및 2박/난이도별 체공 속도', () => {
  let ctx: CanvasRenderingContext2D;
  const viewport = { width: 1280, height: 720 };

  beforeEach(() => {
    ctx = createMockContext();
  });

  describe('1. 레거시 별모으기 방식 원형 어프로치 가이드 렌더링 (AssaultPairPainter)', () => {
    it('DEFAULT_ASSAULT_VISUAL_CONFIG의 approachShape 기본값이 "circle"이어야 한다', () => {
      expect((DEFAULT_ASSAULT_VISUAL_CONFIG as any).approachShape).toBe('circle');
    });

    it('답안 비행 중(progress 0.5)일 때 좌/우 타깃 앵커 및 어프로치 링이 원형(ctx.arc)으로 그려져야 한다', () => {
      const painter = new AssaultPairPainter();
      const anchors = painter.getAnchors(viewport);

      const snapshot: AssaultPairRenderSnapshot = {
        leftText: '10',
        rightText: '20',
        progress: 0.5,
        status: 'inFlight',
      };

      painter.render(ctx, snapshot, viewport);

      // ctx.arc가 좌/우 타깃 앵커 및 좌/우 어프로치 링에 대해 각각 호출되었는지 검증 (최소 4회 이상)
      expect(ctx.arc).toHaveBeenCalled();
      const arcCalls = (ctx.arc as any).mock.calls;
      expect(arcCalls.length).toBeGreaterThanOrEqual(4);

      // 좌측 타깃 앵커 좌표(anchors.leftTarget.x, anchors.leftTarget.y)를 중심으로 하는 원이 그려졌는지 검증
      const leftTargetCalls = arcCalls.filter(
        (call: number[]) => Math.abs(call[0] - anchors.leftTarget.x) < 1 && Math.abs(call[1] - anchors.leftTarget.y) < 1,
      );
      expect(leftTargetCalls.length).toBeGreaterThanOrEqual(2); // 고정 타깃 원 + 수축하는 어프로치 링 원

      // 우측 타깃 앵커 좌표(anchors.rightTarget.x, anchors.rightTarget.y)를 중심으로 하는 원이 그려졌는지 검증
      const rightTargetCalls = arcCalls.filter(
        (call: number[]) => Math.abs(call[0] - anchors.rightTarget.x) < 1 && Math.abs(call[1] - anchors.rightTarget.y) < 1,
      );
      expect(rightTargetCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('진행도(progress)가 증가할수록 어프로치 링 반지름이 바깥에서 중심 타깃 크기로 수축해야 한다', () => {
      const painter = new AssaultPairPainter();
      const anchors = painter.getAnchors(viewport);

      const ctxEarly = createMockContext();
      painter.render(ctxEarly, { leftText: '10', rightText: '20', progress: 0.2, status: 'inFlight' }, viewport);

      const ctxLate = createMockContext();
      painter.render(ctxLate, { leftText: '10', rightText: '20', progress: 0.8, status: 'inFlight' }, viewport);

      // progress=0.2 일 때의 좌측 어프로치 링 반경
      const earlyCalls = (ctxEarly.arc as any).mock.calls.filter(
        (call: number[]) => Math.abs(call[0] - anchors.leftTarget.x) < 1,
      );
      const earlyRadii = earlyCalls.map((c: number[]) => c[2]);
      const maxEarlyRadius = Math.max(...earlyRadii);

      // progress=0.8 일 때의 좌측 어프로치 링 반경
      const lateCalls = (ctxLate.arc as any).mock.calls.filter(
        (call: number[]) => Math.abs(call[0] - anchors.leftTarget.x) < 1,
      );
      const lateRadii = lateCalls.map((c: number[]) => c[2]);
      const maxLateRadius = Math.max(...lateRadii);

      // 진행도가 높을수록 바깥 어프로치 링이 중심(타깃)으로 모여야 함 (early 반경 > late 반경)
      expect(maxEarlyRadius).toBeGreaterThan(maxLateRadius);
    });
  });

  describe('2. 답안 원근 체공 속도(2박 기준) 및 난이도별 가변 설정 (assault.config)', () => {
    it('DEFAULT_ASSAULT_CONFIG의 기본 답안 박자(answerBeats)는 2박이어야 한다', () => {
      expect(DEFAULT_ASSAULT_CONFIG.answerBeats).toBe(2);
    });

    it('난이도별 답안 체공 박자(answerFlightBeatsByDifficulty)가 정의되어 있어야 한다', () => {
      const beats = DEFAULT_ASSAULT_CONFIG.answerFlightBeatsByDifficulty;
      expect(beats).toBeDefined();
      expect(beats!.easy).toBe(3);
      expect(beats!.normal).toBe(2);
      expect(beats!.hard).toBe(1.5);
    });

    it('getAssaultAnswerBeats 함수가 난이도에 따라 올바른 박자 수를 반환해야 한다', () => {
      expect(getAssaultAnswerBeats('easy')).toBe(3);
      expect(getAssaultAnswerBeats('normal')).toBe(2);
      expect(getAssaultAnswerBeats('hard')).toBe(1.5);
      // 난이도 미지정 시 기본 2박
      expect(getAssaultAnswerBeats()).toBe(2);
    });

    it('사용자 커스텀 config가 주어질 경우 해당 config의 난이도 설정을 우선 반영해야 한다', () => {
      const customConfig: Partial<AssaultTimingAndBalanceConfig> = {
        answerBeats: 2,
        answerFlightBeatsByDifficulty: {
          easy: 4,
          normal: 2.5,
          hard: 1.0,
        },
      };

      expect(getAssaultAnswerBeats('easy', customConfig as AssaultTimingAndBalanceConfig)).toBe(4);
      expect(getAssaultAnswerBeats('hard', customConfig as AssaultTimingAndBalanceConfig)).toBe(1.0);
    });

    it('AssaultPlanCompiler: answerBeats 옵션 전달 시 answer_pair 조우의 durationBeats가 2박으로 오버라이드되어야 한다', async () => {
      const { compileAssaultPlan } = await import('../../src/game/assault/AssaultPlanCompiler.js');
      const { DEFAULT_APPROACH_PATTERN } = await import('../../src/data/assault/approachPatterns.js');

      const plan2Beats = compileAssaultPlan(DEFAULT_APPROACH_PATTERN, { bpm: 120, answerBeats: 2 });
      const answerEnc = plan2Beats.encounters.find((e) => e.kind === 'answer_pair')!;
      expect(answerEnc).toBeDefined();
      expect(answerEnc.durationBeats).toBe(2);
      expect(answerEnc.durationSeconds).toBe(1.0); // 2박 @ 120BPM = 1.0초
    });

    it('AssaultSessionFactory: difficulty 옵션 주입 시 컴파일된 플랜의 answer_pair 박자가 난이도에 맞게 설정되어야 한다', async () => {
      const { AssaultSessionFactory } = await import('../../src/core/AssaultSessionFactory.js');
      const { DEFAULT_APPROACH_PATTERN } = await import('../../src/data/assault/approachPatterns.js');

      const dummyBattle = { hp: 100, maxHp: 100, mana: 0, maxMana: 100, applyHazardDamage: vi.fn() } as any;
      const dummyBoss = { hp: 100, maxHp: 100, takeDamage: vi.fn() } as any;
      const dummySpeech = { speak: vi.fn() };
      const dummyQuestions = [
        {
          level: 1,
          subLevel: 1,
          questionText: '4 + 3 = ?',
          correctAnswer: 7,
          wrongAnswer: 8,
          choices: [7, 8],
        },
      ] as any;

      const session = AssaultSessionFactory.createSession({
        battleState: dummyBattle,
        bossController: dummyBoss,
        speech: dummySpeech,
        questions: dummyQuestions,
        pattern: DEFAULT_APPROACH_PATTERN,
        difficulty: 'hard', // hard = 1.5박
      });

      const answerEnc = session.compiledPlan.encounters.find((e) => e.kind === 'answer_pair')!;
      expect(answerEnc).toBeDefined();
      expect(answerEnc.durationBeats).toBe(1.5);
      expect(answerEnc.durationSeconds).toBe(0.75); // 1.5박 @ 120BPM = 0.75초
    });
  });

  describe('3. 리듬 판정 타이밍 가이드 UI 내부 원형의 답안 최종 크기 비례 동적 계산 및 비율 정합화 (BUG-ASSAULT-TIMING-001 / Issue #716)', () => {
    it('DEFAULT_ASSAULT_VISUAL_CONFIG에 choiceCardCircleRatio(0.46), targetReceptorScale(1.0) 기본값이 정의되어 있어야 한다', () => {
      expect(DEFAULT_ASSAULT_VISUAL_CONFIG.choiceCardCircleRatio).toBe(0.46);
      expect(DEFAULT_ASSAULT_VISUAL_CONFIG.targetReceptorScale).toBe(1.0);
    });

    it('getFinalChoiceRadius가 뷰포트 크기와 choiceCard 비율 기반 최종 착지 답안 반경을 정확히 계산해야 한다', () => {
      const painter = new AssaultPairPainter();
      const radius = painter.getFinalChoiceRadius(viewport);
      // 1280x720 기준: cardWidth = 1280 * 0.20 = 256, cardHeight = 720 * 0.36 = 259.2
      // min(256, 259.2) * 0.46 = 256 * 0.46 = 117.76
      const expected = Math.min(1280 * DEFAULT_ASSAULT_VISUAL_CONFIG.choiceCard.widthRatio, 720 * DEFAULT_ASSAULT_VISUAL_CONFIG.choiceCard.heightRatio) * 0.46;
      expect(radius).toBeCloseTo(expected, 2);
    });

    it('getAnchors의 좌/우 타깃 앵커 radius가 레거시 고정값(28px)이 아닌 getFinalChoiceRadius 반경과 일치해야 한다', () => {
      const painter = new AssaultPairPainter();
      const anchors = painter.getAnchors(viewport);
      const finalRadius = painter.getFinalChoiceRadius(viewport);

      expect(anchors.leftTarget.radius).toBe(finalRadius);
      expect(anchors.rightTarget.radius).toBe(finalRadius);
      expect(anchors.leftTarget.radius).toBeGreaterThan(100); // 1280x720 기준 ~117.76px (기존 28px 대비 정합화)
    });

    it('착지 시점(progress 1.0)에 고정 기준 링(Hit Receptor)과 답안 카드 원형 외곽 테두리가 1:1 완벽히 일치해야 한다', () => {
      const painter = new AssaultPairPainter();
      const anchors = painter.getAnchors(viewport);
      const finalRadius = painter.getFinalChoiceRadius(viewport);

      painter.render(
        ctx,
        { leftText: '10', rightText: '20', progress: 1.0, status: 'inFlight' },
        viewport,
      );

      const arcCalls = (ctx.arc as any).mock.calls;
      // 좌측 타깃 중심 원형 arc 호출 필터
      const leftArcs = arcCalls.filter(
        (call: number[]) => Math.abs(call[0] - anchors.leftTarget.x) < 1 && Math.abs(call[1] - anchors.leftTarget.y) < 1,
      );

      // 고정 기준 링과 답안 외곽 테두리 둘 다 finalRadius로 그려져야 함
      expect(leftArcs.length).toBeGreaterThanOrEqual(2);
      for (const call of leftArcs) {
        expect(call[2]).toBeCloseTo(finalRadius, 1);
      }
    });

    it('수축 어프로치 링이 progress 1.0 착지 시점에 최종 답안 크기(finalRadius)와 1:1로 수축 수렴해야 한다', () => {
      const painter = new AssaultPairPainter();
      const finalRadius = painter.getFinalChoiceRadius(viewport);

      // progress = 0.1 (시작 부근): approachScale = 2.0 - 0.1 * 1.0 = 1.9 -> ringRadius = finalRadius * 1.9
      const ctxEarly = createMockContext();
      painter.render(ctxEarly, { leftText: '10', rightText: '20', progress: 0.1, status: 'inFlight' }, viewport);
      const earlyCalls = (ctxEarly.arc as any).mock.calls;
      const anchors = painter.getAnchors(viewport);
      const earlyLeftArcs = earlyCalls.filter(
        (call: number[]) => Math.abs(call[0] - anchors.leftTarget.x) < 1 && Math.abs(call[1] - anchors.leftTarget.y) < 1,
      );
      // 가장 큰 원형이 어프로치 링이어야 함
      const earlyApproachRadius = Math.max(...earlyLeftArcs.map((c: number[]) => c[2]));
      expect(earlyApproachRadius).toBeGreaterThan(finalRadius * 1.5);

      // progress = 0.95 (착지 직전): approachScale = 2.0 - 0.95 * 1.0 = 1.05 -> finalRadius에 매우 근접
      const ctxLate = createMockContext();
      painter.render(ctxLate, { leftText: '10', rightText: '20', progress: 0.95, status: 'inFlight' }, viewport);
      const lateCalls = (ctxLate.arc as any).mock.calls;
      const lateLeftArcs = lateCalls.filter(
        (call: number[]) => Math.abs(call[0] - anchors.leftTarget.x) < 1 && Math.abs(call[1] - anchors.leftTarget.y) < 1,
      );
      const lateApproachRadius = Math.max(...lateLeftArcs.map((c: number[]) => c[2]));
      expect(lateApproachRadius).toBeCloseTo(finalRadius * 1.05, 1);
    });

    it('커스텀 choiceCardCircleRatio 및 targetReceptorScale 설정 시 동적으로 비례 반영되어야 한다', () => {
      const customConfig = {
        ...DEFAULT_ASSAULT_VISUAL_CONFIG,
        choiceCardCircleRatio: 0.5,
        targetReceptorScale: 1.2,
      };
      const painter = new AssaultPairPainter(customConfig);
      const finalRadius = painter.getFinalChoiceRadius(viewport);
      const expectedRadius = Math.min(1280 * customConfig.choiceCard.widthRatio, 720 * customConfig.choiceCard.heightRatio) * 0.5;
      expect(finalRadius).toBeCloseTo(expectedRadius, 2);

      const anchors = painter.getAnchors(viewport);
      expect(anchors.leftTarget.radius).toBe(finalRadius);

      painter.render(
        ctx,
        { leftText: '10', rightText: '20', progress: 1.0, status: 'inFlight' },
        viewport,
      );

      const arcCalls = (ctx.arc as any).mock.calls;
      const leftArcs = arcCalls.filter(
        (call: number[]) => Math.abs(call[0] - anchors.leftTarget.x) < 1 && Math.abs(call[1] - anchors.leftTarget.y) < 1,
      );

      // 내부 기준 링은 finalRadius * 1.2
      const targetZoneRadius = finalRadius * 1.2;
      const hasTargetZoneRadius = leftArcs.some((c: number[]) => Math.abs(c[2] - targetZoneRadius) < 1);
      expect(hasTargetZoneRadius).toBe(true);
    });
  });
});
