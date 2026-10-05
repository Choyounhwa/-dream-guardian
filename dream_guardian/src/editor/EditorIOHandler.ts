/**
 * EditorIOHandler.ts - 피트니스 안무 및 타임라인 에디터 데이터 입출력(IO), 스토어 연동 및 LocalStorage 영속화
 *
 * 명세서 (docs/06_DANCE_CHOREO_EDITOR_SPEC.md 4절, docs/07_UNIFIED_EDITOR_INTEGRITY_DESIGN.md 11절, Issue #381):
 * - V2 전체 열기 API: V2 검증(validateEditorProject), V1 변환(migrateV1ProjectToV2), 단일 ReplaceProjectCommand 원자적 실행
 * - 엄격한 부분 수입 금지: 단 하나의 노트나 속성 오류 시에도 전체 거부, 기존 상태/저장본 100% 보존, 알림 0회
 * - 스토어(EditorProjectStore) 자동 저장: 원자적 초안 저장, Stale Callback 동시성 가드
 * - 프로젝트 전환 시 미저장 작업 복구 버퍼(recoveryBuffers) 보존
 * - 새로고침 복원(restoreLatestProject): 스토어 최신 Head 우선 복원, 레거시 LocalStorage 폴백
 * - 레거시 V1 비파괴적 읽기 변환: 원본 스토리지 키 불변(mutation 0회)
 * - JSON 내보내기/재열기 의미론적 동일성(Roundtrip)
 * - 라이브러리 병합 API(mergePatternLibrary)
 */

import type { EditorState, PhaseType } from './EditorState.js';
import type { CatChoreoPattern } from '../data/danceRoutineData.js';
import type { TimelineTrackNote } from './PhaseSequenceEditor.js';
import {
  AUTHORING_PROJECT_KIND,
  AUTHORING_SCHEMA_VERSION,
  type EditorProject,
} from '../data/EditorProject.js';
import { validateEditorProject, type ValidationDiagnostic } from '../data/ProjectValidator.js';
import { migrateV1ProjectToV2, type MigrationDiagnostic } from '../data/EditorProjectMigration.js';
import {
  mergePatternLibrary,
  type MergeOptions,
  type PatternMergeResult,
  type AuthoringPattern,
} from '../data/PatternLibraryMigration.js';
import {
  EditorProjectStore,
  type SaveResult,
  type RecoveryBufferRecord,
} from '../storage/EditorProjectStore.js';
import { EditorContentDatabase } from '../storage/EditorContentDatabase.js';
import { ReplaceProjectCommand, deepClone } from './ProjectCommands.js';

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

export interface OpenProjectOptions {
  expectedRevision?: number;
  autoSave?: boolean;
}

export interface OpenProjectResult {
  success: boolean;
  project?: EditorProject;
  revision?: number;
  errors: string[];
  warnings: string[];
  diagnostics?: ValidationDiagnostic[] | MigrationDiagnostic[];
}

export interface SaveDraftOptions {
  expectedRevision?: number;
  saveRecoveryOnError?: boolean;
}

export interface SaveDraftResult {
  success: boolean;
  revision?: number;
  snapshotId?: string;
  isConflict?: boolean;
  errors: string[];
}

export class EditorIOHandler {
  private readonly _storage: Storage | null;
  private readonly _store: EditorProjectStore | null;
  private _lastSavedRevision: number = -1;
  private _activeProjectId: string = '';
  private _saveSeq: number = 0;

  constructor(storage?: Storage, store?: EditorProjectStore) {
    if (storage) {
      this._storage = storage;
    } else if (typeof window !== 'undefined' && window.localStorage) {
      this._storage = window.localStorage;
    } else {
      this._storage = null;
    }

    if (store) {
      this._store = store;
    } else if (typeof window !== 'undefined') {
      this._store = new EditorProjectStore(new EditorContentDatabase());
    } else {
      this._store = null;
    }
  }

  get store(): EditorProjectStore | null {
    return this._store;
  }

  get lastSavedRevision(): number {
    return this._lastSavedRevision;
  }

  get activeProjectId(): string {
    return this._activeProjectId;
  }

  hasUnsavedChanges(state: EditorState): boolean {
    return this._lastSavedRevision !== state.commandManager.revision;
  }

