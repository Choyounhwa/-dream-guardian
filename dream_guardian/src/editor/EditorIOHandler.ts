/**
 * EditorIOHandler.ts - 피트니스 안무 및 타임라인 에디터 데이터 입출력(IO) 및 LocalStorage 영속화
 *
 * 명세서 (docs/06_DANCE_CHOREO_EDITOR_SPEC.md 4절):
 * - JSON 내보내기/불러오기 (전체 프로젝트 패키지: 패턴, 시퀀스, BPM 메타데이터)
 * - CSV 내보내기/불러오기 (인게임 dancePatternRegistry 호환)
 * - LocalStorage 자동 저장/복원
 * - 파일 다운로드 및 클립보드 복사 헬퍼
 */

import type { EditorState, PhaseType } from './EditorState.js';
import type { CatChoreoPattern } from '../data/danceRoutineData.js';
import type { TimelineTrackNote } from './PhaseSequenceEditor.js';

export const STORAGE_KEY = 'DREAM_GUARDIAN_DANCE_EDITOR_DATA_V1';

export interface ProjectDataPackage {
  version: string;
  exportedAt: string;
  bpm: number;
  selectedPhase: PhaseType;
  selectedPatternId: string;
  patterns: CatChoreoPattern[];
  sequences: {
    RUN_QUESTION: TimelineTrackNote[];
    ANSWER_SELECT: TimelineTrackNote[];
    STAR_COLLECT: TimelineTrackNote[];
    FEVER_PHASE_B: TimelineTrackNote[];
  };
}

export interface IOResult {
  success: boolean;
  loadedCount: number;
  errors: string[];
}

export class EditorIOHandler {
  private readonly _storage: Storage | null;

  constructor(storage?: Storage) {
    if (storage) {
      this._storage = storage;
    } else if (typeof window !== 'undefined' && window.localStorage) {
      this._storage = window.localStorage;
    } else {
      this._storage = null;
    }
  }

