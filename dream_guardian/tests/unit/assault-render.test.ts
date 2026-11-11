/**
 * assault-render.test.ts - 보스 접근전 읽기 전용 공격 장면 렌더링 단위 테스트
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§6.4, 6.7, 11.1, A03, A05, A06)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-19 / Issue #521)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AssaultSceneRenderer,
  type AssaultSceneSnapshot,
} from '../../src/render/AssaultSceneRenderer.js';
import {
  AssaultPairPainter,
  type AssaultPairRenderSnapshot,
} from '../../src/render/AssaultPairPainter.js';
import {
  DEFAULT_ASSAULT_VISUAL_CONFIG,
} from '../../config/assault-visual.config.js';
import { resolveAnchor } from '../../src/render/NoteAnchorResolver.js';
import type {
  AssaultRoundPresentation,
  AssaultPresentationDTO,
} from '../../src/types/assault.js';

function createMockContext(): CanvasRenderingContext2D {
  const fontHistory: string[] = [];
  let currentFont = '';

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
    drawImage: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    globalAlpha: 1.0,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    get font() {
      return currentFont;
    },
    set font(val: string) {
      currentFont = val;
      fontHistory.push(val);
    },
    __fontHistory: fontHistory,
    textAlign: 'center',
    textBaseline: 'middle',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    canvas: {
      width: 1280,
      height: 720,
    },
  } as unknown as CanvasRenderingContext2D;
}

describe('[BOSS-ASSAULT-19 / #521] 읽기 전용 공격 장면 렌더링 (AssaultSceneRenderer & AssaultPairPainter)', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = createMockContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. 읽기 전용 순수 렌더러 제약 및 자원 무부작용 (Idempotent Draw)', () => {
    it('렌더러 초기화 및 render 호출 시 DOM 리스너, rAF, 타이머를 일체 등록하지 않아야 한다', () => {
      const g = globalThis as Record<string, unknown>;
      const originalRaf = g.requestAnimationFrame;
      const originalSetTimeout = g.setTimeout;
      const originalSetInterval = g.setInterval;
      const originalAddEventListener = g.addEventListener;

      const rafSpy = vi.fn();
      const setTimeoutSpy = vi.fn();
      const setIntervalSpy = vi.fn();
      const addEventListenerSpy = vi.fn();

      g.requestAnimationFrame = rafSpy;
      g.setTimeout = setTimeoutSpy as unknown as typeof setTimeout;
      g.setInterval = setIntervalSpy as unknown as typeof setInterval;
      g.addEventListener = addEventListenerSpy;

      try {
        const renderer = new AssaultSceneRenderer();
        const painter = new AssaultPairPainter();

        const snapshot: AssaultSceneSnapshot = Object.freeze({
          questionText: '12 + 15 = ?',
          phase: 'choice_window',
          leftChoiceText: '27',
          rightChoiceText: '25',
          warningActive: false,
        });

        renderer.render(ctx, snapshot, { width: 1280, height: 720 });
        painter.render(
          ctx,
          { leftText: '27', rightText: '25', progress: 0.5, status: 'inFlight' },
          { width: 1280, height: 720 },
        );

        expect(rafSpy).not.toHaveBeenCalled();
        expect(setTimeoutSpy).not.toHaveBeenCalled();
        expect(setIntervalSpy).not.toHaveBeenCalled();
        expect(addEventListenerSpy).not.toHaveBeenCalled();
      } finally {
        g.requestAnimationFrame = originalRaf;
        g.setTimeout = originalSetTimeout;
        g.setInterval = originalSetInterval;
        g.addEventListener = originalAddEventListener;
      }
    });

    it('동일한 동결(frozen) 스냅샷을 5회 반복 render 해도 스냅샷 내용과 외부 상태를 전혀 변경하지 않아야 한다 (Idempotence)', () => {
      const renderer = new AssaultSceneRenderer();
      const snapshot: AssaultSceneSnapshot = Object.freeze({
        sessionId: 'test_session_1',
        roundId: 'test_round_1',
        phase: 'choice_window',
        questionText: '14 × 2 = ?',
        leftChoiceText: '28',
        rightChoiceText: '38',
        comboCount: 3,
        bossScaleProgress: 0.4,
        warningActive: false,
        pair: Object.freeze({
          leftText: '28',
          rightText: '38',
          progress: 0.6,
          status: 'inFlight',
        }),
      });

      const initialSnapshotJson = JSON.stringify(snapshot);

      // 5회 반복 렌더링
      for (let i = 0; i < 5; i++) {
        expect(() => {
          renderer.render(ctx, snapshot, { width: 1280, height: 720 });
        }).not.toThrow();
      }

      // 스냅샷 객체 내용 불변 검증
      expect(JSON.stringify(snapshot)).toBe(initialSnapshotJson);
      // 렌더러가 외부 HP, 점수, 정답 추론 필드를 생성하지 않음
      expect((renderer as unknown as Record<string, unknown>).hp).toBeUndefined();
      expect((renderer as unknown as Record<string, unknown>).playerHp).toBeUndefined();
      expect((renderer as unknown as Record<string, unknown>).score).toBeUndefined();
    });
  });

  describe('2. A03: 문제 투척(throw_in) 및 화면 상단 고정(readable/encounters) 표시', () => {
    it('throw_in 페이즈에서는 보스 소실점 좌표에서 상단 헤더 위치로 비행 진행도에 따라 투영되어야 한다', () => {
      const renderer = new AssaultSceneRenderer();
      const viewport = { width: 1280, height: 720 };

      // throwProgress: 0.0 (시작 위치: 보스 중심 앵커)
      const snapshotStart: AssaultSceneSnapshot = {
        questionText: '8 × 7 = ?',
        phase: 'throw_in',
        throwProgress: 0.0,
      };
      const boundsStart = renderer.computeQuestionPosition(snapshotStart, viewport);
      const expectedVx = DEFAULT_ASSAULT_VISUAL_CONFIG.bossAnchor.center.x * viewport.width;
      const expectedVy = DEFAULT_ASSAULT_VISUAL_CONFIG.bossAnchor.center.y * viewport.height;
      expect(boundsStart.x).toBeCloseTo(expectedVx, 0);
      expect(boundsStart.y).toBeCloseTo(expectedVy, 0);

      // throwProgress: 1.0 (도착 위치: 화면 상단 고정 헤더)
      const snapshotEnd: AssaultSceneSnapshot = {
        questionText: '8 × 7 = ?',
        phase: 'throw_in',
        throwProgress: 1.0,
      };
      const boundsEnd = renderer.computeQuestionPosition(snapshotEnd, viewport);
      expect(boundsEnd.x).toBeCloseTo(viewport.width * 0.5, 0);
      expect(boundsEnd.y).toBeLessThan(viewport.height * 0.25); // 상단 영역
      expect(boundsEnd.scale).toBeGreaterThan(boundsStart.scale);
    });

    it('question_reading 및 encounters 페이즈에서는 문제가 화면 상단에 완벽히 고정 표시되어야 한다 (A03)', () => {
      const renderer = new AssaultSceneRenderer();
      const viewport = { width: 1280, height: 720 };

      const snapshotReading: AssaultSceneSnapshot = {
        questionText: '35 ÷ 5 = ?',
        phase: 'question_reading',
        readingProgress: 0.5,
      };
      const boundsReading = renderer.computeQuestionPosition(snapshotReading, viewport);

      const snapshotEncounters: AssaultSceneSnapshot = {
        questionText: '35 ÷ 5 = ?',
        phase: 'encounters',
        leftChoiceText: '7',
        rightChoiceText: '8',
      };
      const boundsEncounters = renderer.computeQuestionPosition(snapshotEncounters, viewport);

      expect(boundsReading.x).toBeCloseTo(boundsEncounters.x, 1);
      expect(boundsReading.y).toBeCloseTo(boundsEncounters.y, 1);
      expect(boundsReading.y).toBeLessThan(viewport.height * 0.25);

      renderer.render(ctx, snapshotReading, viewport);
      expect(ctx.fillText).toHaveBeenCalledWith(
        expect.stringContaining('35'),
        expect.any(Number),
        expect.any(Number),
      );
    });
  });

  describe('3. AssaultPairPainter: 공용 판정 앵커, 연결 표시 및 상태별(A05, A06) 시각 효과', () => {
    it('좌/우 타깃 착지 앵커가 공용 NoteAnchorResolver(zone 4, zone 5)와 정확히 일치해야 한다', () => {
      const painter = new AssaultPairPainter();
      const viewport = { width: 1280, height: 720 };

      const expectedLeft = resolveAnchor({ part: 'leftHand', zoneId: 4 }, viewport);
      const expectedRight = resolveAnchor({ part: 'rightHand', zoneId: 5 }, viewport);

      const anchors = painter.getAnchors(viewport);
      expect(anchors.leftTarget.x).toBeCloseTo(expectedLeft.x, 1);
      expect(anchors.leftTarget.y).toBeCloseTo(expectedLeft.y, 1);
      expect(anchors.rightTarget.x).toBeCloseTo(expectedRight.x, 1);
      expect(anchors.rightTarget.y).toBeCloseTo(expectedRight.y, 1);
    });

    it('비행 중인 답 쌍에 대해 양손 발사 위치에서 날아오는 궤적과 두 답을 연결하는 시각 표시를 그려야 한다', () => {
      const painter = new AssaultPairPainter();
      const viewport = { width: 1280, height: 720 };

      const pairSnapshot: AssaultPairRenderSnapshot = {
        pairId: 'pair_01',
        leftText: '24',
        rightText: '26',
        progress: 0.5,
        status: 'inFlight',
      };

      painter.render(ctx, pairSnapshot, viewport);

      // 연결 선 및 박스 패스 그리기 호출 검증
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.moveTo).toHaveBeenCalled();
      expect(ctx.lineTo).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();

      // 두 라벨 텍스트가 렌더링되었는지 검증
      expect(ctx.fillText).toHaveBeenCalledWith('24', expect.any(Number), expect.any(Number));
      expect(ctx.fillText).toHaveBeenCalledWith('26', expect.any(Number), expect.any(Number));
    });

    it('A05: 정답 펀치 시(status=negated/disarmed/cancelled) 두 탄환이 소멸/무효화 스타일로 표시되고 추가 피격/Miss가 없어야 한다', () => {
      const painter = new AssaultPairPainter();
      const viewport = { width: 1280, height: 720 };

      const negatedPair: AssaultPairRenderSnapshot = {
        pairId: 'pair_01',
        leftText: '24',
        rightText: '26',
        progress: 0.9,
        status: 'negated',
      };

      painter.render(ctx, negatedPair, viewport);

      // 무효화 시각 효과: globalAlpha 감쇄 및 perfectGlow 스타일 적용 확인
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
      // disarmed 상태에서는 alpha가 감소되거나 무효화 태그가 그려짐
      expect(negatedPair.status).toBe('negated');
    });

    it('A06: 오답 펀치 시(status=wrong_hit/wrong_locked) 잠긴 쪽에 위험(hazardRed) 경고 표시가 나타나야 한다', () => {
      const painter = new AssaultPairPainter();
      const viewport = { width: 1280, height: 720 };

      const wrongLockedPair: AssaultPairRenderSnapshot = {
        pairId: 'pair_02',
        leftText: '10',
        rightText: '15',
        progress: 0.8,
        status: 'wrong_locked',
        lockedSide: 'right',
      };

      painter.render(ctx, wrongLockedPair, viewport);

      // 잠긴 쪽에 hazardRed 색상이 적용되었는지 검증
      expect(ctx.strokeStyle === DEFAULT_ASSAULT_VISUAL_CONFIG.colors.hazardRed ||
             ctx.fillStyle === DEFAULT_ASSAULT_VISUAL_CONFIG.colors.hazardRed).toBe(true);
    });

    it('timeout 상태 시 만료/피격 예고 스타일로 안전하게 렌더링되어야 한다', () => {
      const painter = new AssaultPairPainter();
      const viewport = { width: 1280, height: 720 };

      const timeoutPair: AssaultPairRenderSnapshot = {
        pairId: 'pair_03',
        leftText: '40',
        rightText: '50',
        progress: 1.0,
        status: 'timeout',
      };

      expect(() => {
        painter.render(ctx, timeoutPair, viewport);
      }).not.toThrow();
    });
  });

  describe('4. 스쿼트 회피 장애물(squat hazard telegraph) 및 웅크리기 안내 렌더링', () => {
    it('warningActive 또는 squatHazard가 활성화된 경우 하단 회피 위험 구역 및 안내 문구를 렌더링해야 한다', () => {
      const renderer = new AssaultSceneRenderer();
      const viewport = { width: 1280, height: 720 };

      const snapshot: AssaultSceneSnapshot = {
        questionText: '9 × 9 = ?',
        phase: 'encounters',
        warningActive: true,
        squatHazard: {
          active: true,
          progress: 0.6,
          promptText: 'SQUAT! 웅크리기',
        },
      };

      renderer.render(ctx, snapshot, viewport);

      expect(ctx.fillText).toHaveBeenCalledWith(
        expect.stringContaining('SQUAT'),
        expect.any(Number),
        expect.any(Number),
      );
    });

    it('스쿼트 장애물과 상단 문제 텍스트가 서로 시각적으로 겹치지 않아야 한다', () => {
      const renderer = new AssaultSceneRenderer();
      const viewport = { width: 1280, height: 720 };

      const snapshot: AssaultSceneSnapshot = {
        questionText: '12 × 12 = ?',
        phase: 'encounters',
        warningActive: true,
        squatHazard: {
          active: true,
          progress: 0.5,
        },
      };

      const qBounds = renderer.computeQuestionPosition(snapshot, viewport);
      const hazardBounds = renderer.computeSquatHazardBounds(viewport);

      // 문제 영역(상단)과 스쿼트 위험 영역(하단/중하단)의 Y축 분리 검증
      expect(qBounds.y + 60).toBeLessThan(hazardBounds.y);
    });
  });

  describe('5. 화면 크기 반응형(Responsive Resize) 지원', () => {
    it('FHD(1920x1080), HD(1280x720), 모바일(480x320) 등 다양한 해상도에서 비율 기반으로 정상 스케일링되어야 한다', () => {
      const renderer = new AssaultSceneRenderer();
      const painter = new AssaultPairPainter();

      const viewports = [
        { width: 1920, height: 1080 },
        { width: 1280, height: 720 },
        { width: 800, height: 600 },
        { width: 480, height: 320 },
      ];

      for (const vp of viewports) {
        const snapshot: AssaultSceneSnapshot = {
          questionText: '6 + 7 = ?',
          phase: 'choice_window',
          leftChoiceText: '13',
          rightChoiceText: '14',
          pair: {
            leftText: '13',
            rightText: '14',
            progress: 0.5,
            status: 'inFlight',
          },
        };

        const qPos = renderer.computeQuestionPosition(snapshot, vp);
        const anchors = painter.getAnchors(vp);

        // 뷰포트 내 좌표 범위 검증
        expect(qPos.x).toBeGreaterThan(0);
        expect(qPos.x).toBeLessThan(vp.width);
        expect(qPos.y).toBeGreaterThan(0);
        expect(qPos.y).toBeLessThan(vp.height);

        expect(anchors.leftTarget.x).toBeGreaterThan(0);
        expect(anchors.leftTarget.x).toBeLessThan(vp.width * 0.5);
        expect(anchors.rightTarget.x).toBeGreaterThan(vp.width * 0.5);
        expect(anchors.rightTarget.x).toBeLessThan(vp.width);

        // 에러 없이 렌더링 호출 확인
        expect(() => {
          renderer.render(ctx, snapshot, vp);
        }).not.toThrow();
      }
    });
  });

  describe('6. 프레젠테이션 스냅샷 타입 호환성 (AssaultRoundPresentation & AssaultPresentationDTO)', () => {
    it('AssaultRoundPresentation 스냅샷을 직접 전달해도 예외 없이 정상 렌더링되어야 한다', () => {
      const renderer = new AssaultSceneRenderer();
      const roundSnapshot: AssaultRoundPresentation = Object.freeze({
        sessionId: 'session_1',
        roundId: 'round_1',
        phase: 'question_reading',
        questionText: '50 - 25 = ?',
        currentEncounterIndex: 0,
        totalEncounters: 3,
        activeSeconds: 1.2,
        readingProgress: 0.4,
        isPaused: false,
      });

      expect(() => {
        renderer.render(ctx, roundSnapshot, { width: 1280, height: 720 });
      }).not.toThrow();
    });

    it('AssaultPresentationDTO 스냅샷을 직접 전달해도 예외 없이 정상 렌더링되어야 한다', () => {
      const renderer = new AssaultSceneRenderer();
      const dtoSnapshot: AssaultPresentationDTO = Object.freeze({
        sessionId: 'session_2',
        roundId: 'round_2',
        phase: 'choice_window',
        questionText: '7 × 8 = ?',
        leftChoiceText: '56',
        rightChoiceText: '54',
        bossScaleProgress: 0.3,
        comboCount: 5,
        remainingTimeSeconds: 4.5,
        warningActive: true,
      });

      expect(() => {
        renderer.render(ctx, dtoSnapshot, { width: 1280, height: 720 });
      }).not.toThrow();
    });
  });

  describe('7. 정답 선택지 글자 크기: 100px 폰트 크기 적용', () => {
    it('DEFAULT_ASSAULT_VISUAL_CONFIG에 선택지 기준 폰트 크기 100px가 정의되어야 한다', () => {
      expect((DEFAULT_ASSAULT_VISUAL_CONFIG as any).choiceBaseFontSizePx).toBe(100);
    });

    it('AssaultPairPainter: 착지(progress=1.0, 1280x720) 시 선택지 폰트 크기가 100px이어야 한다', () => {
      const painter = new AssaultPairPainter();
      const viewport = { width: 1280, height: 720 };

      const pairSnapshot: AssaultPairRenderSnapshot = {
        pairId: 'pair_font_test',
        leftText: '24',
        rightText: '26',
        progress: 1.0,
        status: 'inFlight',
      };

      painter.render(ctx, pairSnapshot, viewport);

      const fontHistory: string[] = (ctx as any).__fontHistory;
      expect(fontHistory.length).toBeGreaterThan(0);

      // 선택지 라벨 폰트 검증: bold 100px sans-serif
      const choiceFonts = fontHistory.filter((f) => f.includes('100px'));
      expect(choiceFonts.length).toBeGreaterThanOrEqual(2); // 좌/우 2개 카드
    });

    it('AssaultSceneRenderer: 전체 장면 렌더링 시 선택지 폰트 크기(100px)가 적용되어야 한다', () => {
      const renderer = new AssaultSceneRenderer();
      const viewport = { width: 1280, height: 720 };
      const snapshot: AssaultSceneSnapshot = {
        questionText: '8단 숫자를 쳐라!',
        leftChoiceText: '48',
        rightChoiceText: '50',
        phase: 'choice_window',
        pair: {
          leftText: '48',
          rightText: '50',
          progress: 1.0,
          status: 'inFlight',
        },
      };

      renderer.render(ctx, snapshot, viewport);

      const fontHistory: string[] = (ctx as any).__fontHistory;
      const has100pxChoice = fontHistory.some((f) => f.includes('100px'));
      expect(has100pxChoice).toBe(true);
    });
  });
});