  /**
   * 동기적 프로젝트 열기 및 원자적 검증
   * 단 하나의 오류라도 발견되면 즉시 거부하며 state에 아무런 변경 알림도 발생시키지 않습니다.
   */
  openProjectSync(
    state: EditorState,
    input: unknown | string,
    options?: OpenProjectOptions
  ): OpenProjectResult {
    let raw: unknown = input;
    if (typeof input === 'string') {
      try {
        raw = JSON.parse(input);
      } catch (e: any) {
        return {
          success: false,
          errors: [`JSON 파싱 오류: ${e.message || e}`],
          warnings: [],
        };
      }
    }

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return {
        success: false,
        errors: ['유효한 프로젝트 객체 또는 JSON 문자열이 아닙니다.'],
        warnings: [],
      };
    }

    let candidateProject: EditorProject;
    const warnings: string[] = [];
    const isV2 =
      (raw as any).kind === AUTHORING_PROJECT_KIND &&
      (raw as any).schemaVersion === AUTHORING_SCHEMA_VERSION;

    if (isV2) {
      candidateProject = JSON.parse(JSON.stringify(raw)) as EditorProject;
    } else {
      // V1 package 검증 및 무손실 변환
      const pkg = raw as Record<string, unknown>;
      if (Array.isArray(pkg.patterns)) {
        for (const p of pkg.patterns) {
          if (p && typeof p === 'object') {
            const val = state.registry.validate(p as Partial<CatChoreoPattern>);
            if (!val.valid) {
              return {
                success: false,
                errors: [
                  `패턴 "${(p as any).id || 'unknown'}" 유효성 검증 실패: ${val.errors.join(', ')}`,
                ],
                warnings: [],
              };
            }
          }
        }
      }

      const migResult = migrateV1ProjectToV2(raw, { idConflictPolicy: 'fail' });
      if (!migResult.success || !migResult.project) {
        return {
          success: false,
          errors:
            migResult.errors.length > 0
              ? migResult.errors
              : ['V1 프로젝트 변환에 실패했습니다.'],
          warnings: migResult.warnings,
          diagnostics: migResult.diagnostics,
        };
      }
      warnings.push(...migResult.warnings);
      candidateProject = migResult.project;
    }

    // 엄격한 V2 스키마 및 무결성 검증
    const validation = validateEditorProject(candidateProject);
    if (!validation.valid) {
      const errorMsgs = validation.diagnostics
        .filter((d) => d.severity === 'error')
        .map((d) => `[${d.code}] ${d.path ? d.path + ': ' : ''}${d.message}`);
      return {
        success: false,
        errors: errorMsgs.length > 0 ? errorMsgs : ['프로젝트 스키마 검증 실패'],
        warnings,
        diagnostics: validation.diagnostics,
      };
    }

    // 단일 ReplaceProjectCommand를 통한 원자적 교체
    const cmd = new ReplaceProjectCommand(candidateProject, {
      expectedRevision: options?.expectedRevision,
    });
    const cmdResult = state.commandManager.executeCommand(cmd);
    if (!cmdResult.success) {
      return {
        success: false,
        errors: cmdResult.errors,
        warnings,
        diagnostics: cmdResult.diagnostics,
      };
    }

    // V1 호환 복원: V1 패키지에 커스텀 시퀀스 트랙 노트가 포함된 경우 원본 라벨 및 세부 속성 완전 보존
    if (!isV2 && (raw as any).sequences) {
      const seqs = (raw as any).sequences;
      const phases: PhaseType[] = [
        'RUN_QUESTION',
        'ANSWER_SELECT',
        'STAR_COLLECT',
        'FEVER_PHASE_B',
      ];
      for (const phase of phases) {
        if (Array.isArray(seqs[phase])) {
          state.sequenceEditor.replaceNotesForPhase(phase, seqs[phase]);
        }
      }
    }

    this._activeProjectId = candidateProject.projectId;
    this._lastSavedRevision = candidateProject.revision;

