/**
 * BeatTimelineRenderer.ts - 비트 타임라인 트랙 시각화 및 인터랙티브 스크러버
 */

import type { TimelineTrackNote } from './PhaseSequenceEditor.js';
import type { PhaseType } from './EditorState.js';

export class BeatTimelineRenderer {
  /**
   * 1-based 표시 비트를 타임라인 백분율(0~100%)로 변환 (#383)
   * 비트 1이 0%에 위치하며, 비트 (1 + totalBeats)가 100%에 도달
   */
  beatToPercent(displayBeat: number, totalBeats: number): number {
    if (totalBeats <= 0) return 0;
    return Math.max(0, Math.min(100, ((displayBeat - 1) / totalBeats) * 100));
  }

  /**
   * 타임라인 백분율(0~100%)을 1-based 표시 비트로 역변환 (#383)
   */
  percentToBeat(percent: number, totalBeats: number): number {
    if (totalBeats <= 0) return 1.0;
    const clampedPercent = Math.max(0, Math.min(100, percent));
    return 1 + (clampedPercent / 100) * totalBeats;
  }

  /**
   * 트랙 컨텐츠 픽셀 X 좌표(레인 태그 80px 제외)를 1-based 비트 위치로 변환 (#383)
   */
  pixelToBeat(contentPixelX: number, contentWidth: number, totalBeats: number): number {
    if (contentWidth <= 0 || totalBeats <= 0) return 1.0;
    const ratio = Math.max(0, Math.min(1, contentPixelX / contentWidth));
    return 1 + ratio * totalBeats;
  }

  /**
   * 노트의 시작 비트 및 지속 시간에 따른 좌측 위치(leftPercent)와 폭(widthPercent) 계산 (#383)
   */
  getNoteLeftAndWidth(
    startBeat: number,
    durationBeats: number,
    totalBeats: number
  ): { leftPercent: number; widthPercent: number } {
    if (totalBeats <= 0) {
      return { leftPercent: 0, widthPercent: 0 };
    }
    const leftPercent = this.beatToPercent(startBeat, totalBeats);
    const widthPercent = Math.max(0, Math.min(100, (durationBeats / totalBeats) * 100));
    return { leftPercent, widthPercent };
  }

  /**
   * 루프 종료 경계 비트 계산 (브랜치 길이 8박 + 마지막 노트 랜딩/지속 시간 보장) (#383)
   */
  getLoopBoundary(totalBeats: number, notes: TimelineTrackNote[] = []): number {
    const branchEndBeat = 1 + Math.max(0, totalBeats);
    if (!notes || notes.length === 0) {
      return branchEndBeat;
    }
    let maxEndBeat = branchEndBeat;
    for (const note of notes) {
      const noteEnd = note.startBeat + note.durationBeats;
      if (noteEnd > maxEndBeat) {
        maxEndBeat = noteEnd;
      }
    }
    return maxEndBeat;
  }

  /**
   * 현재 비트가 루프 경계(마지막 노트 랜딩 및 브랜치 종료)에 도달했는지 확인 (#383)
   */
  shouldLoop(currentBeat: number, totalBeats: number, notes: TimelineTrackNote[] = []): boolean {
    const boundary = this.getLoopBoundary(totalBeats, notes);
    return currentBeat >= boundary;
  }

