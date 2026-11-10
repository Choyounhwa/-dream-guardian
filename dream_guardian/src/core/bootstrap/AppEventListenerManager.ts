/**
 * AppEventListenerManager - DOM 및 윈도우 이벤트 리스너 생명주기 및 fallback 관리자
 *
 * [REFACTOR-SRP-001] (Issue #632)
 * - AppBootstrap에서 거대화된 윈도우 resize, 키보드/터치/클릭 fallback, 가시성 변경 이벤트 리스너 분리
 * - attachListeners(), detachListeners() 생명주기 캡슐화
 */

import { getAnswerButtonLayouts, DEFAULT_FITNESS_ZONES } from '../../../config/zone.config.js';
import { resolveBottomBarActionSlot } from '../SceneDirector.js';
import type { ScreenMode, MenuMode, GamePhase } from './BootstrapStateMachineBuilder.js';

export interface AppEventListenerHost {
  canvas: HTMLCanvasElement | any;
  canvasManager: { resize(): void; virtualWidth: number; virtualHeight: number; toVirtual(px: number, py: number): { x: number; y: number } };
  bgmManager?: { unlock(): void; resume(): void; stop(): void; pause(): void; setMuted?(muted: boolean): void };
  stageBgm?: { resume(): void; stop(): void; pause(): void; setMuted?(muted: boolean): void };
  sfx?: { play(name: string): void; setMuted?(muted: boolean): void };
  bandSynth?: { setMuted?(muted: boolean): void };
  speech?: { enabled: boolean };
  cameraLayer?: { isActive: boolean; status: string; renderVideo: boolean; stop(): void };
  ensureCameraStarted?: () => Promise<boolean | void>;
  tutorial?: { isVisible: boolean; nextStep(): void };
  pauseModal?: { isOpen: boolean; open(): void; close(resumed?: boolean): void; hitTest(x: number, y: number, vw: number, vh: number): string | null };
  locomotionModal?: { isOpen: boolean; open(): void; close(): void; handleClick(x: number, y: number, vw: number, vh: number): any };
  updateLocomotionLabel?: () => void;
  settingsModal?: { isOpen: boolean; open(): void; close(): void; handleClick(x: number, y: number, vw: number, vh: number): string | null; cameraEnabled: boolean; soundEnabled: boolean; renderVideoEnabled: boolean; skeletonEnabled?: boolean };
  bottomBar?: any;
  readonly screenMode: ScreenMode;
  readonly menuMode: MenuMode;
  readonly gamePhase?: GamePhase;
  readonly selectedChapter: number;
  readonly currentQuestion?: any;
  selectChapter(ch: number): void;
  selectSubLevel(subLevel: number): void;
  goToMenu(): void;
  menuRenderer?: {
    hitTestLocomotion(x: number, y: number, vw: number, vh: number): boolean;
    hitTest(x: number, y: number, vw: number, vh: number): number | null;
    hitTestSub(x: number, y: number, vw: number, vh: number, chapter: number, subLevels: any[]): number | null;
  };
  questionBank?: { getSubLevels(chapter: number): any[] };
  poseManager?: any;
  presentationAdapter?: {
    isAnswerInputAllowed(state: string, locked: boolean, isAnswerOpen: boolean): boolean;
    resolveAnswerClick?(x: number, y: number, vw: number, vh: number): number | null;
  };
  stateMachine: { currentState: string };
  readonly answerLocked: boolean;
  beatCoordinator?: {
    isAnswerOpen: boolean;
    confirmAnswerByFallback(idx: number): void;
    phase?: string;
    recordStep(): void;
    currentQuestion?: any;
  };
  starNoteScheduler?: { fromTouch(id: number, time: number): void; fromKeyboard(time: number): void };
  engine?: { elapsedTime: number };
  bossHazardController?: { recordAction(action: string): void };
  phaseAHazardController?: { activePattern: string | null; recordAction(action: string): void };
  assaultWireHelper?: { handleKeyDown(e: KeyboardEvent): boolean; handleKeyUp(e: KeyboardEvent): void; handleVisibilityChange?(hidden?: boolean): void };
  readyPositionController?: { isActive: boolean; skip(): void };
  runningMatRenderer?: { triggerMotionHit(): void };
  effectManager?: { playBurst(options: any): void };
  footKeynoteInput?: { fromKeyboard(foot: string, time: number): void; fromVirtualPedal?(zone: 9 | 10 | 11, time: number): any };
  onRunningStep?(): void;
  onJumpAction?(): void;
  handleVisibilityChange?(hidden?: boolean): void;
}

