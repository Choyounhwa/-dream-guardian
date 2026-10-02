/**
 * scene-director.test.ts
 * [REFACTOR-MAIN-001 / Issue #301] 메인 게임 루프 씬 디렉터 분리 (SceneDirector)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SceneDirector, RENDER_LAYER_ORDER } from '../../src/core/SceneDirector.js';
import { GameSessionContext } from '../../src/core/GameSessionContext.js';

describe('SceneDirector (REFACTOR-MAIN-001 / #301)', () => {
  let sessionContext: GameSessionContext;

  beforeEach(() => {
    sessionContext = new GameSessionContext();
  });

  describe('1. 인스턴스 생성 및 초기화 (Creation & Configuration)', () => {
    it('기본 옵션으로 정상 생성되고 기본 씬은 menu이다', () => {
      const director = new SceneDirector();
      expect(director).toBeDefined();
      expect(director.currentScene).toBe('menu');
      expect(director.sessionContext).toBeUndefined();
    });

    it('GameSessionContext 및 커스텀 초기 씬을 주입하여 생성할 수 있다', () => {
      const director = new SceneDirector({
        sessionContext,
        initialScene: 'game',
      });
      expect(director.currentScene).toBe('game');
      expect(director.sessionContext).toBe(sessionContext);
    });

    it('setScene으로 현재 씬을 변경할 수 있다', () => {
      const director = new SceneDirector();
      director.setScene('result');
      expect(director.currentScene).toBe('result');
    });

    it('등록된 씬 목록과 씬 존재 여부를 확인할 수 있다', () => {
      const director = new SceneDirector();
      director.registerScene('menu', {});
      director.registerScene('game', {});

      expect(director.hasScene('menu')).toBe(true);
      expect(director.hasScene('game')).toBe(true);
      expect(director.hasScene('unknown')).toBe(false);
      expect(director.registeredScenes).toContain('menu');
      expect(director.registeredScenes).toContain('game');
    });
  });

  describe('2. 씬 업데이트 디스패칭 (Update Dispatching)', () => {
    it('현재 씬에 대응하는 씬 핸들러의 update가 호출된다', () => {
      const director = new SceneDirector({ initialScene: 'menu' });
      const menuUpdate = vi.fn();
      const gameUpdate = vi.fn();
      const resultUpdate = vi.fn();

      director.registerScene('menu', { update: menuUpdate });
      director.registerScene('game', { update: gameUpdate });
      director.registerScene('result', { update: resultUpdate });

      const ctx = { customData: 42 };
      director.update(0.016, ctx);

      expect(menuUpdate).toHaveBeenCalledWith(0.016, ctx);
      expect(gameUpdate).not.toHaveBeenCalled();
      expect(resultUpdate).not.toHaveBeenCalled();

      // 게임 씬으로 변경 후 update
      director.setScene('game');
      director.update(0.033, ctx);

      expect(gameUpdate).toHaveBeenCalledWith(0.033, ctx);
      expect(menuUpdate).toHaveBeenCalledTimes(1);
    });

    it('updateScene(sceneName, dt, ctx)으로 특정 씬의 update를 직접 호출할 수 있다', () => {
      const director = new SceneDirector({ initialScene: 'menu' });
      const gameUpdate = vi.fn();
      director.registerScene('game', { update: gameUpdate });

      director.updateScene('game', 0.05, { flag: true });
      expect(gameUpdate).toHaveBeenCalledWith(0.05, { flag: true });
    });

    it('beforeUpdate 및 afterUpdate 훅이 씬 업데이트 전후에 호출된다', () => {
      const callLog: string[] = [];
      const director = new SceneDirector({
        initialScene: 'menu',
        beforeUpdate: () => callLog.push('before'),
        afterUpdate: () => callLog.push('after'),
      });

      director.registerScene('menu', {
        update: () => callLog.push('menu_update'),
      });

      director.update(0.016);
      expect(callLog).toEqual(['before', 'menu_update', 'after']);
    });
  });

  describe('3. 레이어 렌더 디스패칭 및 렌더 순서 (Render Dispatching & Order)', () => {
    it('등록된 렌더 레이어들이 정의된 우선순위(order) 오름차순으로 순차 실행된다', () => {
      const director = new SceneDirector();
      const renderLog: string[] = [];

      // 의도적으로 무작위 순서로 레이어 등록
      director.registerLayer('modals', RENDER_LAYER_ORDER.MODALS, () => renderLog.push('modals'));
      director.registerLayer('background', RENDER_LAYER_ORDER.BACKGROUND, () => renderLog.push('background'));
      director.registerLayer('clear', RENDER_LAYER_ORDER.CLEAR, () => renderLog.push('clear'));
      director.registerLayer('transitions', RENDER_LAYER_ORDER.TRANSITIONS, () => renderLog.push('transitions'));
      director.registerLayer('hud', RENDER_LAYER_ORDER.HUD, () => renderLog.push('hud'));
      director.registerLayer('avatar', RENDER_LAYER_ORDER.AVATAR, () => renderLog.push('avatar'));
      director.registerLayer('entities', RENDER_LAYER_ORDER.ENTITIES, () => renderLog.push('entities'));

      director.render({ frame: 1 });

      expect(renderLog).toEqual([
        'clear',
        'background',
        'avatar',
        'entities',
        'hud',
        'modals',
        'transitions',
      ]);
    });

    it('현재 활성 씬의 render 콜백이 정상 디스패치된다', () => {
      const director = new SceneDirector({ initialScene: 'game' });
      const menuRender = vi.fn();
      const gameRender = vi.fn();

      director.registerScene('menu', { render: menuRender });
      director.registerScene('game', { render: gameRender });

      const mockCtx = { width: 1280, height: 720 };
      director.render(mockCtx);

      expect(gameRender).toHaveBeenCalledWith(mockCtx);
      expect(menuRender).not.toHaveBeenCalled();
    });

    it('renderScene(sceneName, ctx)으로 특정 씬의 render를 직접 호출할 수 있다', () => {
      const director = new SceneDirector();
      const resultRender = vi.fn();
      director.registerScene('result', { render: resultRender });

      director.renderScene('result', { score: 100 });
      expect(resultRender).toHaveBeenCalledWith({ score: 100 });
    });

    it('비활성화(enabled: false)된 레이어는 렌더링에서 건너뛴다', () => {
      const director = new SceneDirector();
      const executed: string[] = [];

      director.registerLayer('layer1', 10, () => executed.push('l1'), () => true);
      director.registerLayer('layer2', 20, () => executed.push('l2'), () => false);
      director.registerLayer('layer3', 30, () => executed.push('l3'));

      director.render();
      expect(executed).toEqual(['l1', 'l3']);
    });
  });

  describe('4. 상태 전환 생명주기 훅 및 에러 핸들링 (Lifecycle & Error Handling)', () => {
    it('씬 전환 시 이전 씬의 exit과 다음 씬의 enter가 올바른 순서로 호출된다', () => {
      const director = new SceneDirector({ initialScene: 'menu' });
      const lifecycleLog: string[] = [];

      director.registerScene('menu', {
        exit: () => lifecycleLog.push('menu_exit'),
      });
      director.registerScene('game', {
        enter: () => lifecycleLog.push('game_enter'),
      });

      director.setScene('game');
      expect(lifecycleLog).toEqual(['menu_exit', 'game_enter']);
    });

    it('onSceneChange 콜백이 설정되어 있으면 씬 전환 시 (from, to) 인자로 호출된다', () => {
      const onSceneChange = vi.fn();
      const director = new SceneDirector({
        initialScene: 'menu',
        onSceneChange,
      });

      director.setScene('game');
      expect(onSceneChange).toHaveBeenCalledWith('menu', 'game');
    });

    it('동일한 씬으로 setScene 호출 시 전환 로직이 중복 실행되지 않는다', () => {
      const onSceneChange = vi.fn();
      const director = new SceneDirector({
        initialScene: 'menu',
        onSceneChange,
      });

      director.setScene('menu');
      expect(onSceneChange).not.toHaveBeenCalled();
    });

    it('미등록된 씬의 update 또는 render 호출 시 크래시 없이 안전하게 무시된다', () => {
      const director = new SceneDirector({ initialScene: 'unregistered' });

      expect(() => {
        director.update(0.016);
        director.render();
      }).not.toThrow();
    });

    it('핸들러 에러 발생 시 onError 콜백이 등록되어 있으면 이를 안전하게 위임하고 앱 크래시를 방지한다', () => {
      const onError = vi.fn();
      const director = new SceneDirector({
        initialScene: 'game',
        onError,
      });

      const boomError = new Error('Render crash!');
      director.registerScene('game', {
        render: () => {
          throw boomError;
        },
      });

      expect(() => director.render()).not.toThrow();
      expect(onError).toHaveBeenCalledWith(boomError, 'render', 'game');
    });
  });
});
