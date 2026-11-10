/**
 * EditorLayout.ts - 피트니스 안무 & 비트 타임라인 에디터 3단 반응형 UI 레이아웃 및 뷰 렌더러
 */

import { EditorState, type PhaseType } from './EditorState.js';
import type { DanceMotionType } from '../data/danceRoutineData.js';
import { BeatTimelineRenderer } from './BeatTimelineRenderer.js';
import { EditorModalViews } from './EditorModalViews.js';
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
  private readonly _modalViews: EditorModalViews;

  constructor(state: EditorState) {
    this._state = state;
    this._timelineRenderer = new BeatTimelineRenderer();
    this._modalViews = new EditorModalViews(state);
  }

  get timelineRenderer(): BeatTimelineRenderer {
    return this._timelineRenderer;
  }

  getTimelineRenderer(): BeatTimelineRenderer {
    return this._timelineRenderer;
  }

  get modalViews(): EditorModalViews {
    return this._modalViews;
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
      { value: 'FEVER_NOTES', label: '🔥 피버 노트 (Phase B)' },
      { value: 'HAZARD_EVADE', label: '⚠️ 오답 장판 (Phase A)' },
      { value: 'BOSS_HAZARD', label: '👹 보스 장판/공격 (Phase B)' },
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
    const isHazardEvade = this._state.selectedPhase === 'HAZARD_EVADE';
    const hazardSection = isHazardEvade ? this.renderHazardEvadeEditorHTML() : '';
    const isFeverNotes = this._state.selectedPhase === 'FEVER_NOTES';
    const feverSection = isFeverNotes ? this.renderFeverSlotEditorHTML() : '';
    const isBossHazard = this._state.selectedPhase === 'BOSS_HAZARD';
    const bossHazardSection = isBossHazard ? this.renderBossHazardEditorHTML() : '';

    return `
      <aside class="editor-sidebar">
        ${hazardSection}
        ${starSlotSection}
        ${feverSection}
        ${bossHazardSection}
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
   * Phase A 오답 장판(HAZARD_EVADE) 회피 편집 UI HTML 렌더링 (#395)
   */
  renderHazardEvadeEditorHTML(): string {
    const currentPattern = this._state.getPhaseAHazardPattern();
    const activePatterns = this._state.getActivePhaseAHazardPatterns();
    const lockedPatterns = this._state.getLockedPhaseAHazardPatterns();
    const schedule = this._state.getPhaseAHazardSchedule();
    const damage = this._state.getPhaseAHazardDamage();

    const patternLabels: Record<string, string> = {
      left_step: '좌측 회피 스텝 (left_step)',
      right_step: '우측 회피 스텝 (right_step)',
      jump: '회피 점프 (jump)',
      balance_left: '좌측 밸런스 (balance_left)',
      balance_right: '우측 밸런스 (balance_right)',
    };

    return `
      <section class="sidebar-section hazard-evade-editor-section" style="border:1px solid #FF865E; background:rgba(255,134,94,0.06); margin-bottom:12px; border-radius:6px; padding:12px;">
        <div class="section-title" style="color:#FF865E; display:flex; align-items:center; gap:6px; font-weight:bold; margin-bottom:8px;">
          <span>⚠️ 오답 장판 회피 편집 (Phase A / HAZARD_EVADE)</span>
        </div>

        <div class="form-group" style="margin-top:8px;">
          <label style="font-weight:bold; color:#FFCB4D; display:block; margin-bottom:4px;">회피 동작 선택 (활성 3종):</label>
          <div class="radio-group" style="display:flex; flex-direction:column; gap:6px;">
            ${activePatterns
              .map(
                (pat) => `
              <label class="radio-label" style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;">
                <input type="radio" name="phase-a-hazard-pattern" value="${pat}" ${currentPattern === pat ? 'checked' : ''} class="hazard-pattern-radio" />
                <span>${patternLabels[pat] || pat}</span>
              </label>
            `,
              )
              .join('')}
            ${lockedPatterns
              .map(
                (pat) => `
              <label class="radio-label" style="display:flex; align-items:center; gap:6px; font-size:13px; color:#6B7280; cursor:not-allowed;">
                <input type="radio" name="phase-a-hazard-pattern" value="${pat}" disabled class="hazard-pattern-radio" />
                <span>${patternLabels[pat] || pat} <small>(비활성 잠금)</small></span>
              </label>
            `,
              )
              .join('')}
          </div>
        </div>

        <div class="form-group" style="margin-top:10px;">
          <label style="font-weight:bold; display:block; margin-bottom:4px;">피해량 (오답 피격 데미지):</label>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="text" value="${damage} HP (고정 / 🔒 잠금)" disabled class="editor-input disabled" style="width:100%; color:#FF865E; font-weight:bold;" />
          </div>
        </div>

        <div class="section-subtitle" style="margin-top:12px; font-weight:bold; color:#28E6FF;">현재 BPM(${schedule.bpm}) 기준 스케줄 (읽기 전용)</div>
        <div class="schedule-table-container" style="background:rgba(0,0,0,0.25); border-radius:4px; padding:8px; font-size:12px; line-height:1.6; margin-top:6px;">
          <div class="form-row warning-duration-display" style="display:flex; justify-content:space-between;">
            <span style="color:#9CA3AF;">경고 지속 시간:</span>
            <strong>${schedule.warningDuration.toFixed(2)}초 (${schedule.warningDurationBeats.toFixed(1)}박)</strong>
          </div>
          <div class="form-row input-window-display" style="display:flex; justify-content:space-between;">
            <span style="color:#9CA3AF;">입력 유효 마감:</span>
            <strong>${schedule.inputWindowEnd.toFixed(2)}초 (${schedule.inputWindowEndBeats.toFixed(1)}박)</strong>
          </div>
          <div class="form-row judgment-time-display" style="display:flex; justify-content:space-between;">
            <span style="color:#9CA3AF;">판정 시점:</span>
            <strong>${schedule.judgmentTime.toFixed(2)}초 (${schedule.judgmentTimeBeats.toFixed(1)}박)</strong>
          </div>
          <div class="form-row total-duration-display" style="display:flex; justify-content:space-between;">
            <span style="color:#9CA3AF;">총 지속 시간:</span>
            <strong>${schedule.totalDuration.toFixed(2)}초 (${schedule.totalDurationBeats.toFixed(1)}박)</strong>
          </div>
          <div style="margin-top:6px; font-size:11px; color:#6B7280; border-top:1px dashed #374151; padding-top:4px;">
            * 시간·판정 공식은 phase-a-hazard.config 단일 원천에 의해 BPM 비례 자동 계산됩니다.
          </div>
        </div>
      </section>
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
   * 피버 노트(FEVER_NOTES) 8슬롯 편집 UI HTML 렌더링 (#398)
   */
  renderFeverSlotEditorHTML(): string {
    const slots = this._state.getFeverSlots();
    const selectedNoteId = this._state.selectedNoteId;
    const focusedError = this._state.getFocusedError();

    const slotsHTML = slots
      .map((slot) => {
        const idx = slot.slotIndex;
        const slotNumber = slot.slotNumber;
        const buffer = this._state.getFeverFormBuffer(idx);
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
          ((activePart === 'leftHand' || activePart === 'rightHand') &&
            (activeZone < 1 || activeZone > 5));

        const isPartFocused = isErrorFocused && firstDiagPath.includes('part');
        const isZoneFocused = isErrorFocused && (firstDiagPath.includes('zoneId') || firstDiagPath.includes('Zone'));

        return `
          <div class="star-slot-item fever-slot-item ${isSelected ? 'selected' : ''} ${hasBufferErrors ? 'slot-has-error' : ''}"
               data-slot-index="${idx}"
               data-note-id="${slot.noteId}"
               style="border-left: 4px solid ${slot.color || '#28E6FF'}; margin-bottom: 8px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 4px;">
            <div class="slot-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span class="slot-badge" style="font-weight:bold; font-size:12px;">슬롯 ${slotNumber} (${slot.beat}박 / ${slot.tick}틱)</span>
              <span class="slot-status" style="font-size:11px; color:#A78BFA;">고정 타이밍</span>
            </div>

            <div class="slot-controls" style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 6px;">
              <div class="form-group-compact">
                <label for="fever-part-${idx}">부위:</label>
                <select id="fever-part-${idx}"
                        class="editor-select fever-part-select ${isPartFocused ? 'field-error-focus' : ''}"
                        data-slot-index="${idx}">
                  <option value="leftHand" ${activePart === 'leftHand' ? 'selected' : ''}>왼손 (Zone 1~5)</option>
                  <option value="rightHand" ${activePart === 'rightHand' ? 'selected' : ''}>오른손 (Zone 1~5)</option>
                  <option value="foot" ${activePart === 'foot' ? 'selected' : ''}>발 (Zone 9~11)</option>
                </select>
              </div>

              <div class="form-group-compact">
                <label for="fever-zone-${idx}">존:</label>
                <select id="fever-zone-${idx}"
                        class="editor-select fever-zone-select ${isZoneFocused ? 'field-error-focus' : ''} ${isZoneInvalid ? 'invalid-select' : ''}"
                        data-slot-index="${idx}">
                  ${zoneOptionsHTML}
                </select>
              </div>
            </div>

            <div class="slot-actions" style="display:flex; justify-content:flex-end; gap:6px; align-items:center;">
              ${
                buffer?.isDirty
                  ? `
                <button class="btn btn-xs btn-primary btn-apply-fever-buffer" data-slot-index="${idx}">적용</button>
                <button class="btn btn-xs btn-secondary btn-cancel-fever-buffer" data-slot-index="${idx}">취소</button>
              `
                  : ''
              }
            </div>

            ${
              hasBufferErrors
                ? `
              <div class="slot-error-msg" style="color:#EF4444; font-size:11px; margin-top:4px;">
                ⚠️ ${firstErrorMsg}
              </div>
            `
                : ''
            }
          </div>
        `;
      })
      .join('');

    return `
      <section class="sidebar-section fever-notes-editor-section" style="border:1px solid #A78BFA; background:rgba(167,139,250,0.06); margin-bottom:12px; border-radius:6px; padding:12px;">
        <div class="section-title">
          <span>🔥 피버 노트 편집 (Phase B / FEVER_NOTES)</span>
          <small>고정 8박 (1~8박, 480틱 간격) | 손 (Zone 1~5), 발 (Zone 9~11)</small>
        </div>
        <div class="fever-slots-container">
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
    return this._modalViews.renderStageBindingsPanelHTML();
  }

  /**
   * 프로젝트 검증·게시 및 릴리즈 관리 모달(Publish & Release Modal) HTML 렌더링
   */
  renderPublishModalHTML(
    status?: EditorPublishStatus | null,
    versions: PublishedPackSummary[] = []
  ): string {
    return this._modalViews.renderPublishModalHTML(status, versions);
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
    return this._modalViews.renderTestLaunchFeedbackHTML(result);
  }

  /**
   * Phase B 보스 장판 및 공격 순서(BOSS_HAZARD) 편집 UI HTML 렌더링 (#400)
   */
  renderBossHazardEditorHTML(): string {
    const attacks = this._state.getPhaseBHazardAttacks();
    const lockedConfig = this._state.getPhaseBHazardLockedConfig();

    const attackNameMap: Record<string, string> = {
      dual_slam: '양손 내려치기 (dual_slam)',
      alternating_stomp_left: '왼발 발구르기 (alternating_stomp_left)',
      alternating_stomp_right: '오른발 발구르기 (alternating_stomp_right)',
    };

    const actionBadgeMap: Record<string, { label: string; bg: string }> = {
      jump: { label: '회피: JUMP (점프)', bg: '#8B5CF6' },
      left_step: { label: '회피: LEFT STEP (좌스텝)', bg: '#06B6D4' },
      right_step: { label: '회피: RIGHT STEP (우스텝)', bg: '#F59E0B' },
    };

    const attackCardsHTML = attacks
      .map((att, idx) => {
        const name = attackNameMap[att.attackType] ?? att.attackType;
        const badge = actionBadgeMap[att.requiredAction] ?? {
          label: `회피: ${att.requiredAction}`,
          bg: '#64748B',
        };
        const isFirst = idx === 0;
        const isLast = idx === attacks.length - 1;

        return `
          <div class="boss-hazard-attack-card" style="display:flex; flex-direction:column; gap:6px; background:rgba(30,41,59,0.7); border:1px solid #475569; border-radius:6px; padding:10px; margin-bottom:8px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="attack-index-badge" style="background:#334155; color:#94A3B8; font-size:11px; font-weight:bold; padding:2px 6px; border-radius:4px;">#${idx + 1}</span>
                <span style="font-weight:bold; font-size:13px; color:#F1F5F9;">${name}</span>
              </div>
              <span class="badge badge-${att.requiredAction}" style="background:${badge.bg}; color:#FFF; padding:3px 8px; border-radius:12px; font-weight:bold; font-size:11px;">${badge.label}</span>
            </div>
            <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px; margin-top:4px;">
              <button class="btn btn-xs btn-secondary btn-move-up-boss-hazard" data-attack-index="${idx}" ${isFirst ? 'disabled' : ''} title="위로 이동">▲ 위로</button>
              <button class="btn btn-xs btn-secondary btn-move-down-boss-hazard" data-attack-index="${idx}" ${isLast ? 'disabled' : ''} title="아래로 이동">▼ 아래로</button>
              <button class="btn btn-xs btn-secondary btn-duplicate-boss-hazard" data-attack-index="${idx}" title="패턴 복제">📋 복제</button>
              <button class="btn btn-xs btn-danger btn-delete-boss-hazard" data-attack-index="${idx}" title="삭제">🗑 삭제</button>
            </div>
          </div>
        `;
      })
      .join('');

    const emptyWarningHTML =
      attacks.length === 0
        ? `
          <div class="empty-attacks-warning" style="background:rgba(239,68,68,0.15); border:1px solid #EF4444; color:#FCA5A5; padding:8px 12px; border-radius:6px; margin-bottom:10px; font-size:12px;">
            ⚠️ 등록된 공격 패턴이 없습니다. 게시를 위해 최소 1개 이상 추가하세요.
          </div>
        `
        : `
          <div class="attacks-count-info" style="font-size:12px; color:#94A3B8; margin-bottom:10px;">
            총 ${attacks.length}개 공격 패턴 순서대로 반복 루프 실행
          </div>
        `;

    return `
      <section class="sidebar-section boss-hazard-editor-section" style="border:1px solid #F59E0B; background:rgba(245,158,11,0.06); margin-bottom:12px; border-radius:6px; padding:12px;">
        <div class="section-title" style="display:flex; align-items:center; gap:6px; margin-bottom:10px;">
          <span>👹 보스 장판 및 공격 순서 편집 (Phase B / BOSS_HAZARD)</span>
        </div>

        ${emptyWarningHTML}

        <div class="boss-hazard-attack-list" style="margin-bottom:12px;">
          ${attackCardsHTML}
        </div>

        <div class="boss-hazard-add-control" style="background:rgba(15,23,42,0.6); border:1px dashed #64748B; border-radius:6px; padding:10px; margin-bottom:12px;">
          <label for="boss-hazard-attack-select" style="font-size:12px; color:#CBD5E1; display:block; margin-bottom:6px;">새 보스 공격 패턴 추가:</label>
          <div style="display:flex; gap:6px;">
            <select id="boss-hazard-attack-select" class="editor-select" style="flex:1;">
              <option value="dual_slam">양손 내려치기 (회피: 점프 / JUMP)</option>
              <option value="alternating_stomp_left">왼발 발구르기 (회피: 좌스텝 / LEFT STEP)</option>
              <option value="alternating_stomp_right">오른발 발구르기 (회피: 우스텝 / RIGHT STEP)</option>
            </select>
            <button id="btn-add-boss-hazard" class="btn btn-primary" style="white-space:nowrap;">+ 공격 추가</button>
          </div>
        </div>

        <div class="boss-hazard-locked-config" style="background:rgba(15,23,42,0.8); border:1px solid #334155; border-radius:6px; padding:10px; font-size:12px;">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px; color:#E2E8F0; font-weight:bold;">
            <span>🔒 전투 수치 잠금 (게임 밸런스 보호)</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px 8px; color:#94A3B8;">
            <div>공격 주기: <strong style="color:#CBD5E1;">${lockedConfig.attackInterval.toFixed(1)}초</strong></div>
            <div>전조/활성: <strong style="color:#CBD5E1;">${lockedConfig.warningDuration.toFixed(1)}s / ${lockedConfig.activeDuration.toFixed(1)}s</strong></div>
            <div>피격 피해: <strong style="color:#EF4444;">${lockedConfig.damage} HP</strong></div>
            <div>군단 손실: <strong style="color:#F97316;">${lockedConfig.minionCasualtyCount}체</strong></div>
          </div>
          <div style="margin-top:6px; font-size:11px; color:#64748B;">
            광폭화: HP ${(lockedConfig.enrageHpRatio * 100).toFixed(0)}% 이하 시 ${lockedConfig.enrageSpeedMultiplier}x 가속 (수정 불가)
          </div>
        </div>
      </section>
    `;
  }
}