export class AppEventListenerManager {
  private _host: AppEventListenerHost;
  private _attachedCanvas: any = null;
  private _isAttached = false;

  public readonly onResize: (e?: any) => void;
  public readonly onKeyDown: (e: KeyboardEvent) => void;
  public readonly onKeyUp: (e: KeyboardEvent) => void;
  public readonly onCanvasClick: (e: MouseEvent) => void;
  public readonly onVisibilityChange: () => void;

  constructor(host: AppEventListenerHost) {
    this._host = host;
    this.onResize = () => this.handleResize();
    this.onKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.onKeyUp = (e: KeyboardEvent) => this.handleKeyUp(e);
    this.onCanvasClick = (e: MouseEvent) => this.handleCanvasClick(e);
    this.onVisibilityChange = () => this.handleVisibilityChange();
  }

  public attachListeners(canvas?: any): void {
    if (this._isAttached) return;
    if (typeof window !== 'undefined') window.addEventListener('resize', this.onResize);
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', this.onKeyDown);
      document.addEventListener('keyup', this.onKeyUp);
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
    const targetCanvas = canvas ?? this._host.canvas;
    if (targetCanvas && typeof targetCanvas.addEventListener === 'function') {
      targetCanvas.addEventListener('click', this.onCanvasClick);
      this._attachedCanvas = targetCanvas;
    }
    this._isAttached = true;
  }