  /**
   * 프로젝트 전체 데이터(패턴 + 4대 페이즈 시퀀스 + 메타데이터) JSON 내보내기
   */
  exportFullProjectJSON(state: EditorState): string {
    const pkg: ProjectDataPackage = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      bpm: state.bpm,
      selectedPhase: state.selectedPhase,
      selectedPatternId: state.selectedPatternId,
      patterns: state.getPatterns(),
      sequences: {
        RUN_QUESTION: state.sequenceEditor.getNotesForPhase('RUN_QUESTION'),
        ANSWER_SELECT: state.sequenceEditor.getNotesForPhase('ANSWER_SELECT'),
        STAR_COLLECT: state.sequenceEditor.getNotesForPhase('STAR_COLLECT'),
        FEVER_PHASE_B: state.sequenceEditor.getNotesForPhase('FEVER_PHASE_B'),
      },
    };
    return JSON.stringify(pkg, null, 2);
  }

  /**
   * 프로젝트 전체 데이터 JSON 불러오기 (프로젝트 열기: 전체 교체)
   */
  importFullProjectJSON(state: EditorState, jsonStr: string): IOResult {
    try {
      const pkg = JSON.parse(jsonStr) as Partial<ProjectDataPackage>;
      const errors: string[] = [];

      if (!pkg.patterns || !Array.isArray(pkg.patterns)) {
        return {
          success: false,
          loadedCount: 0,
          errors: ['유효한 패턴 목록(patterns)이 누락되었습니다.'],
        };
      }

      // 1. 패턴 유효성 사전 검증
      const validPatterns: CatChoreoPattern[] = [];
      for (const pattern of pkg.patterns) {
        const val = state.registry.validate(pattern);
        if (val.valid) {
          validPatterns.push(pattern);
        } else {
          errors.push(`패턴 "${pattern.id}" 유효성 검증 실패: ${val.errors.join(', ')}`);
        }
      }

      if (validPatterns.length === 0) {
        return {
          success: false,
          loadedCount: 0,
          errors: ['유효한 안무 패턴이 없습니다.', ...errors],
        };
      }

      // 2. 프로젝트 열기: 사전 검증 완료 후 기존 레지스트리 전체 교체 (삭제된 패턴 부활 방지)
      state.registry.clear();
      let loadedPatterns = 0;
      for (const pattern of validPatterns) {
        const res = state.registry.register(pattern);
        if (res.valid) {
          loadedPatterns++;
        }
      }

      // 3. 시퀀스 노트 복원
      if (pkg.sequences) {
        const phases: PhaseType[] = ['RUN_QUESTION', 'ANSWER_SELECT', 'STAR_COLLECT', 'FEVER_PHASE_B'];
        for (const phase of phases) {
          const notes = pkg.sequences[phase];
          if (Array.isArray(notes)) {
            state.sequenceEditor.importPhaseJSON(phase, JSON.stringify({ phase, notes }));
          }
        }
      }

      // 4. 메타데이터 및 선택 상태 복원 (선택 복원은 시퀀스를 덮어쓰지 않음)
      if (typeof pkg.bpm === 'number') {
        state.setBpm(pkg.bpm);
      }
      if (pkg.selectedPhase) {
        state.setSelectedPhase(pkg.selectedPhase);
      }
      if (pkg.selectedPatternId && state.registry.get(pkg.selectedPatternId)) {
        state.setSelectedPattern(pkg.selectedPatternId);
      } else if (validPatterns.length > 0) {
        state.setSelectedPattern(validPatterns[0].id);
      }

      return {
        success: loadedPatterns > 0,
        loadedCount: loadedPatterns,
        errors,
      };
    } catch (e: any) {
      return {
        success: false,
        loadedCount: 0,
        errors: [`JSON 파싱 오류: ${e.message || e}`],
      };
    }
  }

  /**
   * 외부 안무 패턴 라이브러리 JSON 불러오기 (기존 프로젝트/시퀀스를 유지하고 패턴만 병합 등록)
   */
  importPatternLibraryJSON(state: EditorState, jsonStr: string): IOResult {
    const res = state.registry.loadFromJSON(jsonStr);
    return {
      success: res.loadedCount > 0,
      loadedCount: res.loadedCount,
      errors: res.errors,
    };
  }

  /**
   * 패턴 목록 CSV 문자열 내보내기
   */
  exportCSV(state: EditorState): string {
    return state.registry.toCSV();
  }

  /**
   * CSV 데이터 파싱하여 패턴 등록
   */
  importCSV(state: EditorState, csvText: string): IOResult {
    const res = state.registry.loadFromCSV(csvText);
    return {
      success: res.loadedCount > 0,
      loadedCount: res.loadedCount,
      errors: res.errors,
    };
  }

  /**
   * LocalStorage에 자동 저장
   */
  saveToLocalStorage(state: EditorState): boolean {
    if (!this._storage) return false;
    try {
      const json = this.exportFullProjectJSON(state);
      this._storage.setItem(STORAGE_KEY, json);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * LocalStorage에서 불러오기
   */
  loadFromLocalStorage(state: EditorState): boolean {
    if (!this._storage) return false;
    try {
      const json = this._storage.getItem(STORAGE_KEY);
      if (!json) return false;
      const res = this.importFullProjectJSON(state, json);
      return res.success;
    } catch {
      return false;
    }
  }

  /**
   * LocalStorage 초기화
   */
  clearLocalStorage(): void {
    if (!this._storage) return;
    try {
      this._storage.removeItem(STORAGE_KEY);
    } catch {}
  }

  /**
   * 브라우저 파일 다운로드 트리거
   */
  downloadFile(filename: string, content: string, mimeType: string): void {
    if (typeof document === 'undefined') return;
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 클립보드 복사
   */
  async copyToClipboard(text: string): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export const editorIOHandler = new EditorIOHandler();
