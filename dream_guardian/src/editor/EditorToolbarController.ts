/**
 * EditorToolbarController.ts - 에디터 툴바, 모달, 단축키 이벤트 전담 컨트롤러 (#626)
 *
 * 책임 분리:
 * 1. 상단 헤더 툴바 버튼 이벤트 바인딩 (재생/정지, 프로젝트 생성/복제/저장/검증/게시/불러오기/내보내기)
 * 2. 배포 및 검증 모달 (Publish Modal) 바인딩 및 렌더링 수명주기 관리
 * 3. 구간 바인딩 모달 (Stage Bindings Panel) 바인딩 및 렌더링 수명주기 관리
 * 4. 배치 도구(Tool) 버튼 바인딩
 * 5. 단축키(Ctrl+Z Undo, Ctrl+Y / Ctrl+Shift+Z Redo, Ctrl+S Save) 바인딩 및 안전 해제
 */

import { EditorState, type PhaseType } from './EditorState.js';
import { EditorLayout } from './EditorLayout.js';
import { EditorPublishController } from './EditorPublishController.js';
import type { AudioSyncController } from './AudioSyncController.js';
import { editorIOHandler } from './EditorIOHandler.js';

export interface EditorToolbarCallbacks {
  updateHeader?: () => void;
  updateSidebar?: () => void;
  updateTimeline?: () => void;
  updateCanvas?: (hoveredZoneId?: number | null) => void;
  updateStatusBar?: () => void;
  updateToolbar?: () => void;
}

export interface EditorToolbarControllerOptions {
  state: EditorState;
  layout: EditorLayout;
  publishController: EditorPublishController;
  audioSync?: AudioSyncController | null;
  ioHandler?: typeof editorIOHandler;
  callbacks?: EditorToolbarCallbacks;
  windowRef?: any;
  documentRef?: any;
}

export class EditorToolbarController {
  private readonly state: EditorState;
  private readonly layout: EditorLayout;
  private readonly publishController: EditorPublishController;
  private readonly audioSync: AudioSyncController | null;
  private readonly ioHandler: typeof editorIOHandler;
  private readonly callbacks: EditorToolbarCallbacks;

  private readonly win: any;
  private readonly doc: any;

  private keyDownHandler: ((e: any) => void) | null = null;

  constructor(options: EditorToolbarControllerOptions) {
    this.state = options.state;
    this.layout = options.layout;
    this.publishController = options.publishController;
    this.audioSync = options.audioSync ?? null;
    this.ioHandler = options.ioHandler ?? editorIOHandler;
    this.callbacks = options.callbacks ?? {};

    this.win = options.windowRef ?? (typeof window !== 'undefined' ? window : null);
    this.doc = options.documentRef ?? (typeof document !== 'undefined' ? document : null);
  }

  public getState(): EditorState {
    return this.state;
  }

  public getLayout(): EditorLayout {
    return this.layout;
  }

  public getPublishController(): EditorPublishController {
    return this.publishController;
  }

  // =========================================================================
  // 1. 배포 및 검증 모달 (Publish Modal) 수명주기 및 이벤트 바인딩
  // =========================================================================

  public async updatePublishModal(): Promise<void> {
    if (!this.doc) return;
    const modalContainer = this.doc.getElementById('publish-modal-container');
    if (modalContainer) {
      const status = await this.publishController.getStatus();
      const versions = await this.publishController.listPublishedVersions();
      modalContainer.innerHTML = this.layout.renderPublishModalHTML(status, versions);
      modalContainer.style.display = modalContainer.classList.contains('hidden') ? 'none' : 'block';
      this.bindPublishModalEvents();
    }
  }

  public async openPublishModal(): Promise<void> {
    if (!this.doc) return;
    const modalContainer = this.doc.getElementById('publish-modal-container');
    if (modalContainer) {
      modalContainer.classList.remove('hidden');
      modalContainer.style.display = 'block';
      await this.updatePublishModal();
    }
  }

