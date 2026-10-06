/**
 * EditorPublishController.ts - 에디터 프로젝트 검증·불변 게시·적용 예약 컨트롤러
 *
 * Issue #387 / EDITOR-PUBLISH:
 * 1. 프로젝트 유효성 검증(validateProject) 및 컴파일(compileProject) 연계
 * 2. 미완성/수정 중인 폼(dirty/uncommitted form input)이 있을 경우 게시 차단
 * 3. 검증 결과 에러/경고 목록, sourceRevision, contentHash, diff 요약 상태 모델 제공
 * 4. 게시(publish): PublishedContentStore.publish 불변 저장
 * 5. 적용 예약(stageActivation / scheduleRollback): "다음 스테이지 시작 시 적용" 예약 상태 등록
 *    - "현재 실행 중인 세션에 즉시 반영된다"고 잘못 표시하지 않음
 * 6. 검증 또는 게시 실패 시 기존 activeContentHash 및 현재 작업 프로젝트 상태 보존
 * 7. 이전 정상본(previousHealthyHash) 목록 조회 및 롤백 예약(rollback) 액션 연동 (삭제 없는 안전한 롤백)
 * 8. Project / Library / CompiledContentPack 간 kind 검증 (kind 혼동 거부)
 */

import { EditorState } from './EditorState.js';
import {
  PublishedContentStore,
  type PublishResult,
  type RollbackResult,
  type PublishedPackSummary,
  type ActivationHeadRecord,
} from '../storage/PublishedContentStore.js';
import { EditorContentDatabase } from '../storage/EditorContentDatabase.js';
import {
  AUTHORING_PROJECT_KIND,
  type EditorProject,
} from '../data/EditorProject.js';
import {
  PUBLISHED_PACK_KIND,
  type PublishedContentPack,
  validatePublishedContentPack,
} from '../data/PublishedContentPack.js';
import {
  compileEditorProject,
  type CompileResult,
} from '../data/ContentCompiler.js';
import type { ValidationDiagnostic } from '../data/ProjectValidator.js';

/**
 * 프로젝트 변경점 diff 요약 모델
 */
export interface ProjectDiffSummary {
  isFirstPublish: boolean;
  previousHash: string | null;
  newHash: string;
  sourceRevision: number;
  notesCount: number;
  patternsCount: number;
  bpm: number;
  hasBpmChange: boolean;
  notesDiff: number;
  patternsDiff: number;
  summaryText: string;
}

/**
 * 게시 사전 검증 결과 모델
 */
export interface PublishValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  diagnostics: ValidationDiagnostic[];
  sourceRevision?: number;
  contentHash?: string;
  diffSummary?: ProjectDiffSummary | null;
  compiledPack?: PublishedContentPack;
}

/**
 * 게시 및 적용 상태 스냅샷
 */
export interface EditorPublishStatus {
  projectId: string;
  sourceRevision: number;
  isFormDirty: boolean;
  activeContentHash: string | null;
  previousHealthyHash: string | null;
  stagedActivationHash: string | null;
  lastPublishedHash: string | null;
  lastValidation: PublishValidationResult | null;
  isStagedForNextStage: boolean;
}

/**
 * 게시 옵션
 */
export interface EditorPublishOptions {
  expectedRevision?: number;
  stageActivation?: boolean;
}

/**
 * 테스트 플레이 론치 디스크립터 (Issue #393 / #391 격리 계약)
 */
export interface TestLaunchDescriptor {
  contentHash: string;
  rulesetId: string;
  rulesetHash: string;
  bpm: number;
  sourceRevision: number;
  testPlayUrl: string;
  isIsolatedSession: boolean;
  isolationContract: string;
}

/**
 * 테스트 플레이 준비 결과 모델
 */
export interface TestLaunchPreparationResult {
  ok: boolean;
  error?: string;
  diagnostics?: string[];
  descriptor?: TestLaunchDescriptor;
  pack?: PublishedContentPack;
}

