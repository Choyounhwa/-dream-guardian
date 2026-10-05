/**
 * main.ts - 피트니스 안무 & 비트 타임라인 에디터 브라우저 진입점
 */

import { EditorState, type PhaseType } from './EditorState.js';
import { EditorLayout } from './EditorLayout.js';
import { EditorCanvasRenderer } from './EditorCanvasRenderer.js';
import { AudioSyncController } from './AudioSyncController.js';
import { editorIOHandler } from './EditorIOHandler.js';
import type { BodyCursorPart } from './PoseConstraintValidator.js';
import type { DanceMotionType } from '../data/danceRoutineData.js';

window.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    console.error('#app element not found');
    return;
  }

  const state = new EditorState();
  // 스토어 최신 Head 및 레거시 로컬 스토리지 비파괴적 복원
  editorIOHandler
    .restoreLatestProject(state)
    .then((res) => {
      if (res.success) {
        updateHeader();
        updateSidebar();
        updateTimeline();
        updateCanvas();
      }
    })
    .catch((err) => {
      console.warn('[Editor] Failed to restore project:', err);
    });

  const layout = new EditorLayout(state);
  const timelineRenderer = layout.timelineRenderer;
  const audioSync = new AudioSyncController({ bpm: state.bpm, enableAudioNode: true });

  // 1. 전체 레이아웃 렌더링
  appContainer.innerHTML = layout.renderFullLayoutHTML();

  // 2. 캔버스 렌더러 초기화
  const canvas = document.getElementById('editor-canvas') as HTMLCanvasElement;
  let canvasRenderer: EditorCanvasRenderer | null = null;
  if (canvas) {
    // 고해상도 DPI 대응
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = (rect.width || 800) * dpr;
    canvas.height = (rect.height || 600) * dpr;
    canvasRenderer = new EditorCanvasRenderer(canvas);
  }

  // 3. 뷰 새로고침 함수들
  const updateStatusBar = () => {
    const statusBarContainer = document.getElementById('editor-status-bar-container');
    if (statusBarContainer) {
      statusBarContainer.innerHTML = layout.renderStatusBarHTML();
    }
  };

  const updateBindingsPanel = () => {
    const modalContainer = document.getElementById('bindings-modal-container');
    if (modalContainer) {
      modalContainer.innerHTML = layout.renderStageBindingsPanelHTML();
      bindBindingsPanelEvents();
    }
  };

  const bindBindingsPanelEvents = () => {
    const closeBtn = document.getElementById('btn-close-bindings');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        const modalContainer = document.getElementById('bindings-modal-container');
        if (modalContainer) modalContainer.classList.add('hidden');
      });
    }

    const removeBtns = document.querySelectorAll('.btn-remove-binding');
    removeBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const idxStr = (e.target as HTMLElement).getAttribute('data-index');
        if (idxStr !== null) {
          const idx = parseInt(idxStr, 10);
          state.removeBinding(idx);
          updateBindingsPanel();
          updateStatusBar();
        }
      });
    });

    const addBtn = document.getElementById('btn-add-binding');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const chapterEl = document.getElementById('bind-chapter') as HTMLSelectElement;
        const subLevelEl = document.getElementById('bind-sublevel') as HTMLInputElement;
        const phaseEl = document.getElementById('bind-phase') as HTMLSelectElement;
        const seqEl = document.getElementById('bind-seq') as HTMLSelectElement;
        const roleEl = document.getElementById('bind-role') as HTMLSelectElement;

        const chapterId = chapterEl ? chapterEl.value : 'ch1';
        const subLevelId = subLevelEl && subLevelEl.value.trim().length > 0 ? subLevelEl.value.trim() : null;
        const phase = (phaseEl ? phaseEl.value : 'phaseA') as any;
        const sequenceId = seqEl ? seqEl.value : '';
        const role = roleEl ? roleEl.value : 'motionGuide';

        const result = state.addBinding({
          chapterId,
          subLevelId,
          phase,
          sequenceId,
          role,
        });

        if (!result.success) {
          alert(`바인딩 추가 실패: ${result.error || '유효하지 않은 바인딩입니다.'}`);
        } else {
          updateBindingsPanel();
          updateStatusBar();
        }
      });
    }

    const presetSelects = document.querySelectorAll('.select-stage-preset');
    presetSelects.forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const chapter = (e.target as HTMLElement).getAttribute('data-chapter');
        const val = (e.target as HTMLSelectElement).value;
        if (chapter) {
          state.setStageBuiltinProfile(chapter, val || null);
          updateBindingsPanel();
          updateStatusBar();
        }
      });
    });
  };

  const updateSidebar = () => {
    const sidebarEl = document.querySelector('.editor-sidebar');
    if (sidebarEl) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = layout.renderSidebarHTML();
      const newSidebar = tempDiv.firstElementChild;
      if (newSidebar) {
        sidebarEl.replaceWith(newSidebar);
        bindSidebarEvents();
      }
    }
  };

  const updateHeader = () => {
    const isPlaying = state.isPlaying;
    const playBtn = document.getElementById('btn-play');
    if (playBtn) {
      playBtn.className = `btn ${isPlaying ? 'btn-pause' : 'btn-play'}`;
      playBtn.textContent = isPlaying ? '⏸ 일시정지' : '▶ 재생';
    }

    const beatDisplay = document.getElementById('beat-display');
    if (beatDisplay) {
      const routine = state.getCurrentPhaseRoutine();
      beatDisplay.textContent = `Beat: ${state.currentBeat.toFixed(1)} / ${routine.beats}`;
    }
  };

  const updateTimeline = () => {
    const timelineEl = document.querySelector('.editor-timeline-panel');
    if (timelineEl) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = layout.renderTimelineHTML();
      const newTimeline = tempDiv.firstElementChild;
      if (newTimeline) {
        timelineEl.replaceWith(newTimeline);
        bindTimelineEvents();
      }
    }
    updatePlayhead();
  };

  const updatePlayhead = () => {
    const playhead = document.getElementById('timeline-playhead');
    if (playhead) {
      const routine = state.getCurrentPhaseRoutine();
      const percent = timelineRenderer.beatToPercent(state.currentBeat, routine.beats);
      playhead.style.left = `${percent}%`;
    }
  };

  const bindTimelineEvents = () => {
    // 1. 노트 블록 클릭 선택 및 해당 비트 즉시 탐색
    const noteBlocks = document.querySelectorAll('.note-block');
    noteBlocks.forEach((block) => {
      block.addEventListener('click', (e) => {
        e.stopPropagation();
        const noteId = block.getAttribute('data-note-id');
        if (noteId) {
          state.setSelectedNoteId(noteId);
          const currentNotes = state.getCurrentPhaseNotes();
          const targetNote = currentNotes.find((n) => n.id === noteId);
          if (targetNote) {
            state.seekBeat(targetNote.startBeat);
            audioSync.seek(state.displayBeatToAudioBeat(targetNote.startBeat));
          }
          updateTimeline();
          updateCanvas();
        }
      });
    });

    // 2. 타임라인 레인 클릭 시 비트 스크러빙 (#383: 트랙 컨텐츠 영역 기준 pixelToBeat 변환)
    const tracksContainer = document.querySelector('.timeline-tracks-wrapper');
    if (tracksContainer) {
      tracksContainer.addEventListener('click', (e) => {
        const laneContent = (e.target as HTMLElement).closest('.lane-content') as HTMLElement ||
          document.querySelector('.lane-content') as HTMLElement;
        const rect = laneContent
          ? laneContent.getBoundingClientRect()
          : tracksContainer.getBoundingClientRect();

        const clickX = (e as MouseEvent).clientX - rect.left;
        if (clickX < 0) return; // 레인 태그 클릭 무시

        const routine = state.getCurrentPhaseRoutine();
        const rawBeat = timelineRenderer.pixelToBeat(clickX, rect.width, routine.beats);
        const snapped = timelineRenderer.snapBeat(rawBeat, 0.5);
        state.seekBeat(snapped);
        audioSync.seek(state.displayBeatToAudioBeat(snapped));
        updateTimeline();
        updateCanvas();
      });
    }

    // 3. 눈금자(Ruler) 트랙 영역 클릭 시 비트 스크러빙 (#383)
    const rulerContent = document.querySelector('.ruler-track-content');
    if (rulerContent) {
      rulerContent.addEventListener('click', (e) => {
        const rect = rulerContent.getBoundingClientRect();
        const clickX = (e as MouseEvent).clientX - rect.left;
        if (clickX < 0) return;

        const routine = state.getCurrentPhaseRoutine();
        const rawBeat = timelineRenderer.pixelToBeat(clickX, rect.width, routine.beats);
        const snapped = timelineRenderer.snapBeat(rawBeat, 0.5);
        state.seekBeat(snapped);
        audioSync.seek(state.displayBeatToAudioBeat(snapped));
        updateTimeline();
        updateCanvas();
      });
    }
  };

  const updateToolbar = () => {
    const toolBtns = document.querySelectorAll('.tool-btn');
    toolBtns.forEach((btn) => {
      const tool = btn.getAttribute('data-tool');
      if (tool === state.activeTool) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  };

  const updateCanvas = (hoveredZoneId?: number | null) => {
    if (canvasRenderer) {
      const simulatedFrame = state.computeCurrentPoseFrame();
      canvasRenderer.render(state.getSelectedPattern(), {
        hoveredZoneId: hoveredZoneId ?? null,
        activeTool: state.activeTool,
        validation: state.getDetailedValidation(),
        simulatedFrame,
        showSkeleton: state.showSimulation,
      });
    }
  };

  const bindWorkspaceEvents = () => {
    const toggleSimBtn = document.getElementById('btn-toggle-simulation');
    if (toggleSimBtn) {
      toggleSimBtn.addEventListener('click', () => {
        state.toggleSimulation();
        toggleSimBtn.className = `btn btn-sm ${state.showSimulation ? 'btn-accent' : 'btn-secondary'}`;
        toggleSimBtn.textContent = state.showSimulation ? '💃 시뮬레이션: ON' : '🧍 시뮬레이션: OFF';
        updateCanvas();
      });
    }
  };

  // 4. 사이드바 이벤트 바인딩
  const bindSidebarEvents = () => {
    // 패턴 카드 클릭
    const cards = document.querySelectorAll('.pattern-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-pattern-id');
        if (id) {
          state.setSelectedPattern(id);
        }
      });
    });

    // 패턴 시퀀스 명시적 적용 버튼
    const applySeqBtn = document.getElementById('btn-apply-sequence');
    if (applySeqBtn) {
      applySeqBtn.addEventListener('click', () => {
        state.applyPatternToSequence();
        updateTimeline();
        updateCanvas();
      });
    }

    // 패턴 복제 버튼
    const dupBtn = document.getElementById('btn-duplicate-pattern');
    if (dupBtn) {
      dupBtn.addEventListener('click', () => {
        state.duplicateCurrentPattern();
      });
    }

    // 패턴 삭제 버튼
    const delBtn = document.getElementById('btn-delete-pattern');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        if (confirm('현재 선택된 패턴을 삭제하시겠습니까?')) {
          state.deleteCurrentPattern();
        }
      });
    }

    // 패턴 속성 입력 이벤트
    const nameInput = document.getElementById('pattern-name-input') as HTMLInputElement;
    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        state.updateCurrentPattern({ name: (e.target as HTMLInputElement).value });
      });
    }

    const motionSelect = document.getElementById('pattern-motion-select') as HTMLSelectElement;
    if (motionSelect) {
      motionSelect.addEventListener('change', (e) => {
        state.updateCurrentPattern({
          motionType: (e.target as HTMLSelectElement).value as DanceMotionType,
        });
      });
    }

    const descInput = document.getElementById('pattern-desc-input') as HTMLTextAreaElement;
    if (descInput) {
      descInput.addEventListener('input', (e) => {
        state.updateCurrentPattern({ description: (e.target as HTMLTextAreaElement).value });
      });
    }

    // 신체 부위 존 선택 이벤트
    const bindZoneSelect = (id: string, key: 'leftHand' | 'rightHand' | 'head' | 'hip') => {
      const el = document.getElementById(id) as HTMLSelectElement;
      if (el) {
        el.addEventListener('change', (e) => {
          const val = (e.target as HTMLSelectElement).value;
          state.updateCurrentPattern({
            [key]: val === '' ? null : parseInt(val, 10),
          });
        });
      }
    };

    bindZoneSelect('select-left-hand', 'leftHand');
    bindZoneSelect('select-right-hand', 'rightHand');
    bindZoneSelect('select-head', 'head');
    bindZoneSelect('select-hip', 'hip');

    // 발 디딤 존 체크박스
    const updateFootZones = () => {
      const zones: number[] = [];
      [9, 10, 11].forEach((z) => {
        const chk = document.getElementById(`foot-zone-${z}`) as HTMLInputElement;
        if (chk && chk.checked) {
          zones.push(z);
        }
      });
      state.updateCurrentPattern({ footZones: zones });
    };

    [9, 10, 11].forEach((z) => {
      const chk = document.getElementById(`foot-zone-${z}`) as HTMLInputElement;
      if (chk) {
        chk.addEventListener('change', updateFootZones);
      }
    });

    // 별 수집 7슬롯 편집 UI 이벤트 (#384)
    const slotItems = document.querySelectorAll('.star-slot-item');
    slotItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'SELECT' || target.tagName === 'BUTTON' || target.closest('.slot-error-badge')) {
          return;
        }
        const noteId = item.getAttribute('data-note-id');
        if (noteId) {
          state.setSelectedNoteId(noteId);
        }
      });
    });

    const partSelects = document.querySelectorAll('.star-part-select');
    partSelects.forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const slotIdxStr = (e.target as HTMLElement).getAttribute('data-slot-index');
        if (slotIdxStr === null) return;
        const slotIdx = parseInt(slotIdxStr, 10);
        const part = (e.target as HTMLSelectElement).value as any;
        const currentBuffer = state.getFormBuffer(slotIdx);
        const currentSlot = state.getStarSlots()[slotIdx];
        const defaultZone = part === 'foot' ? 10 : 3;
        const currentZone = currentBuffer?.zoneId ?? currentSlot?.zoneId;
        const zoneId =
          part === 'foot'
            ? (currentZone >= 9 && currentZone <= 11 ? currentZone : 10)
            : (currentZone >= 1 && currentZone <= 5 ? currentZone : defaultZone);
        state.setFormBuffer(slotIdx, {
          part,
          zoneId,
        });
        updateSidebar();
      });
    });

    const zoneSelects = document.querySelectorAll('.star-zone-select');
    zoneSelects.forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const slotIdxStr = (e.target as HTMLElement).getAttribute('data-slot-index');
        if (slotIdxStr === null) return;
        const slotIdx = parseInt(slotIdxStr, 10);
        const zoneId = parseInt((e.target as HTMLSelectElement).value, 10);
        const currentBuffer = state.getFormBuffer(slotIdx);
        const currentSlot = state.getStarSlots()[slotIdx];
        state.setFormBuffer(slotIdx, {
          part: currentBuffer?.part ?? currentSlot?.part,
          zoneId,
        });
        updateSidebar();
      });
    });

    const applyBtns = document.querySelectorAll('.btn-apply-slot');
    applyBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slotIdxStr = (e.target as HTMLElement).getAttribute('data-slot-index');
        if (slotIdxStr === null) return;
        const slotIdx = parseInt(slotIdxStr, 10);
        const res = state.applyFormBuffer(slotIdx);
        if (!res.valid) {
          alert(`슬롯 적용 실패: ${res.lockReason || res.diagnostics[0]?.message}`);
        }
        updateSidebar();
        updateTimeline();
        updateCanvas();
      });
    });

    const clearBtns = document.querySelectorAll('.btn-clear-slot');
    clearBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slotIdxStr = (e.target as HTMLElement).getAttribute('data-slot-index');
        if (slotIdxStr === null) return;
        const slotIdx = parseInt(slotIdxStr, 10);
        state.clearFormBuffer(slotIdx);
        updateSidebar();
      });
    });

    const errorBadges = document.querySelectorAll('.slot-error-badge');
    errorBadges.forEach((badge) => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const entityId = badge.getAttribute('data-error-entity');
        const path = badge.getAttribute('data-error-path') || 'target.zoneId';
        if (entityId) {
          state.focusError(entityId, path);
          updateSidebar();
          updateTimeline();
        }
      });
    });
  };

  // 5. 헤더 툴바 이벤트 바인딩
  const phaseSelect = document.getElementById('phase-select') as HTMLSelectElement;
  if (phaseSelect) {
    phaseSelect.addEventListener('change', (e) => {
      state.setSelectedPhase((e.target as HTMLSelectElement).value as PhaseType);
      updateTimeline();
    });
  }

  const bpmInput = document.getElementById('bpm-input') as HTMLInputElement;
  if (bpmInput) {
    bpmInput.addEventListener('change', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      state.setBpm(val);
      audioSync.setBpm(val);
    });
  }

  const playBtn = document.getElementById('btn-play');
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      state.togglePlay();
      if (state.isPlaying) {
        audioSync.start(state.displayBeatToAudioBeat(state.currentBeat));
      } else {
        audioSync.stop();
      }
    });
  }

  const stopBtn = document.getElementById('btn-stop');
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      state.pause();
      state.seekBeat(1.0);
      audioSync.stop();
      audioSync.seek(0);
    });
  }

  // 프로젝트 제어 버튼들 (#385)
  const newProjectBtn = document.getElementById('btn-new-project');
  if (newProjectBtn) {
    newProjectBtn.addEventListener('click', () => {
      const status = state.getProjectPublicationStatus();
      if (!status.isClean && !confirm('저장되지 않은 변경사항이 있습니다. 새 프로젝트를 생성하시겠습니까?')) {
        return;
      }
      state.newProject();
      updateHeader();
      updateSidebar();
      updateTimeline();
      updateCanvas();
      updateStatusBar();
      updateBindingsPanel();
    });
  }

  const cloneProjectBtn = document.getElementById('btn-clone-project');
  if (cloneProjectBtn) {
    cloneProjectBtn.addEventListener('click', () => {
      const cloned = state.cloneProject();
      state.applyProject(cloned);
      updateHeader();
      updateSidebar();
      updateTimeline();
      updateCanvas();
      updateStatusBar();
      updateBindingsPanel();
      alert(`프로젝트가 복제되었습니다: ${cloned.projectId}`);
    });
  }

  const manageBindingsBtn = document.getElementById('btn-manage-bindings');
  if (manageBindingsBtn) {
    manageBindingsBtn.addEventListener('click', () => {
      const modalContainer = document.getElementById('bindings-modal-container');
      if (modalContainer) {
        modalContainer.classList.toggle('hidden');
        if (!modalContainer.classList.contains('hidden')) {
          updateBindingsPanel();
        }
      }
    });
  }

  // 신규 패턴 생성 버튼
  const newPatternBtn = document.getElementById('btn-new-pattern');
  if (newPatternBtn) {
    newPatternBtn.addEventListener('click', () => {
      const newId = `CAT_PATTERN_${Date.now().toString().slice(-4)}`;
      const result = state.createNewPattern({
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
        state.setSelectedPattern(newId);
      }
    });
  }

  // 5.1 로컬 수동 저장 버튼
  const saveLocalBtn = document.getElementById('btn-save-local');
  if (saveLocalBtn) {
    saveLocalBtn.addEventListener('click', () => {
      const saved = editorIOHandler.saveToLocalStorage(state);
      if (saved) {
        state.markSaved();
        updateStatusBar();
        alert('💾 프로젝트 데이터가 브라우저 로컬 스토리지에 성공적으로 저장되었습니다!');
      } else {
        alert('⚠️ 저장 실패: 브라우저 스토리지를 사용할 수 없습니다.');
      }
    });
  }

  // 5.2 JSON 내보내기 버튼 (전체 프로젝트 패키지)
  const exportJsonBtn = document.getElementById('btn-export-json');
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const json = editorIOHandler.exportFullProjectJSON(state);
      editorIOHandler.downloadFile('danceStudio_project.json', json, 'application/json');
    });
  }

  // 5.3 JSON 불러오기 버튼
  const importJsonBtn = document.getElementById('btn-import-json');
  if (importJsonBtn) {
    importJsonBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const content = event.target?.result as string;
            const res = await editorIOHandler.openProject(state, content, { autoSave: true });
            if (res.success) {
              alert(`✅ 프로젝트 JSON 로드 완료! (ID: ${state.currentProjectId})`);
              editorIOHandler.saveToLocalStorage(state);
              updateHeader();
              updateSidebar();
              updateTimeline();
              updateCanvas();
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

  // 5.4 CSV 내보내기 버튼
  const exportCsvBtn = document.getElementById('btn-export-csv');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const csv = editorIOHandler.exportCSV(state);
      editorIOHandler.downloadFile('danceRoutineData.csv', csv, 'text/csv;charset=utf-8;');
    });
  }

  // 5.5 CSV 불러오기 버튼
  const importCsvBtn = document.getElementById('btn-import-csv');
  if (importCsvBtn) {
    importCsvBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const content = event.target?.result as string;
            const res = editorIOHandler.importCSV(state, content);
            if (res.success) {
              alert(`✅ 패턴 CSV 로드 완료! (${res.loadedCount}개 패턴 등록)`);
              editorIOHandler.saveToLocalStorage(state);
              updateSidebar();
              updateCanvas();
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

  // 5.6 기본값 초기화 버튼
  const resetDefaultsBtn = document.getElementById('btn-reset-defaults');
  if (resetDefaultsBtn) {
    resetDefaultsBtn.addEventListener('click', () => {
      if (confirm('모든 안무 패턴과 시퀀스를 기본 설정값으로 초기화하시겠습니까?\n(로컬 저장 데이터가 삭제됩니다)')) {
        editorIOHandler.clearLocalStorage();
        location.reload();
      }
    });
  }

  // 6. 배치 도구(Tool) 버튼 이벤트 바인딩
  const bindToolButtons = () => {
    const toolBtns = document.querySelectorAll('.tool-btn');
    toolBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool');
        if (tool) {
          state.setActiveTool(tool as any);
          updateToolbar();
          updateCanvas();
        }
      });
    });
  };
  bindToolButtons();

  // 7. 캔버스 인터랙션 (커서 직접 클릭 선택, 드래그&드롭, 피트니스존 이동)
  if (canvas && canvasRenderer) {
    let isDragging = false;
    let draggedPart: BodyCursorPart | 'foot' | null = null;
    let dragStartX = 0;
    let dragStartY = 0;

    const getCanvasCoords = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };

    canvas.addEventListener('mousedown', (e) => {
      const { x, y } = getCanvasCoords(e);
      const hitCursor = canvasRenderer?.hitTestCursor(
        x,
        y,
        state.getSelectedPattern(),
        state.computeCurrentPoseFrame()
      );

      if (hitCursor) {
        isDragging = true;
        draggedPart = hitCursor;
        dragStartX = x;
        dragStartY = y;
        state.setActiveTool(hitCursor);
        updateToolbar();
        canvas.style.cursor = 'grabbing';

        canvasRenderer?.render(state.getSelectedPattern(), {
          hoveredZoneId: canvasRenderer?.hitTestZone(x, y),
          activeTool: hitCursor,
          validation: state.getDetailedValidation(),
          simulatedFrame: state.computeCurrentPoseFrame(),
          showSkeleton: state.showSimulation,
          dragState: { part: hitCursor, x, y },
        });
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      const { x, y } = getCanvasCoords(e);
      const zoneId = canvasRenderer?.hitTestZone(x, y) ?? null;

      if (isDragging && draggedPart) {
        canvas.style.cursor = 'grabbing';
        canvasRenderer?.render(state.getSelectedPattern(), {
          hoveredZoneId: zoneId,
          activeTool: draggedPart,
          validation: state.getDetailedValidation(),
          simulatedFrame: state.computeCurrentPoseFrame(),
          showSkeleton: state.showSimulation,
          dragState: { part: draggedPart, x, y },
        });
      } else {
        const hitCursor = canvasRenderer?.hitTestCursor(
          x,
          y,
          state.getSelectedPattern(),
          state.computeCurrentPoseFrame()
        );
        canvas.style.cursor = hitCursor ? 'grab' : state.activeTool !== 'inspect' ? 'crosshair' : 'default';
        updateCanvas(zoneId);
      }
    });

    canvas.addEventListener('mouseup', (e) => {
      if (isDragging && draggedPart) {
        const { x, y } = getCanvasCoords(e);
        const distMoved = Math.hypot(x - dragStartX, y - dragStartY);
        const zoneId = canvasRenderer?.hitTestZone(x, y);

        // 일정 거리 이상 드래그 후 존 위에서 뗐을 때 해당 존으로 커서 이동 할당
        if (distMoved > 12 && zoneId !== null && zoneId !== undefined) {
          state.assignPartToZone(draggedPart, zoneId);
          updateSidebar();
        }

        isDragging = false;
        draggedPart = null;
        canvas.style.cursor = 'default';
        updateCanvas(zoneId);
      }
    });

    canvas.addEventListener('mouseleave', () => {
      if (isDragging) {
        isDragging = false;
        draggedPart = null;
      }
      updateCanvas(null);
    });

    canvas.addEventListener('click', (e) => {
      const { x, y } = getCanvasCoords(e);
      const hitCursor = canvasRenderer?.hitTestCursor(
        x,
        y,
        state.getSelectedPattern(),
        state.computeCurrentPoseFrame()
      );

      // 1. 신체 커서를 클릭한 경우 -> 해당 부위 선택
      if (hitCursor) {
        state.setActiveTool(hitCursor);
        updateToolbar();
        updateCanvas();
        return;
      }

      // 2. 부위가 선택된 상태에서 피트니스 존을 클릭한 경우 -> 해당 존으로 이동 할당
      if (state.activeTool !== 'inspect') {
        const zoneId = canvasRenderer?.hitTestZone(x, y);
        if (zoneId !== null && zoneId !== undefined) {
          state.assignPartToZone(state.activeTool, zoneId);
          updateSidebar();
          updateCanvas(zoneId);
        }
      }
    });
  }

  // 8. 상태 변경 리스너 등록 & LocalStorage 디바운스 자동 저장
  let autoSaveTimer: any = null;
  const triggerAutoSave = () => {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
      try {
        await editorIOHandler.saveDraft(state);
        state.markSaved();
        updateStatusBar();
      } catch (err) {
        console.warn('[Editor] Store auto-save failed:', err);
      }
      editorIOHandler.saveToLocalStorage(state);
    }, 800);
  };

  state.addListener({
    onDocumentChange: () => {
      triggerAutoSave();
      updateStatusBar();
      updateBindingsPanel();
    },
    onStateChange: () => {
      updateHeader();
      updateToolbar();
      updateStatusBar();
    },
    onPatternChange: () => {
      updateSidebar();
      updateCanvas();
    },
    onPhaseChange: () => {
      updateTimeline();
    },
    onPlayStateChange: () => {
      updateHeader();
    },
    onBeatUpdate: () => {
      updateHeader();
      updatePlayhead();
    },
  });

  // 초기 사이드바 이벤트 및 캔버스 렌더링
  bindSidebarEvents();
  bindWorkspaceEvents();
  bindTimelineEvents();
  bindBindingsPanelEvents();
  updateToolbar();
  updateCanvas();
  updateStatusBar();

  // 9. 오디오 비트 재생 루프 (AudioSyncController와 실시간 동기화, #383 루프 경계 완주 보장)
  function animationLoop() {
    if (state.isPlaying) {
      const audioBeat = audioSync.getCurrentBeat();
      const currentNotes = state.getCurrentPhaseNotes();
      const routine = state.getCurrentPhaseRoutine();
      const displayBeat = state.audioBeatToDisplayBeat ? state.audioBeatToDisplayBeat(audioBeat) : (audioBeat + 1);

      if (timelineRenderer.shouldLoop(displayBeat, routine.beats, currentNotes)) {
        audioSync.seek(0);
        state.seekBeat(1.0);
      } else {
        state.seekBeat(displayBeat);
      }
      updateHeader();
      updatePlayhead();
      updateCanvas();
    }

    requestAnimationFrame(animationLoop);
  }
  requestAnimationFrame(animationLoop);
});