  /**
   * 픽셀 좌표를 비트 위치로 변환 (하위 호환 0-based 비율 계산)
   */
  beatFromPixel(pixelX: number, trackWidth: number, totalBeats: number): number {
    if (trackWidth <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, pixelX / trackWidth));
    return ratio * totalBeats;
  }

  /**
   * 지정된 단위(snapInterval)로 비트 스냅
   */
  snapBeat(rawBeat: number, snapInterval: number = 0.5): number {
    return Math.round(rawBeat / snapInterval) * snapInterval;
  }

  /**
   * 특정 비트 위치에 위치한 노트 검출
   */
  hitTestNote(beat: number, notes: TimelineTrackNote[]): TimelineTrackNote | null {
    // 역순 검색 (가장 위에 그려진 노트 우선 검출, 반열린 구간 [start, end) 적용)
    for (let i = notes.length - 1; i >= 0; i--) {
      const note = notes[i];
      const start = note.startBeat;
      const end = note.startBeat + note.durationBeats;
      if (beat >= start && beat < end) {
        return note;
      }
    }
    return null;
  }

  /**
   * 노트의 구조화된 부위 메타데이터를 기반으로 렌더링할 신체 레인 목록 반환 (이름/라벨 문자열 휴리스틱 배제)
   */
  getLanesForNote(note: TimelineTrackNote): Array<'motion' | 'leftHand' | 'rightHand' | 'hipFoot'> {
    // 1. 구조화된 명시적 부위 데이터 추출
    const explicitParts: string[] = [];
    if (Array.isArray(note.payload?.parts)) {
      explicitParts.push(...note.payload.parts);
    }
    const singlePart =
      note.payload?.part ||
      note.payload?.targetPart ||
      (note.payload?.action === 'dip' ? 'hip' : note.payload?.action === 'rebound' ? 'leftHand' : note.payload?.primaryPart);

    if (singlePart && !explicitParts.includes(singlePart)) {
      explicitParts.push(singlePart);
    }
    if (note.payload?.choiceIndex === 0 && !explicitParts.includes('leftHand')) {
      explicitParts.push('leftHand');
    }
    if (note.payload?.choiceIndex === 1 && !explicitParts.includes('rightHand')) {
      explicitParts.push('rightHand');
    }
    if (note.payload?.instrument === 'foot' && !explicitParts.includes('foot')) {
      explicitParts.push('foot');
    }

    if (explicitParts.length > 0) {
      const assignedLanes = new Set<'leftHand' | 'rightHand' | 'hipFoot'>();
      for (const part of explicitParts) {
        switch (part) {
          case 'leftHand':
            assignedLanes.add('leftHand');
            break;
          case 'rightHand':
            assignedLanes.add('rightHand');
            break;
          case 'bothHands':
            assignedLanes.add('leftHand');
            assignedLanes.add('rightHand');
            break;
          case 'hip':
          case 'foot':
          case 'head':
          default:
            assignedLanes.add('hipFoot');
            break;
        }
      }
      return Array.from(assignedLanes);
    }

    // 2. 부위가 지정되지 않은 전신 안무 블록(FEVER_PHASE_B 등)은 모션 레인에 배치
    if (note.lane === 'motion') {
      return ['motion'];
    }

    // 기본 폴백 (유실 방지)
    return ['hipFoot'];
  }

  /**
   * 트랙 레인 및 노트 블록 HTML 마크업 렌더링 (4줄 레인 구조)
   */
  renderTimelineTracksHTML(
    _phase: PhaseType,
    notes: TimelineTrackNote[],
    currentBeat: number,
    totalBeats: number,
    selectedNoteId?: string | null
  ): string {
    const playheadPercent = this.beatToPercent(currentBeat, totalBeats);

    // 4개 레인별 노트 분리 (구조화된 신체 부위 기반)
    // 1. 모션 레인 (바운스 / 16박 안무 블록)
    const motionNotes = notes.filter((n) => this.getLanesForNote(n).includes('motion'));

    // 2. 왼손 레인 (왼손 키노트, 0번 답안 등)
    const lhNotes = notes.filter((n) => this.getLanesForNote(n).includes('leftHand'));

    // 3. 오른손 레인 (오른손 키노트, 1번 답안 등)
    const rhNotes = notes.filter((n) => this.getLanesForNote(n).includes('rightHand'));

    // 4. 골반/발 레인 (골반 스쿼트, 힙스웨이, 발 디딤/킥, 머리 등)
    const hipFootNotes = notes.filter((n) => this.getLanesForNote(n).includes('hipFoot'));

    const renderNoteBlock = (note: TimelineTrackNote) => {
      // 1-based startBeat: Beat 1 starts at 0%
      const { leftPercent, widthPercent } = this.getNoteLeftAndWidth(
        note.startBeat,
        note.durationBeats,
        totalBeats
      );
      const displayWidth = Math.max(3, widthPercent);
      const isSelected = selectedNoteId === note.id;

      return `
        <div class="note-block ${isSelected ? 'selected' : ''}"
             data-note-id="${note.id}"
             style="left: ${leftPercent}%; width: ${displayWidth}%; background-color: ${note.color};">
          <span class="note-title">${note.label}</span>
          <span class="note-zones">${note.targetZones.length > 0 ? `Z${note.targetZones.join(',')}` : ''}</span>
        </div>
      `.trim();
    };

    return `
      <div class="timeline-tracks-wrapper">
        <div class="timeline-track-content" style="position: absolute; left: 80px; right: 0; top: 0; bottom: 0; pointer-events: none;">
          <div id="timeline-playhead" class="playhead-cursor" style="left: ${playheadPercent}%;">
            <div class="playhead-pin">▼</div>
            <div class="playhead-bar"></div>
          </div>
        </div>

        <div class="timeline-lane lane-motion" data-lane="motion">
          <span class="lane-tag">모션</span>
          <div class="lane-content">
            ${motionNotes.map(renderNoteBlock).join('')}
          </div>
        </div>

        <div class="timeline-lane lane-lh" data-lane="leftHand">
          <span class="lane-tag">✋ 왼손</span>
          <div class="lane-content">
            ${lhNotes.map(renderNoteBlock).join('')}
          </div>
        </div>

        <div class="timeline-lane lane-rh" data-lane="rightHand">
          <span class="lane-tag">🤚 오른손</span>
          <div class="lane-content">
            ${rhNotes.map(renderNoteBlock).join('')}
          </div>
        </div>

        <div class="timeline-lane lane-hipfoot" data-lane="hipFoot">
          <span class="lane-tag">🥋 골반/발</span>
          <div class="lane-content">
            ${hipFootNotes.map(renderNoteBlock).join('')}
          </div>
        </div>
      </div>
    `.trim();
  }
}