  public detachListeners(): void {
    if (!this._isAttached) return;
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.onResize);
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.onKeyDown);
      document.removeEventListener('keyup', this.onKeyUp);
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    if (this._attachedCanvas && typeof this._attachedCanvas.removeEventListener === 'function') {
      this._attachedCanvas.removeEventListener('click', this.onCanvasClick);
      this._attachedCanvas = null;
    }
    this._isAttached = false;
  }

  public handleResize(): void {
    this._host.canvasManager?.resize();
  }

  public handleVisibilityChange(hidden?: boolean): void {
    if (this._host.handleVisibilityChange) {
      this._host.handleVisibilityChange(hidden);
    } else {
      this._host.assaultWireHelper?.handleVisibilityChange?.(hidden);
    }
  }

  public handleKeyUp(e: KeyboardEvent): void {
    this._host.assaultWireHelper?.handleKeyUp(e);
  }

  public handleKeyDown(e: KeyboardEvent): void {
    const host = this._host;
    const { screenMode, menuMode } = host;

    // Issue #141 / #154 / #172: 모달 열림 상태 시 Escape 또는 P로 토글/닫기
    if (e.key === 'Escape' || e.code === 'KeyP') {
      if (host.pauseModal?.isOpen) {
        host.pauseModal.close();
        host.stageBgm?.resume();
        host.bgmManager?.resume();
        host.sfx?.play('hover');
        return;
      }
      if (host.locomotionModal?.isOpen) { host.locomotionModal.close(); return; }
      if (host.settingsModal?.isOpen) { host.settingsModal.close(); return; }
      if (screenMode === 'game') {
        host.stageBgm?.pause(); host.bgmManager?.pause(); host.pauseModal?.open(); host.sfx?.play('hover');
        return;
      }
      if (screenMode === 'menu' && menuMode === 'sub') { host.selectSubLevel(-1); return; }
    }

    if (host.assaultWireHelper?.handleKeyDown(e)) return;

    if (host.tutorial?.isVisible && (e.code === 'Space' || e.key === 'Enter' || e.key === 'Escape')) {
      host.tutorial.nextStep();
      return;
    }

    const currentState = host.stateMachine.currentState;

    if (e.code === 'Space') {
      if (e.repeat) return;
      if (currentState === 'READY_POSITION' && host.readyPositionController?.isActive) {
        host.readyPositionController.skip();
        return;
      }
      if (screenMode === 'game' && host.gamePhase === 'running' && !host.pauseModal?.isOpen) {
        host.beatCoordinator?.recordStep();
        host.runningMatRenderer?.triggerMotionHit();
        host.effectManager?.playBurst({
          x: host.canvasManager.virtualWidth * 0.5,
          y: host.canvasManager.virtualHeight * 0.65,
          count: 8,
          colors: ['#28E6FF', '#FFCB4D'],
          duration: 0.3,
        });
        host.onRunningStep?.();
        return;
      }
      if (screenMode === 'game' && currentState === 'HAZARD_EVADE' && !host.pauseModal?.isOpen) {
        const target = host.phaseAHazardController?.activePattern;
        if (target === 'jump') {
          host.phaseAHazardController?.recordAction('jump');
          host.sfx?.play('jump_whoosh');
        } else if (target) {
          host.phaseAHazardController?.recordAction(target);
        }
        host.effectManager?.playBurst({
          x: host.canvasManager.virtualWidth * 0.5,
          y: host.canvasManager.virtualHeight * 0.65,
          count: 8,
          colors: ['#28E6FF', '#FFFFFF'],
          duration: 0.3,
        });
        return;
      }
      if (
        screenMode === 'game' &&
        (host.beatCoordinator?.phase === 'KEYNOTE_PERFORMANCE' ||
          host.beatCoordinator?.phase === 'STAR_COLLECT' ||
          currentState === 'STAR_COLLECT' ||
          currentState === 'BOSS_CLIMAX')
      ) {
        host.starNoteScheduler?.fromKeyboard(host.engine?.elapsedTime ?? 0);
        if (currentState === 'BOSS_CLIMAX' && host.bossHazardController && !host.pauseModal?.isOpen) {
          host.onJumpAction?.();
          host.bossHazardController.recordAction('jump');
        }
        return;
      }
    }

    if (e.key.toLowerCase() === 'c' && host.cameraLayer) {
      if (host.cameraLayer.isActive) {
        host.cameraLayer.stop();
        if (host.settingsModal) host.settingsModal.cameraEnabled = false;
      } else {
        host.ensureCameraStarted?.()?.catch?.(() => {});
        if (host.settingsModal) host.settingsModal.cameraEnabled = true;
      }
    }
    if (e.key.toLowerCase() === 'f' && typeof document !== 'undefined') {
      const container = document.getElementById('container') || host.canvas;
      if (!document.fullscreenElement) container?.requestFullscreen?.().catch?.(() => {});
      else document.exitFullscreen?.().catch?.(() => {});
    }

    if (screenMode === 'game') {
      const elapsedTime = host.engine?.elapsedTime ?? 0;
      if (e.key === 'z' || e.key === 'Z') host.footKeynoteInput?.fromKeyboard('leftFoot', elapsedTime);
      else if (e.key === 'x' || e.key === 'X') host.footKeynoteInput?.fromKeyboard('centerFoot', elapsedTime);
      else if (e.key === 'v' || e.key === 'V') host.footKeynoteInput?.fromKeyboard('rightFoot', elapsedTime);

      if (
        !host.pauseModal?.isOpen &&
        host.presentationAdapter?.isAnswerInputAllowed(currentState, host.answerLocked, Boolean(host.beatCoordinator?.isAnswerOpen))
      ) {
        if (e.key === '1') {
          host.sfx?.play('hover');
          host.beatCoordinator?.confirmAnswerByFallback(0);
        } else if (e.key === '2') {
          host.sfx?.play('hover');
          host.beatCoordinator?.confirmAnswerByFallback(1);
        }
      }
    } else if (screenMode === 'menu') {
      if (menuMode === 'main') {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= 5) host.selectChapter(n);
      } else {
        if (e.key === 'Escape' || e.key === 'Backspace' || e.key === '0' || e.key.toLowerCase() === 'b') {
          host.selectSubLevel(-1);
        } else if (e.key.toLowerCase() === 'a') {
          host.selectSubLevel(0);
        } else {
          const n = parseInt(e.key, 10);
          const subLevels = host.questionBank?.getSubLevels(host.selectedChapter) ?? [];
          if (n >= 1 && n <= subLevels.length) host.selectSubLevel(n);
        }
      }
    } else if (screenMode === 'result') {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') host.goToMenu();
    }
  }

  public handleCanvasClick(e: MouseEvent): void {
    const host = this._host;
    host.bgmManager?.unlock();

    if (host.cameraLayer && !host.cameraLayer.isActive && host.cameraLayer.status !== 'requesting') {
      host.ensureCameraStarted?.()?.catch?.(() => {});
    }

    const canvas = host.canvas;
    if (!canvas || typeof canvas.getBoundingClientRect !== 'function') return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const { x, y } = host.canvasManager.toVirtual(px, py);
    const vw = host.canvasManager.virtualWidth;
    const vh = host.canvasManager.virtualHeight;

    if (host.tutorial?.isVisible) { host.tutorial.nextStep(); return; }

    if (host.pauseModal?.isOpen) {
      const action = host.pauseModal.hitTest(x, y, vw, vh);
      if (action === 'resume' || action === 'backdrop') {
        host.pauseModal.close();
        host.stageBgm?.resume();
        host.bgmManager?.resume();
        host.sfx?.play(action === 'resume' ? 'correct' : 'hover');
      } else if (action === 'quit') {
        host.pauseModal.close();
        host.stageBgm?.stop();
        host.bgmManager?.stop();
        host.goToMenu();
        host.sfx?.play('hover');
      }
      return;
    }

    if (host.locomotionModal?.isOpen) {
      const res = host.locomotionModal.handleClick(x, y, vw, vh);
      if (res) {
        if (res.action === 'select' && res.mode) {
          host.poseManager?.setLocomotionMode(res.mode);
          host.updateLocomotionLabel?.();
          host.locomotionModal.close();
          host.sfx?.play('correct');
        } else if (res.action === 'close') {
          host.locomotionModal.close();
          host.sfx?.play('hover');
        }
      }
      return;
    }

    if (host.settingsModal?.isOpen) {
      const action = host.settingsModal.handleClick(x, y, vw, vh);
      if (action === 'close' || action === 'backdrop-close') { host.settingsModal.close(); host.sfx?.play('hover'); }
      else if (action === 'locomotion') { host.settingsModal.close(); host.locomotionModal?.open(); host.sfx?.play('hover'); }
      else if (action === 'camera') {
        if (host.settingsModal.cameraEnabled) host.ensureCameraStarted?.()?.catch?.(() => {});
        else host.cameraLayer?.stop();
        host.sfx?.play('hover');
      } else if (action === 'fullscreen') {
        const container = document.getElementById('container') || host.canvas;
        if (!document.fullscreenElement) container?.requestFullscreen?.().catch?.(() => {});
        else document.exitFullscreen?.().catch?.(() => {});
        host.sfx?.play('hover');
      } else if (action === 'skeleton') {
        if (host.settingsModal.skeletonEnabled !== undefined) host.settingsModal.skeletonEnabled = !host.settingsModal.skeletonEnabled;
        host.sfx?.play('hover');
      } else if (action === 'sound') {
        host.settingsModal.soundEnabled = !host.settingsModal.soundEnabled;
        host.sfx?.setMuted?.(!host.settingsModal.soundEnabled);
        host.bandSynth?.setMuted?.(!host.settingsModal.soundEnabled);
        host.stageBgm?.setMuted?.(!host.settingsModal.soundEnabled);
        host.bgmManager?.setMuted?.(!host.settingsModal.soundEnabled);
        if (host.speech) host.speech.enabled = host.settingsModal.soundEnabled;
        if (host.settingsModal.soundEnabled) host.sfx?.play('correct');
      } else if (action === 'fontScale' || action === 'highContrast') {
        host.sfx?.play('hover');
      } else if (action === 'webcamVideo') {
        if (host.cameraLayer) host.cameraLayer.renderVideo = host.settingsModal.renderVideoEnabled;
        host.sfx?.play('hover');
      }
      return;
    }

    const { screenMode, menuMode } = host;

    if (host.bottomBar?.hitTestSettings?.(x, y, vw, vh)) {
      host.settingsModal?.open();
      host.sfx?.play('hover');
      return;
    }

    if (host.bottomBar) {
      const actionSlot = resolveBottomBarActionSlot(host.bottomBar, vw, vh, screenMode, menuMode);
      if (actionSlot !== undefined && host.bottomBar.hitTestAction(x, y, vw, vh, 0, actionSlot)) {
        if (screenMode === 'menu' && menuMode === 'sub') host.selectSubLevel(-1);
        else if (screenMode === 'game') {
          host.stageBgm?.pause(); host.bgmManager?.pause(); host.pauseModal?.open(); host.sfx?.play('hover');
        } else if (screenMode === 'result') host.goToMenu();
        return;
      }
    }

    if (screenMode === 'menu') {
      if (menuMode === 'main') {
        if (host.menuRenderer?.hitTestLocomotion(x, y, vw, vh)) {
          host.locomotionModal?.open();
          host.sfx?.play('hover');
          return;
        }
        const ch = host.menuRenderer?.hitTest(x, y, vw, vh);
        if (ch !== null && ch !== undefined) host.selectChapter(ch);
      } else {
        const subLevels = host.questionBank?.getSubLevels(host.selectedChapter) ?? [];
        const chosen = host.menuRenderer?.hitTestSub(x, y, vw, vh, host.selectedChapter, subLevels);
        if (chosen !== null && chosen !== undefined) host.selectSubLevel(chosen);
      }
    } else if (screenMode === 'game') {
      const normX = x / vw;
      const normY = y / vh;
      const currentState = host.stateMachine.currentState;

      // READY_POSITION 건너뛰기
      if (currentState === 'READY_POSITION' && host.readyPositionController?.isActive) {
        host.readyPositionController.skip();
        return;
      }
      // running 중 클릭 -> 스텝 입력
      if (host.gamePhase === 'running' && !host.pauseModal?.isOpen) {
        host.beatCoordinator?.recordStep();
        host.runningMatRenderer?.triggerMotionHit();
        host.effectManager?.playBurst({
          x: vw * 0.5,
          y: vh * 0.65,
          count: 8,
          colors: ['#28E6FF', '#FFCB4D'],
          duration: 0.3,
        });
        host.onRunningStep?.();
        return;
      }

      // 정답 버튼 클릭 확인
      if (
        !host.pauseModal?.isOpen &&
        host.presentationAdapter?.isAnswerInputAllowed(currentState, host.answerLocked, Boolean(host.beatCoordinator?.isAnswerOpen))
      ) {
        if (host.presentationAdapter?.resolveAnswerClick) {
          const chosen = host.presentationAdapter.resolveAnswerClick(x, y, vw, vh);
          if (chosen !== null) {
            host.sfx?.play('hover');
            host.beatCoordinator?.confirmAnswerByFallback(chosen);
            return;
          }
        }
        if (host.currentQuestion) {
          const buttonLayouts = getAnswerButtonLayouts(vw, vh);
          for (let i = 0; i < 2; i++) {
            const btn = buttonLayouts[i];
            if (x >= btn.x && x <= btn.x + btn.width && y >= btn.y && y <= btn.y + btn.height) {
              if (host.beatCoordinator?.isAnswerOpen) {
                host.sfx?.play('hover');
                host.beatCoordinator?.confirmAnswerByFallback(i);
              }
              return;
            }
          }
        }
      }

      // 가상 페달 (Zone 9, 10, 11) 터치/클릭
      if (normY >= 0.76 && normY <= 1.0) {
        let pedalZone: 9 | 10 | 11 | null = null;
        if (normX < 1 / 3) pedalZone = 9;
        else if (normX < 2 / 3) pedalZone = 10;
        else pedalZone = 11;
        if (pedalZone) {
          const ev = host.footKeynoteInput?.fromVirtualPedal?.(pedalZone, host.engine?.elapsedTime ?? 0);
          if (ev) host.sfx?.play('hover');
        }
      }

      // STAR_COLLECT / BOSS_CLIMAX 존 터치
      if (
        currentState === 'STAR_COLLECT' ||
        currentState === 'BOSS_CLIMAX' ||
        host.beatCoordinator?.phase === 'STAR_COLLECT' ||
        host.beatCoordinator?.phase === 'KEYNOTE_PERFORMANCE'
      ) {
        const hitZone = DEFAULT_FITNESS_ZONES.find((z) => normX >= z.x && normX <= z.x + z.width && normY >= z.y && normY <= z.y + z.height);
        if (hitZone) {
          const elapsedTime = host.engine?.elapsedTime ?? 0;
          host.starNoteScheduler?.fromTouch(hitZone.id, elapsedTime);
          if (currentState === 'BOSS_CLIMAX' && host.bossHazardController && !host.pauseModal?.isOpen) {
            if (hitZone.id === 9) host.bossHazardController.recordAction('step_left');
            else if (hitZone.id === 11) host.bossHazardController.recordAction('step_right');
            else if (hitZone.id === 10) host.bossHazardController.recordAction('jump');
          }
        }
      }

      // HAZARD_EVADE 회피 fallback
      if (currentState === 'HAZARD_EVADE' && !host.pauseModal?.isOpen) {
        const target = host.phaseAHazardController?.activePattern;
        if (target) {
          if (normX < 0.35) host.phaseAHazardController?.recordAction(target === 'balance_right' ? 'balance_right' : 'left_step');
          else if (normX > 0.65) host.phaseAHazardController?.recordAction(target === 'balance_left' ? 'balance_left' : 'right_step');
          else host.phaseAHazardController?.recordAction('jump');
          host.sfx?.play('hover');
        }
      }
    } else if (screenMode === 'result') {
      host.goToMenu();
    }
  }
}
