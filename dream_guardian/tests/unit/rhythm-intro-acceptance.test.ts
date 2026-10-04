/**
 * rhythm-intro-acceptance.test.ts
 *
 * [#410 RHYTHM-INTRO-005] 두 개선의 무릎 프레이밍 실플레이·회귀 최종 인수 테스트
 *
 * [검증 시나리오]
 * 1. Phase A 정답 시 7개 손 노트 시퀀스 검증 (leftHand Zone 4 / rightHand Zone 5 교대)
 * 2. 첫 번째 별의 1박 사전 예고(displayStart = t0) 및 2~7번째 별의 2박 사전 예고(displayStart = max(t0, landing - 2*s))
 * 3. 러닝 발판 무릎 동작(knee_left, knee_right) 전반부 들기 / 후반부 복귀 및 upcomingCues(1박 후, 2박 후) 시간/진행도 검증
 * 4. 오답/timeout 시 별 미표시, Phase B(BOSS_CLIMAX)에 beatPreview 미전달 등 회귀 결함 0건 검증
 * 5. 다양한 BPM(60, 120, 160) 환산 수식 유효성 및 유효하지 않은 preview 전달 시 0.5s fallback 안전성 검증
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BEGINNER_PHASE_A_STAR_NOTES,
  BEGINNER_PHASE_A_PATTERN_ID,
} from '../../src/data/beginnerRhythmRoutine.js';
import { StarNoteScheduler } from '../../src/game/StarNoteScheduler.js';
import { StarNoteRenderer, type StarNoteRenderState } from '../../src/render/StarNoteRenderer.js';
import { RunningMatPresenter } from '../../src/render/RunningMatPresenter.js';
import { RunningMatRenderer } from '../../src/render/RunningMatRenderer.js';
import { DEFAULT_FITNESS_ZONES } from '../../config/zone.config.js';
import type { StarBeatPreviewOptions } from '../../config/star-preview.config.js';
import { PhasePresentationAdapter } from '../../src/ui/PhasePresentationAdapter.js';
import { SceneDirector } from '../../src/core/SceneDirector.js';
import type { RunTimingSnapshot } from '../../src/game/BeatRunCoordinator.js';
import type { ActiveStarTarget } from '../../src/input/StarCollectionInput.js';

function createMockStarTarget(
  overrides: Partial<ActiveStarTarget> & { landingTime: number },
): ActiveStarTarget {
  return {
    patternId: 'mock-pattern',
    part: 'leftHand',
    zoneId: 4,
    beatIndex: 1,
    ...overrides,
  };
}

function createMockContext2D(): CanvasRenderingContext2D {
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
    measureText: vi.fn().mockReturnValue({ width: 50 }),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    roundRect: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    setLineDash: vi.fn(),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
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

describe('[#410 RHYTHM-INTRO-005] 두 개선의 무릎 프레이밍 실플레이·회귀 최종 인수 테스트', () => {
  const vw = 800;
  const vh = 600;
  const vx = 400;
  const vy = 200;

  // ────────────────────────────────────────────────────────────────
  // 시나리오 1: Phase A 정답 시 7개 손 노트 시퀀스 검증
  // ────────────────────────────────────────────────────────────────
  describe('1. Phase A 정답 시 7개 손 노트 시퀀스 검증 (leftHand Zone 4 / rightHand Zone 5 교대)', () => {
    it('BEGINNER_PHASE_A_STAR_NOTES는 불변 배열이며 총 7개의 손 노트가 4/5존 교대로 정의되어 있다', () => {
      expect(BEGINNER_PHASE_A_STAR_NOTES).toHaveLength(7);
      expect(Object.isFrozen(BEGINNER_PHASE_A_STAR_NOTES)).toBe(true);

      const expectedSequence = [
        { part: 'leftHand', zoneId: 4, beat: 2 },
        { part: 'rightHand', zoneId: 5, beat: 3 },
        { part: 'leftHand', zoneId: 4, beat: 4 },
        { part: 'rightHand', zoneId: 5, beat: 5 },
        { part: 'leftHand', zoneId: 4, beat: 6 },
        { part: 'rightHand', zoneId: 5, beat: 7 },
        { part: 'leftHand', zoneId: 4, beat: 8 },
      ];

      BEGINNER_PHASE_A_STAR_NOTES.forEach((note, index) => {
        expect(note.patternId).toBe(BEGINNER_PHASE_A_PATTERN_ID);
        expect(note.instrument).toBe('hand');
        expect(note.part).toBe(expectedSequence[index].part);
        expect(note.zoneId).toBe(expectedSequence[index].zoneId);
        expect(note.beat).toBe(expectedSequence[index].beat);
        expect(Object.isFrozen(note)).toBe(true);
      });
    });

    it('StarNoteScheduler에 주입 시 7개 노트의 착지 시간이 t0 + 0.5s ~ 3.5s(BPM 120 기준)로 정확히 스케줄링된다', () => {
      const scheduler = new StarNoteScheduler();
      const t0 = 10.0;
      const secondsPerBeat = 0.5;

      scheduler.start(t0, {
        roundId: 1,
        notes: BEGINNER_PHASE_A_STAR_NOTES,
        secondsPerBeat,
      });

      expect(scheduler.isStarted).toBe(true);
      expect(scheduler.startTime).toBe(t0);
      expect(scheduler.notes).toHaveLength(7);

      scheduler.notes.forEach((note, index) => {
        expect(note.landingTime).toBeCloseTo(t0 + (index + 1) * secondsPerBeat, 5);
        expect(note.zoneId).toBe(index % 2 === 0 ? 4 : 5);
        expect(note.part).toBe(index % 2 === 0 ? 'leftHand' : 'rightHand');
        expect(note.instrument).toBe('hand');
        expect(note.resolved).toBe(false);
      });
    });

    it('양손 교대 모션을 통해 7개 노트가 순차적으로 판정되며 3.90s 경과 후 완료(isComplete)에 도달한다', () => {
      const scheduler = new StarNoteScheduler();
      const t0 = 0.0;
      scheduler.start(t0, {
        roundId: 1,
        notes: BEGINNER_PHASE_A_STAR_NOTES,
        secondsPerBeat: 0.5,
      });

      const ratings: string[] = [];
      scheduler.onRating((res) => {
        ratings.push(res.rating);
      });

      const dummyLandmarks = Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.5,
        z: 0,
        visibility: 0.9,
      }));

      // Zone 4와 Zone 5의 중심 좌표 (정규화 0~1)
      const zone4 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 4)!;
      const zone5 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 5)!;

      const zone4Center = {
        x: zone4.x + zone4.width / 2,
        y: zone4.y + zone4.height / 2,
      };
      const zone5Center = {
        x: zone5.x + zone5.width / 2,
        y: zone5.y + zone5.height / 2,
      };

      // 7개 노트 착지 시점마다 해당 손을 해당 존에 위치시켜 수집
      for (let i = 0; i < 7; i++) {
        const landingTime = (i + 1) * 0.5;
        const isLeft = i % 2 === 0;

        scheduler.update(
          landingTime,
          dummyLandmarks,
          isLeft
            ? { leftPalm: { x: zone4Center.x, y: zone4Center.y, confidence: 1.0 } }
            : { rightPalm: { x: zone5Center.x, y: zone5Center.y, confidence: 1.0 } },
        );
      }

      expect(ratings).toHaveLength(7);
      expect(ratings.every((r) => r === 'Perfect' || r === 'Good' || r === 'Late')).toBe(true);
      expect(scheduler.resolvedCount).toBe(7);
      expect(scheduler.pendingCount).toBe(0);

      // landing(3.5s) + lateWindow(0.4s) = 3.90s 이후 isComplete = true
      scheduler.update(3.89);
      expect(scheduler.isComplete).toBe(false);

      scheduler.update(3.91);
      expect(scheduler.isComplete).toBe(true);
    });

    it('손을 목표 존에 미리 유지하고 있어도(조기 위치 유지) 판정창 진입 시 정상 수집된다', () => {
      const scheduler = new StarNoteScheduler();
      const t0 = 0.0;
      scheduler.start(t0, {
        roundId: 1,
        notes: BEGINNER_PHASE_A_STAR_NOTES,
        secondsPerBeat: 0.5,
      });

      let hitResult: any = null;
      scheduler.onRating((res) => {
        hitResult = res;
      });

      const dummyLandmarks = Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.5,
        z: 0,
        visibility: 0.9,
      }));

      const zone4 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 4)!;
      const zone4Center = {
        x: zone4.x + zone4.width / 2,
        y: zone4.y + zone4.height / 2,
      };

      // 첫 번째 노트 착지는 0.5s. late window는 0.40s.
      // 0.05s는 판정 윈도우 밖 (0.5 - 0.4 = 0.10s 이전)
      scheduler.update(
        0.05,
        dummyLandmarks,
        { leftPalm: { x: zone4Center.x, y: zone4Center.y, confidence: 1.0 } },
      );
      expect(hitResult).toBeNull();

      // 0.30s (landing 0.5s 기준 -0.20s, 판정 윈도우 내)에서 위치 유지 시 즉시 수집
      scheduler.update(
        0.30,
        dummyLandmarks,
        { leftPalm: { x: zone4Center.x, y: zone4Center.y, confidence: 1.0 } },
      );
      expect(hitResult).not.toBeNull();
      expect(hitResult.collected).toBe(true);
      expect(scheduler.resolvedCount).toBe(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 시나리오 2: 첫 번째 별의 1박 사전 예고 및 2~7번째 별의 2박 사전 예고
  // ────────────────────────────────────────────────────────────────
  describe('2. 박 기반 사전 예고 타이밍 검증 (첫 별: 1박, 2~7번째 별: 2박)', () => {
    let renderer: StarNoteRenderer;
    const t0 = 10.0;
    const s = 0.5; // secondsPerBeat (BPM 120)
    const preview: StarBeatPreviewOptions = {
      startTime: t0,
      secondsPerBeat: s,
    };

    beforeEach(() => {
      renderer = new StarNoteRenderer();
    });

    it('첫 번째 별(landing = t0 + 1*s): displayStart = t0 (정확히 1박 사전 예고) 및 비행 진행도 검증', () => {
      const target1 = createMockStarTarget({
        landingTime: t0 + 1 * s, // 10.5
        zoneId: 4,
      });

      // 1) displayStart(10.0) 이전에는 화면에 출현하지 않음
      const posBefore = renderer.computeNotePosition(
        target1,
        t0 - 0.01,
        vx,
        vy,
        vw,
        vh,
        DEFAULT_FITNESS_ZONES,
        preview,
      );
      expect(posBefore.inFlight).toBe(false);

      // 2) displayStart(10.0) 정밀 시점: 소실점에서 스폰 시작 (progress = 0)
      const posStart = renderer.computeNotePosition(
        target1,
        t0,
        vx,
        vy,
        vw,
        vh,
        DEFAULT_FITNESS_ZONES,
        preview,
      );
      expect(posStart.inFlight).toBe(true);
      expect(posStart.progress).toBeCloseTo(0.0, 4);
      expect(posStart.x).toBeCloseTo(vx, 1);
      expect(posStart.y).toBeCloseTo(vy, 1);

      // 3) 중간 시점 (t0 + 0.25s): 진행도 0.5 도달
      const posMid = renderer.computeNotePosition(
        target1,
        t0 + 0.25,
        vx,
        vy,
        vw,
        vh,
        DEFAULT_FITNESS_ZONES,
        preview,
      );
      expect(posMid.inFlight).toBe(true);
      expect(posMid.progress).toBeCloseTo(0.5, 4);

      // 4) 착지 시점 (t0 + 0.5s): 목표 존 중심 도달 (progress = 1.0)
      const posLanding = renderer.computeNotePosition(
        target1,
        t0 + 0.5,
        vx,
        vy,
        vw,
        vh,
        DEFAULT_FITNESS_ZONES,
        preview,
      );
      expect(posLanding.inFlight).toBe(true);
      expect(posLanding.progress).toBeCloseTo(1.0, 4);
    });

    it('두 번째 별(landing = t0 + 2*s): displayStart = max(t0, landing - 2*s) = t0 (2박 예고) 검증', () => {
      const target2 = createMockStarTarget({
        part: 'rightHand',
        landingTime: t0 + 2 * s, // 11.0
        zoneId: 5,
        beatIndex: 2,
      });

      // landing(11.0) - 2*0.5 = 10.0 = t0
      const posStart = renderer.computeNotePosition(
        target2,
        t0,
        vx,
        vy,
        vw,
        vh,
        DEFAULT_FITNESS_ZONES,
        preview,
      );
      expect(posStart.inFlight).toBe(true);
      expect(posStart.progress).toBeCloseTo(0.0, 4);

      // 10.5초 경과 시 2박 중 1박 경과이므로 progress = 0.5
      const posMid = renderer.computeNotePosition(
        target2,
        t0 + 0.5,
        vx,
        vy,
        vw,
        vh,
        DEFAULT_FITNESS_ZONES,
        preview,
      );
      expect(posMid.inFlight).toBe(true);
      expect(posMid.progress).toBeCloseTo(0.5, 4);

      // 11.0초 착지 시 progress = 1.0
      const posLanding = renderer.computeNotePosition(
        target2,
        t0 + 1.0,
        vx,
        vy,
        vw,
        vh,
        DEFAULT_FITNESS_ZONES,
        preview,
      );
      expect(posLanding.inFlight).toBe(true);
      expect(posLanding.progress).toBeCloseTo(1.0, 4);
    });

    it('3~7번째 별: 정확히 landing - 2*s 시점에 출현하며 그 이전에는 화면에 미출현 검증', () => {
      // 3번째 별 (landing = t0 + 1.5s): displayStart = 10.5s
      // 4번째 별 (landing = t0 + 2.0s): displayStart = 11.0s
      // 5번째 별 (landing = t0 + 2.5s): displayStart = 11.5s
      // 6번째 별 (landing = t0 + 3.0s): displayStart = 12.0s
      // 7번째 별 (landing = t0 + 3.5s): displayStart = 12.5s
      for (let i = 2; i < 7; i++) {
        const landingTime = t0 + (i + 1) * s;
        const target = createMockStarTarget({
          part: i % 2 === 0 ? 'leftHand' : 'rightHand',
          landingTime,
          zoneId: i % 2 === 0 ? 4 : 5,
          beatIndex: i + 1,
        });
        const expectedDisplayStart = landingTime - 2 * s;

        // displayStart 직전: 미출현
        const before = renderer.computeNotePosition(
          target,
          expectedDisplayStart - 0.01,
          vx,
          vy,
          vw,
          vh,
          DEFAULT_FITNESS_ZONES,
          preview,
        );
        expect(before.inFlight).toBe(false);

        // displayStart 정밀 시점: 출현 (progress = 0)
        const start = renderer.computeNotePosition(
          target,
          expectedDisplayStart,
          vx,
          vy,
          vw,
          vh,
          DEFAULT_FITNESS_ZONES,
          preview,
        );
        expect(start.inFlight).toBe(true);
        expect(start.progress).toBeCloseTo(0.0, 4);

        // displayStart + 1박(0.5s): 진행도 0.5
        const mid = renderer.computeNotePosition(
          target,
          expectedDisplayStart + s,
          vx,
          vy,
          vw,
          vh,
          DEFAULT_FITNESS_ZONES,
          preview,
        );
        expect(mid.inFlight).toBe(true);
        expect(mid.progress).toBeCloseTo(0.5, 4);

        // 착지 시점: 진행도 1.0
        const end = renderer.computeNotePosition(
          target,
          landingTime,
          vx,
          vy,
          vw,
          vh,
          DEFAULT_FITNESS_ZONES,
          preview,
        );
        expect(end.inFlight).toBe(true);
        expect(end.progress).toBeCloseTo(1.0, 4);
      }
    });

    it('StarNoteRenderer.render 시 출현 전 노트는 캔버스에 그려지지 않는다', () => {
      const mockCtx = createMockContext2D();
      const target3 = createMockStarTarget({
        landingTime: t0 + 1.5, // displayStart = 10.5
        zoneId: 4,
      });

      const renderState: StarNoteRenderState = {
        target: target3,
        elapsedTime: t0 + 0.2, // 10.2s: 아직 출현 전
        vanishingX: vx,
        vanishingY: vy,
        beatPreview: preview,
      };

      renderer.render(mockCtx, vw, vh, renderState);
      expect(mockCtx.save).not.toHaveBeenCalled();

      // 출현 후 비행 중
      renderState.elapsedTime = t0 + 0.8; // 10.8s
      renderer.render(mockCtx, vw, vh, renderState);
      expect(mockCtx.save).toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 시나리오 3: 러닝 발판 무릎 동작(knee_left, knee_right) 및 upcomingCues 검증
  // ────────────────────────────────────────────────────────────────
  describe('3. 러닝 발판 무릎 동작(knee_left, knee_right) 전반/후반 분리와 다음 두 박 예고(upcomingCues)', () => {
    let presenter: RunningMatPresenter;
    let renderer: RunningMatRenderer;

    beforeEach(() => {
      presenter = new RunningMatPresenter('run');
      renderer = new RunningMatRenderer();
    });

    const createSnapshot = (overrides: Partial<RunTimingSnapshot> = {}): RunTimingSnapshot => {
      return Object.freeze({
        runId: 1,
        active: true,
        paused: false,
        elapsedBeats: 0,
        exerciseBeats: 8,
        requiredExerciseCount: 6,
        acceptedExerciseCount: 0,
        prepareStartBeat: 6,
        transitionBeat: 8,
        ...overrides,
      });
    };

    it('0박(knee_left): 전반부(0.0~0.5박)는 "왼무릎 들기", 후반부(0.5~1.0박)는 "왼무릎 복귀"로 분리된다', () => {
      // 0.2박: 전반부 들기 (lift)
      const liftVm = presenter.present(createSnapshot({ elapsedBeats: 0.2 }));
      expect(liftVm.currentCue?.actionId).toBe('knee_left');
      expect(liftVm.currentCue?.isReturnPhase).toBe(false);
      expect(liftVm.currentCue?.phase).toBe('lift');
      expect(liftVm.isReturnPhase).toBe(false);
      expect(liftVm.actionText).toBe('왼무릎 들기');

      // 0.7박: 후반부 복귀 (return)
      const returnVm = presenter.present(createSnapshot({ elapsedBeats: 0.7 }));
      expect(returnVm.currentCue?.actionId).toBe('knee_left');
      expect(returnVm.currentCue?.isReturnPhase).toBe(true);
      expect(returnVm.currentCue?.phase).toBe('return');
      expect(returnVm.isReturnPhase).toBe(true);
      expect(returnVm.actionText).toBe('왼무릎 복귀');
    });

    it('1박(knee_right): 전반부(1.0~1.5박)는 "오른무릎 들기", 후반부(1.5~2.0박)는 "오른무릎 복귀"로 분리된다', () => {
      // 1.25박: 전반부 들기 (lift)
      const liftVm = presenter.present(createSnapshot({ elapsedBeats: 1.25 }));
      expect(liftVm.currentCue?.actionId).toBe('knee_right');
      expect(liftVm.currentCue?.isReturnPhase).toBe(false);
      expect(liftVm.currentCue?.phase).toBe('lift');
      expect(liftVm.actionText).toBe('오른무릎 들기');

      // 1.75박: 후반부 복귀 (return)
      const returnVm = presenter.present(createSnapshot({ elapsedBeats: 1.75 }));
      expect(returnVm.currentCue?.actionId).toBe('knee_right');
      expect(returnVm.currentCue?.isReturnPhase).toBe(true);
      expect(returnVm.currentCue?.phase).toBe('return');
      expect(returnVm.actionText).toBe('오른무릎 복귀');
    });

    it('upcomingCues는 1박 후와 2박 후의 큐를 정확한 잔여 박수, 진행도 및 lift 상태로 제공한다', () => {
      // 0.25박 진행 시점
      const vm = presenter.present(createSnapshot({ elapsedBeats: 0.25 }));

      expect(vm.upcomingCues).toHaveLength(2);

      // 1박 후 (targetBeat 1: knee_right)
      const cue1 = vm.upcomingCues[0];
      expect(cue1.targetBeat).toBe(1);
      expect(cue1.cue.id).toBe('knee_right');
      expect(cue1.remainingBeats).toBeCloseTo(0.75, 2);
      expect(cue1.progress).toBeCloseTo(0.25, 2);
      expect(cue1.phase).toBe('lift');
      expect(cue1.isReturnPhase).toBe(false);

      // 2박 후 (targetBeat 2: knee_left)
      const cue2 = vm.upcomingCues[1];
      expect(cue2.targetBeat).toBe(2);
      expect(cue2.cue.id).toBe('knee_left');
      expect(cue2.remainingBeats).toBeCloseTo(1.75, 2);
      expect(cue2.progress).toBeCloseTo(0.25, 2);
      expect(cue2.phase).toBe('lift');
      expect(cue2.isReturnPhase).toBe(false);
    });

    it('전환 박자(transitionBeat = 8)에 도달하면 upcomingCues가 범위를 초과하지 않고 안전하게 축소/정리된다', () => {
      // 7.1박 진행 시점: currentBeat = 7, targetBeat 8은 transitionBeat이므로 제외됨
      const vm = presenter.present(createSnapshot({ elapsedBeats: 7.1, transitionBeat: 8 }));
      expect(vm.upcomingCues).toHaveLength(0);
    });

    it('RunningMatRenderer는 upcomingCues 및 복귀 표시 뷰모델을 오류 없이 렌더링한다', () => {
      const mockCtx = createMockContext2D();
      const vm = presenter.present(createSnapshot({ elapsedBeats: 0.7 })); // 복귀 페이즈

      expect(() => {
        renderer.render(mockCtx, vm, vw, vh, { x: vx, y: vy });
      }).not.toThrow();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 시나리오 4: 오답/timeout 시 별 미표시, Phase B beatPreview 미전달 등 회귀 결함 0건
  // ────────────────────────────────────────────────────────────────
  describe('4. 회귀 방지: 오답/타임아웃 시 별 미표시 및 Phase B beatPreview 격리 검증', () => {
    let adapter: PhasePresentationAdapter;

    beforeEach(() => {
      adapter = new PhasePresentationAdapter();
    });

    it('PhasePresentationAdapter는 STAR_COLLECT 상태에서만 canRenderStarCollect가 참이고 오답/타임아웃/답선택에서는 거짓이다', () => {
      // 정답 후 보상 페이즈
      expect(adapter.canRenderStarCollect('STAR_COLLECT')).toBe(true);

      // 오답 회피 페이즈
      expect(adapter.canRenderStarCollect('HAZARD_EVADE')).toBe(false);

      // 타임아웃 / 라운드 정산 페이즈
      expect(adapter.canRenderStarCollect('ROUND_RESOLVE')).toBe(false);

      // 문제 풀이 / 답안 선택 페이즈
      expect(adapter.canRenderStarCollect('RUN_QUESTION')).toBe(false);
      expect(adapter.canRenderStarCollect('ANSWER_SELECT')).toBe(false);
      expect(adapter.canRenderStarCollect('GAMEOVER')).toBe(false);
    });

    const createFullMockSceneContext = (currentState: string, overrides: Record<string, any> = {}) => {
      const mockCtx = createMockContext2D();
      return {
        stateMachine: { currentState },
        state: { currentChapter: 1, gamePhase: 'playing', climaxBarrageTimer: 0 },
        beatCoordinator: {
          phase: currentState,
          getBranchClock: () => ({ secondsPerBeat: 0.5 }),
          rhythmEngine: { secondsPerBeat: 0.5, beatProgress: 0.5 },
        },
        presentationAdapter: {
          canRenderRunningHUD: () => false,
          canRenderAnswerPreview: () => false,
          canRenderQuestion: () => false,
          canRenderStarCollect: (s: string) => s === 'STAR_COLLECT',
          canRenderHazardEvade: () => false,
          canRenderReadyPosition: () => false,
          getAnswerSelectFeedback: vi.fn(() => null),
          renderAnswerFeedback: vi.fn(),
          renderHazardEvade: vi.fn(),
        },
        starNoteRenderer: { render: vi.fn() },
        starNoteScheduler: { currentTarget: null, activeNotes: [], startTime: 10.0, isPaused: false },
        engine: { elapsedTime: 12.0, paused: false },
        cameraLayer: { isActive: false },
        imageLoader: { get: vi.fn() },
        dreamGrid: { render: vi.fn() },
        boss: { x: vx, y: vy, hp: 10, maxHp: 10, phase: 'idle' },
        bossRenderer: { render: vi.fn() },
        bossClimaxRenderer: { render: vi.fn() },
        guardian: { stage: 1 },
        beatRoundResolver: { resourceManager: { troopManager: { minionCount: 0 }, stardust: 0 } },
        phaseAHazardController: {
          isEvaded: false,
          performedAction: null,
          activePattern: null,
          beatProgress: 0,
          isResolved: false,
        },
        hazardZoneRenderer: { render: vi.fn() },
        stickmanRenderer: { render: vi.fn() },
        skeletonEffect: { renderTrails: vi.fn() },
        hudLayer: { render: vi.fn() },
        beatHUDRenderer: { render: vi.fn() },
        questionRenderer: { render: vi.fn() },
        answerSelectionRenderer: { render: vi.fn() },
        bottomBar: { render: vi.fn() },
        transitionManager: { render: vi.fn() },
        canvasManager: { ctx: mockCtx, virtualWidth: vw, virtualHeight: vh },
        actions: {} as any,
        renderFeedback: vi.fn(),
        effectManager: { render: vi.fn(), play: vi.fn() },
        getHUDData: vi.fn(() => ({})),
        ...overrides,
      };
    };

    it('SceneDirector.renderGameScene: 오답(HAZARD_EVADE) 또는 타임아웃(ROUND_RESOLVE) 시 StarNoteRenderer가 절대 호출되지 않는다', () => {
      const director = new SceneDirector();

      // 1. 오답 상황 (HAZARD_EVADE)
      const mockEvadeContext = createFullMockSceneContext('HAZARD_EVADE');
      director.renderGameScene(mockEvadeContext as any);
      expect(mockEvadeContext.starNoteRenderer.render).not.toHaveBeenCalled();

      // 2. 타임아웃/정산 상황 (ROUND_RESOLVE)
      const mockResolveContext = createFullMockSceneContext('ROUND_RESOLVE');
      director.renderGameScene(mockResolveContext as any);
      expect(mockResolveContext.starNoteRenderer.render).not.toHaveBeenCalled();

      // 3. 정답 선택 진행 중 상황 (ANSWER_SELECT)
      const mockAnswerContext = createFullMockSceneContext('ANSWER_SELECT');
      director.renderGameScene(mockAnswerContext as any);
      expect(mockAnswerContext.starNoteRenderer.render).not.toHaveBeenCalled();
    });

    it('SceneDirector.renderGameScene: Phase B (BOSS_CLIMAX) 에서는 canRenderStarCollect가 참이어도 beatPreview가 절대 주입되지 않는다', () => {
      const director = new SceneDirector();
      const mockContext = createFullMockSceneContext('BOSS_CLIMAX', {
        presentationAdapter: {
          canRenderRunningHUD: () => false,
          canRenderAnswerPreview: () => false,
          canRenderQuestion: () => false,
          canRenderStarCollect: (s: string) => s === 'BOSS_CLIMAX',
          canRenderHazardEvade: () => false,
          canRenderReadyPosition: () => false,
          getAnswerSelectFeedback: vi.fn(() => null),
          renderAnswerFeedback: vi.fn(),
          renderHazardEvade: vi.fn(),
        },
      });

      director.renderGameScene(mockContext as any);

      expect(mockContext.starNoteRenderer.render).toHaveBeenCalledTimes(1);
      const [, , , renderState] = mockContext.starNoteRenderer.render.mock.calls[0];
      // BOSS_CLIMAX에서는 beatPreview가 주입되지 않고 undefined여야 함 (Phase B 비주입 격리)
      expect(renderState.beatPreview).toBeUndefined();
    });

    it('일시정지(pause) 시 isPaused 플래그가 StarNoteRenderer에 온전히 전달된다', () => {
      const director = new SceneDirector();
      const mockContext = createFullMockSceneContext('STAR_COLLECT', {
        engine: { elapsedTime: 10.0, paused: true },
        starNoteScheduler: { currentTarget: null, activeNotes: [], startTime: 5.0, isPaused: true },
      });

      director.renderGameScene(mockContext as any);

      expect(mockContext.starNoteRenderer.render).toHaveBeenCalledTimes(1);
      const [, , , renderState] = mockContext.starNoteRenderer.render.mock.calls[0];
      expect(renderState.isPaused).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 시나리오 5: 다양한 BPM 환산 수식 유효성 및 fallback 안전성 검증
  // ────────────────────────────────────────────────────────────────
  describe('5. 다양한 BPM(60, 120, 160) 환산 수식 유효성 및 유효하지 않은 preview 전달 시 fallback 검증', () => {
    let renderer: StarNoteRenderer;
    const t0 = 0.0;

    beforeEach(() => {
      renderer = new StarNoteRenderer();
    });

    it('BPM 60 (1박 = 1.000s): 첫 별 1.0s 예고, 2~7번째 별 2.0s 예고 수식이 정확히 성립한다', () => {
      const bpm = 60;
      const spb = 60 / bpm; // 1.0s
      const previewOption: StarBeatPreviewOptions = {
        startTime: t0,
        secondsPerBeat: spb,
      };

      // 1번째 별: landing = t0 + 1.0s
      const star1 = createMockStarTarget({ landingTime: t0 + 1.0, zoneId: 4 });
      // displayStart = max(0, 1.0 - 2.0) = 0.0 -> 예고시간 1.0s (1박)
      const pos1 = renderer.computeNotePosition(
        star1,
        0.5,
        vx,
        vy,
        vw,
        vh,
        DEFAULT_FITNESS_ZONES,
        previewOption,
      );
      expect(pos1.inFlight).toBe(true);
      expect(pos1.progress).toBeCloseTo(0.5, 4);

      // 2번째 별: landing = t0 + 2.0s
      const star2 = createMockStarTarget({ landingTime: t0 + 2.0, zoneId: 5 });
      // displayStart = max(0, 2.0 - 2.0) = 0.0 -> 예고시간 2.0s (2박)
      const pos2 = renderer.computeNotePosition(
        star2,
        1.0,
        vx,
        vy,
        vw,
        vh,
        DEFAULT_FITNESS_ZONES,
        previewOption,
      );
      expect(pos2.inFlight).toBe(true);
      expect(pos2.progress).toBeCloseTo(0.5, 4);

      // 3번째 별: landing = t0 + 3.0s
      const star3 = createMockStarTarget({ landingTime: t0 + 3.0, zoneId: 4 });
      // displayStart = max(0, 3.0 - 2.0) = 1.0 -> 예고시간 2.0s (2박)
      const pos3Before = renderer.computeNotePosition(
        star3,
        0.9,
        vx,
        vy,
        vw,
        vh,
        DEFAULT_FITNESS_ZONES,
        previewOption,
      );
      expect(pos3Before.inFlight).toBe(false);

      const pos3Mid = renderer.computeNotePosition(
        star3,
        2.0,
        vx,
        vy,
        vw,
        vh,
        DEFAULT_FITNESS_ZONES,
        previewOption,
      );
      expect(pos3Mid.inFlight).toBe(true);
      expect(pos3Mid.progress).toBeCloseTo(0.5, 4);
    });

    it('BPM 160 (1박 = 0.375s): 첫 별 0.375s 예고, 2~7번째 별 0.750s 예고 수식이 정확히 성립한다', () => {
      const bpm = 160;
      const spb = 60 / bpm; // 0.375s
      const previewOption: StarBeatPreviewOptions = {
        startTime: t0,
        secondsPerBeat: spb,
      };

      // 1번째 별: landing = t0 + 0.375s
      const star1 = createMockStarTarget({ landingTime: t0 + 0.375, zoneId: 4 });
      const pos1 = renderer.computeNotePosition(
        star1,
        0.375 / 2,
        vx,
        vy,
        vw,
        vh,
        DEFAULT_FITNESS_ZONES,
        previewOption,
      );
      expect(pos1.inFlight).toBe(true);
      expect(pos1.progress).toBeCloseTo(0.5, 4);

      // 2번째 별: landing = t0 + 0.750s
      const star2 = createMockStarTarget({ landingTime: t0 + 0.75, zoneId: 5 });
      const pos2 = renderer.computeNotePosition(
        star2,
        0.75 / 2,
        vx,
        vy,
        vw,
        vh,
        DEFAULT_FITNESS_ZONES,
        previewOption,
      );
      expect(pos2.inFlight).toBe(true);
      expect(pos2.progress).toBeCloseTo(0.5, 4);

      // 3번째 별: landing = t0 + 1.125s -> displayStart = 1.125 - 0.750 = 0.375s
      const star3 = createMockStarTarget({ landingTime: t0 + 1.125, zoneId: 4 });
      const pos3Before = renderer.computeNotePosition(
        star3,
        0.3,
        vx,
        vy,
        vw,
        vh,
        DEFAULT_FITNESS_ZONES,
        previewOption,
      );
      expect(pos3Before.inFlight).toBe(false);

      const pos3Mid = renderer.computeNotePosition(
        star3,
        0.75,
        vx,
        vy,
        vw,
        vh,
        DEFAULT_FITNESS_ZONES,
        previewOption,
      );
      expect(pos3Mid.inFlight).toBe(true);
      expect(pos3Mid.progress).toBeCloseTo(0.5, 4);
    });

    it('유효하지 않은 beatPreview (undefined, NaN, minSecondsPerBeat 미만 등) 전달 시 기존 0.5s travelDuration으로 fallback한다', () => {
      const target = createMockStarTarget({ landingTime: 10.0, zoneId: 4 });

      // 1. undefined
      const posUndef = renderer.computeNotePosition(
        target,
        9.75,
        vx,
        vy,
        vw,
        vh,
        DEFAULT_FITNESS_ZONES,
        undefined,
      );
      // fallback 0.5s -> startTime = 9.5s, at 9.75s progress = 0.5
      expect(posUndef.inFlight).toBe(true);
      expect(posUndef.progress).toBeCloseTo(0.5, 4);

      // 2. startTime이 NaN
      const posNanStart = renderer.computeNotePosition(
        target,
        9.75,
        vx,
        vy,
        vw,
        vh,
        DEFAULT_FITNESS_ZONES,
        { startTime: NaN, secondsPerBeat: 0.5 },
      );
      expect(posNanStart.inFlight).toBe(true);
      expect(posNanStart.progress).toBeCloseTo(0.5, 4);

      // 3. secondsPerBeat가 minSecondsPerBeat(0.05s) 미만
      const posTooFast = renderer.computeNotePosition(
        target,
        9.75,
        vx,
        vy,
        vw,
        vh,
        DEFAULT_FITNESS_ZONES,
        { startTime: 0, secondsPerBeat: 0.01 },
      );
      expect(posTooFast.inFlight).toBe(true);
      expect(posTooFast.progress).toBeCloseTo(0.5, 4);

      // 4. secondsPerBeat가 음수 또는 NaN
      const posNegative = renderer.computeNotePosition(
        target,
        9.75,
        vx,
        vy,
        vw,
        vh,
        DEFAULT_FITNESS_ZONES,
        { startTime: 0, secondsPerBeat: -0.5 },
      );
      expect(posNegative.inFlight).toBe(true);
      expect(posNegative.progress).toBeCloseTo(0.5, 4);
    });
  });
});
