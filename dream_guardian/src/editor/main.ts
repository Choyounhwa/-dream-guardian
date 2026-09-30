/**
 * main.ts - 피트니스 안무 & 비트 타임라인 에디터 브라우저 진입점
 */

import { EditorState, type PhaseType } from './EditorState.js';
import { EditorLayout } from './EditorLayout.js';
import { EditorCanvasRenderer } from './EditorCanvasRenderer.js';
import { AudioSyncController } from './AudioSyncController.js';
import type { DanceMotionType } from '../data/danceRoutineData.js';

window.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    console.error('#app element not found');
    return;
  }

  const state = new EditorState();
  const layout = new EditorLayout(state);
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
    const container = document.querySelector('.timeline-tracks-wrapper') as HTMLElement;
    if (playhead && container) {
      const routine = state.getCurrentPhaseRoutine();
      const ratio = state.currentBeat / Math.max(1, routine.beats);
      const percent = Math.max(0, Math.min(100, ratio * 100));
      playhead.style.left = `${percent}%`;
    }
  };

  const bindTimelineEvents = () => {
    // 1. 노트 블록 클릭 선택
    const noteBlocks = document.querySelectorAll('.note-block');
    noteBlocks.forEach((block) => {
      block.addEventListener('click', (e) => {
        e.stopPropagation();
        const noteId = block.getAttribute('data-note-id');
        if (noteId) {
          state.setSelectedNoteId(noteId);
          updateTimeline();
        }
      });
    });

    // 2. 타임라인 레인 클릭 시 비트 스크러빙
    const tracksContainer = document.querySelector('.timeline-tracks-wrapper');
    if (tracksContainer) {
      tracksContainer.addEventListener('click', (e) => {
        const rect = tracksContainer.getBoundingClientRect();
        const clickX = (e as MouseEvent).clientX - rect.left;
        const routine = state.getCurrentPhaseRoutine();
        const targetBeat = Math.max(0, Math.min(routine.beats, (clickX / rect.width) * routine.beats));
        const snapped = Math.round(targetBeat * 2) / 2; // 0.5 beat snap
        state.seekBeat(snapped);
        audioSync.seek(snapped);
        updateTimeline();
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
        audioSync.start(state.currentBeat);
      } else {
        audioSync.stop();
      }
    });
  }

  const stopBtn = document.getElementById('btn-stop');
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      state.pause();
      state.seekBeat(0);
      audioSync.stop();
      audioSync.seek(0);
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

  // JSON 내보내기 버튼
  const exportJsonBtn = document.getElementById('btn-export-json');
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const json = state.registry.toJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'danceRoutineData.json';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // JSON 불러오기 버튼
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
          reader.onload = (event) => {
            const content = event.target?.result as string;
            const res = state.registry.loadFromJSON(content);
            alert(`JSON 불러오기 완료! (${res.loadedCount}개 패턴 로드)`);
            updateSidebar();
            updateCanvas();
          };
          reader.readAsText(file);
        }
      };
      input.click();
    });
  }

  // CSV 내보내기 버튼
  const exportCsvBtn = document.getElementById('btn-export-csv');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const csv = state.registry.toCSV();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'danceRoutineData.csv';
      a.click();
      URL.revokeObjectURL(url);
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

  // 7. 캔버스 인터랙션 (호버 및 클릭 존 직접 할당)
  if (canvas && canvasRenderer) {
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const zoneId = canvasRenderer?.hitTestZone(x, y) ?? null;
      updateCanvas(zoneId);
    });

    canvas.addEventListener('mouseleave', () => {
      updateCanvas(null);
    });

    canvas.addEventListener('click', (e) => {
      if (state.activeTool === 'inspect') return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const zoneId = canvasRenderer?.hitTestZone(x, y);
      if (zoneId !== null && zoneId !== undefined) {
        state.assignPartToZone(state.activeTool, zoneId);
        updateSidebar();
        updateCanvas(zoneId);
      }
    });
  }

  // 8. 상태 변경 리스너 등록
  state.addListener({
    onStateChange: () => {
      updateHeader();
      updateToolbar();
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
  updateToolbar();
  updateCanvas();

  // 9. 오디오 비트 재생 루프 (AudioSyncController와 실시간 동기화)
  function animationLoop() {
    if (state.isPlaying) {
      const audioBeat = audioSync.getCurrentBeat();
      const maxBeats = state.getCurrentPhaseRoutine().beats;

      if (audioBeat >= maxBeats) {
        audioSync.seek(0);
        state.seekBeat(0);
      } else {
        state.seekBeat(audioBeat);
      }
      updateCanvas();
    }

    requestAnimationFrame(animationLoop);
  }
  requestAnimationFrame(animationLoop);
});
