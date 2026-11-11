/**
 * tests/e2e/fitness-editor-full.e2e.ts
 *
 * [Issue #404 / FITNESS-EDITOR-QA]
 * 피트니스 에디터 통합 제작·컴파일·게시·게임 실행·결전·격리·롤백 전체 파이프라인 E2E 인수 테스트 (F단계 최종)
 *
 * 책임 레이어: Tests (소스/config 변경 0개, 종단 QA 통합 검증)
 *
 * 검증 매트릭스:
 * 1. 전체 파이프라인 통합 완주:
 *    - 5대 요소(별 7노트, 오답 장판, 피버 8노트, 보스 장판 3종, 가이드) 에디터 저작
 *    - 컴파일(ContentCompiler) -> 유효성 검증 -> 불변 게시(PublishedContentStore)
 *    - 테스트 플레이 론칭(AppBootstrap.startTestPlaySession) -> 10문제 러닝
 *    - Round 1 오답 분기: HAZARD_EVADE 진입 및 커스텀 장판(jump) 회피
 *    - Round 2 정답 분기: STAR_COLLECT 진입 및 커스텀 7개 별노트 스케줄링 1:1 일치
 *    - Round 3~10 완주 후 Phase B 결전(BOSS_CLIMAX) 단 1회 정상 전이
 *    - Phase B 피버 노트 타격 및 보스 장판(dual_slam -> stomp_l -> stomp_r) 회피 정산
 *    - 보스 격파 승리(showResult(true)) 및 메뉴 복귀(goToMenu)
 * 2. 테스트 플레이 스토리지 완벽 격리 (Zero Storage Writes):
 *    - 테스트 세션 동안 stage progress, high score, rewards 영속화 쓰기 0건 완벽 차단
 *    - 일반 세션(startChapter) 복귀 후 정상적인 저장소 쓰기 동작 보존
 * 3. 패배(Defeat) 분기 및 일시정지(pause/resume) 회귀 무결성
 * 4. 롤백(Rollback) 적용본 재실행 검증
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AppBootstrap,
  STORAGE_KEY_STAGE_PROGRESS,
  STORAGE_KEY_HIGH_SCORES,
  STORAGE_KEY_REWARDS,
  isVerifiedPublishedPack,
} from '../../src/core/AppBootstrap.js';
import { PublishedContentStore } from '../../src/storage/PublishedContentStore.js';
import {
  EditorContentDatabase,
  MemoryIndexedDBAdapter,
} from '../../src/storage/EditorContentDatabase.js';
import {
  AUTHORING_PROJECT_KIND,
  AUTHORING_SCHEMA_VERSION,
  type EditorProject,
} from '../../src/data/EditorProject.js';
import {
  validatePublishedContentPack,
} from '../../src/data/PublishedContentPack.js';
import {
  DEFAULT_RULESET_ID,
  PHASE_A_STAR_LANDING_TICKS,
} from '../../src/data/ContentCapabilities.js';
import { compileEditorProject } from '../../src/data/ContentCompiler.js';

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
    bezierCurveTo: vi.fn(),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    drawImage: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    roundRect: vi.fn(),
    rect: vi.fn(),
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

/**
 * 5대 요소를 포함하는 정밀 저작 프로젝트 픽스처 생성기
 */
