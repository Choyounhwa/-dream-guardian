/**
 * tests/integration/content-test-session.test.ts
 *
 * [Issue #391 / CONTENT-TEST-SESSION]
 * 테스트 플레이 격리와 진행·보상 저장 차단 통합 검증
 *
 * 검증 매트릭스:
 * 1. 정상 세션 모드에서는 기존 진행도(starsMap), 하이스코어, 보상 저장 동작 정상 수행
 * 2. 테스트 세션 모드 활성화 시 승리/패배/결과 도달 시 localStorage 및 저장소 쓰기 완전 차단 (spy 검증)
 * 3. 테스트 세션 모드에서 정상 진행도(starsMap) 및 보상 불변 유지
 * 4. 테스트 세션 종료(메뉴 복귀 / abort / 재시작) 시 상태, 타이머, 예약, 입력 완벽 격리 및 다음 정상 세션에 잔류 0
 * 5. URL 쿼리나 외부 입력으로 전달된 임의 미검증/변조 팩의 테스트 세션 진입 차단
 * 6. SessionLifecycle 및 GameSessionContext의 isTestSession 및 canSave* 단위 격리
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppBootstrap, STORAGE_KEY_STAGE_PROGRESS, STORAGE_KEY_HIGH_SCORES, STORAGE_KEY_REWARDS } from '../../src/core/AppBootstrap.js';
import { SessionLifecycle } from '../../src/core/SessionLifecycle.js';
import { GameSessionContext } from '../../src/core/GameSessionContext.js';
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

function createValidPublishedPack(stageId = 'ch1', bpm = 135): PublishedContentPack {
  const starNotes = [
    { id: 'star_0', slotIndex: 0, landingTick: 960, landingBeat: 2, target: { type: 'cursor' as const, part: 'leftHand' as const, zoneId: 1, instrument: 'hand' as const } },
    { id: 'star_1', slotIndex: 1, landingTick: 1440, landingBeat: 3, target: { type: 'cursor' as const, part: 'rightHand' as const, zoneId: 2, instrument: 'hand' as const } },
    { id: 'star_2', slotIndex: 2, landingTick: 1920, landingBeat: 4, target: { type: 'cursor' as const, part: 'leftHand' as const, zoneId: 3, instrument: 'hand' as const } },
    { id: 'star_3', slotIndex: 3, landingTick: 2400, landingBeat: 5, target: { type: 'cursor' as const, part: 'rightHand' as const, zoneId: 4, instrument: 'hand' as const } },
    { id: 'star_4', slotIndex: 4, landingTick: 2880, landingBeat: 6, target: { type: 'cursor' as const, part: 'leftHand' as const, zoneId: 5, instrument: 'hand' as const } },
    { id: 'star_5', slotIndex: 5, landingTick: 3360, landingBeat: 7, target: { type: 'cursor' as const, part: 'rightHand' as const, zoneId: 2, instrument: 'hand' as const } },
    { id: 'star_6', slotIndex: 6, landingTick: 3840, landingBeat: 8, target: { type: 'cursor' as const, part: 'hip' as const, zoneId: 9, instrument: 'foot' as const } },
  ];

  const pack: PublishedContentPack = {
    kind: PUBLISHED_PACK_KIND,
    schemaVersion: PUBLISHED_SCHEMA_VERSION,
    runtimeContractVersion: '2.0.0',
    rulesetId: DEFAULT_RULESET_ID,
    rulesetHash: VALID_RULESET_HASH,
    compilerVersion: '1.0.0',
    sourceProjectId: 'proj_test_session_391',
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
      title: 'Test Session Pack 391',
      compiledAt: new Date().toISOString(),
    },
  };

  pack.contentHash = computePublishedPackHash(pack);
  return pack;
}

describe('[Issue #391 / CONTENT-TEST-SESSION] 테스트 플레이 격리와 진행·보상 저장 차단', () => {
  let localStorageMock: Record<string, string>;
  let setItemSpy: ReturnType<typeof vi.fn>;
  let getItemSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorageMock = {};
    setItemSpy = vi.fn((key: string, value: string) => {
      localStorageMock[key] = value;
    });
    getItemSpy = vi.fn((key: string) => localStorageMock[key] ?? null);

    vi.stubGlobal('localStorage', {
      getItem: getItemSpy,
      setItem: setItemSpy,
      removeItem: vi.fn((key: string) => { delete localStorageMock[key]; }),
      clear: vi.fn(() => { localStorageMock = {}; }),
    });

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

  describe('1. 정상 세션 모드 동작 보존', () => {
    it('일반 플레이 세션에서는 승리 시 정상적으로 진행도(starsMap), 하이스코어, 보상이 저장된다', async () => {
      const app = new AppBootstrap({
        canvas: createMockCanvas(),
        autoStartCamera: false,
        preloadAssets: false,
      });
      await app.init();

      // 일반 세션 시작
      app.startChapter(1);
      expect(app.isTestSession).toBe(false);
      expect(app.sessionLifecycle.isTestSession).toBe(false);
      expect(app.sessionContext.isTestSession).toBe(false);
      expect(app.sessionContext.canSaveProgress).toBe(true);

      setItemSpy.mockClear();

      // 승리 처리
      app.showResult(true);

      // starsMap 갱신 및 localStorage 저장 검증
      expect(app.starsMap[1]).toBeDefined();
      expect(setItemSpy).toHaveBeenCalledWith(
        STORAGE_KEY_STAGE_PROGRESS,
        expect.stringContaining('"1":'),
      );
      expect(setItemSpy).toHaveBeenCalledWith(
        STORAGE_KEY_HIGH_SCORES,
        expect.any(String),
      );
      expect(setItemSpy).toHaveBeenCalledWith(
        STORAGE_KEY_REWARDS,
        expect.any(String),
      );

      app.dispose();
    });
  });

  describe('2. 테스트 세션 격리 및 저장 차단', () => {
    it('테스트 세션 승리 시 localStorage 및 진행도(starsMap), 보상 저장이 완전히 차단된다', async () => {
      const app = new AppBootstrap({
        canvas: createMockCanvas(),
        autoStartCamera: false,
        preloadAssets: false,
      });
      await app.init();

      const validPack = createValidPublishedPack('ch1', 135);
      const started = app.startTestPlaySession(1, { pack: validPack });
      expect(started).toBe(true);

      expect(app.isTestSession).toBe(true);
      expect(app.sessionLifecycle.isTestSession).toBe(true);
      expect(app.sessionContext.isTestSession).toBe(true);
      expect(app.sessionContext.canSaveProgress).toBe(false);
      expect(app.sessionContext.canSaveHighScore).toBe(false);
      expect(app.sessionContext.canSaveRewards).toBe(false);

      setItemSpy.mockClear();
      const prevStars = app.starsMap[1];

      // 승리 처리
      app.showResult(true);

      // spy 검증: 저장소 쓰기 0건
      expect(setItemSpy).not.toHaveBeenCalled();
      // starsMap 불변 검증
      expect(app.starsMap[1]).toBe(prevStars);
      expect(app.resultData?.isTestSession).toBe(true);

      app.dispose();
    });

    it('테스트 세션 패배(GAMEOVER) 시 저장소 쓰기가 발생하지 않는다', async () => {
      const app = new AppBootstrap({
        canvas: createMockCanvas(),
        autoStartCamera: false,
        preloadAssets: false,
      });
      await app.init();

      const validPack = createValidPublishedPack('ch1', 135);
      app.startTestPlaySession(1, { pack: validPack });
      expect(app.isTestSession).toBe(true);

      setItemSpy.mockClear();

      // 패배 처리
      app.showResult(false);

      expect(setItemSpy).not.toHaveBeenCalled();
      expect(app.stateMachine.currentState).toBe('GAMEOVER');

      app.dispose();
    });

    it('테스트 세션 중단(abort) 및 메뉴 복귀 시 저장소 쓰기 없이 안전 복구된다', async () => {
      const app = new AppBootstrap({
        canvas: createMockCanvas(),
        autoStartCamera: false,
        preloadAssets: false,
      });
      await app.init();

      const validPack = createValidPublishedPack('ch1', 135);
      app.startTestPlaySession(1, { pack: validPack });
      expect(app.isTestSession).toBe(true);

      setItemSpy.mockClear();

      // abort 호출
      app.abortSession();

      expect(setItemSpy).not.toHaveBeenCalled();
      expect(app.isTestSession).toBe(false);
      expect(app.stateMachine.currentState).toBe('MENU_MAIN');

      app.dispose();
    });
  });

  describe('3. 세션 종료 후 잔류 0 및 다음 정상 세션 완전 격리', () => {
    it('테스트 세션 종료 후 타이머/예약/콘텐츠가 클린업되고 다음 일반 세션에 영향을 주지 않는다', async () => {
      const app = new AppBootstrap({
        canvas: createMockCanvas(),
        autoStartCamera: false,
        preloadAssets: false,
      });
      await app.init();

      const validPack = createValidPublishedPack('ch1', 140);
      app.startTestPlaySession(1, { pack: validPack });

      // 테스트 세션 예약 등록
      let scheduledRan = false;
      app.sessionLifecycle.schedule(() => {
        scheduledRan = true;
      }, 500);
      expect(app.sessionLifecycle.pendingTimeoutCount).toBeGreaterThan(0);

      // 세션 메뉴 복귀 (종료)
      app.goToMenu();

      // 예약 클린업 검증
      expect(app.sessionLifecycle.pendingTimeoutCount).toBe(0);
      expect(app.sessionLifecycle.isTestSession).toBe(false);
      expect(app.sessionContext.contentMode).toBe('default_csv');
      expect(app.sessionContext.isTestSession).toBe(false);

      // 다음 일반 세션 시작
      app.startChapter(1);
      expect(app.isTestSession).toBe(false);
      expect(app.sessionContext.contentMode).toBe('default_csv');

      // 일반 세션에서는 승리 시 정상 저장
      setItemSpy.mockClear();
      app.showResult(true);
      expect(setItemSpy).toHaveBeenCalledWith(
        STORAGE_KEY_STAGE_PROGRESS,
        expect.any(String),
      );
      expect(scheduledRan).toBe(false);

      app.dispose();
    });
  });

  describe('4. 미검증 데이터 및 변조 해시 테스트 진입 차단', () => {
    it('유효하지 않은 객체나 미검증 팩으로는 테스트 세션에 진입할 수 없다', async () => {
      const app = new AppBootstrap({
        canvas: createMockCanvas(),
        autoStartCamera: false,
        preloadAssets: false,
      });
      await app.init();

      // 1. null 또는 비어있는 팩
      const res1 = app.startTestPlaySession(1, { pack: null as any });
      expect(res1).toBe(false);
      expect(app.isTestSession).toBe(false);

      // 2. 구조가 잘못된 객체
      const res2 = app.startTestPlaySession(1, { pack: { kind: 'invalid' } as any });
      expect(res2).toBe(false);
      expect(app.isTestSession).toBe(false);

      // 3. 변조된 contentHash
      const tamperedPack = createValidPublishedPack('ch1', 135);
      tamperedPack.contentHash = 'fake_hash_tampered_12345';
      const res3 = app.startTestPlaySession(1, { pack: tamperedPack });
      expect(res3).toBe(false);
      expect(app.isTestSession).toBe(false);

      // 4. hash mismatch (요청한 expectedHash와 팩의 contentHash가 불일치)
      const validPack = createValidPublishedPack('ch1', 135);
      const res4 = app.startTestPlaySession(1, {
        pack: validPack,
        contentHash: 'some_other_hash_expected',
      });
      expect(res4).toBe(false);
      expect(app.isTestSession).toBe(false);

      // 5. startChapter({ isTestSession: true }) 경로에서도 미검증 팩 차단
      app.startChapter(1, undefined, {
        pack: tamperedPack,
        isTestSession: true,
      });
      expect(app.isTestSession).toBe(false);
      expect(app.stateMachine.currentState).toBe('MENU_MAIN');

      app.dispose();
    });
  });

  describe('5. SessionLifecycle 및 GameSessionContext 단위 검증', () => {
    it('SessionLifecycle은 isTestSession 상태를 격리 관리하고 abort/end 시 리셋한다', () => {
      const lifecycle = new SessionLifecycle();
      expect(lifecycle.isTestSession).toBe(false);

      lifecycle.startSession(true);
      expect(lifecycle.isTestSession).toBe(true);

      lifecycle.abortSession();
      expect(lifecycle.isTestSession).toBe(false);

      lifecycle.startSession({ isTestSession: true });
      expect(lifecycle.isTestSession).toBe(true);

      lifecycle.endSession();
      expect(lifecycle.isTestSession).toBe(false);
    });

    it('GameSessionContext는 isTestSession 플래그에 따라 canSave* 권한을 제어한다', () => {
      const ctx = new GameSessionContext();
      expect(ctx.isTestSession).toBe(false);
      expect(ctx.canSaveProgress).toBe(true);
      expect(ctx.canSaveRewards).toBe(true);
      expect(ctx.canSaveHighScore).toBe(true);

      ctx.setTestSession(true);
      expect(ctx.isTestSession).toBe(true);
      expect(ctx.canSaveProgress).toBe(false);
      expect(ctx.canSaveRewards).toBe(false);
      expect(ctx.canSaveHighScore).toBe(false);

      ctx.resetSession();
      expect(ctx.isTestSession).toBe(false);
      expect(ctx.canSaveProgress).toBe(true);
    });
  });
});
