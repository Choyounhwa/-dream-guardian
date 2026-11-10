import { describe, it, expect, vi, afterEach } from 'vitest';
import { AppBootstrap } from '../../src/core/AppBootstrap.js';

/**
 * [BUG-ASSAULT-BOOT / #587]
 * boss_assault 모드 초기 부팅 시 화면 렌더링 미작동 (3중 결함) 회귀 방지 단위 테스트
 *
 * 검증 항목:
 * 1. 결함 1: mode === 'boss_assault'일 때 READY_POSITION 완료 시 startRunningPhase(RUN_QUESTION) 대신 ASSAULT_ROUND로 전이된다.
 * 2. 결함 2: ASSAULT_ROUND 전이 시 screenMode = 'game' 및 gamePhase = 'assault_round'로 설정되어 SceneDirector가 게임 씬을 유지한다.
 * 3. 결함 3: READY_POSITION 완료 시점에 assembleAssaultSession()이 자동 조립되어 assaultSession이 활성화된다.
 * 4. 레거시 모드 보존: mode 미지정 시 READY_POSITION 완료 후 기존대로 RUN_QUESTION, running 페이즈로 정상 전이된다.
 */

function createMockCanvas() {
  const gradient = { addColorStop: vi.fn() };
  const ctx = {
    canvas: { width: 1280, height: 720 },
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    roundRect: vi.fn(),
    fillText: vi.fn(),
    strokeRect: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    rect: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
    translate: vi.fn(),
    scale: vi.fn(),
    ellipse: vi.fn(),
    setLineDash: vi.fn(),
    getLineDash: vi.fn(() => []),
  };
  return {
    clientWidth: 1280,
    clientHeight: 720,
    width: 1280,
    height: 720,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

describe('[BUG-ASSAULT-BOOT / #587] boss_assault 모드 부팅 및 상태 전이 검증', () => {
  let app: AppBootstrap;

  afterEach(() => {
    if (app) {
      app.dispose();
    }
  });

  it('결함 1 & 3: boss_assault 모드에서 READY_POSITION 완료 시 ASSAULT_ROUND로 전이되고 세션이 자동 조립된다', async () => {
    app = new AppBootstrap({
      canvas: createMockCanvas() as any,
      autoStartCamera: false,
      preloadAssets: false,
      mode: 'boss_assault',
    });
    await app.init();

    // 초기 상태 확인
    expect(app.isAssaultMode()).toBe(true);
    expect(app.assaultSession).toBeNull();

    // 준비 단계 진입
    app.startReadyPhase();
    expect(app.stateMachine.currentState).toBe('READY_POSITION');

    // 카운트다운 완료/스킵
    app.readyPositionController.skip();

    // 결함 1: RUN_QUESTION이 아닌 ASSAULT_ROUND로 전이
    expect(app.stateMachine.currentState).toBe('ASSAULT_ROUND');

    // 결함 3: 세션 자동 조립
    expect(app.assaultSession).not.toBeNull();
    expect(app.assaultSession?.isDisposed).toBe(false);
  });

  it('결함 2: ASSAULT_ROUND 전이 시 screenMode = game 및 gamePhase = assault_round가 설정된다', async () => {
    app = new AppBootstrap({
      canvas: createMockCanvas() as any,
      autoStartCamera: false,
      preloadAssets: false,
      mode: 'boss_assault',
    });
    await app.init();

    app.startReadyPhase();
    app.readyPositionController.skip();

    const state = app.mainSceneContext.state as any;
    expect(state.screenMode).toBe('game');
    expect(state.gamePhase).toBe('assault_round');
  });

  it('ASSAULT_ROUND 상태에서 renderGameScene 호출 시 assault HUD 및 장면이 정상 렌더링된다', async () => {
    app = new AppBootstrap({
      canvas: createMockCanvas() as any,
      autoStartCamera: false,
      preloadAssets: false,
      mode: 'boss_assault',
    });
    await app.init();

    app.startReadyPhase();
    app.readyPositionController.skip();

    const mockHudRender = vi.fn();
    (app.assaultSession as any).hud = { render: mockHudRender };

    expect(() => {
      app.sceneDirector.renderGameScene(app.mainSceneContext);
    }).not.toThrow();

    expect(mockHudRender).toHaveBeenCalledTimes(1);
  });

  it('레거시 모드 보존: mode 미지정 시 READY_POSITION 완료 후 RUN_QUESTION 및 running 페이즈로 전이된다', async () => {
    app = new AppBootstrap({
      canvas: createMockCanvas() as any,
      autoStartCamera: false,
      preloadAssets: false,
    });
    await app.init();

    expect(app.isAssaultMode()).toBe(false);

    app.startReadyPhase();
    expect(app.stateMachine.currentState).toBe('READY_POSITION');

    app.readyPositionController.skip();

    expect(app.stateMachine.currentState).toBe('RUN_QUESTION');
    const state = app.mainSceneContext.state as any;
    expect(state.screenMode).toBe('game');
    expect(state.gamePhase).toBe('running');
  });
});