  public closePublishModal(): void {
    if (!this.doc) return;
    const modalContainer = this.doc.getElementById('publish-modal-container');
    if (modalContainer) {
      modalContainer.classList.add('hidden');
      modalContainer.style.display = 'none';
    }
  }

  public isPublishModalOpen(): boolean {
    if (!this.doc) return false;
    const modalContainer = this.doc.getElementById('publish-modal-container');
    if (!modalContainer) return false;
    return !modalContainer.classList.contains('hidden') && modalContainer.style.display !== 'none';
  }

  public bindPublishModalEvents(): void {
    if (!this.doc) return;

    const closeBtn = this.doc.getElementById('btn-close-publish-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closePublishModal();
      });
    }

    const validateBtn = this.doc.getElementById('btn-modal-validate');
    if (validateBtn) {
      validateBtn.addEventListener('click', async () => {
        const valRes = await this.publishController.validateProject();
        await this.updatePublishModal();
        this.callbacks.updateStatusBar?.();
        if (valRes.valid) {
          alert('✅ 프로젝트 검증 통과! 게시 가능한 상태입니다.');
        } else {
          alert(`❌ 검증 실패:\n${valRes.errors.join('\n')}`);
        }
      });
    }

    const publishBtn = this.doc.getElementById('btn-modal-publish');
    if (publishBtn) {
      publishBtn.addEventListener('click', async () => {
        if (this.publishController.hasUncommittedChanges()) {
          alert('⚠️ 수정 중인 미완성 폼 입력이 있습니다! 폼을 확정하거나 취소한 후 게시해 주세요.');
          return;
        }

        try {
          const res = await this.publishController.publish({ stageActivation: false });
          await this.updatePublishModal();
          this.callbacks.updateStatusBar?.();
          alert(
            `🚀 새 버전 게시 성공!\n\nContent Hash: ${res.contentHash.slice(0, 16)}...\n\n⚠️ 다음 스테이지 적용을 원하시면 [✨ 다음 스테이지 적용 예약] 버튼을 클릭하세요.`
          );
        } catch (err) {
          alert(`게시 실패:\n${err instanceof Error ? err.message : String(err)}`);
          await this.updatePublishModal();
          this.callbacks.updateStatusBar?.();
        }
      });
    }

    const stageBtn = this.doc.getElementById('btn-modal-stage-activation');
    if (stageBtn) {
      stageBtn.addEventListener('click', async () => {
        try {
          const res = await this.publishController.stageActivation();
          await this.updatePublishModal();
          this.callbacks.updateStatusBar?.();
          alert(
            `✨ 다음 스테이지 적용 예약 완료!\n\n예약 Hash: ${res.stagedHash.slice(0, 16)}...\n\n${this.publishController.getActivationNoticeText()}`
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          alert(`적용 예약 실패:\n${msg}`);
        }
      });
    }

    const rollbackBtn = this.doc.getElementById('btn-modal-rollback');
    if (rollbackBtn) {
      rollbackBtn.addEventListener('click', async () => {
        try {
          const res = await this.publishController.scheduleRollback();
          await this.updatePublishModal();
          this.callbacks.updateStatusBar?.();
          alert(
            `↺ 이전 정상본으로 롤백 예약 완료!\n\n롤백 예약 Hash: ${res.scheduledHash?.slice(0, 16)}...\n\n${this.publishController.getActivationNoticeText()}`
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          alert(`롤백 예약 실패:\n${msg}`);
        }
      });
    }

    const stageVersionBtns = this.doc.querySelectorAll('.btn-stage-version');
    stageVersionBtns.forEach((btn: any) => {
      btn.addEventListener('click', async (e: any) => {
        const hash = (e.target as HTMLElement).getAttribute('data-hash');
        if (hash) {
          try {
            await this.publishController.stageActivation(hash);
            await this.updatePublishModal();
            this.callbacks.updateStatusBar?.();
            alert(
              `✨ 선택한 버전(${hash.slice(0, 10)}...)이 다음 스테이지 적용 예약되었습니다.\n\n${this.publishController.getActivationNoticeText()}`
            );
          } catch (err) {
            alert(`적용 예약 실패: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      });
    });

    const rollbackVersionBtns = this.doc.querySelectorAll('.btn-rollback-version');
    rollbackVersionBtns.forEach((btn: any) => {
      btn.addEventListener('click', async (e: any) => {
        const hash = (e.target as HTMLElement).getAttribute('data-hash');
        if (hash) {
          try {
            await this.publishController.scheduleRollback(hash);
            await this.updatePublishModal();
            this.callbacks.updateStatusBar?.();
            alert(
              `↺ 선택한 버전(${hash.slice(0, 10)}...)으로 롤백 예약되었습니다.\n\n${this.publishController.getActivationNoticeText()}`
            );
          } catch (err) {
            alert(`롤백 예약 실패: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      });
    });

    const modalTestPlayBtn = this.doc.getElementById('btn-modal-test-play');
    if (modalTestPlayBtn) {
      modalTestPlayBtn.addEventListener('click', async () => {
        if (this.publishController.hasUncommittedChanges()) {
          alert('⚠️ 수정 중인 미완성 폼 입력이 있습니다! 폼을 확정하거나 취소한 후 테스트 플레이를 실행해 주세요.');
          return;
        }
        const feedbackEl = this.doc.getElementById('test-launch-feedback');
        const badgeEl = this.doc.getElementById('test-launch-status-badge');
        if (badgeEl) badgeEl.textContent = '실행 중...';
        const res = await this.publishController.launchTestPlay();
        if (feedbackEl) {
          feedbackEl.style.display = 'block';
          feedbackEl.innerHTML = this.layout.renderTestLaunchFeedbackHTML(res);
        }
        if (badgeEl) {
          badgeEl.textContent = res.ok ? '실행 완료' : '실행 실패';
          badgeEl.style.color = res.ok ? '#10B981' : '#EF4444';
        }
        if (!res.ok) {
          alert(`❌ 테스트 플레이 실행 실패:\n${res.error || '알 수 없는 에러'}`);
        }
      });
    }

    const testVersionBtns = this.doc.querySelectorAll('.btn-test-version');
    testVersionBtns.forEach((btn: any) => {
      btn.addEventListener('click', async (e: any) => {
        const hash = (e.target as HTMLElement).getAttribute('data-hash');
        if (hash) {
          const feedbackEl = this.doc.getElementById('test-launch-feedback');
          const badgeEl = this.doc.getElementById('test-launch-status-badge');
          if (badgeEl) badgeEl.textContent = '실행 중...';
          const res = await this.publishController.launchTestPlay(hash);
          if (feedbackEl) {
            feedbackEl.style.display = 'block';
            feedbackEl.innerHTML = this.layout.renderTestLaunchFeedbackHTML(res);
          }
          if (badgeEl) {
            badgeEl.textContent = res.ok ? '실행 완료' : '실행 실패';
            badgeEl.style.color = res.ok ? '#10B981' : '#EF4444';
          }
          if (!res.ok) {
            alert(`❌ 테스트 플레이 실행 실패:\n${res.error || '알 수 없는 에러'}`);
          }
        }
      });
    });
  }

  // =========================================================================
  // 2. 구간 바인딩 모달 (Bindings Panel) 수명주기 및 이벤트 바인딩
  // =========================================================================

  public updateBindingsPanel(): void {
    if (!this.doc) return;
    const modalContainer = this.doc.getElementById('bindings-modal-container');
    if (modalContainer) {
      modalContainer.innerHTML = this.layout.renderStageBindingsPanelHTML();
      this.bindBindingsPanelEvents();
    }
  }

  public openBindingsPanel(): void {
    if (!this.doc) return;
    const modalContainer = this.doc.getElementById('bindings-modal-container');
    if (modalContainer) {
      modalContainer.classList.remove('hidden');
      this.updateBindingsPanel();
    }
  }

  public closeBindingsPanel(): void {
    if (!this.doc) return;
    const modalContainer = this.doc.getElementById('bindings-modal-container');
    if (modalContainer) {
      modalContainer.classList.add('hidden');
    }
  }

  public isBindingsModalOpen(): boolean {
    if (!this.doc) return false;
    const modalContainer = this.doc.getElementById('bindings-modal-container');
    if (!modalContainer) return false;
    return !modalContainer.classList.contains('hidden');
  }

  public bindBindingsPanelEvents(): void {
    if (!this.doc) return;

    const closeBtn = this.doc.getElementById('btn-close-bindings');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closeBindingsPanel();
      });
    }

    const removeBtns = this.doc.querySelectorAll('.btn-remove-binding');
    removeBtns.forEach((btn: any) => {
      btn.addEventListener('click', (e: any) => {
        const idxStr = (e.target as HTMLElement).getAttribute('data-index');
        if (idxStr !== null) {
          const idx = parseInt(idxStr, 10);
          this.state.removeBinding(idx);
          this.updateBindingsPanel();
          this.callbacks.updateStatusBar?.();
        }
      });
    });

    const addBtn = this.doc.getElementById('btn-add-binding');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const chapterEl = this.doc.getElementById('bind-chapter') as HTMLSelectElement;
        const subLevelEl = this.doc.getElementById('bind-sublevel') as HTMLInputElement;
        const phaseEl = this.doc.getElementById('bind-phase') as HTMLSelectElement;
        const seqEl = this.doc.getElementById('bind-seq') as HTMLSelectElement;
        const roleEl = this.doc.getElementById('bind-role') as HTMLSelectElement;

        const chapterId = chapterEl ? chapterEl.value : 'ch1';
        const subLevelId =
          subLevelEl && subLevelEl.value.trim().length > 0 ? subLevelEl.value.trim() : null;
        const phase = (phaseEl ? phaseEl.value : 'phaseA') as any;
        const sequenceId = seqEl ? seqEl.value : '';
        const role = roleEl ? roleEl.value : 'motionGuide';

        const result = this.state.addBinding({
          chapterId,
          subLevelId,
          phase,
          sequenceId,
          role,
        });

        if (!result.success) {
          alert(`바인딩 추가 실패: ${result.error || '유효하지 않은 바인딩입니다.'}`);
        } else {
          this.updateBindingsPanel();
          this.callbacks.updateStatusBar?.();
        }
      });
    }

    const presetSelects = this.doc.querySelectorAll('.select-stage-preset');
    presetSelects.forEach((sel: any) => {
      sel.addEventListener('change', (e: any) => {
        const chapter = (e.target as HTMLElement).getAttribute('data-chapter');
        const val = (e.target as HTMLSelectElement).value;
        if (chapter) {
          this.state.setStageBuiltinProfile(chapter, val || null);
          this.updateBindingsPanel();
          this.callbacks.updateStatusBar?.();
        }
      });
    });
  }

  // =========================================================================
  // 3. 헤더 툴바 컨트롤 및 버튼 이벤트 바인딩
  // =========================================================================

  public bindHeaderToolbar(): void {
    if (!this.doc) return;

    const phaseSelect = this.doc.getElementById('phase-select') as HTMLSelectElement;
    if (phaseSelect) {
      phaseSelect.addEventListener('change', (e: any) => {
        this.state.setSelectedPhase((e.target as HTMLSelectElement).value as PhaseType);
        this.callbacks.updateSidebar?.();
        this.callbacks.updateTimeline?.();
      });
    }

    const bpmInput = this.doc.getElementById('bpm-input') as HTMLInputElement;
    if (bpmInput) {
      bpmInput.addEventListener('change', (e: any) => {
        const val = parseInt((e.target as HTMLInputElement).value, 10);
        this.state.setBpm(val);
        this.audioSync?.setBpm(val);
        this.callbacks.updateSidebar?.();
      });
    }

    const playBtn = this.doc.getElementById('btn-play');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        this.state.togglePlay();
        if (this.state.isPlaying) {
          this.audioSync?.start(this.state.displayBeatToAudioBeat(this.state.currentBeat));
        } else {
          this.audioSync?.stop();
        }
      });
    }

    const stopBtn = this.doc.getElementById('btn-stop');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        this.state.pause();
        this.state.seekBeat(1.0);
        this.audioSync?.stop();
        this.audioSync?.seek(0);
      });
    }

    const newProjectBtn = this.doc.getElementById('btn-new-project');
    if (newProjectBtn) {
      newProjectBtn.addEventListener('click', () => {
        const status = this.state.getProjectPublicationStatus();
        if (
          !status.isClean &&
          !confirm('저장되지 않은 변경사항이 있습니다. 새 프로젝트를 생성하시겠습니까?')
        ) {
          return;
        }
        this.state.newProject();
        this.refreshAllViews();
      });
    }

    const validateProjectBtn = this.doc.getElementById('btn-validate-project');
    if (validateProjectBtn) {
      validateProjectBtn.addEventListener('click', async () => {
        await this.openPublishModal();
        const valRes = await this.publishController.validateProject();
        await this.updatePublishModal();
        this.callbacks.updateStatusBar?.();
        if (valRes.valid) {
          alert('✅ 프로젝트 검증 통과! 규칙 및 제약을 모두 만족합니다.');
        } else {
          alert(`❌ 검증 실패:\n${valRes.errors.join('\n')}`);
        }
      });
    }

    const testPlayBtn = this.doc.getElementById('btn-test-play');
    if (testPlayBtn) {
      testPlayBtn.addEventListener('click', async () => {
        if (this.publishController.hasUncommittedChanges()) {
          alert('⚠️ 수정 중인 미완성 폼 입력이 있습니다! 폼을 확정하거나 취소한 후 테스트 플레이를 실행해 주세요.');
          return;
        }
        const res = await this.publishController.launchTestPlay();
        if (!res.ok) {
          alert(`❌ 테스트 플레이 실행 실패:\n${res.error || '알 수 없는 에러'}`);
        } else {
          alert('🎮 테스트 플레이가 새 탭에서 성공적으로 실행되었습니다!');
        }
      });
    }

    const publishProjectBtn = this.doc.getElementById('btn-publish-project');
    if (publishProjectBtn) {
      publishProjectBtn.addEventListener('click', async () => {
        if (this.publishController.hasUncommittedChanges()) {
          alert('⚠️ 수정 중인 미완성 폼 입력이 있습니다! 폼을 확정하거나 취소한 후 게시해 주세요.');
          return;
        }
        await this.openPublishModal();
        try {
          const res = await this.publishController.publish({ stageActivation: false });
          await this.updatePublishModal();
          this.callbacks.updateStatusBar?.();
          alert(
            `🚀 새 버전이 성공적으로 불변 저장소에 게시되었습니다!\n\nContent Hash: ${res.contentHash.slice(0, 16)}...\n\n⚠️ 다음 스테이지 적용을 원하시면 [✨ 다음 스테이지 적용 예약] 버튼을 클릭하세요.`
          );
        } catch (err) {
          alert(`게시 실패:\n${err instanceof Error ? err.message : String(err)}`);
          await this.updatePublishModal();
          this.callbacks.updateStatusBar?.();
        }
      });
    }

    const manageReleasesBtn = this.doc.getElementById('btn-manage-releases');
    if (manageReleasesBtn) {
      manageReleasesBtn.addEventListener('click', () => {
        const modalContainer = this.doc.getElementById('publish-modal-container');
        if (modalContainer) {
          modalContainer.classList.toggle('hidden');
          if (!modalContainer.classList.contains('hidden')) {
            modalContainer.style.display = 'block';
            this.updatePublishModal();
          } else {
            modalContainer.style.display = 'none';
          }
        }
      });
    }

    const cloneProjectBtn = this.doc.getElementById('btn-clone-project');
    if (cloneProjectBtn) {
      cloneProjectBtn.addEventListener('click', () => {
        const cloned = this.state.cloneProject();
        this.state.applyProject(cloned);
        this.refreshAllViews();
        alert(`프로젝트가 복제되었습니다: ${cloned.projectId}`);
      });
    }

    const manageBindingsBtn = this.doc.getElementById('btn-manage-bindings');
    if (manageBindingsBtn) {
      manageBindingsBtn.addEventListener('click', () => {
        const modalContainer = this.doc.getElementById('bindings-modal-container');
        if (modalContainer) {
          modalContainer.classList.toggle('hidden');
          if (!modalContainer.classList.contains('hidden')) {
            this.updateBindingsPanel();
          }
        }
      });
    }

    const newPatternBtn = this.doc.getElementById('btn-new-pattern');
    if (newPatternBtn) {
      newPatternBtn.addEventListener('click', () => {
        const newId = `CAT_PATTERN_${Date.now().toString().slice(-4)}`;
        const result = this.state.createNewPattern({
          id: newId,
          name: '새 커스텀 안무',
          description: '에디터에서 새로 추가된 안무 패턴',
          motionType: 'low_bounce',
          leftHand: 6,
          rightHand: 8,
          head: null,
          hip: 10,
          footZones: [9, 11],
          partZoneMap: { leftHand: 6, rightHand: 8, hip: 10 },
        });
        if (result.valid) {
          this.state.setSelectedPattern(newId);
        }
      });
    }

    const saveLocalBtn = this.doc.getElementById('btn-save-local');
    if (saveLocalBtn) {
      saveLocalBtn.addEventListener('click', () => {
        this.handleSave(true);
      });
    }

    const exportJsonBtn = this.doc.getElementById('btn-export-json');
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => {
        const json = this.ioHandler.exportFullProjectJSON(this.state);
        this.ioHandler.downloadFile('danceStudio_project.json', json, 'application/json');
      });
    }

    const importJsonBtn = this.doc.getElementById('btn-import-json');
    if (importJsonBtn) {
      importJsonBtn.addEventListener('click', () => {
        if (!this.doc) return;
        const input = this.doc.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e: any) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
              const content = event.target?.result as string;
              const res = await this.ioHandler.openProject(this.state, content, { autoSave: true });
              if (res.success) {
                alert(`✅ 프로젝트 JSON 로드 완료! (ID: ${this.state.currentProjectId})`);
                this.ioHandler.saveToLocalStorage(this.state);
                this.callbacks.updateHeader?.();
                this.callbacks.updateSidebar?.();
                this.callbacks.updateTimeline?.();
                this.callbacks.updateCanvas?.();
              } else {
                alert(`❌ 로드 실패:\n${res.errors.join('\n')}`);
              }
            };
            reader.readAsText(file);
          }
        };
        input.click();
      });
    }

    const exportCsvBtn = this.doc.getElementById('btn-export-csv');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => {
        const csv = this.ioHandler.exportCSV(this.state);
        this.ioHandler.downloadFile('danceRoutineData.csv', csv, 'text/csv;charset=utf-8;');
      });
    }

    const importCsvBtn = this.doc.getElementById('btn-import-csv');
    if (importCsvBtn) {
      importCsvBtn.addEventListener('click', () => {
        if (!this.doc) return;
        const input = this.doc.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = (e: any) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const content = event.target?.result as string;
              const res = this.ioHandler.importCSV(this.state, content);
              if (res.success) {
                alert(`✅ 패턴 CSV 로드 완료! (${res.loadedCount}개 패턴 등록)`);
                this.ioHandler.saveToLocalStorage(this.state);
                this.callbacks.updateSidebar?.();
                this.callbacks.updateCanvas?.();
              } else {
                alert(`❌ CSV 로드 실패:\n${res.errors.join('\n')}`);
              }
            };
            reader.readAsText(file);
          }
        };
        input.click();
      });
    }

    const resetDefaultsBtn = this.doc.getElementById('btn-reset-defaults');
    if (resetDefaultsBtn) {
      resetDefaultsBtn.addEventListener('click', () => {
        if (
          confirm(
            '모든 안무 패턴과 시퀀스를 기본 설정값으로 초기화하시겠습니까?\n(로컬 저장 데이터가 삭제됩니다)'
          )
        ) {
          this.ioHandler.clearLocalStorage();
          if (this.win?.location?.reload) {
            this.win.location.reload();
          }
        }
      });
    }
  }

  // =========================================================================
  // 4. 배치 도구(Tool) 버튼 이벤트 바인딩
  // =========================================================================

  public bindToolButtons(): void {
    if (!this.doc) return;
    const toolBtns = this.doc.querySelectorAll('.tool-btn');
    toolBtns.forEach((btn: any) => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool');
        if (tool) {
          this.state.setActiveTool(tool as any);
          this.callbacks.updateToolbar?.();
          this.callbacks.updateCanvas?.();
        }
      });
    });
  }

  // =========================================================================
  // 5. 단축키 (Undo, Redo, Save) 바인딩 및 조작
  // =========================================================================

  public bindShortcuts(): void {
    if (!this.win) return;
    if (this.keyDownHandler) {
      this.win.removeEventListener('keydown', this.keyDownHandler);
    }

    this.keyDownHandler = (e: any) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      if (!isCtrlOrMeta) return;

      const key = e.key?.toLowerCase();

      // Undo: Ctrl+Z (without shift)
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault?.();
        this.handleUndo();
        return;
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault?.();
        this.handleRedo();
        return;
      }

      // Save: Ctrl+S
      if (key === 's') {
        e.preventDefault?.();
        this.handleSave(false);
        return;
      }
    };

    this.win.addEventListener('keydown', this.keyDownHandler);
  }

  public handleUndo(): boolean {
    const res = this.state.undo();
    if (res.success) {
      this.callbacks.updateHeader?.();
      this.callbacks.updateSidebar?.();
      this.callbacks.updateTimeline?.();
      this.callbacks.updateCanvas?.();
      this.callbacks.updateStatusBar?.();
      return true;
    }
    return false;
  }

  public handleRedo(): boolean {
    const res = this.state.redo();
    if (res.success) {
      this.callbacks.updateHeader?.();
      this.callbacks.updateSidebar?.();
      this.callbacks.updateTimeline?.();
      this.callbacks.updateCanvas?.();
      this.callbacks.updateStatusBar?.();
      return true;
    }
    return false;
  }

  public handleSave(showAlert = true): boolean {
    const saved = this.ioHandler.saveToLocalStorage(this.state);
    if (saved) {
      this.state.markSaved();
      this.callbacks.updateStatusBar?.();
      if (showAlert) {
        alert('💾 프로젝트 데이터가 브라우저 로컬 스토리지에 성공적으로 저장되었습니다!');
      }
      return true;
    } else {
      if (showAlert) {
        alert('⚠️ 저장 실패: 브라우저 스토리지를 사용할 수 없습니다.');
      }
      return false;
    }
  }

  public refreshAllViews(): void {
    this.callbacks.updateHeader?.();
    this.callbacks.updateSidebar?.();
    this.callbacks.updateTimeline?.();
    this.callbacks.updateCanvas?.();
    this.callbacks.updateStatusBar?.();
    this.updateBindingsPanel();
  }

  // =========================================================================
  // 6. 전체 바인딩 및 정리(Dispose)
  // =========================================================================

  public bindAll(): void {
    this.bindHeaderToolbar();
    this.bindToolButtons();
    this.bindShortcuts();
    this.bindPublishModalEvents();
    this.bindBindingsPanelEvents();
  }

  public dispose(): void {
    if (this.keyDownHandler && this.win) {
      this.win.removeEventListener('keydown', this.keyDownHandler);
      this.keyDownHandler = null;
    }
  }
}
