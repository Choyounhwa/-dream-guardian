/**
 * ProjectCommands.ts - V2 피트니스 안무 및 타임라인 에디터 문서 명령 및 Undo/Redo 시스템
 *
 * Issue #380 / EDITOR-COMMAND:
 * - 문서 명령 + expectedRevision 기반 후보 생성 / 사전 검증(validateEditorProject) / 교체
 * - 실패 원자성: 실패 시 문서 / Undo / Redo / 리스너 변경 0
 * - 일반 수정 시 ID 불변 보장
 * - 참조 안전 패턴 삭제 (sourcePatternId 참조 시 cascade=false면 거부, cascade=true면 정리)
 * - 패턴 복제 시 고유한 새 ID 자동 생성
 * - 템플릿 일괄 적용 및 1-Step Undo 복원
 * - Undo / Redo 시 새로운 revision 번호 부여 (stale 저장 요청과 구별)
 * - 불변 조회 및 심층 복제(Deep Clone)를 통한 외부 변조 격리
 */

import {
  type EditorProject,
  type EditorPattern,
  type SequenceEvent,
  type EditorProjectMetadata,
  type EditorPreviewTempo,
} from '../data/EditorProject.js';
import {
  validateEditorProject,
  createEmptyEditorProject,
  type ValidationDiagnostic,
} from '../data/ProjectValidator.js';

export function deepClone<T>(val: T): T {
  if (val === undefined || val === null) {
    return val;
  }
  return JSON.parse(JSON.stringify(val));
}

export interface CommandSuccessResult {
  success: true;
  project: EditorProject;
  revision: number;
}

export interface CommandFailureResult {
  success: false;
  code: string;
  errors: string[];
  diagnostics?: ValidationDiagnostic[];
}

export type CommandExecutionResult = CommandSuccessResult | CommandFailureResult;

export interface ProjectCommand {
  readonly type: string;
  readonly expectedRevision?: number;
  execute(project: EditorProject): EditorProject;
}

export class AddPatternCommand implements ProjectCommand {
  readonly type = 'ADD_PATTERN';

  constructor(
    public readonly pattern: EditorPattern,
    public readonly options?: { expectedRevision?: number }
  ) {}

  get expectedRevision(): number | undefined {
    return this.options?.expectedRevision;
  }

  execute(project: EditorProject): EditorProject {
    if (project.patterns.some((p) => p.id === this.pattern.id)) {
      const err = new Error(`Pattern with ID "${this.pattern.id}" already exists`);
      (err as any).code = 'DUPLICATE_ID';
      throw err;
    }
    project.patterns.push(deepClone(this.pattern));
    return project;
  }
}

export class UpdatePatternCommand implements ProjectCommand {
  readonly type = 'UPDATE_PATTERN';

  constructor(
    public readonly patternId: string,
    public readonly updates: Partial<Omit<EditorPattern, 'id'>> & { id?: string },
    public readonly options?: { expectedRevision?: number }
  ) {}

  get expectedRevision(): number | undefined {
    return this.options?.expectedRevision;
  }

  execute(project: EditorProject): EditorProject {
    if (this.updates.id !== undefined && this.updates.id !== this.patternId) {
      const err = new Error('Pattern ID is immutable and cannot be updated');
      (err as any).code = 'ID_IMMUTABLE';
      throw err;
    }
    const index = project.patterns.findIndex((p) => p.id === this.patternId);
    if (index === -1) {
      const err = new Error(`Pattern with ID "${this.patternId}" not found`);
      (err as any).code = 'PATTERN_NOT_FOUND';
      throw err;
    }
    const existing = project.patterns[index];
    const updated: EditorPattern = {
      ...existing,
      ...deepClone(this.updates),
      id: existing.id,
    };
    if (this.updates.target) {
      updated.target = {
        ...existing.target,
        ...deepClone(this.updates.target),
      };
    }
    project.patterns[index] = updated;
    return project;
  }
}

export class DeletePatternCommand implements ProjectCommand {
  readonly type = 'DELETE_PATTERN';

  constructor(
    public readonly patternId: string,
    public readonly options?: { cascade?: boolean; expectedRevision?: number }
  ) {}

  get expectedRevision(): number | undefined {
    return this.options?.expectedRevision;
  }

