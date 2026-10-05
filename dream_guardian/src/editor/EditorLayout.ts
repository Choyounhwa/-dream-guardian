/**
 * EditorLayout.ts - 피트니스 안무 & 비트 타임라인 에디터 3단 반응형 UI 레이아웃 및 뷰 렌더러
 */

import { EditorState, type PhaseType } from './EditorState.js';
import type { DanceMotionType } from '../data/danceRoutineData.js';
import { BeatTimelineRenderer } from './BeatTimelineRenderer.js';

export interface TimelineMarker {
  beat: number;
  label: string;
}

export interface ValidationBadgeInfo {
  status: 'valid' | 'invalid';
  message: string;
  errors: string[];
}

export class EditorLayout {
  private readonly _state: EditorState;
  private readonly _timelineRenderer: BeatTimelineRenderer;

  constructor(state: EditorState) {
    this._state = state;
    this._timelineRenderer = new BeatTimelineRenderer();
  }

  get timelineRenderer(): BeatTimelineRenderer {
    return this._timelineRenderer;
  }

  getTimelineRenderer(): BeatTimelineRenderer {
    return this._timelineRenderer;
  }

  /**
   * 상단 헤더 및 툴바 HTML 렌더링
   */
  renderHeaderHTML(): string {
    const bpm = this._state.bpm;
    const currentPhase = this._state.selectedPhase;
    const isPlaying = this._state.isPlaying;
    const routine = this._state.getCurrentPhaseRoutine();

    const phases: Array<{ value: PhaseType; label: string }> = [
      { value: 'RUN_QUESTION', label: '1. 문제 페이즈 (8박 바운스)' },
      { value: 'ANSWER_SELECT', label: '2. 답선택 페이즈 (2박 즉시선택)' },
      { value: 'STAR_COLLECT', label: '3. 별모으기 페이즈 (7박 키노트)' },
      { value: 'FEVER_PHASE_B', label: '4. 피버 결전 (16박 풀루프)' },
    ];

    const phaseOptions = phases
      .map(
        (p) =>
          `<option value="${p.value}" ${p.value === currentPhase ? 'selected' : ''}>${p.label}</option>`
      )
      .join('');

    return `
      <header class="editor-header">
        <div class="header-left">
          <span class="editor-logo">🐱 댄스 안무 & 비트 에디터</span>
          <span class="editor-subtitle">Dream Guardian Dance Studio</span>
        </div>

        <div class="header-center">
          <div class="control-group">
            <label for="phase-select">페이즈:</label>
            <select id="phase-select" class="editor-select">
              ${phaseOptions}
            </select>
          </div>

          <div class="control-group">
            <label for="bpm-input">BPM:</label>
            <input id="bpm-input" type="number" min="40" max="240" value="${bpm}" class="editor-input-number" />
          </div>

          <div class="playback-controls">
            <button id="btn-play" class="btn ${isPlaying ? 'btn-pause' : 'btn-play'}">
              ${isPlaying ? '⏸ 일시정지' : '▶ 재생'}
            </button>
            <button id="btn-stop" class="btn btn-secondary">⏹ 정지</button>
            <span id="beat-display" class="beat-display">Beat: ${this._state.currentBeat.toFixed(1)} / ${routine.beats}</span>
          </div>
        </div>

        <div class="header-right">
          <button id="btn-new-project" class="btn btn-outline" title="새 프로젝트 만들기">📄 새 프로젝트</button>
          <button id="btn-clone-project" class="btn btn-outline" title="프로젝트 복제">📑 프로젝트 복제</button>
          <button id="btn-manage-bindings" class="btn btn-outline" title="스테이지 및 구간 바인딩 관리">🔗 구간 바인딩</button>
          <button id="btn-new-pattern" class="btn btn-accent">+ 새 패턴</button>
          <button id="btn-save-local" class="btn btn-primary" title="로컬 브라우저 저장">💾 저장</button>
          <button id="btn-export-json" class="btn btn-outline" title="전체 프로젝트 JSON 파일 다운로드">JSON 내보내기</button>
          <button id="btn-import-json" class="btn btn-outline" title="프로젝트 JSON 파일 불러오기">JSON 불러오기</button>
          <button id="btn-export-csv" class="btn btn-outline" title="패턴 CSV 다운로드">CSV 내보내기</button>
          <button id="btn-import-csv" class="btn btn-outline" title="패턴 CSV 불러오기">CSV 불러오기</button>
          <button id="btn-reset-defaults" class="btn btn-ghost" title="기본값으로 복원">↺ 초기화</button>
          <a href="./index.html" class="btn btn-ghost" target="_blank">🎮 게임 실행</a>
        </div>
      </header>
    `.trim();
  }

