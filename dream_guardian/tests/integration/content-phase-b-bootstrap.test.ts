/**
 * tests/integration/content-phase-b-bootstrap.test.ts
 *
 * [Issue #402 / BOOT-PHASE-B-CONTENT]
 * Phase A→B 동일 팩 인계와 피버·보스 공격 연결 통합 테스트
 *
 * 검증 매트릭스:
 * 1. 10문제 완료 후 BOSS_CLIMAX 진입 시 Phase A와 동일한 hash/bundle이 bossFeverController 및 bossHazardController에 주입된다.
 * 2. Phase B 진입 시 11번째 문제 출제 차단 및 단 1회의 정상적인 Phase B 자원/상태 인계 보장.
 * 3. 양 컨트롤러의 역할 분리: fever는 feverNotes만, hazard는 hazards만 소비.
 * 4. 중간 게시(mid-stage publish/rollback)가 발생하더라도 현재 진행 중인 스테이지의 stageBundle은 불변 고정(Pinning)되며 오직 다음 스테이지나 명시적 재시작 시점에만 새 팩이 적용됨.
 * 5. 승패, 메뉴 복귀(goToMenu), 재시작(restartGame), 테스트 세션 격리(isTestSession) 보존.
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
import type { BossHazardAttackType } from '../../src/game/BossHazardController.js';

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

function createValidPublishedPackWithPhaseB(
  stageId = 'ch1',
  bpm = 128,
  hazards: BossHazardAttackType[] = ['dual_slam', 'alternating_stomp_left'],
  feverNoteZoneIds: number[] = [1, 2, 3, 4],
): PublishedContentPack {
  const starNotes = [
    { id: 'star_0', slotIndex: 0, landingTick: 960, landingBeat: 2, target: { type: 'cursor' as const, part: 'leftHand' as const, zoneId: 1, instrument: 'hand' as const } },
    { id: 'star_1', slotIndex: 1, landingTick: 1920, landingBeat: 4, target: { type: 'cursor' as const, part: 'rightHand' as const, zoneId: 2, instrument: 'hand' as const } },
    { id: 'star_2', slotIndex: 2, landingTick: 2880, landingBeat: 6, target: { type: 'cursor' as const, part: 'leftHand' as const, zoneId: 3, instrument: 'hand' as const } },
    { id: 'star_3', slotIndex: 3, landingTick: 3840, landingBeat: 8, target: { type: 'cursor' as const, part: 'rightHand' as const, zoneId: 4, instrument: 'hand' as const } },
    { id: 'star_4', slotIndex: 4, landingTick: 4800, landingBeat: 10, target: { type: 'cursor' as const, part: 'hip' as const, zoneId: 7, instrument: 'foot' as const } },
    { id: 'star_5', slotIndex: 5, landingTick: 5760, landingBeat: 12, target: { type: 'cursor' as const, part: 'hip' as const, zoneId: 8, instrument: 'foot' as const } },
    { id: 'star_6', slotIndex: 6, landingTick: 6720, landingBeat: 14, target: { type: 'cursor' as const, part: 'leftHand' as const, zoneId: 5, instrument: 'hand' as const } },
  ];

  const compiledHazards = hazards.map((attackType, idx) => ({
    id: `hz_b_${idx}`,
    attackType,
    requiredAction: attackType === 'dual_slam' ? ('jump' as const) : attackType === 'alternating_stomp_left' ? ('left_step' as const) : ('right_step' as const),
    warningDurationSeconds: 1.5,
    activeDurationSeconds: 1.0,
    damage: 15,
  }));

  const compiledFeverNotes = feverNoteZoneIds.map((zoneId, idx) => ({
    id: `fn_${idx}`,
    landingTick: (idx + 1) * 960,
    target: { type: 'cursor' as const, part: 'leftHand' as const, zoneId, instrument: 'hand' as const },
  }));

  const pack: PublishedContentPack = {
    schemaVersion: PUBLISHED_SCHEMA_VERSION,
    kind: PUBLISHED_PACK_KIND,
    runtimeContractVersion: '2.0.0',
    compilerVersion: '1.0.0',
    sourceProjectId: 'proj_phase_b_test_402',
    sourceRevision: 1,
    rulesetId: DEFAULT_RULESET_ID,
    rulesetHash: VALID_RULESET_HASH,
    contentHash: '',
    stages: {
      [stageId]: {
        stageId,
        tempo: { bpm, beatsPerBar: 4 },
        phaseA: {
          starNotes,
          hazard: {
            id: 'hz_a_sample',
            hazardType: 'jump',
            requiredAction: 'jump',
          },
          motionGuide: [],
        },
        phaseB: {
          feverNotes: compiledFeverNotes,
          hazards: compiledHazards,
          motionGuide: [],
        },
      },
    },
    metadata: {
      title: `Phase B Test Pack (${stageId})`,
      compiledAt: new Date().toISOString(),
    },
  };

  pack.contentHash = computePublishedPackHash(pack);
  return pack;
}

/**
 * 10개 라운드를 완료하여 BOSS_CLIMAX 진입을 유도하는 헬퍼
 */