  execute(project: EditorProject): EditorProject {
    const cascade = this.options?.cascade ?? false;
    const index = project.patterns.findIndex((p) => p.id === this.patternId);
    if (index === -1) {
      const err = new Error(`Pattern with ID "${this.patternId}" not found`);
      (err as any).code = 'PATTERN_NOT_FOUND';
      throw err;
    }

    const referencingEvents: { sequenceId: string; eventId?: string }[] = [];
    for (const seq of project.sequences) {
      for (const evt of seq.events) {
        if ((evt as any).sourcePatternId === this.patternId) {
          referencingEvents.push({
            sequenceId: seq.id,
            eventId: (evt as any).id ?? (evt as any).eventId,
          });
        }
      }
    }

    if (referencingEvents.length > 0 && !cascade) {
      const err = new Error(
        `Pattern "${this.patternId}" is referenced by ${referencingEvents.length} event(s) and cascade=false`
      );
      (err as any).code = 'PATTERN_REFERENCED';
      throw err;
    }

    if (cascade && referencingEvents.length > 0) {
      for (const seq of project.sequences) {
        seq.events = seq.events.filter((evt) => (evt as any).sourcePatternId !== this.patternId);
      }
    }

    project.patterns.splice(index, 1);
    return project;
  }
}

export class DuplicatePatternCommand implements ProjectCommand {
  readonly type = 'DUPLICATE_PATTERN';

  constructor(
    public readonly sourcePatternId: string,
    public readonly options?: { newId?: string; newName?: string; expectedRevision?: number }
  ) {}

  get expectedRevision(): number | undefined {
    return this.options?.expectedRevision;
  }

  execute(project: EditorProject): EditorProject {
    const existing = project.patterns.find((p) => p.id === this.sourcePatternId);
    if (!existing) {
      const err = new Error(`Source pattern with ID "${this.sourcePatternId}" not found`);
      (err as any).code = 'PATTERN_NOT_FOUND';
      throw err;
    }

    let newId = this.options?.newId;
    if (newId) {
      if (project.patterns.some((p) => p.id === newId)) {
        const err = new Error(`Target pattern ID "${newId}" already exists`);
        (err as any).code = 'DUPLICATE_ID';
        throw err;
      }
    } else {
      const baseId = `${this.sourcePatternId}_COPY`;
      let candidateId = baseId;
      let counter = 2;
      while (project.patterns.some((p) => p.id === candidateId)) {
        candidateId = `${baseId}_${counter}`;
        counter++;
      }
      newId = candidateId;
    }

    const newName = this.options?.newName ?? `${existing.name} (Copy)`;
    const duplicated: EditorPattern = {
      ...deepClone(existing),
      id: newId,
      name: newName,
    };

    project.patterns.push(duplicated);
    return project;
  }
}

export class AddEventCommand implements ProjectCommand {
  readonly type = 'ADD_EVENT';

  constructor(
    public readonly sequenceId: string,
    public readonly event: SequenceEvent,
    public readonly options?: { expectedRevision?: number }
  ) {}

  get expectedRevision(): number | undefined {
    return this.options?.expectedRevision;
  }

  execute(project: EditorProject): EditorProject {
    const seq = project.sequences.find((s) => s.id === this.sequenceId);
    if (!seq) {
      const err = new Error(`Sequence with ID "${this.sequenceId}" not found`);
      (err as any).code = 'SEQUENCE_NOT_FOUND';
      throw err;
    }
    const eventId = (this.event as any).id ?? (this.event as any).eventId;
    if (eventId && seq.events.some((e) => ((e as any).id ?? (e as any).eventId) === eventId)) {
      const err = new Error(`Event with ID "${eventId}" already exists in sequence "${this.sequenceId}"`);
      (err as any).code = 'DUPLICATE_ID';
      throw err;
    }
    seq.events.push(deepClone(this.event));
    return project;
  }
}

export class UpdateEventCommand implements ProjectCommand {
  readonly type = 'UPDATE_EVENT';

  constructor(
    public readonly sequenceId: string,
    public readonly eventId: string,
    public readonly updates: Partial<SequenceEvent> & { id?: string; eventId?: string },
    public readonly options?: { expectedRevision?: number }
  ) {}

