/**
 * bug-run-question-render.test.ts
 *
 * [Issue #492 / BUG-RUN-QUESTION-RENDER-001]
 * 문제페이즈(RUN_QUESTION) 렌더링 중단 버그: RunningMatRenderer Proxy Illegal Invocation 및 tracker.render 예외 해결 검증
 *
 * 1) 브라우저 WebIDL C++ 바인딩과 동일하게 Proxy가 씌워졌을 때 Illegal invocation을 던지는 엄격한 CanvasRenderingContext2D 시뮬레이션 환경 구축.
 * 2) RunningMatRenderer._renderFlyingStompNotes 호출 시 네이티브 Canvas2D 프로퍼티(globalAlpha, lineWidth, strokeStyle 등) 접근에서 Illegal invocation 예외가 발생하지 않고 정상 렌더링됨을 검증.
 * 3) SceneDirector.renderModalsAndOverlays에서 menu, result, pauseModal 상태 시 tracker.render가 존재하지 않아도 TypeError 예외 없이 정상적으로 커서가 렌더링됨을 검증.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunningMatRenderer } from '../../src/render/RunningMatRenderer.js';
import type { RunningMatViewModel } from '../../src/render/RunningMatPresenter.js';
import { SceneDirector, type MainSceneContext } from '../../src/core/SceneDirector.js';
import { CursorTracker } from '../../src/input/CursorTracker.js';

/**
 * 브라우저 WebIDL C++ 바인딩과 동일하게 this가 실제 네이티브 CanvasRenderingContext2D 인스턴스가
 * 아닐 경우(Proxy로 래핑되어 receiver가 Proxy일 경우) TypeError: Illegal invocation을 던지는 엄격한 시뮬레이션 컨텍스트
 */
function createStrictWebIDLContext(): CanvasRenderingContext2D {
  let _globalAlpha = 1.0;
  let _lineWidth = 1;
  let _strokeStyle = '#000000';
  let _fillStyle = '#000000';
  let _shadowBlur = 0;
  let _shadowColor = '#000000';
  let _font = '10px sans-serif';
  let _textAlign = 'start';
  let _textBaseline = 'alphabetic';

  const realInstance: any = {};

  function assertReceiver(self: any, member: string) {
    if (self !== realInstance) {
      throw new TypeError(`Illegal invocation: '${member}' called on invalid receiver`);
    }
  }

  const proto = {
    get globalAlpha() {
      assertReceiver(this, 'globalAlpha');
      return _globalAlpha;
    },
    set globalAlpha(val: number) {
      assertReceiver(this, 'globalAlpha');
      _globalAlpha = val;
    },
    get lineWidth() {
      assertReceiver(this, 'lineWidth');
      return _lineWidth;
    },
    set lineWidth(val: number) {
      assertReceiver(this, 'lineWidth');
      _lineWidth = val;
    },
    get strokeStyle() {
      assertReceiver(this, 'strokeStyle');
      return _strokeStyle;
    },
    set strokeStyle(val: any) {
      assertReceiver(this, 'strokeStyle');
      _strokeStyle = val;
    },
    get fillStyle() {
      assertReceiver(this, 'fillStyle');
      return _fillStyle;
    },
    set fillStyle(val: any) {
      assertReceiver(this, 'fillStyle');
      _fillStyle = val;
    },
    get shadowBlur() {
      assertReceiver(this, 'shadowBlur');
      return _shadowBlur;
    },
    set shadowBlur(val: number) {
      assertReceiver(this, 'shadowBlur');
      _shadowBlur = val;
    },
    get shadowColor() {
      assertReceiver(this, 'shadowColor');
      return _shadowColor;
    },
    set shadowColor(val: string) {
      assertReceiver(this, 'shadowColor');
      _shadowColor = val;
    },
    get font() {
      assertReceiver(this, 'font');
      return _font;
    },
    set font(val: string) {
      assertReceiver(this, 'font');
      _font = val;
    },
    get textAlign() {
      assertReceiver(this, 'textAlign');
      return _textAlign;
    },
    set textAlign(val: string) {
      assertReceiver(this, 'textAlign');
      _textAlign = val;
    },
    get textBaseline() {
      assertReceiver(this, 'textBaseline');
      return _textBaseline;
    },
    set textBaseline(val: string) {
      assertReceiver(this, 'textBaseline');
      _textBaseline = val;
    },
    save() {
      assertReceiver(this, 'save');
    },
    restore() {
      assertReceiver(this, 'restore');
    },
    beginPath() {
      assertReceiver(this, 'beginPath');
    },
    moveTo(_x: number, _y: number) {
      assertReceiver(this, 'moveTo');
    },
    lineTo(_x: number, _y: number) {
      assertReceiver(this, 'lineTo');
    },
    closePath() {
      assertReceiver(this, 'closePath');
    },
    arc(..._args: any[]) {
      assertReceiver(this, 'arc');
    },
    ellipse(..._args: any[]) {
      assertReceiver(this, 'ellipse');
    },
    fill() {
      assertReceiver(this, 'fill');
    },
    stroke() {
      assertReceiver(this, 'stroke');
    },
    fillRect(..._args: any[]) {
      assertReceiver(this, 'fillRect');
    },
    strokeRect(..._args: any[]) {
      assertReceiver(this, 'strokeRect');
    },
    fillText(..._args: any[]) {
      assertReceiver(this, 'fillText');
    },
    strokeText(..._args: any[]) {
      assertReceiver(this, 'strokeText');
    },
    measureText: function (this: any) {
      assertReceiver(this, 'measureText');
      return { width: 40 };
    },
    createLinearGradient: function (this: any) {
      assertReceiver(this, 'createLinearGradient');
      return { addColorStop: vi.fn() };
    },
    createRadialGradient: function (this: any) {
      assertReceiver(this, 'createRadialGradient');
      return { addColorStop: vi.fn() };
    },
    setLineDash: function (this: any) {
      assertReceiver(this, 'setLineDash');
    },
    roundRect: function (this: any) {
      assertReceiver(this, 'roundRect');
    },
    drawImage: function (this: any) {
      assertReceiver(this, 'drawImage');
    },
  };

  Object.setPrototypeOf(realInstance, proto);
  return realInstance as CanvasRenderingContext2D;
}