  /**
   * 좌측 패널(Sidebar): 안무 패턴 목록 및 선택된 패턴 속성 편집기 HTML 렌더링
   */
  renderSidebarHTML(): string {
    const patterns = this._state.getPatterns();
    const selected = this._state.getSelectedPattern();
    const badge = this.getValidationBadge();

    const patternCards = patterns
      .map((p) => {
        const isSel = selected && selected.id === p.id;
        return `
          <div class="pattern-card ${isSel ? 'selected' : ''}" data-pattern-id="${p.id}">
            <div class="pattern-card-header">
              <span class="pattern-id">${p.id}</span>
              <span class="pattern-badge badge-${p.motionType}">${p.motionType}</span>
            </div>
            <div class="pattern-name">${p.name}</div>
          </div>
        `;
      })
      .join('');

    const motionTypes: Array<{ value: DanceMotionType; label: string }> = [
      { value: 'low_bounce', label: '로우바운스 & 오픈스텝 (low_bounce)' },
      { value: 'sky_point_right', label: '우측 스카이포인트 (sky_point_right)' },
      { value: 'center_clasp', label: '가슴모으기 & 힙스웨이 (center_clasp)' },
      { value: 'sky_point_left', label: '좌측 스카이포인트 (sky_point_left)' },
    ];

    const motionOptions = motionTypes
      .map(
        (m) =>
          `<option value="${m.value}" ${selected?.motionType === m.value ? 'selected' : ''}>${m.label}</option>`
      )
      .join('');

    const renderZoneSelect = (id: string, currentVal: number | null, allowed: number[], label: string) => {
      let opts = `<option value="" ${currentVal === null ? 'selected' : ''}>없음 (미사용)</option>`;
      for (const z of allowed) {
        opts += `<option value="${z}" ${currentVal === z ? 'selected' : ''}>Zone ${z}</option>`;
      }
      return `
        <div class="form-row">
          <label for="${id}">${label}:</label>
          <select id="${id}" class="editor-select zone-select">
            ${opts}
          </select>
        </div>
      `;
    };

    const isFootZoneChecked = (zone: number) => {
      return selected?.footZones?.includes(zone) ? 'checked' : '';
    };

    const isStarCollect = this._state.selectedPhase === 'STAR_COLLECT';
    const starSlotSection = isStarCollect ? this.renderStarSlotEditorHTML() : '';

    return `
      <aside class="editor-sidebar">
        ${starSlotSection}
        <section class="sidebar-section pattern-details-section">
          <div class="section-title">
            <span>패턴 속성 편집</span>
          </div>

          ${
            selected
              ? `
            <div class="form-group">
              <label for="pattern-id-input">패턴 ID:</label>
              <input id="pattern-id-input" type="text" value="${selected.id}" disabled class="editor-input disabled" />
            </div>

            <div class="form-group">
              <label for="pattern-name-input">패턴 이름:</label>
              <input id="pattern-name-input" type="text" value="${selected.name}" class="editor-input" />
            </div>

            <div class="form-group">
              <label for="pattern-motion-select">모션 타입:</label>
              <select id="pattern-motion-select" class="editor-select">
                ${motionOptions}
              </select>
            </div>

            <div class="form-group">
              <label for="pattern-desc-input">설명:</label>
              <textarea id="pattern-desc-input" class="editor-textarea" rows="2">${selected.description}</textarea>
            </div>

            <div class="section-subtitle">부위별 피트니스 존 매핑</div>

            ${renderZoneSelect('select-left-hand', selected.leftHand, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], '왼손 (시안 #28E6FF)')}
            ${renderZoneSelect('select-right-hand', selected.rightHand, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], '오른손 (노랑 #FFCB4D)')}
            ${renderZoneSelect('select-head', selected.head, [4, 5], '머리 (보라 #C889FF)')}
            ${renderZoneSelect('select-hip', selected.hip, [6, 8, 9, 10, 11], '골반 (주황 #FF865E)')}

            <div class="form-row">
              <label>발 디딤 존 (Foot):</label>
              <div class="checkbox-group">
                <label class="checkbox-item"><input type="checkbox" id="foot-zone-9" value="9" ${isFootZoneChecked(9)}> Zone 9</label>
                <label class="checkbox-item"><input type="checkbox" id="foot-zone-10" value="10" ${isFootZoneChecked(10)}> Zone 10</label>
                <label class="checkbox-item"><input type="checkbox" id="foot-zone-11" value="11" ${isFootZoneChecked(11)}> Zone 11</label>
              </div>
            </div>

            <div id="validation-box" class="validation-box ${badge.status}">
              <div class="validation-title">${badge.message}</div>
              ${
                badge.errors.length > 0
                  ? `<ul class="validation-errors">${badge.errors.map((e) => `<li>${e}</li>`).join('')}</ul>`
                  : ''
              }
            </div>
          `
              : `<div class="empty-state">선택된 패턴이 없습니다.</div>`
          }
        </section>

        <section class="sidebar-section">
          <div class="section-title">
            <span>안무 패턴 목록 (${patterns.length})</span>
          </div>
          <div class="sidebar-action-bar">
            <button id="btn-apply-sequence" class="btn btn-sm btn-outline" title="현재 패턴을 타임라인 시퀀스에 적용">⚡ 시퀀스에 적용</button>
            <button id="btn-duplicate-pattern" class="btn btn-sm btn-secondary" title="현재 선택된 패턴 복제">📑 패턴 복제</button>
            <button id="btn-delete-pattern" class="btn btn-sm btn-danger" title="현재 패턴 삭제" ${patterns.length <= 1 ? 'disabled' : ''}>🗑 삭제</button>
          </div>
          <div class="pattern-list">
            ${patternCards}
          </div>
        </section>
      </aside>
    `.trim();
  }

  /**
   * 별 수집(STAR_COLLECT) 7슬롯 편집 UI HTML 렌더링 (#384)
   */
  renderStarSlotEditorHTML(): string {
    const slots = this._state.getStarSlots();
    const selectedNoteId = this._state.selectedNoteId;
    const focusedError = this._state.getFocusedError();

    const slotsHTML = slots
      .map((slot) => {
        const idx = slot.slotIndex;
        const slotNumber = slot.slotNumber;
        const buffer = this._state.getFormBuffer(idx);
        const activePart = buffer?.part ?? slot.part;
        const activeZone = buffer?.zoneId ?? slot.zoneId;
        const isSelected = selectedNoteId === slot.noteId;
        const isErrorFocused = focusedError?.entityId === slot.noteId;

        const hasBufferErrors = Boolean(buffer?.errors && buffer.errors.length > 0);
        const firstErrorMsg = buffer?.errors?.[0] ?? '';
        const firstDiagPath = buffer?.diagnostics?.[0]?.path ?? 'target.zoneId';

        let zoneOptionsHTML = '';
        if (activePart === 'foot') {
          for (let z = 9; z <= 11; z++) {
            zoneOptionsHTML += `<option value="${z}" ${activeZone === z ? 'selected' : ''}>Zone ${z} (발)</option>`;
          }
        } else {
          for (let z = 1; z <= 5; z++) {
            zoneOptionsHTML += `<option value="${z}" ${activeZone === z ? 'selected' : ''}>Zone ${z} (손)</option>`;
          }
        }

        const isZoneInvalid =
          (activePart === 'foot' && (activeZone < 9 || activeZone > 11)) ||
          ((activePart === 'leftHand' || activePart === 'rightHand') && (activeZone < 1 || activeZone > 5));
        if (isZoneInvalid) {
          zoneOptionsHTML += `<option value="${activeZone}" selected disabled>Zone ${activeZone} (허용 범위 외)</option>`;
        }

        const isPartFocused = isErrorFocused && focusedError?.path === 'target.part';
        const isZoneFocused = isErrorFocused && focusedError?.path === 'target.zoneId';

        return `
          <div class="star-slot-item ${isSelected ? 'active-slot' : ''} ${isErrorFocused ? 'has-error-focus' : ''}"
               data-slot-index="${idx}"
               data-note-id="${slot.noteId}">
            <div class="slot-header">
              <span class="slot-badge">슬롯 ${slotNumber}</span>
              <span class="slot-timing">Beat ${slot.beat} (${slot.tick} tick)</span>
            </div>

            <div class="form-row">
              <label for="star-part-${idx}">부위:</label>
              <select id="star-part-${idx}"
                      class="editor-select star-part-select ${isPartFocused ? 'field-error-focus' : ''}"
                      data-slot-index="${idx}">
                <option value="leftHand" ${activePart === 'leftHand' ? 'selected' : ''}>왼손 (leftHand, Zone 1~5)</option>
                <option value="rightHand" ${activePart === 'rightHand' ? 'selected' : ''}>오른손 (rightHand, Zone 1~5)</option>
                <option value="foot" ${activePart === 'foot' ? 'selected' : ''}>발 (foot, Zone 9~11)</option>
                ${activePart === 'head' ? '<option value="head" selected disabled>머리 (head, 잠김)</option>' : ''}
                ${activePart === 'hip' ? '<option value="hip" selected disabled>골반 (hip, 잠김)</option>' : ''}
              </select>
            </div>

            <div class="form-row">
              <label for="star-zone-${idx}">존:</label>
              <select id="star-zone-${idx}"
                      class="editor-select star-zone-select ${isZoneFocused ? 'field-error-focus' : ''}"
                      data-slot-index="${idx}">
                ${zoneOptionsHTML}
              </select>
            </div>

            ${
              hasBufferErrors
                ? `
              <div class="slot-error-badge"
                   data-error-entity="${slot.noteId}"
                   data-error-path="${firstDiagPath}"
                   title="클릭하여 오류 위치로 이동">
                <span class="badge-icon">⚠️</span>
                <span class="badge-msg">${firstErrorMsg}</span>
              </div>
            `
                : ''
            }

            ${
              buffer?.isDirty
                ? `
              <div class="slot-buffer-actions">
                <button type="button" class="btn btn-sm btn-primary btn-apply-slot" data-slot-index="${idx}">적용</button>
                <button type="button" class="btn btn-sm btn-secondary btn-clear-slot" data-slot-index="${idx}">취소</button>
              </div>
            `
                : ''
            }
          </div>
        `;
      })
      .join('');

    return `
      <section class="sidebar-section star-slot-editor-section" id="star-slot-editor">
        <div class="section-title">
          <span>별 수집 7슬롯 편집</span>
        </div>
        <div class="slot-editor-meta">
          <small>고정 7박 (2~8박) | 손 (Zone 1~5), 발 (Zone 9~11) 전용</small>
        </div>
        <div class="star-slots-container">
          ${slotsHTML}
        </div>
      </section>
    `;
  }

  /**
   * 중앙 캔버스 워크스페이스 HTML 렌더링
   */
  renderWorkspaceHTML(): string {
    const selected = this._state.getSelectedPattern();
    const activeTool = this._state.activeTool;

    return `
      <main class="editor-workspace">
        <div class="workspace-toolbar">
          <div class="tool-selector-group">
            <span class="tool-label">배치 도구:</span>
            <button class="tool-btn ${activeTool === 'inspect' ? 'active' : ''}" data-tool="inspect">🔍 조회</button>
            <button class="tool-btn tool-lh ${activeTool === 'leftHand' ? 'active' : ''}" data-tool="leftHand">✋ 왼손 (#28E6FF)</button>
            <button class="tool-btn tool-rh ${activeTool === 'rightHand' ? 'active' : ''}" data-tool="rightHand">🤚 오른손 (#FFCB4D)</button>
            <button class="tool-btn tool-head ${activeTool === 'head' ? 'active' : ''}" data-tool="head">👤 머리 (#C889FF)</button>
            <button class="tool-btn tool-hip ${activeTool === 'hip' ? 'active' : ''}" data-tool="hip">🥋 골반 (#FF865E)</button>
            <button class="tool-btn tool-foot ${activeTool === 'foot' ? 'active' : ''}" data-tool="foot">🦶 발 (#10B981)</button>
          </div>
          <div class="mode-toggles">
            <button id="btn-toggle-simulation" class="btn btn-sm ${this._state.showSimulation ? 'btn-accent' : 'btn-secondary'}">
              ${this._state.showSimulation ? '💃 시뮬레이션: ON' : '🧍 시뮬레이션: OFF'}
            </button>
            <span class="active-pattern-label">${selected ? `현재 패턴: <strong>${selected.name}</strong>` : ''}</span>
          </div>
        </div>

        <div class="canvas-wrapper">
          <canvas id="editor-canvas" width="800" height="600"></canvas>
        </div>

        <div class="workspace-footer">
          <div class="legend-group">
            <span class="legend-title">신체 커서:</span>
            <span class="legend-item cursor-lh"><span class="dot"></span> 왼손 (#28E6FF)</span>
            <span class="legend-item cursor-rh"><span class="dot"></span> 오른손 (#FFCB4D)</span>
            <span class="legend-item cursor-head"><span class="dot"></span> 머리 (#C889FF)</span>
            <span class="legend-item cursor-hip"><span class="dot"></span> 골반 (#FF865E)</span>
            <span class="legend-item cursor-foot"><span class="dot"></span> 발 (#10B981)</span>
          </div>
          <div class="legend-info">
            💡 <strong>직관적 조작:</strong> 캔버스의 신체 커서를 마우스로 드래그하여 피트니스 존에 놓거나, 커서를 클릭 후 이동할 피트니스 존을 클릭하세요!
          </div>
        </div>
      </main>
    `.trim();
  }

  /**
   * 하단 타임라인 패널 HTML 렌더링
   */
  renderTimelineHTML(): string {
    const routine = this._state.getCurrentPhaseRoutine();
    const markers = this.getTimelineMarkers();

    const rulerTicks = markers
      .map(
        (m) => `
        <div class="ruler-tick" data-beat="${m.beat}">
          <span class="tick-label">${m.label}</span>
          <div class="tick-line"></div>
        </div>
      `
      )
      .join('');

    return `
      <section class="editor-timeline-panel">
        <div class="timeline-header">
          <div class="timeline-info">
            <span class="timeline-badge">${routine.phase}</span>
            <span class="timeline-prompt">${routine.prompt}</span>
          </div>
          <div class="timeline-meta">
            <span>총 ${routine.beats}박</span>
          </div>
        </div>

        <div class="timeline-container">
          <div id="timeline-ruler" class="timeline-ruler">
            <div class="ruler-lane-tag-spacer lane-tag" style="width: 80px; flex-shrink: 0; border-right: 1px solid var(--border-color, rgba(255,255,255,0.1));"></div>
            <div class="ruler-track-content" style="flex: 1; display: flex; position: relative;">
              ${rulerTicks}
            </div>
          </div>

          <div id="timeline-tracks" class="timeline-tracks">
            ${this._timelineRenderer.renderTimelineTracksHTML(
              routine.phase,
              this._state.getCurrentPhaseNotes(),
              this._state.currentBeat,
              routine.beats,
              this._state.selectedNoteId
            )}
          </div>
        </div>
      </section>
    `.trim();
  }

  /**
   * 현재 상태 기준 유효성 검증 배지 정보 계산
   */
  getValidationBadge(): ValidationBadgeInfo {
    const selected = this._state.getSelectedPattern();
    if (!selected) {
      return { status: 'valid', message: '선택된 패턴 없음', errors: [] };
    }
    const result = this._state.getDetailedValidation();
    if (result.valid) {
      return {
        status: 'valid',
        message: '✅ 정상 포즈 (물리 제약 통과)',
        errors: [],
      };
    }
    return {
      status: 'invalid',
      message: '⚠️ 제약 위반 경고',
      errors: result.violations.map((v) => v.message),
    };
  }

  /**
   * 현재 페이즈 기준 타임라인 비트 마커 생성
   */
  getTimelineMarkers(): TimelineMarker[] {
    const beats = this._state.getCurrentPhaseRoutine().beats;
    const markers: TimelineMarker[] = [];
    for (let b = 1; b <= beats; b++) {
      const bar = Math.floor((b - 1) / 4) + 1;
      const beatInBar = ((b - 1) % 4) + 1;
      markers.push({
        beat: b,
        label: `B${b} (${bar}.${beatInBar})`,
      });
    }
    return markers;
  }

  /**
   * 하단 상태 표시줄(Status Bar) HTML 렌더링
   */
  renderStatusBarHTML(): string {
    const status = this._state.getProjectPublicationStatus();
    const coverage = this._state.getStageCoverageStatus();
    const saveLabel = status.isClean ? '저장됨' : '미저장';
    const saveClass = status.isClean ? 'status-clean' : 'status-dirty';
    const pubLabel = status.isPublished ? '게시됨' : '미게시 초안';
    const pubClass = status.isPublished ? 'status-published' : 'status-unpublished';
    const covLabel = coverage.isComplete
      ? '스테이지 완료 (5/5)'
      : `${coverage.boundStages.length + coverage.builtinStages.length}/5 커버`;

    return `
      <div id="editor-status-bar" class="editor-status-bar">
        <div class="status-left">
          <span class="status-item project-title"><strong>${this._state.metadata.title}</strong> (${this._state.currentProjectId})</span>
          <span class="status-badge status-revision">Draft rev.${status.currentRevision}</span>
          <span class="status-badge ${saveClass}">${saveLabel}</span>
          <span class="status-badge ${pubClass}">${pubLabel}</span>
        </div>
        <div class="status-right">
          <span class="status-badge status-coverage">${covLabel}</span>
        </div>
      </div>
    `.trim();
  }

  /**
   * 구간 및 스테이지 연결 패널(Stage Bindings Panel) HTML 렌더링
   */
  renderStageBindingsPanelHTML(): string {
    const bindings = this._state.getBindings();
    const sequences = this._state.getSequences();
    const coverage = this._state.getStageCoverageStatus();

    const bindingsRows = bindings
      .map((b, idx) => {
        const seq = sequences.find((s) => s.id === b.sequenceId);
        const role = b.role || seq?.kind || 'motionGuide';
        const compoundKey = `${b.chapterId}::${b.subLevelId ?? 'all'}::${b.phase}::${role}`;
        return `
          <tr class="binding-row" data-binding-index="${idx}">
            <td class="binding-key"><code>${compoundKey}</code></td>
            <td>${b.chapterId}</td>
            <td>${b.subLevelId ?? '(all)'}</td>
            <td>${b.phase}</td>
            <td>${b.sequenceId}</td>
            <td>${role}</td>
            <td>
              <button type="button" class="btn btn-sm btn-danger btn-remove-binding" data-index="${idx}">삭제</button>
            </td>
          </tr>
        `;
      })
      .join('');

    const stageCoverageRows = coverage.stages
      .map((st) => {
        const statusBadge =
          st.status === 'bound'
            ? '<span class="badge badge-success">바인딩 완료</span>'
            : st.status === 'builtin'
            ? `<span class="badge badge-info">내장 프리셋 (${st.builtinProfile})</span>`
            : st.status === 'partial'
            ? '<span class="badge badge-warning">부분 미완성 (Partial)</span>'
            : '<span class="badge badge-danger">누락 (Missing)</span>';

        return `
          <tr class="stage-row" data-chapter="${st.chapterId}">
            <td><strong>${st.chapterId.toUpperCase()}</strong></td>
            <td>${statusBadge}</td>
            <td>
              <select class="editor-select select-stage-preset" data-chapter="${st.chapterId}">
                <option value="" ${!st.builtinProfile ? 'selected' : ''}>프리셋 없음 (직접 바인딩)</option>
                <option value="${st.chapterId}-default-v2" ${st.builtinProfile === `${st.chapterId}-default-v2` ? 'selected' : ''}>${st.chapterId}-default-v2</option>
                <option value="${st.chapterId}-challenge-v2" ${st.builtinProfile === `${st.chapterId}-challenge-v2` ? 'selected' : ''}>${st.chapterId}-challenge-v2</option>
              </select>
            </td>
          </tr>
        `;
      })
      .join('');

    return `
      <div class="stage-bindings-panel" id="stage-bindings-panel">
        <div class="panel-header">
          <div class="panel-header-title">
            <h3>🔗 스테이지 구간 바인딩 & 프리셋 관리</h3>
            <span class="panel-status ${coverage.isComplete ? 'coverage-ok' : 'coverage-warn'}">
              ${coverage.isComplete ? '전체 스테이지 매핑 완료' : '일부 스테이지 미완성 / 누락'}
            </span>
          </div>
          <button id="btn-close-bindings" type="button" class="btn btn-ghost">✕ 닫기</button>
        </div>

        <!-- 미지원 잠금(Lock) 배지 및 알림 영역 -->
        <div class="lock-notices">
          <div class="lock-badge-item">
            <span class="badge-lock">🔒 미지원: Phase A 장판(Hazard) 트랙 잠금 (Locked)</span>
            <small class="lock-desc">Phase A 장판 인터랙션은 런타임 제약으로 인해 저작이 잠겨 있습니다.</small>
          </div>
          <div class="lock-badge-item">
            <span class="badge-lock">🔒 미지원: Phase B 피버 결전 장판(Hazard) 잠금 (Locked)</span>
            <small class="lock-desc">Phase B 피버 결전 장판 트랙은 저작이 잠겨 있습니다.</small>
          </div>
        </div>

        <!-- 스테이지 커버리지 현황 -->
        <div class="panel-section">
          <h4>스테이지별 커버리지 및 내장 프리셋</h4>
          <table class="bindings-table stage-table">
            <thead>
              <tr><th>스테이지</th><th>상태</th><th>내장 프리셋 설정</th></tr>
            </thead>
            <tbody>
              ${stageCoverageRows}
            </tbody>
          </table>
        </div>

        <!-- 활성 바인딩 목록 -->
        <div class="panel-section">
          <h4>활성 구간 바인딩 목록 (${bindings.length}개)</h4>
          <table class="bindings-table">
            <thead>
              <tr><th>Compound Key</th><th>Chapter</th><th>SubLevel</th><th>Phase</th><th>Sequence ID</th><th>Role</th><th>작업</th></tr>
            </thead>
            <tbody>
              ${bindingsRows}
            </tbody>
          </table>
        </div>

        <!-- 새 바인딩 추가 폼 -->
        <div class="panel-section add-binding-form">
          <h4>새 구간 바인딩 추가</h4>
          <div class="form-grid">
            <div class="form-row">
              <label for="bind-chapter">Chapter:</label>
              <select id="bind-chapter" class="editor-select">
                <option value="ch1">Chapter 1 (ch1)</option>
                <option value="ch2">Chapter 2 (ch2)</option>
                <option value="ch3">Chapter 3 (ch3)</option>
                <option value="ch4">Chapter 4 (ch4)</option>
                <option value="ch5">Chapter 5 (ch5)</option>
              </select>
            </div>
            <div class="form-row">
              <label for="bind-sublevel">SubLevel ID:</label>
              <input id="bind-sublevel" type="text" class="editor-input" placeholder="star_collect, run_question 등 (선택)" />
            </div>
            <div class="form-row">
              <label for="bind-phase">Phase:</label>
              <select id="bind-phase" class="editor-select">
                <option value="phaseA">phaseA</option>
                <option value="phaseB">phaseB</option>
              </select>
            </div>
            <div class="form-row">
              <label for="bind-seq">Sequence:</label>
              <select id="bind-seq" class="editor-select">
                ${sequences.map((s) => `<option value="${s.id}">${s.id} (${s.phase} / ${s.kind})</option>`).join('')}
              </select>
            </div>
            <div class="form-row">
              <label for="bind-role">Role:</label>
              <select id="bind-role" class="editor-select">
                <option value="starNotes">starNotes</option>
                <option value="motionGuide">motionGuide</option>
                <option value="feverNotes">feverNotes</option>
                <option value="hazard" disabled>hazard (🔒 잠금 / 미지원)</option>
              </select>
            </div>
          </div>
          <button id="btn-add-binding" type="button" class="btn btn-primary">+ 바인딩 추가</button>
        </div>
      </div>
    `.trim();
  }

  /**
   * 전체 에디터 3단 레이아웃 통합 HTML 생성
   */
  renderFullLayoutHTML(): string {
    return `
      <div class="editor-app-container">
        ${this.renderHeaderHTML()}
        <div class="editor-body">
          ${this.renderSidebarHTML()}
          ${this.renderWorkspaceHTML()}
        </div>
        ${this.renderTimelineHTML()}
        <div id="bindings-modal-container" class="bindings-modal-container hidden">
          ${this.renderStageBindingsPanelHTML()}
        </div>
        <footer id="editor-status-bar-container">
          ${this.renderStatusBarHTML()}
        </footer>
      </div>
    `.trim();
  }
}