  get expectedRevision(): number | undefined {
    return this.options?.expectedRevision;
  }

  execute(project: EditorProject): EditorProject {
    if (
      (this.updates.id !== undefined && this.updates.id !== this.eventId) ||
      (this.updates.eventId !== undefined && this.updates.eventId !== this.eventId)
    ) {
      const err = new Error('Event ID is immutable and cannot be updated');
      (err as any).code = 'ID_IMMUTABLE';
      throw err;
    }
    const seq = project.sequences.find((s) => s.id === this.sequenceId);
    if (!seq) {
      const err = new Error(`Sequence with ID "${this.sequenceId}" not found`);
      (err as any).code = 'SEQUENCE_NOT_FOUND';
      throw err;
    }
    const idx = seq.events.findIndex(
      (e) => ((e as any).id ?? (e as any).eventId) === this.eventId
    );
    if (idx === -1) {
      const err = new Error(`Event with ID "${this.eventId}" not found in sequence "${this.sequenceId}"`);
      (err as any).code = 'EVENT_NOT_FOUND';
      throw err;
    }
    const existing = seq.events[idx];
    const updated = {
      ...existing,
      ...deepClone(this.updates),
    };
    if ((existing as any).id) (updated as any).id = (existing as any).id;
    if ((existing as any).eventId) (updated as any).eventId = (existing as any).eventId;
    seq.events[idx] = updated as SequenceEvent;
    return project;
  }
}

export class DeleteEventCommand implements ProjectCommand {
  readonly type = 'DELETE_EVENT';

  constructor(
    public readonly sequenceId: string,
    public readonly eventId: string,
    public readonly options?: { expectedRevision?: number }
  ) {}

  get expectedRevision(): number | undefined {
    return this.options?.expectedRevision;
  }

  execute(project: EditorProject): EditorProject {
    const seq = project.sequences.find((s) => s.id === this.sequenceId);
    if (!seq) {
      const err = new Error(`Sequence with ID "${this.sequenceId}" not found`);
      (err as any).code = 'SEQUENCE_NOT_FOUND';
      throw err;
    }
    const idx = seq.events.findIndex(
      (e) => ((e as any).id ?? (e as any).eventId) === this.eventId
    );
    if (idx === -1) {
      const err = new Error(`Event with ID "${this.eventId}" not found in sequence "${this.sequenceId}"`);
      (err as any).code = 'EVENT_NOT_FOUND';
      throw err;
    }
    seq.events.splice(idx, 1);
    return project;
  }
}

export class ApplyTemplateCommand implements ProjectCommand {
  readonly type = 'APPLY_TEMPLATE';

  constructor(
    public readonly params: {
      sequenceId: string;
      events: SequenceEvent[];
      range?: { startTick: number; endTick: number };
    },
    public readonly options?: { expectedRevision?: number }
  ) {}

  get expectedRevision(): number | undefined {
    return this.options?.expectedRevision;
  }

  execute(project: EditorProject): EditorProject {
    const seq = project.sequences.find((s) => s.id === this.params.sequenceId);
    if (!seq) {
      const err = new Error(`Sequence with ID "${this.params.sequenceId}" not found`);
      (err as any).code = 'SEQUENCE_NOT_FOUND';
      throw err;
    }
    if (this.params.range) {
      const { startTick, endTick } = this.params.range;
      seq.events = seq.events.filter((e) => {
        const tick = (e as any).tick ?? (e as any).startTick ?? 0;
        return tick < startTick || tick > endTick;
      });
      seq.events.push(...deepClone(this.params.events));
    } else {
      seq.events = deepClone(this.params.events);
    }
    return project;
  }
}

export class UpdateMetadataCommand implements ProjectCommand {
  readonly type = 'UPDATE_METADATA';

  constructor(
    public readonly metadata: Partial<EditorProjectMetadata>,
    public readonly options?: { expectedRevision?: number }
  ) {}

  get expectedRevision(): number | undefined {
    return this.options?.expectedRevision;
  }

  execute(project: EditorProject): EditorProject {
    project.metadata = {
      ...project.metadata,
      ...deepClone(this.metadata),
      updatedAt: new Date().toISOString(),
    };
    return project;
  }
}