    return {
      success: true,
      project: cmdResult.project,
      revision: cmdResult.revision,
      errors: [],
      warnings,
    };
  }

  /**
   * 프로젝트 열기 (비동기 스토어 복구 및 자동 저장 연동)
   */
  async openProject(
    state: EditorState,
    input: unknown | string,
    options?: OpenProjectOptions
  ): Promise<OpenProjectResult> {
    // 프로젝트 전환 시 미저장 작업이 존재하면 recovery buffer에 안전 보존
    let rawObj: any = null;
    try {
      rawObj = typeof input === 'string' ? JSON.parse(input) : input;
    } catch {}

    const nextProjectId = rawObj?.projectId || (rawObj?.version ? 'proj_legacy_v1' : undefined);
    if (
      nextProjectId &&
      state.currentProjectId &&
      nextProjectId !== state.currentProjectId &&
      this.hasUnsavedChanges(state) &&
      this._store
    ) {
      try {
        await this._store.saveRecoveryBuffer(
          state.currentProjectId,
          state.toEditorProject(),
          'project_switch_unsaved'
        );
      } catch {
        // 복구 버퍼 저장 에러는 본 작업 열기를 차단하지 않음
      }
    }

    const result = this.openProjectSync(state, input, options);
    if (result.success && options?.autoSave && this._store) {
      await this.saveDraft(state);
    }
    return result;
  }

  /**
   * EditorProjectStore 원자적 초안 저장 연동
   */
  async saveDraft(
    state: EditorState,
    options?: SaveDraftOptions
  ): Promise<SaveDraftResult> {
    const project = state.toEditorProject();
    const projectRevision = state.commandManager.revision;
    const projectId = project.projectId;
    const seq = ++this._saveSeq;

    if (
      options?.expectedRevision !== undefined &&
      options.expectedRevision !== projectRevision
    ) {
      return {
        success: false,
        isConflict: true,
        errors: [
          `Revision mismatch: expected ${options.expectedRevision}, current ${projectRevision}`,
        ],
      };
    }

    if (!this._store) {
      return {
        success: false,
        errors: ['스토어가 설정되지 않았습니다.'],
      };
    }

    try {
      const res: SaveResult = await this._store.saveProject(project, {
        expectedRevision: options?.expectedRevision,
        saveRecoveryOnError: options?.saveRecoveryOnError ?? true,
        createRecoveryOnError: true,
      });

      if (!res.success) {
        return {
          success: false,
          isConflict: res.conflict ?? (res.errorType === 'conflict'),
          errors: res.validationErrors || (res.error ? [res.error] : ['저장에 실패했습니다.']),
        };
      }

      // 동시성 가드: 비동기 저장이 완료되는 사이에 사용자가 새 리비전을 만들었거나 다른 프로젝트로 전환한 경우 stale 응답 무시
      if (
        state.currentProjectId === projectId &&
        state.commandManager.revision === projectRevision &&
        seq === this._saveSeq
      ) {
        this._lastSavedRevision = res.revision ?? projectRevision;
      }

      return {
        success: true,
        revision: res.revision,
        snapshotId: res.snapshotId,
        errors: [],
      };
    } catch (err: any) {
      if (options?.saveRecoveryOnError) {
        try {
          await this._store.saveRecoveryBuffer(
            projectId,
            project,
            err?.message || 'save_draft_exception'
          );
        } catch {}
      }
      return {
        success: false,
        errors: [err?.message || '저장 중 오류가 발생했습니다.'],
      };
    }
  }

  /**
   * 오래된 비동기 저장 응답 처리 핸들러 (동시성 가드)
   */
  handleAsyncSaveResponse(
    state: EditorState,
    targetProject: EditorProject,
    saveResult: { success: boolean; revision: number }
  ): { applied: boolean; reason?: string } {
    if (targetProject.projectId !== state.currentProjectId) {
      return { applied: false, reason: 'project_switched' };
    }
    if (targetProject.revision < state.commandManager.revision) {
      return { applied: false, reason: 'revision_superseded' };
    }
    this._lastSavedRevision = saveResult.revision;
    return { applied: true };
  }

  /**
   * 새로고침 시 최신 프로젝트 복원 (스토어 우선, LocalStorage 폴백)
   */
  async restoreLatestProject(state: EditorState): Promise<{
    success: boolean;
    source: 'store' | 'legacy_storage' | 'none';
    errors: string[];
  }> {
    // 1. EditorProjectStore 최신 Head 조회
    if (this._store) {
      try {
        const heads = await (this._store as any).db.transaction(
          ['projectHeads'],
          'readonly',
          async (tx: any) => tx.getAll('projectHeads')
        );
        if (heads && heads.length > 0) {
          heads.sort(
            (a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          const latestHead = heads[0];
          const latestProj = await this._store.loadProject(latestHead.projectId);
          if (latestProj) {
            const openRes = await this.openProject(state, latestProj);
            if (openRes.success) {
              return { success: true, source: 'store', errors: [] };
            }
          }
        }
      } catch (err: any) {
        console.warn('[EditorIOHandler] Failed to load latest project from store:', err);
      }
    }

    // 2. 레거시 LocalStorage 조회 (비파괴적 읽기 변환: 원본 키 일체 수정/삭제 금지)
    if (this._storage) {
      try {
        const legacyRaw = this._storage.getItem(STORAGE_KEY);
        if (legacyRaw) {
          const openRes = await this.openProject(state, legacyRaw);
          if (openRes.success) {
            return { success: true, source: 'legacy_storage', errors: [] };
          }
        }
      } catch (err: any) {
        console.warn('[EditorIOHandler] Failed to load from legacy storage:', err);
      }
    }

    return {
      success: false,
      source: 'none',
      errors: ['복원 가능한 이전 프로젝트가 없습니다.'],
    };
  }

  /**
   * 패턴 라이브러리 병합 API
   */
  mergePatternLibrary(
    state: EditorState,
    input: unknown[] | string,
    options?: MergeOptions
  ): PatternMergeResult {
    const existingPatterns: AuthoringPattern[] = state.commandManager.project.patterns;
    const mergeResult = mergePatternLibrary(existingPatterns, input, options);

    if (!mergeResult.success) {
      return mergeResult;
    }

    // 사전 검증: 단 하나의 패턴이라도 유효하지 않으면 전체 거부하고 기존 라이브러리 보존
    for (const p of mergeResult.patterns) {
      const candidateCatPattern: Partial<CatChoreoPattern> = {
        id: p.id,
        name: p.name,
        leftHand: p.target?.leftHand ?? undefined,
        rightHand: p.target?.rightHand ?? undefined,
        head: p.target?.head ?? undefined,
        hip: p.target?.hip ?? undefined,
      };
      const val = state.registry.validate(candidateCatPattern);
      if (!val.valid) {
        return {
          ...mergeResult,
          success: false,
          errors: [`패턴 "${p.id}" 유효성 검증 실패: ${val.errors.join(', ')}`],
        };
      }
    }

    // 후보 프로젝트 검증
    const currentProject = deepClone(state.commandManager.project);
    currentProject.patterns = mergeResult.patterns;
    const validation = validateEditorProject(currentProject);
    if (!validation.valid) {
      return {
        ...mergeResult,
        success: false,
        errors: validation.diagnostics
          .filter((d) => d.severity === 'error')
          .map((d) => d.message),
      };
    }

    state.registry.clear();
    for (const p of mergeResult.patterns) {
      state.registry.register({
        id: p.id,
        name: p.name || p.id,
        description: p.description || '',
        motionType: 'center_clasp',
        leftHand: p.target?.leftHand ?? null,
        rightHand: p.target?.rightHand ?? null,
        head: p.target?.head ?? null,
        hip: p.target?.hip ?? null,
        footZones: [],
        partZoneMap: {},
      });
    }

    state.commandManager.executeCommand(new ReplaceProjectCommand(currentProject));

    return mergeResult;
  }

  /**
   * V2 프로젝트 JSON 직렬화
   */
  exportProjectJSON(state: EditorState): string {
    return JSON.stringify(state.toEditorProject(), null, 2);
  }

  exportV2ProjectJSON(state: EditorState): string {
    return this.exportProjectJSON(state);
  }

  /**
   * V1 호환 프로젝트 전체 패키지 JSON 내보내기 (기존 테스트 호환성 유지)
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
   * 프로젝트 전체 데이터 JSON 불러오기 (원자적 전체 교체)
   */
  importFullProjectJSON(state: EditorState, jsonStr: string): IOResult {
    const res = this.openProjectSync(state, jsonStr);
    if (res.success) {
      return {
        success: true,
        loadedCount: state.getPatterns().length,
        errors: [],
      };
    }
    return {
      success: false,
      loadedCount: 0,
      errors: res.errors,
    };
  }

  /**
   * 외부 안무 패턴 라이브러리 JSON 불러오기
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
   * LocalStorage에서 불러오기 (비파괴적 읽기)
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
   * 수동 복구 사본 저장 API
   */
  async saveRecoveryCopy(projectId: string, raw: unknown, reason: string): Promise<string> {
    if (!this._store) {
      throw new Error('스토어가 설정되지 않았습니다.');
    }
    return this._store.saveRecoveryBuffer(projectId, raw, reason);
  }

  /**
   * 복구 버퍼 목록 조회 API
   */
  async listRecoveryCopies(projectId?: string): Promise<RecoveryBufferRecord[]> {
    if (!this._store) return [];
    return this._store.listRecoveryBuffers(projectId);
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
