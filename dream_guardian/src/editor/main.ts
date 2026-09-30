/**
 * main.ts - 피트니스 안무 & 비트 타임라인 에디터 브라우저 진입점
 */

import { EditorState, type PhaseType } from './EditorState.js';
import { EditorLayout } from './EditorLayout.js';
import { EditorCanvasRenderer } from './EditorCanvasRenderer.js';
import type { DanceMotionType } from '../data/danceRoutineData.js';

window.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    console.error('#app element not found');
    return;
  }

  const state = new EditorState();
  const layout = new EditorLayout(state);

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
      }
    }
    updatePlayhead();
  };

  const updatePlayhead = () => {
    const playhead = document.getElementById('timeline-playhead');
    const ruler = document.getElementById('timeline-ruler');
    if (playhead && ruler) {
      const routine = state.getCurrentPhaseRoutine();
      const ratio = state.currentBeat / Math.max(1, routine.beats);
      const rulerRect = ruler.getBoundingClientRect();
      const offsetPx = ratio * rulerRect.width;
      playhead.style.left = `${offsetPx}px`;
    }
  };

  const updateCanvas = () => {
    if (canvasRenderer) {
      canvasRenderer.render(state.getSelectedPattern());
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
      state.setBpm(parseInt((e.target as HTMLInputElement).value, 10));
    });
  }

  const playBtn = document.getElementById('btn-play');
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      state.togglePlay();
    });
  }

  const stopBtn = document.getElementById('btn-stop');
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      state.pause();
      state.seekBeat(0);
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

  // 6. 캔버스 클릭 시 인터랙션 (호버 및 클릭 존 선택)
  if (canvas && canvasRenderer) {
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const zoneId = canvasRenderer?.hitTestZone(x, y) ?? null;
      canvasRenderer?.render(state.getSelectedPattern(), zoneId);
    });

    canvas.addEventListener('mouseleave', () => {
      canvasRenderer?.render(state.getSelectedPattern(), null);
    });
  }

  // 7. 상태 변경 리스너 등록
  state.addListener({
    onStateChange: () => {
      updateHeader();
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
  updateCanvas();

  // 8. 오디오 비트 재생 루프 (60fps requestAnimationFrame)
  let lastTime = performance.now();
  function animationLoop(time: number) {
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    if (state.isPlaying) {
      const secondsPerBeat = 60 / state.bpm;
      const deltaBeats = dt / secondsPerBeat;
      const nextBeat = state.currentBeat + deltaBeats;
      const maxBeats = state.getCurrentPhaseRoutine().beats;

      if (nextBeat >= maxBeats) {
        state.seekBeat(nextBeat % maxBeats);
      } else {
        state.seekBeat(nextBeat);
      }
    }

    requestAnimationFrame(animationLoop);
  }
  requestAnimationFrame(animationLoop);
});