export class UpdatePreviewTempoCommand implements ProjectCommand {
  readonly type = 'UPDATE_PREVIEW_TEMPO';

  constructor(
    public readonly tempo: Partial<EditorPreviewTempo>,
    public readonly options?: { expectedRevision?: number }
  ) {}

  get expectedRevision(): number | undefined {
    return this.options?.expectedRevision;
  }

  execute(project: EditorProject): EditorProject {
    project.previewTempo = {
      ...project.previewTempo,
      ...deepClone(this.tempo),
    };
    return project;
  }
}

export class ReplaceProjectCommand implements ProjectCommand {
  readonly type = 'REPLACE_PROJECT';

  constructor(
    public readonly newProject: EditorProject,
    public readonly options?: { expectedRevision?: number }
  ) {}

  get expectedRevision(): number | undefined {
    return this.options?.expectedRevision;
  }

  execute(_project: EditorProject): EditorProject {
    return deepClone(this.newProject);
  }
}

export interface ProjectCommandManagerOptions {
  historyLimit?: number;
  onDocumentChange?: (project: EditorProject) => void;
}

export class ProjectCommandManager {
  private _project: EditorProject;
  private readonly _undoStack: EditorProject[] = [];
  private readonly _redoStack: EditorProject[] = [];
  private readonly _listeners: Set<(project: EditorProject) => void> = new Set();
  private readonly _historyLimit: number;

  constructor(
    initialProject?: EditorProject,
    options?: ProjectCommandManagerOptions
  ) {
    this._historyLimit = options?.historyLimit ?? 100;
    if (initialProject) {
      this._project = deepClone(initialProject);
    } else {
      this._project = createEmptyEditorProject();
    }
    if (options?.onDocumentChange) {
      this._listeners.add(options.onDocumentChange);
    }
  }

  getDocument(): EditorProject {
    return deepClone(this._project);
  }

  get project(): EditorProject {
    return deepClone(this._project);
  }

  get revision(): number {
    return this._project.revision;
  }

  executeCommand(command: ProjectCommand): CommandExecutionResult {
    // 1. Revision mismatch check
    if (
      command.expectedRevision !== undefined &&
      command.expectedRevision !== this._project.revision
    ) {
      return {
        success: false,
        code: 'REVISION_MISMATCH',
        errors: [
          `Revision mismatch: expected ${command.expectedRevision}, actual ${this._project.revision}`,
        ],
      };
    }

    // 2. Candidate generation
    let candidate: EditorProject;
    try {
      candidate = command.execute(deepClone(this._project));
    } catch (e: any) {
      return {
        success: false,
        code: e.code ?? 'COMMAND_EXECUTION_ERROR',
        errors: [e.message ?? 'Command execution failed'],
      };
    }

    // 3. Validation before replacement
    const validation = validateEditorProject(candidate);
    if (!validation.valid) {
      return {
        success: false,
        code: 'VALIDATION_FAILED',
        errors: validation.diagnostics.map((d) => d.message),
        diagnostics: validation.diagnostics,
      };
    }

    // 4. Success state transition
    const nextRevision = this._project.revision + 1;
    candidate.revision = nextRevision;
    candidate.metadata.updatedAt = new Date().toISOString();

    // Push previous snapshot to undo stack
    this._undoStack.push(deepClone(this._project));
    if (this._undoStack.length > this._historyLimit) {
      this._undoStack.shift();
    }
    // Clear redo stack on new command
    this._redoStack.length = 0;

    this._project = candidate;
    this.notifyDocumentChange();

    return {
      success: true,
      project: this.getDocument(),
      revision: nextRevision,
    };
  }

  canUndo(): boolean {
    return this._undoStack.length > 0;
  }

  canRedo(): boolean {
    return this._redoStack.length > 0;
  }

  undo(): CommandExecutionResult {
    if (!this.canUndo()) {
      return {
        success: false,
        code: 'CANNOT_UNDO',
        errors: ['Undo stack is empty'],
      };
    }

    const previousSnapshot = this._undoStack.pop()!;
    this._redoStack.push(deepClone(this._project));

    const nextRevision = this._project.revision + 1;
    const restored = deepClone(previousSnapshot);
    restored.revision = nextRevision;
    restored.metadata.updatedAt = new Date().toISOString();

    this._project = restored;
    this.notifyDocumentChange();

    return {
      success: true,
      project: this.getDocument(),
      revision: nextRevision,
    };
  }

