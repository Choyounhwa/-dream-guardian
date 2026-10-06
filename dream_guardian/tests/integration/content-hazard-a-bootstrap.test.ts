/**
 * tests/integration/content-hazard-a-bootstrap.test.ts
 *
 * [Issue #397 / BOOT-HAZARD-A-CONTENT]
 * 게임 조립계층 오답 장판 팩 연결 통합 테스트
 *
 * 검증 매트릭스:
 * 1. 커스텀 팩 주입 시 오답 분기에서 SessionContent의 패턴과 attackId가 PhaseAHazardController에 정확히 주입되는지 검증
 * 2. 정답 시 별만 실행, 오답 시 장판만 실행 (상호 배타적 분기) 검증
 * 3. 두 진입 경로(Direct enter vs SceneDirector update)에서 일치하는 옵션 주입 및 중복 실행 차단 검증
 * 4. 타임아웃(timeout) 발생 시 장판 정상 트리거 검증
 * 5. 오답 시 직접 HP 즉시 차감 0건 및 회피 실패 시에만 정산(damagePerMiss) 검증
 * 6. pause / resume / restart / 메뉴 복귀 시 장판 리셋 및 잔류 0 검증
 * 7. 기본 팩(CSV/builtin) 모드 회귀 정상 보존 검증
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppBootstrap } from '../../src/core/AppBootstrap.js';
import {
  type PublishedContentPack,
  PUBLISHED_PACK_KIND,
  PUBLISHED_SCHEMA_VERSION,
  computePublishedPackHash,
} from '../../src/data/PublishedContentPack.js';
import { computeContentHash } from '../../src/data/ContentCanonical.js';
import {
  DEFAULT_RULESET_ID,
  V2_PUBLISHABLE_CAPABILITY_PROFILE,
} from '../../src/data/ContentCapabilities.js';
import type { PhaseAHazardPattern } from '../../config/phase-a-hazard.config.js';

const VALID_RULESET_HASH = computeContentHash(V2_PUBLISHABLE_CAPABILITY_PROFILE);

function createMockCanvas(): HTMLCanvasElement {
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 60 })),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    drawImage: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    canvas: { width: 1280, height: 720 },
    fillStyle: '#ffffff',
    strokeStyle: '#ffffff',
    lineWidth: 1,
    font: '16px sans-serif',
    textAlign: 'center',
    textBaseline: 'middle',
    globalAlpha: 1.0,
  };

  return {
    width: 1280,
    height: 720,
    getContext: vi.fn(() => ctx),
    getBoundingClientRect: vi.fn(() => ({
      left: 0,
      top: 0,
      width: 1280,
      height: 720,
      right: 1280,
      bottom: 720,
      x: 0,
      y: 0,
      toJSON: () => {},
    })),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as HTMLCanvasElement;
}

function advanceToAnswerSelect(app: AppBootstrap): void {
  app.startRunningPhase();
  const spb = app.beatCoordinator.rhythmEngine.secondsPerBeat;
  let safety = 0;
  while (app.beatCoordinator.phase !== 'ANSWER_SELECT' && safety++ < 30) {
    app.beatCoordinator.recordStep('run');
    app.beatCoordinator.update(spb);
  }
}

function createValidPublishedPackWithHazard(
  stageId = 'ch1',
  bpm = 120,
  hazardPattern: PhaseAHazardPattern = 'left_step',
): PublishedContentPack {
  const starNotes = [
    { id: 'custom_star_0', slotIndex: 0, landingTick: 960, landingBeat: 2, target: { type: 'cursor' as const, part: 'leftHand' as const, zoneId: 1, instrument: 'hand' as const } },
    { id: 'custom_star_1', slotIndex: 1, landingTick: 1440, landingBeat: 3, target: { type: 'cursor' as const, part: 'rightHand' as const, zoneId: 2, instrument: 'hand' as const } },
    { id: 'custom_star_2', slotIndex: 2, landingTick: 1920, landingBeat: 4, target: { type: 'cursor' as const, part: 'leftHand' as const, zoneId: 3, instrument: 'hand' as const } },
    { id: 'custom_star_3', slotIndex: 3, landingTick: 2400, landingBeat: 5, target: { type: 'cursor' as const, part: 'rightHand' as const, zoneId: 4, instrument: 'hand' as const } },
    { id: 'custom_star_4', slotIndex: 4, landingTick: 2880, landingBeat: 6, target: { type: 'cursor' as const, part: 'leftHand' as const, zoneId: 5, instrument: 'hand' as const } },
    { id: 'custom_star_5', slotIndex: 5, landingTick: 3360, landingBeat: 7, target: { type: 'cursor' as const, part: 'rightHand' as const, zoneId: 6, instrument: 'hand' as const } },
    { id: 'custom_star_6', slotIndex: 6, landingTick: 3840, landingBeat: 8, target: { type: 'cursor' as const, part: 'hip' as const, zoneId: 7, instrument: 'foot' as const } },
  ];

  const pack: PublishedContentPack = {
    kind: PUBLISHED_PACK_KIND,
    schemaVersion: PUBLISHED_SCHEMA_VERSION,
    runtimeContractVersion: '2.0.0',
    rulesetId: DEFAULT_RULESET_ID,
    rulesetHash: VALID_RULESET_HASH,
    compilerVersion: '1.0.0',
    sourceProjectId: 'proj_test_hazard_397',
    sourceRevision: 1,
    contentHash: '',
    stages: {
      [stageId]: {
        stageId,
        tempo: { bpm, beatsPerBar: 4 },
        phaseA: {
          starNotes,
          hazard: {
            id: 'hz_a_test',
            hazardType: hazardPattern,
            requiredAction: hazardPattern,
          },
          motionGuide: [],
        },
        phaseB: {
          feverNotes: [
            {
              id: 'fn_0',
              landingTick: 960,
              target: { type: 'cursor' as const, part: 'leftHand' as const, zoneId: 1, instrument: 'hand' as const },
            },
          ],
          hazards: [
            {
              id: 'hz_b_test',
              attackType: 'dual_slam',
              requiredAction: 'jump',
              warningDurationSeconds: 1.5,
              activeDurationSeconds: 0.5,
              damage: 15,
            },
          ],
          motionGuide: [],
        },
      },
    },
    metadata: {
      title: 'Hazard Test Pack 397',
      compiledAt: new Date().toISOString(),
    },
  };

  pack.contentHash = computePublishedPackHash(pack);
  return pack;
}

describe('[Issue #397 / BOOT-HAZARD-A-CONTENT] 게임 조립계층 오답 장판 팩 연결', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      innerWidth: 1280,
      innerHeight: 720,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal('document', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getElementById: vi.fn(() => null),
      fullscreenElement: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('1. 커스텀 팩 주입 시 오답 분기에서 SessionContent의 패턴과 attackId가 PhaseAHazardController에 정확히 주입된다', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    const customPack = createValidPublishedPackWithHazard('ch1', 130, 'right_step');
    app.setCustomContentPack(customPack);
    app.startChapter(1);

    expect(app.sessionContext.contentMode).toBe('custom_pack');
    const bundle = app.sessionContext.activeStageBundle;
    expect(bundle).not.toBeNull();
    expect(bundle?.getPhaseAHazardPattern(1)).toBe('right_step');

    // 라운드 1 시작 후 ANSWER_SELECT로 이동하여 오답 선택
    advanceToAnswerSelect(app);
    app.beatRoundResolver.startNewRound(1);

    // 오답 선택 시뮬레이션
    const currentQ = app.beatCoordinator.currentQuestion;
    const wrongIdx = currentQ ? (currentQ.correctIndex === 0 ? 1 : 0) : 1;
    app.beatCoordinator.confirmAnswerByFallback(wrongIdx);

    // 오답 분기 -> HAZARD_EVADE 진입
    expect(app.stateMachine.currentState).toBe('HAZARD_EVADE');
    expect(app.phaseAHazardController.isActive).toBe(true);
    expect(app.phaseAHazardController.activePattern).toBe('right_step');

    const expectedAttackId = `${bundle!.getRoundExecutionId(1)}_hazard`;
    expect((app.phaseAHazardController as any)._attackId).toBe(expectedAttackId);

    app.dispose();
  });

  it('2. 정답 시 별 수집(STAR_COLLECT)만 시작되고 오답 장판(HAZARD_EVADE)은 시작되지 않는다', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    const customPack = createValidPublishedPackWithHazard('ch1', 120, 'left_step');
    app.setCustomContentPack(customPack);
    app.startChapter(1);

    advanceToAnswerSelect(app);
    app.beatRoundResolver.startNewRound(1);

    const currentQ = app.beatCoordinator.currentQuestion;
    const correctIdx = currentQ ? currentQ.correctIndex : 0;
    app.beatCoordinator.confirmAnswerByFallback(correctIdx);

    // 정답: STAR_COLLECT만 시작, HAZARD_EVADE는 비활성
    expect(app.stateMachine.currentState).toBe('STAR_COLLECT');
    expect(app.starNoteScheduler.isStarted).toBe(true);
    expect(app.phaseAHazardController.isActive).toBe(false);

    app.dispose();
  });

  it('3. 오답 시 장판 회피(HAZARD_EVADE)만 시작되고 별 수집(STAR_COLLECT)은 시작되지 않는다', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    const customPack = createValidPublishedPackWithHazard('ch1', 120, 'jump');
    app.setCustomContentPack(customPack);
    app.startChapter(1);

    advanceToAnswerSelect(app);
    app.beatRoundResolver.startNewRound(1);

    const currentQ = app.beatCoordinator.currentQuestion;
    const wrongIdx = currentQ ? (currentQ.correctIndex === 0 ? 1 : 0) : 1;
    app.beatCoordinator.confirmAnswerByFallback(wrongIdx);

    // 오답: HAZARD_EVADE만 시작, STAR_COLLECT는 비활성
    expect(app.stateMachine.currentState).toBe('HAZARD_EVADE');
    expect(app.phaseAHazardController.isActive).toBe(true);
    expect(app.phaseAHazardController.activePattern).toBe('jump');
    expect(app.starNoteScheduler.isStarted).toBe(false);

    app.dispose();
  });

  it('4. Direct enter vs SceneDirector update 양쪽 진입 경로에서 동일한 옵션이 주입되며 중복 실행이 차단된다', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    const customPack = createValidPublishedPackWithHazard('ch1', 140, 'left_step');
    app.setCustomContentPack(customPack);
    app.startChapter(1);
    advanceToAnswerSelect(app);
    app.beatRoundResolver.startNewRound(2);

    const bundle = app.sessionContext.activeStageBundle!;
    const expectedAttackId = `${bundle.getRoundExecutionId(2)}_hazard`;

    // 1) Direct enter 경로 테스트
    app.stateMachine.changeState('HAZARD_EVADE');
    expect(app.phaseAHazardController.isActive).toBe(true);
    expect(app.phaseAHazardController.activePattern).toBe('left_step');
    expect((app.phaseAHazardController as any)._attackId).toBe(expectedAttackId);

    // 2) SceneDirector 프레임 업데이트 시 이미 활성화된 상태이므로 중복 start 없이 유지
    const startSpy = vi.spyOn(app.phaseAHazardController, 'start');
    app.sceneDirector.setScene('game');
    app.sceneDirector.update(0.016, app.mainSceneContext);
    expect(startSpy).not.toHaveBeenCalled();

    // 3) Controller 정지 후 SceneDirector를 통한 재진입 테스트
    app.phaseAHazardController.stop();
    expect(app.phaseAHazardController.isActive).toBe(false);

    // SceneDirector update에서 currentState === 'HAZARD_EVADE'일 때 시작
    app.sceneDirector.update(0.016, app.mainSceneContext);
    expect(app.phaseAHazardController.isActive).toBe(true);
    expect(app.phaseAHazardController.activePattern).toBe('left_step');
    expect((app.phaseAHazardController as any)._attackId).toBe(expectedAttackId);

    app.dispose();
  });

  it('5. 타임아웃(timeout) 발생 시 오답 장판(HAZARD_EVADE)이 정상 트리거되고 패턴이 주입된다', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    const customPack = createValidPublishedPackWithHazard('ch1', 120, 'right_step');
    app.setCustomContentPack(customPack);
    app.startChapter(1);

    advanceToAnswerSelect(app);

    // 시간 초과 시뮬레이션: 답변 선택 없이 4박(2.0초) 초과 경과
    app.beatCoordinator.update(2.1);

    expect(app.beatCoordinator.phase).toBe('HAZARD_EVADE');
    expect(app.stateMachine.currentState).toBe('HAZARD_EVADE');
    expect(app.phaseAHazardController.isActive).toBe(true);
    expect(app.phaseAHazardController.activePattern).toBe('right_step');
    expect(app.starNoteScheduler.isStarted).toBe(false);

    app.dispose();
  });

  it('6. 오답 시 직접 HP 즉시 차감 0건 및 장판 회피 실패 시에만 정산(damagePerMiss)된다', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    const customPack = createValidPublishedPackWithHazard('ch1', 120, 'jump');
    app.setCustomContentPack(customPack);
    app.startChapter(1);

    advanceToAnswerSelect(app);
    app.beatRoundResolver.startNewRound(1);

    const initialHp = app.battle.hp;
    expect(initialHp).toBe(100);

    // 오답 선택
    const currentQ = app.beatCoordinator.currentQuestion;
    const wrongIdx = currentQ ? (currentQ.correctIndex === 0 ? 1 : 0) : 1;
    app.beatCoordinator.confirmAnswerByFallback(wrongIdx);

    // 오답 선택 직후에는 직접 HP 차감 없음
    expect(app.battle.hp).toBe(initialHp);

    // 회피 동작 없이 장판 판정 시점(3.5s)까지 업데이트 -> 피격 데미지 25 차감
    app.phaseAHazardController.update(3.6);
    expect(app.battle.hp).toBe(initialHp - 25);

    // 동일 attackId에 대한 추가 업데이트는 중복 피해 차감 0건
    app.phaseAHazardController.update(0.5);
    expect(app.battle.hp).toBe(initialHp - 25);

    app.dispose();
  });

  it('7. pause / resume / restart / 메뉴 복귀 시 장판 리셋 및 잔류 0이 보장된다', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    const customPack = createValidPublishedPackWithHazard('ch1', 120, 'jump');
    app.setCustomContentPack(customPack);
    app.startChapter(1);

    advanceToAnswerSelect(app);
    const currentQ = app.beatCoordinator.currentQuestion;
    const wrongIdx = currentQ ? (currentQ.correctIndex === 0 ? 1 : 0) : 1;
    app.beatCoordinator.confirmAnswerByFallback(wrongIdx);
    expect(app.phaseAHazardController.isActive).toBe(true);

    // pause 테스트: pauseModal 열림 시 SceneDirector update에서 시간 미진행
    app.pauseModal.open();
    const prevElapsed = app.phaseAHazardController.elapsed;
    app.sceneDirector.setScene('game');
    app.sceneDirector.update(0.1, app.mainSceneContext);
    expect(app.phaseAHazardController.elapsed).toBe(prevElapsed);

    // resume
    app.pauseModal.close(true);
    app.sceneDirector.update(0.1, app.mainSceneContext);
    expect(app.phaseAHazardController.elapsed).toBeGreaterThan(prevElapsed);

    // 메뉴 복귀 시 완전 리셋
    app.goToMenu();
    expect(app.stateMachine.currentState).toBe('MENU_MAIN');
    expect(app.phaseAHazardController.isActive).toBe(false);
    expect(app.phaseAHazardController.elapsed).toBe(0);

    // restartGame 테스트
    app.restartGame();
    expect(app.phaseAHazardController.isActive).toBe(false);

    app.dispose();
  });

  it('8. 기본 팩(CSV/builtin) 모드에서 회귀 없이 정상 동작한다', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    // 커스텀 팩 없이 Ch1 시작 -> default_csv 모드
    app.setCustomContentPack(null);
    app.startChapter(1);

    expect(app.sessionContext.contentMode).toBe('default_csv');
    expect(app.sessionContext.activeStageBundle).toBeNull();

    advanceToAnswerSelect(app);
    // HAZARD_EVADE 진입 시 기본 풀(active 3종) 패턴 정상 소비
    app.stateMachine.changeState('HAZARD_EVADE');
    expect(app.phaseAHazardController.isActive).toBe(true);
    expect(['jump', 'left_step', 'right_step']).toContain(app.phaseAHazardController.activePattern);

    app.dispose();
  });
});
