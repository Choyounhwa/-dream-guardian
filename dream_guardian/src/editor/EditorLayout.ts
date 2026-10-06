/**
 * EditorLayout.ts - 피트니스 안무 & 비트 타임라인 에디터 3단 반응형 UI 레이아웃 및 뷰 렌더러
 */

import { EditorState, type PhaseType } from './EditorState.js';
import type { DanceMotionType } from '../data/danceRoutineData.js';
import { BeatTimelineRenderer } from './BeatTimelineRenderer.js';
import type { EditorPublishStatus, TestLaunchResult } from './EditorPublishController.js';
import type { PublishedPackSummary } from '../storage/PublishedContentStore.js';

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
          <button id="btn-validate-project" class="btn btn-outline" title="프로젝트 무결성 및 규칙 검증">🔍 검증</button>
          <button id="btn-test-play" class="btn btn-primary" title="게시된 활성본 격리 테스트 플레이 (Issue #391)">🎮 테스트 플레이</button>
          <button id="btn-publish-project" class="btn btn-accent" title="새 버전 불변 게시">🚀 게시</button>
          <button id="btn-manage-releases" class="btn btn-outline" title="게시본 및 다음 스테이지 적용 예약 관리">📦 릴리즈 관리</button>
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
  renderStatusBarHTML(publishStatus?: EditorPublishStatus | null): string {
    const status = this._state.getProjectPublicationStatus();
    const coverage = this._state.getStageCoverageStatus();
    const saveLabel = status.isClean ? '저장됨' : '미저장';
    const saveClass = status.isClean ? 'status-clean' : 'status-dirty';
    const pubLabel = status.isPublished ? '게시됨' : '미게시 초안';
    const pubClass = status.isPublished ? 'status-published' : 'status-unpublished';
    const covLabel = coverage.isComplete
      ? '스테이지 완료 (5/5)'
      : `${coverage.boundStages.length + coverage.builtinStages.length}/5 커버`;

    const activeBadge = publishStatus?.activeContentHash
      ? `<span class="status-badge status-active-hash" title="현재 활성 게시본: ${publishStatus.activeContentHash}">Active: ${publishStatus.activeContentHash.slice(0, 8)}...</span>`
      : '';

    const stagedBadge = publishStatus?.stagedActivationHash
      ? `<span class="status-badge status-staged-hash" title="다음 스테이지 시작 시 적용 예약됨 (현재 세션 즉시 반영 아님)">Staged: ${publishStatus.stagedActivationHash.slice(0, 8)}... (Next Stage)</span>`
      : '';

    return `
      <div id="editor-status-bar" class="editor-status-bar">
        <div class="status-left">
          <span class="status-item project-title"><strong>${this._state.metadata.title}</strong> (${this._state.currentProjectId})</span>
          <span class="status-badge status-revision">Draft rev.${status.currentRevision}</span>
          <span class="status-badge ${saveClass}">${saveLabel}</span>
          <span class="status-badge ${pubClass}">${pubLabel}</span>
          ${activeBadge}
          ${stagedBadge}
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
   * 프로젝트 검증·게시 및 릴리즈 관리 모달(Publish & Release Modal) HTML 렌더링
   */
  renderPublishModalHTML(
    status?: EditorPublishStatus | null,
    versions: PublishedPackSummary[] = []
  ): string {
    const isDirty = status?.isFormDirty ?? false;
    const activeHash = status?.activeContentHash ?? '없음 (기본 프리셋)';
    const stagedHash = status?.stagedActivationHash ?? '예약 없음';
    const prevHealthy = status?.previousHealthyHash ?? '없음';
    const lastHash = status?.lastPublishedHash ?? '없음';
    const validation = status?.lastValidation;

    // 검증 결과 UI 블록
    let validationHTML = '';
    if (validation) {
      const statusBadge = validation.valid
        ? '<span class="badge badge-success" style="background:#10B981; color:#fff; padding:3px 8px; border-radius:4px;">✅ 검증 통과 (게시 준비 완료)</span>'
        : '<span class="badge badge-danger" style="background:#EF4444; color:#fff; padding:3px 8px; border-radius:4px;">❌ 검증 실패</span>';

      const errorList =
        validation.errors.length > 0
          ? `<ul class="publish-error-list" style="color:#EF4444; margin:8px 0; padding-left:20px;">${validation.errors.map((e) => `<li>${e}</li>`).join('')}</ul>`
          : '';

      const warnList =
        validation.warnings.length > 0
          ? `<ul class="publish-warn-list" style="color:#F59E0B; margin:8px 0; padding-left:20px;">${validation.warnings.map((w) => `<li>${w}</li>`).join('')}</ul>`
          : '';

      const diffHTML = validation.diffSummary
        ? `
          <div class="diff-summary-box" style="background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:4px; margin-top:8px;">
            <div><strong>변경 요약:</strong> ${validation.diffSummary.summaryText}</div>
            <div style="margin-top:4px;"><small>산출 Content Hash: <code>${validation.contentHash || '-'}</code></small></div>
          </div>
        `
        : '';

      validationHTML = `
        <div class="panel-section validation-section" style="margin:16px 0; padding:12px; background:rgba(0,0,0,0.2); border-radius:6px; border:1px solid var(--border-color, #272f4a);">
          <div style="font-weight:600; margin-bottom:6px;">검증 상태: ${statusBadge}</div>
          ${errorList}
          ${warnList}
          ${diffHTML}
        </div>
      `;
    }

    const versionRows =
      versions.length === 0
        ? '<tr><td colspan="5" style="text-align:center; color:#888; padding:12px;">게시된 버전이 없습니다.</td></tr>'
        : versions
            .map((v) => {
              const isActive = v.contentHash === status?.activeContentHash;
              const isStaged = v.contentHash === status?.stagedActivationHash;
              const stateBadge = isActive
                ? '<span class="badge badge-success" style="background:#10B981; color:#fff; padding:2px 6px; border-radius:4px;">활성 (Active)</span>'
                : isStaged
                ? '<span class="badge badge-warning" style="background:#F59E0B; color:#fff; padding:2px 6px; border-radius:4px;">다음 스테이지 예약 (Staged)</span>'
                : '<span class="badge badge-secondary" style="background:#4B5563; color:#fff; padding:2px 6px; border-radius:4px;">보관됨</span>';

              const shortHash = v.contentHash.slice(0, 12);
              const dateStr = new Date(v.publishedAt).toLocaleString();

              return `
                <tr class="version-row" data-hash="${v.contentHash}">
                  <td><code>${shortHash}...</code></td>
                  <td>rev.${v.sourceRevision}</td>
                  <td>${dateStr}</td>
                  <td>${stateBadge}</td>
                  <td>
                    <button type="button" class="btn btn-sm btn-primary btn-test-version" data-hash="${v.contentHash}" title="이 버전으로 격리 테스트 플레이 실행">🎮 테스트</button>
                    <button type="button" class="btn btn-sm btn-outline btn-stage-version" data-hash="${v.contentHash}">다음 스테이지 예약</button>
                    ${isActive ? '' : `<button type="button" class="btn btn-sm btn-outline btn-rollback-version" data-hash="${v.contentHash}">롤백 예약</button>`}
                  </td>
                </tr>
              `;
            })
            .join('');

    return `
      <div class="publish-modal-panel" id="publish-modal-panel" style="display:flex; flex-direction:column; gap:14px;">
        <div class="panel-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:16px;">📦 프로젝트 검증·불변 게시 및 릴리즈 관리</h3>
          <button type="button" class="btn btn-sm btn-ghost" id="btn-close-publish-modal">✕ 닫기</button>
        </div>

        <div class="panel-notice notice-info" style="background:rgba(40,230,255,0.1); border-left:4px solid #28E6FF; padding:10px 14px; border-radius:4px; font-size:12px;">
          ℹ️ <strong>적용 안내:</strong> 새 버전 게시 및 적용 예약은 <strong>다음 스테이지 시작 시</strong> 안전하게 활성화됩니다. 현재 실행 중인 실시간 게임 세션에는 즉시 반영되지 않습니다.
        </div>

        ${
          isDirty
            ? `<div class="panel-notice notice-warning" style="background:rgba(239,68,68,0.15); border-left:4px solid #EF4444; padding:10px 14px; border-radius:4px; font-size:12px; color:#FCA5A5;">
                ⚠️ <strong>수정 중인 미완성 폼 입력이 있습니다!</strong> 폼을 확정하거나 취소한 후 게시를 진행해 주세요.
               </div>`
            : ''
        }

        <div class="panel-section release-info-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; background:rgba(255,255,255,0.03); padding:12px; border-radius:6px; font-size:12px;">
          <div><strong>현재 활성 해시:</strong> <code style="color:#28E6FF;">${activeHash}</code></div>
          <div><strong>다음 스테이지 예약:</strong> <code style="color:#FFCB4D;">${stagedHash}</code></div>
          <div><strong>이전 정상본 해시:</strong> <code style="color:#A78BFA;">${prevHealthy}</code></div>
          <div><strong>최근 게시본 해시:</strong> <code>${lastHash}</code></div>
        </div>

        <div class="panel-actions" style="display:flex; gap:8px; flex-wrap:wrap;">
          <button id="btn-modal-validate" type="button" class="btn btn-outline">🔍 무결성 검증</button>
          <button id="btn-modal-publish" type="button" class="btn btn-success" ${isDirty ? 'disabled' : ''} style="background:#10B981; color:#fff;">🚀 불변 게시</button>
          <button id="btn-modal-test-play" type="button" class="btn btn-primary" style="background:#2563EB; color:#fff;" title="현재 활성 게시본으로 격리 테스트 플레이 실행">🎮 테스트 플레이</button>
          <button id="btn-modal-stage-activation" type="button" class="btn btn-primary" style="background:#6366F1; color:#fff;">✨ 다음 스테이지 적용 예약</button>
          <button id="btn-modal-rollback" type="button" class="btn btn-warning" style="background:#F59E0B; color:#fff;">↺ 이전 정상본으로 롤백 예약</button>
        </div>

        <div class="panel-section test-play-isolation-banner" style="background:rgba(37,99,235,0.08); border:1px solid rgba(59,130,246,0.3); border-radius:6px; padding:10px 14px; font-size:12px; color:#93C5FD;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong>🛡️ 테스트 플레이 격리 보장 (Issue #391 계약)</strong>
            <span id="test-launch-status-badge" style="font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px; background:rgba(255,255,255,0.1);">대기 중</span>
          </div>
          <div style="font-size:11px; color:#BFDBFE; margin-top:4px;">
            테스트 플레이는 검증 완료된 게시본 hash로만 실행되며, 실제 게임 전역 설정·진척도(starsMap)·하이스코어·보상 저장이 완전히 차단됩니다.
          </div>
          <div id="test-launch-feedback" class="test-launch-feedback" style="display:none; margin-top:8px;"></div>
        </div>

        ${validationHTML}

        <div class="panel-section version-history-section">
          <h4 style="margin:8px 0;">게시된 버전 이력 (${versions.length}개)</h4>
          <table class="editor-table version-table" style="width:100%; border-collapse:collapse; text-align:left; font-size:12px;">
            <thead>
              <tr style="border-bottom:1px solid var(--border-color, #272f4a); color:var(--text-muted, #8e9bb5);">
                <th style="padding:6px;">Content Hash</th>
                <th style="padding:6px;">Revision</th>
                <th style="padding:6px;">게시 일시</th>
                <th style="padding:6px;">상태</th>
                <th style="padding:6px;">동작</th>
              </tr>
            </thead>
            <tbody>
              ${versionRows}
            </tbody>
          </table>
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
        <div id="publish-modal-container" class="publish-modal-container hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:1000; background:var(--bg-panel, #151827); border:1px solid var(--border-color, #272f4a); border-radius:8px; box-shadow:0 8px 32px rgba(0,0,0,0.8); max-width:820px; width:92%; max-height:85vh; overflow-y:auto; padding:20px;">
          ${this.renderPublishModalHTML()}
        </div>
        <footer id="editor-status-bar-container">
          ${this.renderStatusBarHTML()}
        </footer>
      </div>
    `.trim();
  }

  /**
   * 테스트 플레이 실행 결과 피드백 HTML 렌더링 (Issue #393 / EDITOR-TEST-LAUNCH)
   */
  renderTestLaunchFeedbackHTML(result: TestLaunchResult): string {
    if (result.ok && result.descriptor) {
      const isMatched = result.targetHash === result.executedHash;
      const shortTarget = result.targetHash ? result.targetHash.slice(0, 12) : '-';
      const shortExecuted = result.executedHash ? result.executedHash.slice(0, 12) : '-';
      return `
        <div class="feedback-box feedback-success" style="background:rgba(16,185,129,0.15); border:1px solid #10B981; border-radius:4px; padding:8px 12px; font-size:12px; color:#D1FAE5;">
          <div style="font-weight:700; margin-bottom:4px; color:#6EE7B7;">
            🎮 테스트 플레이가 격리 세션으로 실행되었습니다.
          </div>
          <div style="display:grid; grid-template-columns:auto 1fr; gap:2px 10px; font-family:monospace; font-size:11px;">
            <span>요청 Hash:</span><span>${shortTarget}...</span>
            <span>실행 Hash:</span><span>${shortExecuted}...</span>
            <span>해시 일치:</span><span style="color:#10B981; font-weight:bold;">${isMatched ? '✅ 일치 (Matched)' : '❌ 불일치'}</span>
            <span>BPM:</span><span>${result.descriptor.bpm}</span>
          </div>
          <div style="margin-top:6px; font-size:11px; color:#A7F3D0; border-top:1px dashed rgba(16,185,129,0.3); padding-top:4px;">
            🛡️ <strong>격리 계약:</strong> 진행도·보상·하이스코어 저장 차단 (Issue #391)
          </div>
        </div>
      `.trim();
    }

    const errorMsg = result.error || '알 수 없는 오류로 테스트 플레이 실행에 실패했습니다.';
    const diagnosticsList =
      result.diagnostics && result.diagnostics.length > 0
        ? `<div style="margin-top:4px; font-size:11px; color:#FCA5A5;">진단: ${result.diagnostics.join(', ')}</div>`
        : '';

    return `
      <div class="feedback-box feedback-error" style="background:rgba(239,68,68,0.15); border:1px solid #EF4444; border-radius:4px; padding:8px 12px; font-size:12px; color:#FEE2E2;">
        <div style="font-weight:700; margin-bottom:2px; color:#FCA5A5;">
          ❌ 테스트 플레이 실행 차단 / 실패
        </div>
        <div style="font-size:12px;">${errorMsg}</div>
        ${diagnosticsList}
      </div>
    `.trim();
  }
}