  redo(): CommandExecutionResult {
    if (!this.canRedo()) {
      return {
        success: false,
        code: 'CANNOT_REDO',
        errors: ['Redo stack is empty'],
      };
    }

    const nextSnapshot = this._redoStack.pop()!;
    this._undoStack.push(deepClone(this._project));

    const nextRevision = this._project.revision + 1;
    const restored = deepClone(nextSnapshot);
    restored.revision = nextRevision;
    restored.metadata.updatedAt = new Date().toISOString();

    this._project = restored;
    this.notifyDocumentChange();

    return {
      success: true,
      project: this.getDocument(),
      revision: nextRevision,
    };
  }

  addPattern(
    pattern: EditorPattern,
    options?: { expectedRevision?: number }
  ): CommandExecutionResult {
    return this.executeCommand(new AddPatternCommand(pattern, options));
  }

  updatePattern(
    patternId: string,
    updates: Partial<Omit<EditorPattern, 'id'>> & { id?: string },
    options?: { expectedRevision?: number }
  ): CommandExecutionResult {
    return this.executeCommand(new UpdatePatternCommand(patternId, updates, options));
  }

  deletePattern(
    patternId: string,
    options?: { cascade?: boolean; expectedRevision?: number }
  ): CommandExecutionResult {
    return this.executeCommand(new DeletePatternCommand(patternId, options));
  }

  duplicatePattern(
    sourcePatternId: string,
    options?: { newId?: string; newName?: string; expectedRevision?: number }
  ): CommandExecutionResult {
    return this.executeCommand(new DuplicatePatternCommand(sourcePatternId, options));
  }

  addEvent(
    sequenceId: string,
    event: SequenceEvent,
    options?: { expectedRevision?: number }
  ): CommandExecutionResult {
    return this.executeCommand(new AddEventCommand(sequenceId, event, options));
  }

  updateEvent(
    sequenceId: string,
    eventId: string,
    updates: Partial<SequenceEvent> & { id?: string; eventId?: string },
    options?: { expectedRevision?: number }
  ): CommandExecutionResult {
    return this.executeCommand(new UpdateEventCommand(sequenceId, eventId, updates, options));
  }

  deleteEvent(
    sequenceId: string,
    eventId: string,
    options?: { expectedRevision?: number }
  ): CommandExecutionResult {
    return this.executeCommand(new DeleteEventCommand(sequenceId, eventId, options));
  }

  applyTemplate(
    params: {
      sequenceId: string;
      events: SequenceEvent[];
      range?: { startTick: number; endTick: number };
    },
    options?: { expectedRevision?: number }
  ): CommandExecutionResult {
    return this.executeCommand(new ApplyTemplateCommand(params, options));
  }

  updateMetadata(
    metadata: Partial<EditorProjectMetadata>,
    options?: { expectedRevision?: number }
  ): CommandExecutionResult {
    return this.executeCommand(new UpdateMetadataCommand(metadata, options));
  }

  updatePreviewTempo(
    tempo: Partial<EditorPreviewTempo>,
    options?: { expectedRevision?: number }
  ): CommandExecutionResult {
    return this.executeCommand(new UpdatePreviewTempoCommand(tempo, options));
  }

  replaceProject(
    project: EditorProject,
    options?: { expectedRevision?: number }
  ): CommandExecutionResult {
    return this.executeCommand(new ReplaceProjectCommand(project, options));
  }

  addListener(listener: (project: EditorProject) => void): void {
    this._listeners.add(listener);
  }

  removeListener(listener: (project: EditorProject) => void): void {
    this._listeners.delete(listener);
  }

  private notifyDocumentChange(): void {
    const doc = this.getDocument();
    for (const listener of this._listeners) {
      try {
        listener(doc);
      } catch (e) {
        console.error('[ProjectCommandManager] Listener error:', e);
      }
    }
  }

  clearHistory(): void {
    this._undoStack.length = 0;
    this._redoStack.length = 0;
  }
}