describe('[BUG-RUN-QUESTION-RENDER-001 / #492] 문제페이즈 렌더링 중단 결함 검증', () => {
  describe('1. WebIDL C++ 바인딩 시뮬레이션 환경 검증', () => {
    it('엄격한 Context는 네이티브 호출 시 정상 동작하지만, Proxy 경유 호출 시 Illegal invocation을 던진다', () => {
      const strictCtx = createStrictWebIDLContext();

      // 직접 호출 시 성공
      expect(() => {
        strictCtx.globalAlpha = 0.8;
        expect(strictCtx.globalAlpha).toBe(0.8);
        strictCtx.lineWidth = 4;
        expect(strictCtx.lineWidth).toBe(4);
        strictCtx.save();
        strictCtx.restore();
      }).not.toThrow();

      // Reflect.get을 사용하는 프록시 경유 호출 시 Illegal invocation 발생
      const proxyCtx = new Proxy(strictCtx, {
        get(target, prop, receiver) {
          const val = Reflect.get(target, prop, receiver);
          if (typeof val === 'function') {
            return val.bind(target);
          }
          return val;
        },
      });

      expect(() => {
        void proxyCtx.globalAlpha;
      }).toThrow(/Illegal invocation/);
      expect(() => {
        proxyCtx.globalAlpha = 0.5;
      }).toThrow(/Illegal invocation/);
      expect(() => {
        void proxyCtx.lineWidth;
      }).toThrow(/Illegal invocation/);
    });
  });

  describe('2. RunningMatRenderer Flying Stomp Notes 렌더링 Illegal invocation 해소 검증', () => {
    it('비행 스톰프 큐가 존재하는 상황에서 strictCtx로 렌더링 시 Illegal invocation 예외가 발생하지 않아야 한다', () => {
      const renderer = new RunningMatRenderer();
      const strictCtx = createStrictWebIDLContext();

      const viewModel: RunningMatViewModel = {
        visible: true,
        paused: false,
        currentCue: null,
        nextCue: null,
        cueText: '왼발 앞으로!',
        actionText: '왼발 전진',
        directionText: '왼쪽',
        arrowDirection: 'up',
        nextRingRatio: 0.5,
        elapsedBeats: 1,
        acceptedExerciseCount: 2,
        requiredExerciseCount: 4,
        isShortage: false,
        isPreparing: false,
        upcomingCues: [
          {
            cue: {
              id: 'stomp_left',
              actionText: '왼발 스텝',
              directionText: '왼쪽',
              cueText: '왼발 쿵!',
              arrowDirection: 'up' as const,
              leftFootSlot: 'out',
              rightFootSlot: 'home',
            },
            targetBeat: 2,
            remainingBeats: 0.5,
            progress: 0.5,
            phase: 'lift',
          },
        ],
      };

      // 수정 전: _renderFlyingStompNotes의 delegateCtx(Proxy)로 인해 Illegal invocation 예외 발생
      // 수정 후: Proxy 제거 및 ctx 직접 전달로 정상 렌더링 완료
      expect(() => {
        renderer.render(strictCtx, viewModel, 1920, 1080);
      }).not.toThrow();
    });
  });

  describe('3. SceneDirector.renderModalsAndOverlays 커서 렌더링 및 tracker.render 미존재 예외 해소 검증', () => {
    let director: SceneDirector;
    let mockContext: MainSceneContext;
    let mockAnswerSelectionRenderer: { render: any; update: any };
    let tracker: CursorTracker;

    beforeEach(() => {
      director = new SceneDirector();
      mockAnswerSelectionRenderer = {
        render: vi.fn(),
        update: vi.fn(),
      };
      tracker = new CursorTracker();
      // 커서 등록 (head, leftHand, rightHand)
      (tracker as any)._cursors.set('head', { x: 500, y: 300, vx: 0, vy: 0, confidence: 1 });
      (tracker as any)._cursors.set('leftHand', { x: 400, y: 400, vx: 0, vy: 0, confidence: 1 });
      (tracker as any)._cursors.set('rightHand', { x: 600, y: 400, vx: 0, vy: 0, confidence: 1 });

      const strictCtx = createStrictWebIDLContext();

      mockContext = {
        canvasManager: {
          ctx: strictCtx,
          virtualWidth: 1920,
          virtualHeight: 1080,
        },
        settingsModal: { isOpen: false, render: vi.fn() },
        locomotionModal: { isOpen: false, render: vi.fn() },
        pauseModal: { isOpen: false, render: vi.fn(), hoverAction: 'resume', hoverProgress: 0 },
        state: {
          screenMode: 'menu',
          menuMode: 'main',
          currentChapter: 1,
          selectedChapter: 1,
          gamePhase: '',
          menuHoverItem: null,
          menuHoverTimer: 0,
          settingsHoverTimer: 0,
          actionHoverTimer: 0,
          resultReturnTimer: 0,
        } as any,
        stateMachine: { currentState: 'MENU_MAIN' } as any,
        cursorTracker: tracker,
        answerSelector: { cursorTracker: tracker },
        answerSelectionRenderer: mockAnswerSelectionRenderer,
        menuInput: { isActive: false, cursorX: 500, cursorY: 500 },
        gestureFeedbackOverlay: { render: vi.fn() },
        dialogueOverlayRenderer: { render: vi.fn() },
        tutorial: { isVisible: false, render: vi.fn() },
        xGestureDetector: { isCrossing: false, inCooldown: false, progress: 0 },
      } as unknown as MainSceneContext;
    });

    it('screenMode = menu 일 때 tracker.render가 없어도 TypeError가 발생하지 않고 answerSelectionRenderer.render로 커서를 렌더링한다', () => {
      mockContext.state.screenMode = 'menu';

      expect(() => {
        director.renderModalsAndOverlays(mockContext);
      }).not.toThrow();

      expect(mockAnswerSelectionRenderer.render).toHaveBeenCalled();
      const callArgs = mockAnswerSelectionRenderer.render.mock.calls[0];
      // callArgs: (ctx, vw, vh, activeZones, cursors, choiceProgress)
      expect(callArgs[1]).toBe(1920);
      expect(callArgs[2]).toBe(1080);
      expect(callArgs[4].size).toBe(3); // head, leftHand, rightHand
    });

    it('screenMode = result 일 때 tracker.render가 없어도 TypeError가 발생하지 않고 answerSelectionRenderer.render로 커서를 렌더링한다', () => {
      mockContext.state.screenMode = 'result';

      expect(() => {
        director.renderModalsAndOverlays(mockContext);
      }).not.toThrow();

      expect(mockAnswerSelectionRenderer.render).toHaveBeenCalled();
      const callArgs = mockAnswerSelectionRenderer.render.mock.calls[0];
      expect(callArgs[1]).toBe(1920);
      expect(callArgs[2]).toBe(1080);
      expect(callArgs[4].size).toBe(3);
    });

    it('pauseModal.isOpen = true 일 때 tracker.render가 없어도 TypeError가 발생하지 않고 answerSelectionRenderer.render로 커서를 렌더링한다', () => {
      mockContext.state.screenMode = 'game';
      mockContext.pauseModal.isOpen = true;

      expect(() => {
        director.renderModalsAndOverlays(mockContext);
      }).not.toThrow();

      expect(mockAnswerSelectionRenderer.render).toHaveBeenCalled();
      const callArgs = mockAnswerSelectionRenderer.render.mock.calls[0];
      expect(callArgs[1]).toBe(1920);
      expect(callArgs[2]).toBe(1080);
      expect(callArgs[4].size).toBe(3);
    });

    it('menuInput.isActive = true 일 때 leftHand와 rightHand 커서가 필터링되고 head만 전달된다', () => {
      mockContext.state.screenMode = 'menu';
      mockContext.menuInput.isActive = true;

      expect(() => {
        director.renderModalsAndOverlays(mockContext);
      }).not.toThrow();

      expect(mockAnswerSelectionRenderer.render).toHaveBeenCalled();
      const callArgs = mockAnswerSelectionRenderer.render.mock.calls[0];
      const renderedCursors = callArgs[4];
      expect(renderedCursors.has('head')).toBe(true);
      expect(renderedCursors.has('leftHand')).toBe(false);
      expect(renderedCursors.has('rightHand')).toBe(false);
    });
  });
});
