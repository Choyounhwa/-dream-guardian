/**
 * EditorTimeModel.ts - 에디터 타임라인 비트/틱/시간 변환 및 페이즈 루틴 모델 전담 모듈
 */

import {
  QUESTION_PHASE_ROUTINE,
  ANSWER_PHASE_ROUTINE,
  STAR_COLLECT_ROUTINE,
  FEVER_PHASE_B_ROUTINE,
  type QuestionPhaseRoutine,
  type AnswerPhaseRoutine,
  type StarCollectRoutine,
  type FeverPhaseRoutine,
} from '../data/danceRoutineData.js';
import type { PhaseType } from './EditorElementTypes.js';

export interface EditorPhaseRoutineInfo {
  phase: PhaseType;
  beats: number;
  totalBeats?: number;
  prompt: string;
  routine: QuestionPhaseRoutine | AnswerPhaseRoutine | StarCollectRoutine | FeverPhaseRoutine;
  branchDuration?: number;
  noteCount?: number;
}

export class EditorTimeModel {
  static getTimelineTotalBeats(phase: PhaseType): number {
    switch (phase) {
      case 'RUN_QUESTION':
        return 8;
      case 'ANSWER_SELECT':
        return 2;
      case 'STAR_COLLECT':
        return 8;
      case 'FEVER_PHASE_B':
        return 16;
      case 'FEVER_NOTES':
        return 8;
      case 'HAZARD_EVADE':
        return 8;
      case 'BOSS_HAZARD':
        return 16;
    }
  }

  static getCurrentPhaseRoutine(phase: PhaseType, phaseBHazardAttackCount: number = 3): EditorPhaseRoutineInfo {
    switch (phase) {
      case 'RUN_QUESTION':
        return {
          phase: 'RUN_QUESTION',
          beats: QUESTION_PHASE_ROUTINE.beats,
          prompt: QUESTION_PHASE_ROUTINE.prompt,
          routine: QUESTION_PHASE_ROUTINE,
          branchDuration: QUESTION_PHASE_ROUTINE.beats,
          noteCount: QUESTION_PHASE_ROUTINE.notes.length,
        };
      case 'ANSWER_SELECT':
        return {
          phase: 'ANSWER_SELECT',
          beats: ANSWER_PHASE_ROUTINE.maxBeats,
          prompt: ANSWER_PHASE_ROUTINE.prompt,
          routine: ANSWER_PHASE_ROUTINE,
          branchDuration: ANSWER_PHASE_ROUTINE.maxBeats,
          noteCount: ANSWER_PHASE_ROUTINE.choices.length,
        };
      case 'STAR_COLLECT':
        return {
          phase: 'STAR_COLLECT',
          beats: 8, // #382: 노트 수 7과 분기 전체 길이 8박 명확한 분리
          prompt: STAR_COLLECT_ROUTINE.prompt,
          routine: STAR_COLLECT_ROUTINE,
          branchDuration: 8,
          noteCount: STAR_COLLECT_ROUTINE.notes.length,
        };
      case 'FEVER_PHASE_B':
        return {
          phase: 'FEVER_PHASE_B',
          beats: FEVER_PHASE_B_ROUTINE.totalBeats,
          totalBeats: FEVER_PHASE_B_ROUTINE.totalBeats,
          prompt: '16박 풀루프 안무 루틴 (4가지 핵심 안무 순환)',
          routine: FEVER_PHASE_B_ROUTINE,
          branchDuration: FEVER_PHASE_B_ROUTINE.totalBeats,
          noteCount: FEVER_PHASE_B_ROUTINE.patterns.length,
        };
      case 'FEVER_NOTES':
        return {
          phase: 'FEVER_NOTES',
          beats: 8,
          totalBeats: 8,
          prompt: 'Phase B 피버 결전 8노트 실행 편집 (8박)',
          routine: null as any,
          branchDuration: 8,
          noteCount: 8,
        };
      case 'HAZARD_EVADE':
        return {
          phase: 'HAZARD_EVADE',
          beats: 8,
          prompt: 'Phase A 오답 장판 회피 (8박)',
          routine: null as any,
          branchDuration: 8,
          noteCount: 1,
        };
      case 'BOSS_HAZARD':
        return {
          phase: 'BOSS_HAZARD',
          beats: 16,
          totalBeats: 16,
          prompt: 'Phase B 보스 장판/공격 순서 및 회피 편집',
          routine: null as any,
          branchDuration: 16,
          noteCount: phaseBHazardAttackCount,
        };
    }
  }

  static beatToTick(beat: number, ticksPerBeat = 480): number {
    return Math.max(0, Math.round((beat - 1) * ticksPerBeat));
  }

  static tickToBeat(tick: number, ticksPerBeat = 480): number {
    return Math.round(((tick / ticksPerBeat) + 1) * 1000) / 1000;
  }

  static displayBeatToAudioBeat(displayBeat: number): number {
    return Math.round((displayBeat - 1) * 1000) / 1000;
  }

  static audioBeatToDisplayBeat(audioBeat: number): number {
    return Math.round((audioBeat + 1) * 1000) / 1000;
  }

  static audioBeatToTick(audioBeat: number, ticksPerBeat = 480): number {
    return Math.max(0, Math.round(audioBeat * ticksPerBeat));
  }

  static tickToAudioBeat(tick: number, ticksPerBeat = 480): number {
    return Math.round((tick / ticksPerBeat) * 1000) / 1000;
  }

  static timeSecondsToBeat(seconds: number, bpm: number): number {
    const audioBeat = seconds / (60 / bpm);
    return Math.round((audioBeat + 1) * 1000) / 1000;
  }

  static beatToTimeSeconds(beat: number, bpm: number): number {
    const audioBeat = Math.max(0, beat - 1);
    return Math.round(audioBeat * (60 / bpm) * 1000) / 1000;
  }
}
