/**
 * tests/integration/content-star-bootstrap.test.ts
 *
 * [Issue #390 / CONTENT-BOOT-STAR]
 * 게임 조립계층 별 팩 주입 및 기존 CSV 경쟁 차단 통합 검증
 *
 * 검증 매트릭스:
 * 1. 커스텀 게시본 주입 시 별 7노트 및 세션 바인딩(BPM, branchClock) 정상 전달
 * 2. 늦게 완료된 비동기 CSV 로드가 커스텀 팩 노트를 덮어쓰지 않는 경쟁 차단 검증
 * 3. 선택 팩이 없을 때 기존 CSV 모드로 정상 동작 검증
 * 4. 불완전 팩 (notes=[]) 제공 시 전체 거부 및 whole-pack fallback으로 default_csv 모드 전환
 * 5. pause/restart 및 새 스테이지 전환 시 이전 세션 팩 오염 방지 검증
 * 6. 정답 분기 진입(STAR_COLLECT) 시 Direct vs Transition 양쪽 경로에서 분기 시작점/BPM/roundID/notes 일치 검증
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
import { BEGINNER_PHASE_A_STAR_NOTES } from '../../src/data/beginnerRhythmRoutine.js';

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

function createValidPublishedPackWith7Notes(stageId = 'ch1', bpm = 135): PublishedContentPack {
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
    sourceProjectId: 'proj_test_star_390',
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
            hazardType: 'jump',
            requiredAction: 'jump',
          },
          motionGuide: [],
        },
        phaseB: {
          feverNotes: [
            {
              id: 'fever_0',
              landingTick: 960,
              target: { type: 'cursor', part: 'leftHand', zoneId: 1, instrument: 'hand' },
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
      title: 'Star Test Pack 390',
      compiledAt: new Date().toISOString(),
    },
  };

  pack.contentHash = computePublishedPackHash(pack);
  return pack;
}

describe('[Issue #390 / CONTENT-BOOT-STAR] 게임 조립계층 별 팩 주입 및 CSV 경쟁 차단', () => {
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

  it('커스텀 게시본 주입 시 별 7노트 및 세션 바인딩(BPM, notes) 정상 전달', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    const customPack = createValidPublishedPackWith7Notes('ch1', 135);
    app.setCustomContentPack(customPack);
    app.startChapter(1);

    // 1. 세션 컨텍스트 검증
    expect(app.sessionContext.contentMode).toBe('custom_pack');
    expect(app.sessionContext.activeStageBundle).not.toBeNull();
    expect(app.sessionContext.activeStageBundle?.bpm).toBe(135);

    // 2. getPhaseAStarNotes 및 beatCoordinator.keynotes 주입 검증
    const activeNotes = app.getPhaseAStarNotes();
    expect(activeNotes).toHaveLength(7);
    expect(activeNotes[0].zoneId).toBe(1);
    expect(activeNotes[1].zoneId).toBe(2);
    expect(activeNotes[6].zoneId).toBe(7);
    expect(activeNotes[6].instrument).toBe('foot');

    // 3. beatCoordinator에 주입된 keynotes 및 BPM 검증
    expect(app.beatCoordinator.keynotes).toHaveLength(7);
    expect(app.beatCoordinator.keynotes[0].zoneId).toBe(1);
    expect(app.beatCoordinator.rhythmEngine.bpm).toBe(135);

    app.dispose();
  });

  it('늦게 완료된 비동기 CSV 로드가 커스텀 팩 노트를 덮어쓰지 않는 경쟁 차단 검증', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    // 커스텀 팩 활성화 상태로 챕터 1 시작
    const customPack = createValidPublishedPackWith7Notes('ch1', 135);
    app.setCustomContentPack(customPack);
    app.startChapter(1);

    expect(app.sessionContext.contentMode).toBe('custom_pack');
    expect(app.getPhaseAStarNotes()[0].zoneId).toBe(1);

    // 비동기 CSV 로드 시뮬레이션: /fitness pattern.csv 응답이 뒤늦게 도착
    const mockCsv = `id,name,category,difficulty,type,beats,bpm,action_pattern,target_zones
FP001,스쿼트 펀치,근력,초급,single,8,120,"leftHand:4,rightHand:5","4,5"`;

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('fitness pattern')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(mockCsv),
        });
      }
      return Promise.resolve({ ok: false });
    }));

    // 뒤늦은 loadFitnessPatterns() 실행
    await app.loadFitnessPatterns();

    // 커스텀 팩 노트를 덮어쓰지 않았음을 확인
    expect(app.sessionContext.contentMode).toBe('custom_pack');
    expect(app.getPhaseAStarNotes()[0].zoneId).toBe(1);
    expect(app.beatCoordinator.keynotes[0].zoneId).toBe(1);

    app.dispose();
  });

  it('선택 팩이 없을 때 기존 CSV 모드로 정상 동작 검증', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    app.setCustomContentPack(null);
    app.startChapter(1);

    expect(app.sessionContext.contentMode).toBe('default_csv');
    expect(app.sessionContext.activeStageBundle).toBeNull();
    // 기본 모드에서는 입문 Phase A 별 노트(Zone 4, 5 교대) 사용
    const defaultNotes = app.getPhaseAStarNotes();
    expect(defaultNotes).toHaveLength(7);
    expect(defaultNotes[0].zoneId).toBe(BEGINNER_PHASE_A_STAR_NOTES[0].zoneId);

    app.dispose();
  });

  it('불완전 팩(notes=[]) 제공 시 전체 거부 및 whole-pack fallback으로 default_csv 모드 전환', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    // starNotes가 빈 배열인 불완전 팩 생성
    const incompletePack = createValidPublishedPackWith7Notes('ch1', 140);
    (incompletePack.stages['ch1'].phaseA as any).starNotes = [];
    incompletePack.contentHash = computePublishedPackHash(incompletePack);

    app.setCustomContentPack(incompletePack);
    app.startChapter(1);

    // 불완전 팩은 우회되지 않고 fallback으로 default_csv 모드로 처리됨
    expect(app.sessionContext.contentMode).toBe('default_csv');
    expect(app.sessionContext.activeStageBundle).toBeNull();
    expect(app.getPhaseAStarNotes()).toHaveLength(7);
    expect(app.getPhaseAStarNotes()[0].zoneId).toBe(BEGINNER_PHASE_A_STAR_NOTES[0].zoneId);

    app.dispose();
  });

  it('pause/restart 및 새 스테이지 전환 시 이전 세션 팩 오염 방지 검증', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    // 1. Ch1에만 존재하는 커스텀 팩 주입
    const customPack = createValidPublishedPackWith7Notes('ch1', 135);
    app.setCustomContentPack(customPack);
    app.startChapter(1);

    const session1Id = app.sessionLifecycle.sessionId;
    expect(app.sessionContext.contentMode).toBe('custom_pack');

    // 2. 재시작 검증
    app.restartGame();
    expect(app.sessionLifecycle.sessionId).toBeGreaterThan(session1Id);

    // 3. 새 스테이지(Ch2) 전환 - 커스텀 팩에 ch2가 없으므로 격리되어 fallback default_csv 동작
    app.startChapter(2);
    expect(app.sessionContext.contentMode).toBe('default_csv');
    expect(app.getPhaseAStarNotes()[0].zoneId).toBe(BEGINNER_PHASE_A_STAR_NOTES[0].zoneId);
    const ch1StarNotes = customPack.stages['ch1']?.phaseA?.starNotes;
    expect(ch1StarNotes).toBeDefined();
    expect(app.getPhaseAStarNotes()[0].zoneId).not.toBe(ch1StarNotes?.[0]?.target?.zoneId);

    app.dispose();
  });

  it('정답 분기 진입(STAR_COLLECT) 시 Direct vs Transition 양쪽 경로에서 분기 시작점/BPM/roundID/notes 일치 검증', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    const customPack = createValidPublishedPackWith7Notes('ch1', 135);
    app.setCustomContentPack(customPack);
    app.startChapter(1);

    // BeatCoordinator를 준비하고 상태를 ANSWER_SELECT로 전이
    app.startRunningPhase();
    app.stateMachine.changeState('ANSWER_SELECT');
    app.beatRoundResolver.startNewRound(3);
    const roundId = app.beatRoundResolver.currentRoundIndex;
    expect(roundId).toBe(3);

    // [경로 1: Direct Entry - StateMachine changeState]
    app.starNoteScheduler.reset();
    expect(app.starNoteScheduler.isStarted).toBe(false);

    app.stateMachine.changeState('STAR_COLLECT');
    expect(app.starNoteScheduler.isStarted).toBe(true);
    expect(app.starNoteScheduler.roundId).toBe(3);
    expect(app.starNoteScheduler.notes).toHaveLength(7);
    expect(app.starNoteScheduler.notes[0].zoneId).toBe(1);
    const directSpb = app.starNoteScheduler.notes[0].landingTime - app.starNoteScheduler.startTime;
    expect(directSpb).toBeCloseTo(60 / 135, 3);
    const directStartTime = app.starNoteScheduler.startTime;
    expect(directStartTime).toBeGreaterThanOrEqual(0);

    // [경로 2: Transition Entry - SceneDirector frame branch entry]
    app.starNoteScheduler.reset();
    expect(app.starNoteScheduler.isStarted).toBe(false);

    // SceneDirector 게임 씬에서 frame update 실행
    app.sceneDirector.setScene('game');
    app.sceneDirector.update(0.016, app.mainSceneContext);
    expect(app.starNoteScheduler.isStarted).toBe(true);
    expect(app.starNoteScheduler.roundId).toBe(3);
    expect(app.starNoteScheduler.notes).toHaveLength(7);
    expect(app.starNoteScheduler.notes[0].zoneId).toBe(1);
    const transSpb = app.starNoteScheduler.notes[0].landingTime - app.starNoteScheduler.startTime;
    expect(transSpb).toBeCloseTo(60 / 135, 3);

    app.dispose();
  });
});