/**
 * 테스트 플레이 실행 옵션
 */
export interface TestLaunchOptions {
  windowOpener?: (url: string) => boolean | Window | null;
  targetOrigin?: string;
  expectedHash?: string;
}

/**
 * 테스트 플레이 실행 결과 모델
 */
export interface TestLaunchResult {
  ok: boolean;
  error?: string;
  diagnostics?: string[];
  descriptor?: TestLaunchDescriptor;
  targetHash?: string;
  executedHash?: string;
  openedWindow?: boolean;
}

export class EditorPublishController {
  private readonly _state: EditorState;
  private readonly _store: PublishedContentStore;
  private readonly _db: EditorContentDatabase;

  private _isFormDirty: boolean = false;
  private _stagedActivationHash: string | null = null;
  private _lastPublishedHash: string | null = null;
  private _lastValidationResult: PublishValidationResult | null = null;

  constructor(
    state: EditorState,
    store?: PublishedContentStore,
    db?: EditorContentDatabase
  ) {
    this._state = state;
    this._db = db ?? new EditorContentDatabase();
    this._store = store ?? new PublishedContentStore(this._db);
  }

  get state(): EditorState {
    return this._state;
  }

  get store(): PublishedContentStore {
    return this._store;
  }

  /**
   * 폼 수정 중(dirty / uncommitted) 상태 검사
   * - 슬롯 폼 버퍼(slotIndex 0~6) 또는 컨트롤러 레벨 dirty 플래그 확인
   */
  hasUncommittedChanges(): boolean {
    if (this._isFormDirty) {
      return true;
    }

    // 슬롯 0~6의 미확정 편집 버퍼 확인
    for (let i = 0; i < 7; i++) {
      const buf = this._state.getFormBuffer(i);
      if (buf && buf.isDirty) {
        return true;
      }
    }

    return false;
  }

  /**
   * 외부 폼(모달/바인딩 입력 등)의 미반영 플래그 설정
   */
  setFormDirty(dirty: boolean): void {
    this._isFormDirty = dirty;
  }

  /**
   * kind 검증: Project / Library / CompiledContentPack 간 혼동 엄격 차단
   */
  private validateKind(candidate: unknown): { ok: boolean; error?: string } {
    if (!candidate || typeof candidate !== 'object') {
      return {
        ok: false,
        error: '프로젝트 데이터가 올바른 객체 형식이 아닙니다 (null or invalid object).',
      };
    }

    const kind = (candidate as { kind?: unknown }).kind;

    if (kind === PUBLISHED_PACK_KIND) {
      return {
        ok: false,
        error: `Kind 불일치 거부: 컴파일된 ContentPack(${PUBLISHED_PACK_KIND})은 에디터 원본 프로젝트로 게시할 수 없습니다.`,
      };
    }

    if (
      kind === 'dream-guardian-pattern-library' ||
      ('patterns' in (candidate as object) && kind !== AUTHORING_PROJECT_KIND)
    ) {
      return {
        ok: false,
        error: `Kind 불일치 거부: 패턴 라이브러리는 직접 게시할 수 없습니다 (kind: "${String(kind)}").`,
      };
    }

    if (kind !== AUTHORING_PROJECT_KIND) {
      return {
        ok: false,
        error: `Kind 불일치 거부: 기대된 프로젝트 종류 "${AUTHORING_PROJECT_KIND}" 대신 "${String(kind)}"이 전달되었습니다.`,
      };
    }

    return { ok: true };
  }

  /**
   * 프로젝트 유효성 검증 및 사전 컴파일 연계
   */
  async validateProject(candidate?: unknown): Promise<PublishValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. 미완성/수정 중인 폼(dirty) 검사
    if (this.hasUncommittedChanges()) {
      errors.push(
        '수정 중인 미완성 폼 입력이 있습니다 (Uncommitted form changes present). 폼 입력을 확정하거나 취소한 후 게시해 주세요.'
      );
    }