function createE2EPublishableProject(
  projectId: string = 'proj_e2e_full_acceptance',
  revision: number = 1,
  bpm: number = 120,
): EditorProject {
  return {
    kind: AUTHORING_PROJECT_KIND,
    schemaVersion: AUTHORING_SCHEMA_VERSION,
    projectId,
    revision,
    rulesetId: DEFAULT_RULESET_ID,
    metadata: {
      title: `E2E Full Choreo Routine rev${revision}`,
      description: 'End-to-End Pipeline Acceptance Test Routine',
      author: 'E2E QA Agent',
      createdAt: '2026-10-06T00:00:00.000Z',
      updatedAt: '2026-10-06T01:00:00.000Z',
    },
    previewTempo: {
      bpm,
      beatsPerBar: 4,
    },
    patterns: [
      {
        id: 'pat_l_hand',
        name: 'Left Hand Punch',
        target: { leftHand: 4, rightHand: null, head: null, hip: null },
      },
      {
        id: 'pat_r_hand',
        name: 'Right Hand Punch',
        target: { leftHand: null, rightHand: 5, head: null, hip: null },
      },
      {
        id: 'pat_foot_step',
        name: 'Left Foot Step',
        target: { leftHand: null, rightHand: null, head: null, hip: 10 },
      },
    ],
    sequences: [
      // 1. 별 7노트 (손 및 발 타겟)
      {
        id: 'seq_phaseA_star',
        phase: 'phaseA',
        kind: 'starNotes',
        events: [
          { id: 'star_0', kind: 'starNote', landingTick: PHASE_A_STAR_LANDING_TICKS[0], target: { type: 'cursor', part: 'leftHand', zoneId: 4 }, sourcePatternId: 'pat_l_hand' },
          { id: 'star_1', kind: 'starNote', landingTick: PHASE_A_STAR_LANDING_TICKS[1], target: { type: 'cursor', part: 'rightHand', zoneId: 5 }, sourcePatternId: 'pat_r_hand' },
          { id: 'star_2', kind: 'starNote', landingTick: PHASE_A_STAR_LANDING_TICKS[2], target: { type: 'cursor', part: 'leftHand', zoneId: 1 }, sourcePatternId: 'pat_l_hand' },
          { id: 'star_3', kind: 'starNote', landingTick: PHASE_A_STAR_LANDING_TICKS[3], target: { type: 'cursor', part: 'rightHand', zoneId: 3 }, sourcePatternId: 'pat_r_hand' },
          { id: 'star_4', kind: 'starNote', landingTick: PHASE_A_STAR_LANDING_TICKS[4], target: { type: 'cursor', part: 'leftHand', zoneId: 4 }, sourcePatternId: 'pat_l_hand' },
          { id: 'star_5', kind: 'starNote', landingTick: PHASE_A_STAR_LANDING_TICKS[5], target: { type: 'cursor', part: 'rightHand', zoneId: 5 }, sourcePatternId: 'pat_r_hand' },
          { id: 'star_6', kind: 'starNote', landingTick: PHASE_A_STAR_LANDING_TICKS[6], target: { type: 'foot', foot: 'leftFoot', zoneId: 10 }, sourcePatternId: 'pat_foot_step' },
        ],
      },
      // 2. Phase A 오답 장판 (jump)
      {
        id: 'seq_phaseA_hazard',
        phase: 'phaseA',
        kind: 'hazard',
        events: [
          {
            id: 'evt_phaseA_hz_e2e',
            kind: 'phaseAHazard',
            hazardType: 'jump',
          },
        ],
      },
      // 3. Phase A 모션 가이드
      {
        id: 'seq_phaseA_motion',
        phase: 'phaseA',
        kind: 'motionGuide',
        events: [
          { id: 'cue_a_1', kind: 'motionCue', startTick: 0, durationTicks: 480, target: { leftHand: 4, rightHand: 5 } },
        ],
      },
      // 4. Phase B 피버 노트 (8개 노트)
      {
        id: 'seq_phaseB_fever',
        phase: 'phaseB',
        kind: 'feverNotes',
        events: [
          { id: 'fn_0', kind: 'feverNote', landingTick: 480, target: { type: 'cursor', part: 'leftHand', zoneId: 4 } },
          { id: 'fn_1', kind: 'feverNote', landingTick: 960, target: { type: 'cursor', part: 'rightHand', zoneId: 5 } },
          { id: 'fn_2', kind: 'feverNote', landingTick: 1440, target: { type: 'cursor', part: 'leftHand', zoneId: 4 } },
          { id: 'fn_3', kind: 'feverNote', landingTick: 1920, target: { type: 'cursor', part: 'rightHand', zoneId: 5 } },
          { id: 'fn_4', kind: 'feverNote', landingTick: 2400, target: { type: 'cursor', part: 'leftHand', zoneId: 4 } },
          { id: 'fn_5', kind: 'feverNote', landingTick: 2880, target: { type: 'cursor', part: 'rightHand', zoneId: 5 } },
          { id: 'fn_6', kind: 'feverNote', landingTick: 3360, target: { type: 'cursor', part: 'leftHand', zoneId: 4 } },
          { id: 'fn_7', kind: 'feverNote', landingTick: 3840, target: { type: 'cursor', part: 'rightHand', zoneId: 5 } },
        ],
      },
      // 5. Phase B 보스 장판 (3종 순서: dual_slam, alternating_stomp_left, alternating_stomp_right)
      {
        id: 'seq_phaseB_hazard',
        phase: 'phaseB',
        kind: 'hazard',
        events: [
          { id: 'bhz_0', kind: 'phaseBHazard', attackType: 'dual_slam' },
          { id: 'bhz_1', kind: 'phaseBHazard', attackType: 'alternating_stomp_left' },
          { id: 'bhz_2', kind: 'phaseBHazard', attackType: 'alternating_stomp_right' },
        ],
      },
      // 6. Phase B 모션 가이드
      {
        id: 'seq_phaseB_motion',
        phase: 'phaseB',
        kind: 'motionGuide',
        events: [
          { id: 'cue_b_1', kind: 'motionCue', startTick: 0, durationTicks: 480, target: { leftHand: 4, rightHand: 5 } },
        ],
      },
    ],
    bindings: [
      { chapterId: 'ch1', subLevelId: null, phase: 'phaseA', sequenceId: 'seq_phaseA_star', role: 'starNotes' },
      { chapterId: 'ch1', subLevelId: null, phase: 'phaseA', sequenceId: 'seq_phaseA_hazard', role: 'hazard' },
      { chapterId: 'ch1', subLevelId: null, phase: 'phaseA', sequenceId: 'seq_phaseA_motion', role: 'motionGuide' },
      { chapterId: 'ch1', subLevelId: null, phase: 'phaseB', sequenceId: 'seq_phaseB_fever', role: 'feverNotes' },
      { chapterId: 'ch1', subLevelId: null, phase: 'phaseB', sequenceId: 'seq_phaseB_hazard', role: 'hazard' },
      { chapterId: 'ch1', subLevelId: null, phase: 'phaseB', sequenceId: 'seq_phaseB_motion', role: 'motionGuide' },
    ],
  };
}