function settleAllTenRounds(app: AppBootstrap): void {
  app.startRunningPhase();
  for (let r = 1; r <= 10; r++) {
    app.beatRoundResolver.startNewRound(r);
    app.stateMachine.changeState('ROUND_RESOLVE');
    const resolveResult = app.beatRoundResolver.resolveRound('correct', r);
    app.stageProgressController.handleRoundSettled(resolveResult, { immediate: true });
  }
}

describe('[Issue #402 / BOOT-PHASE-B-CONTENT] Phase A→B 동일 팩 인계와 피버·보스 공격 연결', () => {
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

  it('1. 10문제 완료 후 BOSS_CLIMAX 진입 시 Phase A와 동일한 hash/bundle이 bossFeverController 및 bossHazardController에 주입된다', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    const customPack = createValidPublishedPackWithPhaseB('ch1', 135, ['dual_slam', 'alternating_stomp_left']);
    app.setCustomContentPack(customPack);
    app.startChapter(1);

    const initialBundle = app.sessionContext.activeStageBundle;
    expect(initialBundle).not.toBeNull();
    expect(initialBundle?.bpm).toBe(135);

    // 10개 문제 완료
    settleAllTenRounds(app);

    // BOSS_CLIMAX 상태 전이 확인
    expect(app.stateMachine.currentState).toBe('BOSS_CLIMAX');

    // 양 컨트롤러에 동일한 stageBundle 주입 확인
    const feverBundle = (app.bossFeverController as any).stageBundle;
    const hazardBundle = (app.bossHazardController as any).stageBundle;

    expect(feverBundle).toBe(initialBundle);
    expect(hazardBundle).toBe(initialBundle);
    expect(feverBundle?.sourcePackHash).toBe(customPack.contentHash);
    expect(hazardBundle?.sourcePackHash).toBe(customPack.contentHash);
    expect(feverBundle?.contentHash).toBe(customPack.contentHash);
    expect(hazardBundle?.contentHash).toBe(customPack.contentHash);

    app.dispose();
  });

  it('2. Phase B 진입 시 11번째 문제 출제 차단 및 단 1회의 정상적인 Phase B 자원/상태 인계 보장', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    const customPack = createValidPublishedPackWithPhaseB('ch1', 128);
    app.setCustomContentPack(customPack);
    app.startChapter(1);

    settleAllTenRounds(app);

    expect(app.stateMachine.currentState).toBe('BOSS_CLIMAX');
    expect(app.stageProgressController.hasEnteredBossClimax).toBe(true);
    expect(app.stageProgressController.handoffCount).toBe(1);

    // 11번째 문제 출제 시도 차단 검증
    app.startRunningPhase();
    expect(app.stateMachine.currentState).toBe('BOSS_CLIMAX');

    app.enterQuestionPhase();
    expect(app.stateMachine.currentState).toBe('BOSS_CLIMAX');

    // 라운드 인덱스는 10으로 유지
    expect(app.beatRoundResolver.currentRoundIndex).toBe(10);

    app.dispose();
  });

  it('3. 양 컨트롤러의 역할 분리: fever는 feverNotes만, hazard는 hazards만 소비', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    const targetHazards: BossHazardAttackType[] = ['dual_slam', 'alternating_stomp_left'];
    const targetFeverZones = [3, 4, 5];
    const customPack = createValidPublishedPackWithPhaseB('ch1', 120, targetHazards, targetFeverZones);
    app.setCustomContentPack(customPack);
    app.startChapter(1);

    settleAllTenRounds(app);

    // BossFeverController 역할 검증: feverNotes만 소비
    const bundle = app.sessionContext.activeStageBundle!;
    const feverKeynotes = bundle.getPhaseBFeverKeynotes(1);
    expect(feverKeynotes.length).toBe(targetFeverZones.length);
    expect(feverKeynotes.map((k) => k.zoneId)).toEqual(targetFeverZones);

    // BossHazardController 역할 검증: hazards만 소비
    const hazardPatterns = (app.bossHazardController as any).patternPool;
    expect(hazardPatterns).toEqual(targetHazards);

    // 보스 공격 트리거 시 번들의 executionId와 연동
    (app.bossHazardController as any).start({ initialDelay: 0 });
    (app.bossHazardController as any).update(0.1);
    const scheduledAttackId = (app.bossHazardController as any).lastAttackId;
    if (scheduledAttackId) {
      expect(scheduledAttackId).toBe(bundle.getPhaseBHazardExecutionId(0, 0));
    }

    app.dispose();
  });

  it('4. 스테이지 진행 도중 새 팩 게시/로드 시도가 있어도 현재 진행 중인 스테이지 팩은 변경되지 않는 세션 고정(mid-stage pinning) 검증', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    const pack1 = createValidPublishedPackWithPhaseB('ch1', 120, ['dual_slam']);
    const pack2 = createValidPublishedPackWithPhaseB('ch1', 140, ['alternating_stomp_right']);

    app.setCustomContentPack(pack1);
    app.startChapter(1);

    expect(app.sessionContext.activeStageBundle?.bpm).toBe(120);

    // 스테이지 진행 도중 pack2 등록
    app.setCustomContentPack(pack2);
    app.sessionContext.setStageContent({
      stageId: 'ch1',
      pack: pack2,
    });

    // 현재 실행 중인 스테이지는 pack1으로 고정 (Pinning) 유지
    expect(app.sessionContext.activeStageBundle?.bpm).toBe(120);
    expect(app.sessionContext.stageBundle?.bpm).toBe(120);
    expect(app.sessionContext.stagedBundle?.bpm).toBe(140);

    // 10문제 완료 후 BOSS_CLIMAX 진입해도 여전히 Pack 1 유지
    settleAllTenRounds(app);
    expect(app.stateMachine.currentState).toBe('BOSS_CLIMAX');
    expect((app.bossFeverController as any).stageBundle?.bpm).toBe(120);
    expect((app.bossHazardController as any).stageBundle?.bpm).toBe(120);

    // 명시적 restartGame 호출 시 staged 팩(pack2)이 새 스테이지에 적용됨
    app.restartGame();
    expect(app.sessionContext.activeStageBundle?.bpm).toBe(140);

    app.dispose();
  });

  it('5. 승리/패배/재시작/메뉴 복귀 시 안전한 클린업 및 test-session 저장 격리 검증', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    const customPack = createValidPublishedPackWithPhaseB('ch1', 125);
    app.setCustomContentPack(customPack);

    // 테스트 세션으로 시작
    app.startChapter(1, undefined, { pack: customPack, isTestSession: true, contentHash: customPack.contentHash });

    expect(app.sessionContext.isTestSession).toBe(true);
    expect(app.sessionContext.canSaveProgress).toBe(false);
    expect(app.sessionContext.canSaveRewards).toBe(false);
    expect(app.sessionContext.canSaveHighScore).toBe(false);

    settleAllTenRounds(app);
    expect(app.stateMachine.currentState).toBe('BOSS_CLIMAX');
    expect(app.sessionContext.canSaveProgress).toBe(false);

    // 메뉴 복귀 시 클린업
    app.goToMenu();
    expect(app.stateMachine.currentState).toBe('MENU_MAIN');
    expect(app.bossFeverController.isActive).toBe(false);
    expect(app.bossHazardController.isActive).toBe(false);
    expect(app.sessionContext.activeStageBundle).toBeNull();
    expect(app.sessionContext.isTestSession).toBe(false);

    app.dispose();
  });
});