    // 대상 프로젝트 결정 (지정되지 않은 경우 현재 에디터 상태 기준)
    const target = candidate !== undefined ? candidate : this._state.toEditorProject();

    // 2. kind 검증
    const kindCheck = this.validateKind(target);
    if (!kindCheck.ok) {
      errors.push(kindCheck.error!);
      const failResult: PublishValidationResult = {
        valid: false,
        errors,
        warnings,
        diagnostics: [],
        diffSummary: null,
      };
      this._lastValidationResult = failResult;
      return failResult;
    }

    const project = target as EditorProject;

    // 3. 결정적 컴파일러(compileEditorProject)를 통한 무결성 및 역량 검증
    let compileResult: CompileResult;
    try {
      compileResult = compileEditorProject(project);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`컴파일 중 치명적 오류 발생: ${msg}`);
      const failResult: PublishValidationResult = {
        valid: false,
        errors,
        warnings,
        diagnostics: [],
        sourceRevision: project.revision,
        diffSummary: null,
      };
      this._lastValidationResult = failResult;
      return failResult;
    }

    // 진단 메시지 수집
    for (const diag of compileResult.diagnostics) {
      if (diag.severity === 'error') {
        errors.push(`[${diag.code}] ${diag.message}`);
      } else if (diag.severity === 'warning') {
        warnings.push(`[${diag.code}] ${diag.message}`);
      }
    }

    if (!compileResult.success || !compileResult.pack || errors.length > 0) {
      const failResult: PublishValidationResult = {
        valid: false,
        errors,
        warnings,
        diagnostics: compileResult.diagnostics,
        sourceRevision: project.revision,
        contentHash: compileResult.pack?.contentHash,
        diffSummary: null,
      };
      this._lastValidationResult = failResult;
      return failResult;
    }

    // 4. 변경점(diff) 요약 계산
    const diffSummary = await this.computeDiffSummary(project, compileResult.pack);

    const successResult: PublishValidationResult = {
      valid: true,
      errors: [],
      warnings,
      diagnostics: compileResult.diagnostics,
      sourceRevision: project.revision,
      contentHash: compileResult.pack.contentHash,
      diffSummary,
      compiledPack: compileResult.pack,
    };

    this._lastValidationResult = successResult;
    return successResult;
  }

  /**
   * 컴파일러 연계 (단순 컴파일 래퍼)
   */
  compileProject(candidate?: unknown): CompileResult {
    const target = candidate !== undefined ? candidate : this._state.toEditorProject();
    const kindCheck = this.validateKind(target);
    if (!kindCheck.ok) {
      throw new Error(kindCheck.error);
    }
    return compileEditorProject(target as EditorProject);
  }

  /**
   * 변경점 diff 요약 모델 생성
   */
  private async computeDiffSummary(
    project: EditorProject,
    pack: PublishedContentPack
  ): Promise<ProjectDiffSummary> {
    const activePack = await this._store.getActivePack(project.projectId);

    let notesCount = 0;
    for (const seq of project.sequences) {
      notesCount += seq.events.length;
    }
    const patternsCount = project.patterns.length;
    const bpm = project.previewTempo?.bpm ?? 120;

    if (!activePack) {
      return {
        isFirstPublish: true,
        previousHash: null,
        newHash: pack.contentHash,
        sourceRevision: project.revision,
        notesCount,
        patternsCount,
        bpm,
        hasBpmChange: false,
        notesDiff: notesCount,
        patternsDiff: patternsCount,
        summaryText: `신규 최초 게시본입니다. (노트 ${notesCount}개, 패턴 ${patternsCount}개, ${bpm} BPM)`,
      };
    }

    // 기존 활성 팩과 비교
    let prevNotesCount = 0;
    for (const stage of Object.values(activePack.stages)) {
      if (stage.phaseA?.starNotes) prevNotesCount += stage.phaseA.starNotes.length;
      if (stage.phaseB?.feverNotes) prevNotesCount += stage.phaseB.feverNotes.length;
    }
    const notesDiff = notesCount - prevNotesCount;
    const patternsDiff = patternsCount; // compiled pack에는 pattern 메타가 직접 들어가지 않음
    const hasBpmChange = false; // pack 레벨에 고정된 tempo 기준

    const summaryText = `기존 버전(${activePack.contentHash.slice(0, 8)}...) 대비 수정: 노트 변화 ${notesDiff >= 0 ? `+${notesDiff}` : notesDiff}개, 새 해시 ${pack.contentHash.slice(0, 8)}...`;

    return {
      isFirstPublish: false,
      previousHash: activePack.contentHash,
      newHash: pack.contentHash,
      sourceRevision: project.revision,
      notesCount,
      patternsCount,
      bpm,
      hasBpmChange,
      notesDiff,
      patternsDiff,
      summaryText,
    };
  }

  /**
   * 불변 게시 (publish): PublishedContentStore.publishPack 호출
   */
  async publish(options?: EditorPublishOptions): Promise<PublishResult> {
    const validation = await this.validateProject();

    if (!validation.valid || !validation.compiledPack) {
      throw new Error(
        `게시 전 검증 실패 (Validation failed): ${validation.errors.join('; ')}`
      );
    }

    const pack = validation.compiledPack;
    const activateNow = options?.stageActivation ?? false;

    // PublishedContentStore에 불변 영구 저장
    const result = await this._store.publish(pack, {
      expectedSourceRevision: options?.expectedRevision ?? validation.sourceRevision,
      activateNow,
    });

    this._lastPublishedHash = result.contentHash;

    if (activateNow) {
      this._stagedActivationHash = result.contentHash;
    }

    return result;
  }

  /**
   * 외부 프로젝트 객체 기준 게시 시도
   */
  async publishFromProject(
    project: unknown,
    options?: EditorPublishOptions
  ): Promise<PublishResult> {
    const validation = await this.validateProject(project);

    if (!validation.valid || !validation.compiledPack) {
      throw new Error(
        `게시 전 검증 실패 (Validation failed): ${validation.errors.join('; ')}`
      );
    }

    const pack = validation.compiledPack;
    const activateNow = options?.stageActivation ?? false;

    const result = await this._store.publish(pack, {
      expectedSourceRevision: options?.expectedRevision ?? validation.sourceRevision,
      activateNow,
    });

    this._lastPublishedHash = result.contentHash;

    if (activateNow) {
      this._stagedActivationHash = result.contentHash;
    }

    return result;
  }

  /**
   * 적용 예약 (stageActivation): "다음 스테이지 시작 시 적용" 상태 등록
   */
  async stageActivation(targetHash?: string): Promise<{ success: boolean; stagedHash: string }> {
    const hashToStage = targetHash ?? this._lastPublishedHash;

    if (!hashToStage) {
      throw new Error('적용 예약할 게시본 Hash가 지정되지 않았습니다.');
    }

    const exists = await this._store.hasPublishedPack(hashToStage);
    if (!exists) {
      throw new Error(`저장소에 해당 게시본이 존재하지 않습니다: ${hashToStage}`);
    }

    const head = await this._store.getActivationHead(this._state.currentProjectId);
    if (head) {
      await this._store.scheduleRollback(this._state.currentProjectId, hashToStage);
    }

    this._stagedActivationHash = hashToStage;

    return {
      success: true,
      stagedHash: hashToStage,
    };
  }

  /**
   * 이전 정상본 또는 지정 hash 대상 롤백 예약 (비파괴적 롤백)
   */
  async scheduleRollback(targetHash?: string): Promise<RollbackResult> {
    const res = await this._store.scheduleRollback(
      this._state.currentProjectId,
      targetHash
    );

    if (res.scheduledHash) {
      this._stagedActivationHash = res.scheduledHash;
    }

    return res;
  }

  /**
   * 이전 정상본(previousHealthyHash) 조회
   */
  async getPreviousHealthyHash(): Promise<string | null> {
    const head = await this._store.getActivationHead(this._state.currentProjectId);
    return head?.previousHealthyHash ?? null;
  }

  /**
   * 현재 프로젝트의 게시된 모든 버전 목록 조회
   */
  async listPublishedVersions(): Promise<PublishedPackSummary[]> {
    const all = await this._store.listPublishedPacks();
    return all.filter((p) => p.sourceProjectId === this._state.currentProjectId);
  }

  /**
   * 적용 예약 상태 안내 문구
   * - "현재 실행 중인 세션에 즉시 반영된다"고 잘못 표시하지 않음
   */
  getActivationNoticeText(): string {
    return '⚠️ 다음 스테이지 진입 시 안전하게 로드 및 적용됩니다. 현재 실행 중인 실시간 게임 세션에는 즉시 반영되지 않습니다.';
  }

  /**
   * 현재 게시 및 적용 상태 조회
   */
  async getStatus(): Promise<EditorPublishStatus> {
    const head: ActivationHeadRecord | null = await this._store.getActivationHead(
      this._state.currentProjectId
    );

    const isStaged = Boolean(
      this._stagedActivationHash ||
        (head?.stagedRollbackHash && head.stagedRollbackHash !== head.activeContentHash)
    );

    return {
      projectId: this._state.currentProjectId,
      sourceRevision: this._state.commandManager?.revision ?? this._state.currentRevision,
      isFormDirty: this.hasUncommittedChanges(),
      activeContentHash: head?.activeContentHash ?? null,
      previousHealthyHash: head?.previousHealthyHash ?? null,
      stagedActivationHash: this._stagedActivationHash ?? head?.stagedRollbackHash ?? null,
      lastPublishedHash: this._lastPublishedHash,
      lastValidation: this._lastValidationResult,
      isStagedForNextStage: isStaged,
    };
  }

  /**
   * 게시된 불변 팩 기반 테스트 플레이 준비 (Issue #393 / EDITOR-TEST-LAUNCH)
   *
   * 1. 폼 버퍼 미반영(dirty) 검사: 작성 중이면 즉시 차단
   * 2. 초안 직접 전송 금지: 저장소(PublishedContentStore)에 이미 검증·저장된 PublishedContentPack만 사용
   * 3. 대상 hash 결정: targetHash 또는 활성 게시본(activeContentHash)
   * 4. 미게시 상태(저장소에 없음) 또는 활성 게시본 부재 시 차단
   * 5. 게시본 호환성 및 무결성 검증 (validatePublishedContentPack, kind 불일치 차단, hash 변조 차단)
   * 6. bpm, rulesetId, rulesetHash, sourceRevision 메타데이터 및 격리 URL 디스크립터 생성
   */
  async prepareTestLaunch(targetHash?: string): Promise<TestLaunchPreparationResult> {
    // 1. 미반영 dirty form 검사
    if (this.hasUncommittedChanges()) {
      return {
        ok: false,
        error: '수정 중인 미완성 폼 입력이 있습니다 (Uncommitted form changes present). 폼 입력을 확정하거나 취소한 후 테스트 플레이를 실행해 주세요.',
        diagnostics: ['uncommitted-form-changes'],
      };
    }

    // 2. 대상 hash 결정 (초안은 직접 실행하지 않음)
    let resolvedHash = targetHash ? targetHash.trim() : null;
    if (!resolvedHash) {
      const activeHead = await this._store.getActivationHead(this._state.currentProjectId);
      resolvedHash = activeHead?.activeContentHash || this._lastPublishedHash || null;
    }

    if (!resolvedHash) {
      return {
        ok: false,
        error: '게시된 팩이 없거나 활성 게시본(activeContentHash)이 설정되지 않았습니다. 먼저 프로젝트를 게시하세요.',
        diagnostics: ['no-published-pack'],
      };
    }

    // 3. 저장소에서 팩 조회
    let pack: PublishedContentPack | null = null;
    try {
      pack = await this._store.getPublishedPack(resolvedHash);
    } catch (err) {
      return {
        ok: false,
        error: `저장소 조회 중 오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`,
        diagnostics: ['store-read-error'],
      };
    }

    if (!pack) {
      return {
        ok: false,
        error: `저장소에 지정된 게시본 [${resolvedHash}]이 존재하지 않습니다 (Unpublished pack).`,
        diagnostics: ['pack-not-found'],
      };
    }

    // 4. kind 검증 (kind 혼동/오염 차단)
    if (pack.kind !== PUBLISHED_PACK_KIND) {
      return {
        ok: false,
        error: `Kind 불일치: 기대된 게시본 kind "${PUBLISHED_PACK_KIND}" 대신 "${String((pack as any).kind)}"이 발견되었습니다.`,
        diagnostics: ['kind-mismatch'],
      };
    }

    // 5. 게시본 무결성 및 호환성 검증
    const valResult = validatePublishedContentPack(pack);
    if (!valResult.valid) {
      const diagnostics = valResult.diagnostics.map((d) => `[${d.code}] ${d.message}`);
      return {
        ok: false,
        error: '게시본 호환성 또는 무결성 검증 실패 (Incompatible or invalid pack)',
        diagnostics,
      };
    }

    // 변조 감지: contentHash 일치 확인
    if (pack.contentHash !== resolvedHash) {
      return {
        ok: false,
        error: `게시본 해시 불일치: 요청된 해시 [${resolvedHash}]와 저장된 팩 해시 [${pack.contentHash}]가 일치하지 않습니다.`,
        diagnostics: ['content-hash-mismatch'],
      };
    }

    // 6. BPM 추출 (첫 번째 스테이지 템포 또는 에디터 BPM)
    const firstStage = Object.values(pack.stages || {})[0];
    const bpm = firstStage?.tempo?.bpm ?? this._state.bpm;

    // 7. 격리된 테스트 플레이 URL 생성 (Issue #391 계약 준수)
    const testPlayUrl = `/?mode=test&hash=${encodeURIComponent(pack.contentHash)}`;

    const descriptor: TestLaunchDescriptor = {
      contentHash: pack.contentHash,
      rulesetId: pack.rulesetId,
      rulesetHash: pack.rulesetHash,
      bpm,
      sourceRevision: pack.sourceRevision,
      testPlayUrl,
      isIsolatedSession: true,
      isolationContract: 'Issue #391: Session progression, rewards, and global settings are isolated.',
    };

    return {
      ok: true,
      descriptor,
      pack,
    };
  }

  /**
   * 게시된 불변 팩 기반 테스트 플레이 실행 (Issue #393 / EDITOR-TEST-LAUNCH)
   *
   * 브라우저 환경에서 격리된 테스트 플레이 URL을 새 창으로 열거나 제공된 executor를 호출합니다.
   * 실패 시 성공인 것처럼 오표시하지 않고 실패 원인과 진단을 반환합니다.
   */
  async launchTestPlay(
    targetHash?: string,
    options?: TestLaunchOptions
  ): Promise<TestLaunchResult> {
    const prep = await this.prepareTestLaunch(targetHash);
    if (!prep.ok || !prep.descriptor) {
      return {
        ok: false,
        error: prep.error,
        diagnostics: prep.diagnostics,
        targetHash,
      };
    }

    const descriptor = prep.descriptor;
    const resolvedHash = descriptor.contentHash;

    // 기대 hash 검증
    if (options?.expectedHash && options.expectedHash !== resolvedHash) {
      return {
        ok: false,
        error: `요청된 기대 해시 [${options.expectedHash}]와 준비된 팩 해시 [${resolvedHash}]가 일치하지 않습니다.`,
        diagnostics: ['expected-hash-mismatch'],
        targetHash: options.expectedHash,
        executedHash: resolvedHash,
      };
    }

    // Origin 검증: 현재 브라우저 window.location 또는 기본 로컬 origin과 비교
    const currentOrigin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost:3000';

    if (
      options?.targetOrigin &&
      options.targetOrigin !== currentOrigin
    ) {
      return {
        ok: false,
        error: `출처(Origin) 불일치: 현재 origin "${currentOrigin}"과 요청 origin "${options.targetOrigin}"이 일치하지 않습니다.`,
        diagnostics: ['origin-mismatch'],
        descriptor,
        targetHash: targetHash || resolvedHash,
        executedHash: resolvedHash,
        openedWindow: false,
      };
    }

    // 사용자 정의 윈도우 오프너 또는 테스트용 mock 오프너가 전달된 경우
    if (options?.windowOpener) {
      try {
        const opened = options.windowOpener(descriptor.testPlayUrl);
        if (!opened) {
          return {
            ok: false,
            error: '테스트 플레이 창을 생성할 수 없습니다 (Window opener returned null or false).',
            diagnostics: ['window-open-failed'],
            descriptor,
            targetHash: targetHash || resolvedHash,
            executedHash: resolvedHash,
            openedWindow: false,
          };
        }
        return {
          ok: true,
          descriptor,
          targetHash: targetHash || resolvedHash,
          executedHash: resolvedHash,
          openedWindow: true,
        };
      } catch (err) {
        return {
          ok: false,
          error: `테스트 플레이 창 열기 중 예외가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`,
          diagnostics: ['window-open-exception'],
          descriptor,
          targetHash: targetHash || resolvedHash,
          executedHash: resolvedHash,
          openedWindow: false,
        };
      }
    }

    // 기본 브라우저 환경 검사
    if (typeof window === 'undefined') {
      return {
        ok: false,
        error: '브라우저 환경이 아니거나 창을 열 수 없습니다 (Window object not available).',
        diagnostics: ['no-browser-window'],
        descriptor,
        targetHash: targetHash || resolvedHash,
        executedHash: resolvedHash,
        openedWindow: false,
      };
    }

    // Origin 검증
    if (
      options?.targetOrigin &&
      typeof window.location !== 'undefined' &&
      window.location.origin !== options.targetOrigin
    ) {
      return {
        ok: false,
        error: `출처(Origin) 불일치: 현재 origin "${window.location.origin}"과 요청 origin "${options.targetOrigin}"이 일치하지 않습니다.`,
        diagnostics: ['origin-mismatch'],
        descriptor,
        targetHash: targetHash || resolvedHash,
        executedHash: resolvedHash,
        openedWindow: false,
      };
    }

    try {
      const openedWin = window.open(descriptor.testPlayUrl, '_blank');
      if (!openedWin) {
        return {
          ok: false,
          error: '브라우저 팝업이 차단되었거나 창을 생성할 수 없습니다 (Popup blocked).',
          diagnostics: ['popup-blocked'],
          descriptor,
          targetHash: targetHash || resolvedHash,
          executedHash: resolvedHash,
          openedWindow: false,
        };
      }
      return {
        ok: true,
        descriptor,
        targetHash: targetHash || resolvedHash,
        executedHash: resolvedHash,
        openedWindow: true,
      };
    } catch (err) {
      return {
        ok: false,
        error: `브라우저 창 열기 실패: ${err instanceof Error ? err.message : String(err)}`,
        diagnostics: ['window-open-exception'],
        descriptor,
        targetHash: targetHash || resolvedHash,
        executedHash: resolvedHash,
        openedWindow: false,
      };
    }
  }
}
