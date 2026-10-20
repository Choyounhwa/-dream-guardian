/**
 * editor-toolbar-controller.test.ts - 에디터 툴바, 모달, 단축키 이벤트 전담 컨트롤러 단위 테스트 (#626)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState } from '../../src/editor/EditorState.js';
import { EditorLayout } from '../../src/editor/EditorLayout.js';
import { EditorPublishController } from '../../src/editor/EditorPublishController.js';
import {
  EditorToolbarController,
  type EditorToolbarCallbacks,
} from '../../src/editor/EditorToolbarController.js';
import { AddPatternCommand } from '../../src/editor/ProjectCommands.js';

interface MockElement {
  id?: string;
  className?: string;
  classList: {
    add: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    toggle: ReturnType<typeof vi.fn>;
    contains: ReturnType<typeof vi.fn>;
  };
  style: Record<string, string>;
  innerHTML: string;
  textContent: string;
  value?: string;
  checked?: boolean;
  type?: string;
  title?: string;
  listeners: Record<string, Function[]>;
  attributes: Record<string, string>;
  addEventListener: (event: string, handler: Function) => void;
  removeEventListener: (event: string, handler: Function) => void;
  dispatchEvent: (event: { type: string }) => void;
  getAttribute: (name: string) => string | null;
  setAttribute: (name: string, value: string) => void;
  click: () => void;
}

function createMockElement(id?: string, className = ''): MockElement {
  const listeners: Record<string, Function[]> = {};
  const attributes: Record<string, string> = {};
  if (id) attributes['id'] = id;

  const classNames = new Set(className.split(' ').filter(Boolean));

  const el: MockElement = {
    id,
    className,
    classList: {
      add: vi.fn((cls: string) => classNames.add(cls)),
      remove: vi.fn((cls: string) => classNames.delete(cls)),
      toggle: vi.fn((cls: string) => {
        if (classNames.has(cls)) {
          classNames.delete(cls);
          return false;
        } else {
          classNames.add(cls);
          return true;
        }
      }),
      contains: vi.fn((cls: string) => classNames.has(cls)),
    },
    style: {},
    innerHTML: '',
    textContent: '',
    value: '',
    listeners,
    attributes,
    addEventListener(event: string, handler: Function) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    removeEventListener(event: string, handler: Function) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter((h) => h !== handler);
    },
    dispatchEvent(event: { type: string; [key: string]: any }) {
      const handlers = listeners[event.type] || [];
      const evt = { target: el, currentTarget: el, ...event };
      handlers.forEach((h) => h(evt));
    },
    getAttribute(name: string) {
      return attributes[name] ?? null;
    },
    setAttribute(name: string, value: string) {
      attributes[name] = value;
    },
    click() {
      const handlers = listeners['click'] || [];
      handlers.forEach((h) => h({ target: el, currentTarget: el, type: 'click' }));
    },
  };

  return el;
}

describe('EditorToolbarController - 이벤트 리스너 및 툴바 바인딩 분리 (#626)', () => {
  let state: EditorState;
  let layout: EditorLayout;
  let publishController: EditorPublishController;
  let callbacks: EditorToolbarCallbacks;
  let controller: EditorToolbarController;

  let elements: Map<string, MockElement>;
  let mockDoc: any;
  let mockWin: any;

  beforeEach(() => {
    state = new EditorState();
    layout = new EditorLayout(state);
    publishController = new EditorPublishController(state);

    elements = new Map();

    const getOrCreateEl = (id: string, cls = ''): MockElement => {
      if (!elements.has(id)) {
        elements.set(id, createMockElement(id, cls));
      }
      return elements.get(id)!;
    };

    // Pre-create containers and standard buttons
    getOrCreateEl('publish-modal-container', 'modal hidden');
    getOrCreateEl('bindings-modal-container', 'modal hidden');
    getOrCreateEl('editor-status-bar-container');
    getOrCreateEl('btn-close-publish-modal');
    getOrCreateEl('btn-modal-validate');
    getOrCreateEl('btn-modal-publish');
    getOrCreateEl('btn-modal-test-play');
    getOrCreateEl('btn-close-bindings');
    getOrCreateEl('btn-add-binding');
    getOrCreateEl('btn-play');
    getOrCreateEl('btn-stop');
    getOrCreateEl('btn-new-project');
    getOrCreateEl('btn-validate-project');
    getOrCreateEl('btn-test-play');
    getOrCreateEl('btn-publish-project');
    getOrCreateEl('btn-manage-releases');
    getOrCreateEl('btn-clone-project');
    getOrCreateEl('btn-manage-bindings');
    getOrCreateEl('btn-new-pattern');
    getOrCreateEl('btn-save-local');
    getOrCreateEl('btn-export-json');
    getOrCreateEl('btn-import-json');
    getOrCreateEl('btn-export-csv');
    getOrCreateEl('btn-import-csv');
    getOrCreateEl('btn-reset-defaults');
    getOrCreateEl('phase-select');
    getOrCreateEl('bpm-input');

    const winListeners: Record<string, Function[]> = {};

    mockWin = {
      addEventListener: vi.fn((event: string, handler: Function) => {
        if (!winListeners[event]) winListeners[event] = [];
        winListeners[event].push(handler);
      }),
      removeEventListener: vi.fn((event: string, handler: Function) => {
        if (!winListeners[event]) return;
        winListeners[event] = winListeners[event].filter((h) => h !== handler);
      }),
      dispatchKeyEvent: (event: any) => {
        const handlers = winListeners['keydown'] || [];
        handlers.forEach((h) => h(event));
      },
    };

    mockDoc = {
      getElementById: vi.fn((id: string) => elements.get(id) ?? null),
      querySelectorAll: vi.fn((selector: string) => {
        if (selector === '.tool-btn') {
          return [createMockElement('tool-leftHand', 'tool-btn')];
        }
        if (selector === '.btn-remove-binding') {
          const btn = createMockElement(undefined, 'btn-remove-binding');
          btn.setAttribute('data-index', '0');
          return [btn];
        }
        return [];
      }),
    };

    callbacks = {
      updateHeader: vi.fn(),
      updateSidebar: vi.fn(),
      updateTimeline: vi.fn(),
      updateCanvas: vi.fn(),
      updateStatusBar: vi.fn(),
      updateToolbar: vi.fn(),
    };

    const mockIOHandler: any = {
      saveToLocalStorage: vi.fn(() => true),
      exportFullProjectJSON: vi.fn(() => '{}'),
      downloadFile: vi.fn(),
      openProject: vi.fn(async () => ({ success: true })),
      exportCSV: vi.fn(() => ''),
      importCSV: vi.fn(() => ({ success: true, loadedCount: 1 })),
      clearLocalStorage: vi.fn(),
    };

    controller = new EditorToolbarController({
      state,
      layout,
      publishController,
      callbacks,
      ioHandler: mockIOHandler,
      documentRef: mockDoc,
      windowRef: mockWin,
    });
  });

  afterEach(() => {
    controller.dispose();
  });

  describe('1. 인스턴스 생성 및 기본 상태 확인', () => {
    it('EditorToolbarController 인스턴스가 올바르게 생성된다', () => {
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(EditorToolbarController);
      expect(controller.getState()).toBe(state);
      expect(controller.getLayout()).toBe(layout);
      expect(controller.getPublishController()).toBe(publishController);
    });

    it('초기 상태에서 모달은 닫혀 있다', () => {
      expect(controller.isPublishModalOpen()).toBe(false);
      expect(controller.isBindingsModalOpen()).toBe(false);
    });
  });

  describe('2. 배포 및 검증 모달(Publish Modal) 바인딩 및 조작', () => {
    it('updatePublishModal 호출 시 모달 컨테이너 HTML이 갱신된다', async () => {
      const container = elements.get('publish-modal-container')!;
      container.classList.contains = vi.fn(() => false);

      await controller.updatePublishModal();

      expect(container.innerHTML).toContain('publish-modal-panel');
      expect(container.style.display).toBe('block');
    });

    it('closePublishModal 호출 시 모달 컨테이너가 숨겨진다', () => {
      const container = elements.get('publish-modal-container')!;
      controller.closePublishModal();

      expect(container.classList.add).toHaveBeenCalledWith('hidden');
      expect(container.style.display).toBe('none');
      expect(controller.isPublishModalOpen()).toBe(false);
    });

    it('openPublishModal 호출 시 모달 컨테이너가 표시된다', async () => {
      const container = elements.get('publish-modal-container')!;
      await controller.openPublishModal();

      expect(container.classList.remove).toHaveBeenCalledWith('hidden');
      expect(container.style.display).toBe('block');
      expect(controller.isPublishModalOpen()).toBe(true);
    });
  });

  describe('3. 구간 바인딩 모달(Bindings Panel) 바인딩 및 조작', () => {
    it('updateBindingsPanel 호출 시 바인딩 패널 HTML이 갱신된다', () => {
      const container = elements.get('bindings-modal-container')!;
      controller.updateBindingsPanel();

      expect(container.innerHTML).toContain('stage-bindings-panel');
    });

    it('closeBindingsPanel 호출 시 hidden 클래스가 추가된다', () => {
      const container = elements.get('bindings-modal-container')!;
      controller.closeBindingsPanel();

      expect(container.classList.add).toHaveBeenCalledWith('hidden');
      expect(controller.isBindingsModalOpen()).toBe(false);
    });

    it('openBindingsPanel 호출 시 hidden 클래스가 제거되고 갱신된다', () => {
      const container = elements.get('bindings-modal-container')!;
      controller.openBindingsPanel();

      expect(container.classList.remove).toHaveBeenCalledWith('hidden');
      expect(controller.isBindingsModalOpen()).toBe(true);
    });
  });

  describe('4. 헤더 툴바 버튼 이벤트 바인딩', () => {
    it('bindHeaderToolbar를 호출하면 툴바 버튼들에 이벤트가 등록된다', () => {
      controller.bindHeaderToolbar();

      const playBtn = elements.get('btn-play')!;
      expect(playBtn.listeners['click']?.length).toBeGreaterThan(0);

      const stopBtn = elements.get('btn-stop')!;
      expect(stopBtn.listeners['click']?.length).toBeGreaterThan(0);

      const saveBtn = elements.get('btn-save-local')!;
      expect(saveBtn.listeners['click']?.length).toBeGreaterThan(0);
    });

    it('재생(btn-play) 버튼 클릭 시 state.togglePlay가 호출된다', () => {
      controller.bindHeaderToolbar();
      const playBtn = elements.get('btn-play')!;
      const initialPlaying = state.isPlaying;

      playBtn.click();
      expect(state.isPlaying).toBe(!initialPlaying);
    });

    it('정지(btn-stop) 버튼 클릭 시 state.pause 및 seekBeat(1.0)가 실행된다', () => {
      controller.bindHeaderToolbar();
      state.play();
      state.seekBeat(4.0);

      const stopBtn = elements.get('btn-stop')!;
      stopBtn.click();

      expect(state.isPlaying).toBe(false);
      expect(state.currentBeat).toBe(1.0);
    });

    it('페이즈 선택(phase-select) 변경 시 state.setSelectedPhase 및 콜백이 실행된다', () => {
      controller.bindHeaderToolbar();
      const phaseSelect = elements.get('phase-select')!;
      phaseSelect.value = 'BOSS_BATTLE';
      phaseSelect.dispatchEvent({ type: 'change' });

      expect(state.selectedPhase).toBe('BOSS_BATTLE');
      expect(callbacks.updateSidebar).toHaveBeenCalled();
      expect(callbacks.updateTimeline).toHaveBeenCalled();
    });

    it('BPM 입력(bpm-input) 변경 시 state.setBpm 및 콜백이 실행된다', () => {
      controller.bindHeaderToolbar();
      const bpmInput = elements.get('bpm-input')!;
      bpmInput.value = '140';
      bpmInput.dispatchEvent({ type: 'change' });

      expect(state.bpm).toBe(140);
      expect(callbacks.updateSidebar).toHaveBeenCalled();
    });
  });

  describe('5. 단축키(Shortcuts: Undo, Redo, Save) 바인딩 및 동작', () => {
    it('bindShortcuts 호출 후 Ctrl+Z 입력 시 Undo가 실행되고 콜백이 호출된다', () => {
      controller.bindShortcuts();

      // 히스토리에 작업 추가
      state.historyManager.commandManager.executeCommand(
        new AddPatternCommand({
          id: 'PAT_HISTORY_TEST_1',
          name: 'History Test Pattern 1',
          target: { leftHand: 3, rightHand: 4 },
        })
      );
      expect(state.canUndo()).toBe(true);

      const preventDefault = vi.fn();
      mockWin.dispatchKeyEvent({
        type: 'keydown',
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        key: 'z',
        preventDefault,
      });

      expect(preventDefault).toHaveBeenCalled();
      expect(state.canUndo()).toBe(false);
      expect(callbacks.updateHeader).toHaveBeenCalled();
      expect(callbacks.updateSidebar).toHaveBeenCalled();
      expect(callbacks.updateTimeline).toHaveBeenCalled();
      expect(callbacks.updateCanvas).toHaveBeenCalled();
      expect(callbacks.updateStatusBar).toHaveBeenCalled();
    });

    it('Ctrl+Y 및 Ctrl+Shift+Z 입력 시 Redo가 실행된다', () => {
      controller.bindShortcuts();

      state.historyManager.commandManager.executeCommand(
        new AddPatternCommand({
          id: 'PAT_HISTORY_TEST_2',
          name: 'History Test Pattern 2',
          target: { leftHand: 3, rightHand: 4 },
        })
      );
      state.undo();
      expect(state.canRedo()).toBe(true);

      const preventDefault = vi.fn();
      mockWin.dispatchKeyEvent({
        type: 'keydown',
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        key: 'y',
        preventDefault,
      });

      expect(preventDefault).toHaveBeenCalled();
      expect(state.canRedo()).toBe(false);
    });

    it('Ctrl+S 입력 시 preventDefault 호출 및 handleSave가 실행된다', () => {
      controller.bindShortcuts();

      const preventDefault = vi.fn();
      mockWin.dispatchKeyEvent({
        type: 'keydown',
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        key: 's',
        preventDefault,
      });

      expect(preventDefault).toHaveBeenCalled();
      expect(callbacks.updateStatusBar).toHaveBeenCalled();
    });
  });

  describe('6. bindAll 및 dispose 라이프사이클', () => {
    it('bindAll 호출 시 모달, 툴바, 단축키가 일괄 바인딩된다', () => {
      controller.bindAll();
      const playBtn = elements.get('btn-play')!;
      expect(playBtn.listeners['click']?.length).toBeGreaterThan(0);
      expect(mockWin.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('dispose 호출 시 단축키 이벤트 리스너가 안전하게 해제된다', () => {
      controller.bindShortcuts();
      controller.dispose();

      expect(mockWin.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });
});
