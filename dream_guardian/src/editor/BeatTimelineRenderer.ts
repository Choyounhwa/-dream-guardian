/**
 * BeatTimelineRenderer.ts - 비트 타임라인 트랙 시각화 및 인터랙티브 스크러버
 */

import type { TimelineTrackNote } from './PhaseSequenceEditor.js';
import type { PhaseType } from './EditorState.js';

export class BeatTimelineRenderer {
  /**
   * 픽셀 좌표를 비트 위치로 변환
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
   * 트랙 레인 및 노트 블록 HTML 마크업 렌더링
   */
  renderTimelineTracksHTML(
    _phase: PhaseType,
    notes: TimelineTrackNote[],
    currentBeat: number,
    totalBeats: number,
    selectedNoteId?: string | null
  ): string {
    const playheadPercent = Math.max(0, Math.min(100, (currentBeat / totalBeats) * 100));

    // 레인별 노트 분리
    const motionNotes = notes.filter((n) => n.lane === 'motion');
    const keynoteNotes = notes.filter((n) => n.lane === 'keynote' || n.lane === 'answer');

    const renderNoteBlock = (note: TimelineTrackNote) => {
      // 1-based startBeat: Beat 1 starts at 0%
      const leftPercent = Math.max(0, Math.min(100, ((note.startBeat - 1) / totalBeats) * 100));
      const widthPercent = Math.max(2, Math.min(100, (note.durationBeats / totalBeats) * 100));
      const isSelected = selectedNoteId === note.id;

      return `
        <div class="note-block ${isSelected ? 'selected' : ''}" 
             data-note-id="${note.id}"
             style="left: ${leftPercent}%; width: ${widthPercent}%; background-color: ${note.color};">
          <span class="note-title">${note.label}</span>
          <span class="note-zones">${note.targetZones.length > 0 ? `Z${note.targetZones.join(',')}` : ''}</span>
        </div>
      `.trim();
    };

    return `
      <div class="timeline-tracks-wrapper">
        <div class="timeline-lane lane-motion" data-lane="motion">
          <span class="lane-tag">모션</span>
          <div class="lane-content">
            ${motionNotes.map(renderNoteBlock).join('')}
          </div>
        </div>

        <div class="timeline-lane lane-keynote" data-lane="keynote">
          <span class="lane-tag">키노트/타깃</span>
          <div class="lane-content">
            ${keynoteNotes.map(renderNoteBlock).join('')}
          </div>
        </div>

        <div id="timeline-playhead" class="playhead-cursor" style="left: ${playheadPercent}%;">
          <div class="playhead-pin">▼</div>
          <div class="playhead-bar"></div>
        </div>
      </div>
    `.trim();
  }
}