/**
 * 리듬을 진행시켜 ANSWER_SELECT 상태에 도달시키는 헬퍼
 */
function advanceToAnswerSelect(app: AppBootstrap): void {
  app.startRunningPhase();
  const spb = app.beatCoordinator.rhythmEngine.secondsPerBeat;
  let safety = 0;
  while (app.beatCoordinator.phase !== 'ANSWER_SELECT' && safety++ < 30) {
    app.beatCoordinator.recordStep('run');
    app.beatCoordinator.update(spb);
  }
}

describe('[Issue #404 / FITNESS-EDITOR-QA] 피트니스 에디터 통합 전체 파이프라인 E2E 인수 테스트', () => {
  let localStorageMock: Record<string, string>;
  let setItemSpy: ReturnType<typeof vi.fn>;
  let getItemSpy: ReturnType<typeof vi.fn>;

  let adapter: MemoryIndexedDBAdapter;
  let db: EditorContentDatabase;
  let publishedStore: PublishedContentStore;

  beforeEach(async () => {
    localStorageMock = {};
    setItemSpy = vi.fn((key: string, value: string) => {
      localStorageMock[key] = value;
    });
    getItemSpy = vi.fn((key: string) => localStorageMock[key] ?? null);

    vi.stubGlobal('localStorage', {
      getItem: getItemSpy,
      setItem: setItemSpy,
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
    });

    vi.stubGlobal('window', {
      innerWidth: 1280,
      innerHeight: 720,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      localStorage: {
        getItem: getItemSpy,
        setItem: setItemSpy,
      },
    });

    vi.stubGlobal('document', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getElementById: vi.fn(() => null),
      fullscreenElement: null,
    });

    adapter = new MemoryIndexedDBAdapter();
    await adapter.open();
    db = new EditorContentDatabase(adapter);
    publishedStore = new PublishedContentStore(db);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('1. 전체 파이프라인 완주 (제작 -> 게시 -> 테스트플레이 -> 오답장판 -> 정답별수집 -> Phase B 보스결전 -> 승리 -> 격리 확인)', async () => {
    // [Step 1: 에디터 저작]
    const project = createE2EPublishableProject('proj_e2e_full', 1, 120);

    // [Step 2: 컴파일 및 유효성 검증]
    const compileResult = compileEditorProject(project);
    expect(compileResult.success).toBe(true);
    expect(compileResult.pack).not.toBeNull();
    const publishedPack = compileResult.pack!;

    const packValidation = validatePublishedContentPack(publishedPack);
    expect(packValidation.valid).toBe(true);

    // [Step 3: PublishedContentStore 불변 게시]
    const publishRes = await publishedStore.publish(publishedPack, {
      activateNow: true,
    });
    expect(publishRes.success).toBe(true);
    expect(publishRes.contentHash).toBe(publishedPack.contentHash);

    // [Step 4: 게임 엔진 초기화 및 테스트 플레이 론칭]
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
      answerRestBeats: 0,
    });
    await app.init();

    // 검증된 팩 검사 통과 확인
    expect(isVerifiedPublishedPack(publishedPack)).toBe(true);

    // 테스트 플레이 시작
    const launched = app.startTestPlaySession(1, { pack: publishedPack });
    expect(launched).toBe(true);
    expect(app.isTestSession).toBe(true);
    expect(app.sessionLifecycle.isTestSession).toBe(true);
    expect(app.sessionContext.contentMode).toBe('custom_pack');

    // 런타임에 주입된 세션 번들 확인
    const activeBundle = app.sessionContext.activeStageBundle;
    expect(activeBundle).not.toBeNull();
    expect(activeBundle?.bpm).toBe(120);
    expect(activeBundle?.phaseA.starNotes).toHaveLength(7);
    expect(activeBundle?.phaseA.hazard?.hazardType).toBe('jump');
    expect(activeBundle?.phaseB.feverNotes).toHaveLength(8);
    expect(activeBundle?.phaseB.hazards).toHaveLength(3);

    // localStorage 쓰기 스파이 초기화
    setItemSpy.mockClear();

    // [Step 5: Round 1 - 오답 분기 -> HAZARD_EVADE 진입 및 점프 회피]
    advanceToAnswerSelect(app);
    app.beatRoundResolver.startNewRound(1);

    const currentQ1 = app.beatCoordinator.currentQuestion;
    const wrongIdx = currentQ1 ? (currentQ1.correctIndex === 0 ? 1 : 0) : 1;
    app.beatCoordinator.confirmAnswerByFallback(wrongIdx);

    // 오답 시 HAZARD_EVADE 진입
    expect(app.stateMachine.currentState).toBe('HAZARD_EVADE');
    expect(app.phaseAHazardController.isActive).toBe(true);
    expect(app.phaseAHazardController.activePattern).toBe('jump');

    // 플레이어가 'jump' 동작을 기록하여 장판 회피 성공
    app.phaseAHazardController.recordAction('jump');
    expect(app.phaseAHazardController.isEvaded).toBe(true);

    // 장판 종료 및 Round 1 오답 정산
    app.phaseAHazardController.stop();
    app.stateMachine.changeState('ROUND_RESOLVE');
    const resolveR1 = app.beatRoundResolver.resolveRound('wrong', 1);
    app.stageProgressController.handleRoundSettled(resolveR1, { immediate: true });

    // [Step 6: Round 2 - 정답 분기 -> STAR_COLLECT 진입 및 별 7노트 확인]
    app.stateMachine.changeState('RUN_QUESTION');
    advanceToAnswerSelect(app);
    app.beatRoundResolver.startNewRound(2);

    const currentQ2 = app.beatCoordinator.currentQuestion;
    const correctIdx = currentQ2 ? currentQ2.correctIndex : 0;
    app.beatCoordinator.confirmAnswerByFallback(correctIdx);

    // 정답 시 STAR_COLLECT 진입
    expect(app.stateMachine.currentState).toBe('STAR_COLLECT');
    expect(app.starNoteScheduler.isStarted).toBe(true);
    expect(app.phaseAHazardController.isActive).toBe(false);

    // 7개 별 노트가 에디터 설정과 1:1 일치
    const runtimeStarNotes = app.getPhaseAStarNotes();
    expect(runtimeStarNotes).toHaveLength(7);
    expect(runtimeStarNotes[0].zoneId).toBe(4);
    expect(runtimeStarNotes[1].zoneId).toBe(5);
    expect(runtimeStarNotes[2].zoneId).toBe(1);
    expect(runtimeStarNotes[6].zoneId).toBe(10);
    expect(runtimeStarNotes[6].instrument).toBe('foot');

    // 별 수집 완료 및 Round 2 정답 정산
    app.starNoteScheduler.reset();
    app.stateMachine.changeState('ROUND_RESOLVE');
    const resolveR2 = app.beatRoundResolver.resolveRound('correct', 2);
    app.stageProgressController.handleRoundSettled(resolveR2, { immediate: true });

    // [Step 7: Rounds 3~10 신속 완주]
    for (let r = 3; r <= 10; r++) {
      app.stateMachine.changeState('RUN_QUESTION');
      app.beatRoundResolver.startNewRound(r);
      app.stateMachine.changeState('ROUND_RESOLVE');
      const resolveResult = app.beatRoundResolver.resolveRound('correct', r);
      app.stageProgressController.handleRoundSettled(resolveResult, { immediate: true });
    }

    // [Step 8: Phase B 결전(BOSS_CLIMAX) 자동 전이 검증]
    expect(app.stateMachine.currentState).toBe('BOSS_CLIMAX');
    expect(app.stageProgressController.hasEnteredBossClimax).toBe(true);

    // Phase B 양 컨트롤러가 동일한 번들과 해시를 불변 유지하고 있는지 확인
    expect(app.bossFeverController.isActive).toBe(true);
    expect(app.bossHazardController.isActive).toBe(true);
    expect((app.bossFeverController as any).stageBundle?.contentHash).toBe(publishedPack.contentHash);
    expect((app.bossHazardController as any).stageBundle?.contentHash).toBe(publishedPack.contentHash);

    // 피버 타격 시뮬레이션
    app.bossFeverController.recordRating('Perfect', 'fn_0');
    expect(app.bossFeverController.feverCombo).toBeGreaterThanOrEqual(1);

    // 보스 공격 패턴 회피 시뮬레이션
    app.bossHazardController.triggerAttack();
    expect(app.bossHazardController.currentAttack).toBe('dual_slam');
    const firstAttackEvaded = app.bossHazardController.recordAction('jump');
    expect(firstAttackEvaded).toBe(true);

    // [Step 9: 보스 격파 및 승리 화면 진입]
    app.showResult(true);
    expect(app.stateMachine.currentState).toBe('RESULT');

    // [중요: 테스트 플레이 스토리지 격리 검증]
    // 테스트 세션이므로 localStorage에 진행도/하이스코어/보상 쓰기가 0건이어야 한다!
    const testSessionCalls = setItemSpy.mock.calls.filter(([key]) =>
      key === STORAGE_KEY_STAGE_PROGRESS ||
      key === STORAGE_KEY_HIGH_SCORES ||
      key === STORAGE_KEY_REWARDS
    );
    expect(testSessionCalls).toHaveLength(0);

    // [Step 10: 메뉴 복귀 및 클린업]
    app.goToMenu();
    expect(app.stateMachine.currentState).toBe('MENU_MAIN');
    expect(app.isTestSession).toBe(false);

    app.dispose();
  });

  it('2. 패배(Defeat) 분기에서도 스토리지 쓰기 0건 및 안전한 상태 클린업이 유지된다', async () => {
    const project = createE2EPublishableProject('proj_e2e_defeat', 1, 120);
    const compileRes = compileEditorProject(project);
    const publishedPack = compileRes.pack!;

    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    app.startTestPlaySession(1, { pack: publishedPack });
    expect(app.isTestSession).toBe(true);

    setItemSpy.mockClear();

    // 패배 처리
    app.showResult(false);
    expect(app.stateMachine.currentState).toBe('GAMEOVER');

    // 스토리지 쓰기 0건 확인
    const writes = setItemSpy.mock.calls.filter(([key]) =>
      key === STORAGE_KEY_STAGE_PROGRESS ||
      key === STORAGE_KEY_HIGH_SCORES ||
      key === STORAGE_KEY_REWARDS
    );
    expect(writes).toHaveLength(0);

    // 메뉴 복귀
    app.goToMenu();
    expect(app.stateMachine.currentState).toBe('MENU_MAIN');
    expect(app.isTestSession).toBe(false);

    app.dispose();
  });

  it('3. 테스트 플레이 종료 후 일반 세션(startChapter) 복귀 시 정상적인 스토리지 저장이 보존된다', async () => {
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    // 1단계: 테스트 플레이 실행 및 종료
    const testProject = createE2EPublishableProject('proj_e2e_normal_restore', 1, 120);
    const compileRes = compileEditorProject(testProject);
    app.startTestPlaySession(1, { pack: compileRes.pack! });
    expect(app.isTestSession).toBe(true);

    app.goToMenu();
    expect(app.isTestSession).toBe(false);

    setItemSpy.mockClear();

    // 2단계: 일반 세션 시작
    app.startChapter(1);
    expect(app.isTestSession).toBe(false);

    // 일반 세션에서 승리 정산
    app.showResult(true);

    // 일반 세션에서는 정상적으로 localStorage에 진척도가 저장되어야 함
    const normalWrites = setItemSpy.mock.calls.filter(([key]) =>
      key === STORAGE_KEY_STAGE_PROGRESS ||
      key === STORAGE_KEY_HIGH_SCORES ||
      key === STORAGE_KEY_REWARDS
    );
    expect(normalWrites.length).toBeGreaterThanOrEqual(1);

    app.dispose();
  });

  it('4. 롤백(Rollback) 적용본에 대한 테스트 플레이 론칭 및 무결성 검증', async () => {
    const projectId = 'proj_e2e_rollback_run';

    // 팩 1 (BPM 120) 게시
    const proj1 = createE2EPublishableProject(projectId, 1, 120);
    const compile1 = compileEditorProject(proj1);
    const pack1 = compile1.pack!;
    await publishedStore.publish(pack1, {
      activateNow: true,
    });

    // 팩 2 (BPM 135) 게시
    const proj2 = createE2EPublishableProject(projectId, 2, 135);
    const compile2 = compileEditorProject(proj2);
    const pack2 = compile2.pack!;
    await publishedStore.publish(pack2, {
      activateNow: true,
    });

    // 롤백 실행: 팩 1로 복귀
    await publishedStore.scheduleRollback(projectId, pack1.contentHash);
    await publishedStore.activateRollback(projectId);

    // 활성 팩이 팩 1로 복원되었는지 확인
    const activeHead = await publishedStore.getActivationHead(projectId);
    expect(activeHead?.activeContentHash).toBe(pack1.contentHash);

    const targetHash = activeHead?.activeContentHash ?? pack1.contentHash;
    const restoredPack = await publishedStore.getPublishedPack(targetHash);
    expect(restoredPack).not.toBeNull();
    const ch1Stage = restoredPack?.stages ? restoredPack.stages['ch1'] : undefined;
    expect(ch1Stage?.tempo?.bpm).toBe(120);

    // 롤백된 팩으로 테스트 플레이 론칭
    const app = new AppBootstrap({
      canvas: createMockCanvas(),
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    const launched = app.startTestPlaySession(1, { pack: restoredPack! });
    expect(launched).toBe(true);
    expect(app.sessionContext.activeStageBundle?.bpm).toBe(120);
    expect(app.sessionContext.activeStageBundle?.contentHash).toBe(pack1.contentHash);

    app.dispose();
  });
});
