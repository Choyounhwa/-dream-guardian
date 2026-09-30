/**
 * PhaseSequenceEditor.ts - 4대 페이즈별 타임라인 시퀀스 데이터 편집기
 *
 * 명세서 (docs/06_DANCE_CHOREO_EDITOR_SPEC.md 3.4절):
 * 1. RUN_QUESTION: 8박 로우바운스 모션 (홀수 박 rebound, 짝수 박 dip)
 * 2. ANSWER_SELECT: 2박 좌우 도달 (Zone 4 - 0번, Zone 5 - 1번)
 * 3. STAR_COLLECT: 7박 로우바운스 & 우측스카이포인트 키노트 시퀀스
 * 4. FEVER_PHASE_B: 4가지 안무 패턴 16박 풀루프 시퀀스
 */

import {
  QUESTION_PHASE_ROUTINE,
  ANSWER_PHASE_ROUTINE,
  STAR_COLLECT_ROUTINE,
  FEVER_PHASE_B_ROUTINE,
} from '../data/danceRoutineData.js';
import type { PhaseType } from './EditorState.js';

export interface TimelineTrackNote {
  id: string;
  lane: 'motion' | 'keynote' | 'answer';
  startBeat: number;
  durationBeats: number;
  label: string;
  color: string;
  targetZones: number[];
  payload?: Record<string, any>;
}

export class PhaseSequenceEditor {
  private readonly _phaseNotes: Map<PhaseType, TimelineTrackNote[]> = new Map();

  constructor() {
    this.initDefaultSequences();
  }

  /**
   * 4대 페이즈 기본 시퀀스 데이터 초기화
   */
  private initDefaultSequences(): void {
    // 1. RUN_QUESTION (8박 로우바운스)
    const qNotes: TimelineTrackNote[] = QUESTION_PHASE_ROUTINE.notes.map((n, idx) => ({
      id: `NOTE_Q_${idx + 1}`,
      lane: 'motion',
      startBeat: n.beat,
      durationBeats: 1,
      label: `${n.action}: ${n.description}`,
      color: n.action === 'dip' ? '#FF865E' : '#28E6FF',
      targetZones: [...n.targetZones],
      payload: { action: n.action, primaryPart: n.primaryPart },
    }));
    this._phaseNotes.set('RUN_QUESTION', qNotes);

    // 2. ANSWER_SELECT (2박 좌우 답안)
    const aNotes: TimelineTrackNote[] = ANSWER_PHASE_ROUTINE.choices.map((c) => ({
      id: `NOTE_A_${c.choiceIndex}`,
      lane: 'answer',
      startBeat: c.choiceIndex === 0 ? 1 : 2,
      durationBeats: 1,
      label: c.label,
      color: c.choiceIndex === 0 ? '#28E6FF' : '#FFCB4D',
      targetZones: [c.zoneId],
      payload: { choiceIndex: c.choiceIndex, targetPart: c.targetPart },
    }));
    this._phaseNotes.set('ANSWER_SELECT', aNotes);

    // 3. STAR_COLLECT (7박 키노트)
    const sNotes: TimelineTrackNote[] = STAR_COLLECT_ROUTINE.notes.map((n, idx) => ({
      id: `NOTE_S_${idx + 1}`,
      lane: 'keynote',
      startBeat: n.beat,
      durationBeats: 1,
      label: n.actionName,
      color: n.instrument === 'hand' ? '#28E6FF' : '#FFCB4D',
      targetZones: [n.zoneId],
      payload: { part: n.part, instrument: n.instrument, patternId: n.patternId },
    }));
    this._phaseNotes.set('STAR_COLLECT', sNotes);

    // 4. FEVER_PHASE_B (16박 풀루프 안무 블록)
    const fNotes: TimelineTrackNote[] = FEVER_PHASE_B_ROUTINE.patterns.map((p, idx) => ({
      id: `NOTE_F_${idx + 1}`,
      lane: 'motion',
      startBeat: p.startBeat,
      durationBeats: p.endBeat - p.startBeat + 1,
      label: p.name,
      color: '#C889FF',
      targetZones: [...p.primaryZones],
      payload: { motionType: p.motionType, patternId: p.patternId },
    }));
    this._phaseNotes.set('FEVER_PHASE_B', fNotes);
  }

  /**
   * 지정된 페이즈의 트랙 노트 목록 반환 (비트 순서 정렬)
   */
  getNotesForPhase(phase: PhaseType): TimelineTrackNote[] {
    const list = this._phaseNotes.get(phase) ?? [];
    return [...list].sort((a, b) => a.startBeat - b.startBeat);
  }

  /**
   * 신규 노트 추가
   */
  addNote(phase: PhaseType, note: TimelineTrackNote): boolean {
    const list = this._phaseNotes.get(phase) ?? [];
    if (list.some((n) => n.id === note.id)) {
      return false;
    }
    list.push({ ...note, targetZones: [...note.targetZones] });
    this._phaseNotes.set(phase, list);
    return true;
  }

  /**
   * 기존 노트 속성 수정
   */
  updateNote(phase: PhaseType, noteId: string, partial: Partial<TimelineTrackNote>): boolean {
    const list = this._phaseNotes.get(phase);
    if (!list) return false;

    const idx = list.findIndex((n) => n.id === noteId);
    if (idx === -1) return false;

    list[idx] = {
      ...list[idx],
      ...partial,
      targetZones: partial.targetZones ? [...partial.targetZones] : list[idx].targetZones,
      payload: { ...(list[idx].payload ?? {}), ...(partial.payload ?? {}) },
    };
    return true;
  }

  /**
   * 노트 삭제
   */
  removeNote(phase: PhaseType, noteId: string): boolean {
    const list = this._phaseNotes.get(phase);
    if (!list) return false;

    const nextList = list.filter((n) => n.id !== noteId);
    if (nextList.length === list.length) {
      return false;
    }
    this._phaseNotes.set(phase, nextList);
    return true;
  }

  /**
   * 기본 시퀀스로 초기화
   */
  resetPhase(phase: PhaseType): void {
    const freshEditor = new PhaseSequenceEditor();
    const defaultNotes = freshEditor.getNotesForPhase(phase);
    this._phaseNotes.set(phase, defaultNotes);
  }

  /**
   * 페이즈 시퀀스 데이터 JSON 직렬화
   */
  exportPhaseJSON(phase: PhaseType): string {
    const notes = this.getNotesForPhase(phase);
    return JSON.stringify(
      {
        phase,
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        notes,
      },
      null,
      2
    );
  }

  /**
   * 페이즈 시퀀스 데이터 JSON 역직렬화
   */
  importPhaseJSON(phase: PhaseType, jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.phase && parsed.phase !== phase) {
        return false;
      }
      if (!Array.isArray(parsed.notes)) {
        return false;
      }
      this._phaseNotes.set(phase, parsed.notes);
      return true;
    } catch {
      return false;
    }
  }
}
