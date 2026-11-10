/**
 * AppUIPresentationSyncManager - UI 프레젠테이션 동기화 및 콘텐츠 프리로더
 *
 * [REFACTOR-SRP-012] (Issue #643)
 * - UI 프레젠테이션 스냅샷 런타임 주입, 인게임 대기(Deferred Adoption), 안전 롤백 관리
 * - CSV 수학 문제 및 피트니스 패턴 로드, 세션 경쟁 가드
 * - 정적 매니페스트 및 로컬 테스트 오버라이드 팩 관리
 */

import { parseCSV } from '../../question/CSVLoader.js';
import { parseFitnessPatternCSV, createKeynoteSequence } from '../../data/index.js';
import { computeContentHash } from '../../data/ContentCanonical.js';
import type { UIPresentationDocument } from '../../data/UIPresentation.js';
import type {
  UIPresentationArtifact,
  UIPresentationLoadOptions,
  UIPresentationLoadResult,
  UIPresentationLoadService,
} from '../UIPresentationLoadService.js';
import type {
  ContentLoadService,
  StaticManifestLoadOptions,
  ContentLoadOptions,
} from '../ContentLoadService.js';
import type { PublishedContentPack } from '../../data/PublishedContentPack.js';
import type { Keynote } from '../../types/keynote.js';
import type { QuestionBank } from '../../question/QuestionBank.js';
import type { SessionLifecycle } from '../SessionLifecycle.js';
import type { GameSessionContext } from '../GameSessionContext.js';

export interface PresentationContextConsumer {
  setPresentationContext(context: { presentationDocument: UIPresentationDocument; pageId?: string }): void;
  clearPresentationContext(): void;
}

export interface AppUIPresentationSyncHost {
  uiPresentationLoadService: UIPresentationLoadService;
  contentLoadService: ContentLoadService;
  questionBank: QuestionBank;
  beatCoordinator?: { setKeynotes(keynotes: readonly Keynote[]): void };
  sessionLifecycle?: SessionLifecycle;
  sessionContext?: GameSessionContext;
  getSessionContext?: () => GameSessionContext | undefined;
  isPlaying?: () => boolean;
  stateMachine?: { currentState: string };
  fetch?: typeof fetch;
  getStaticManifestUrl?: () => string | undefined;
  getStaticManifestOptions?: () => StaticManifestLoadOptions | undefined;

  menuRenderer?: PresentationContextConsumer;
  hudLayer?: PresentationContextConsumer;
  bottomBar?: PresentationContextConsumer;
  pauseModal?: PresentationContextConsumer;
  settingsModal?: PresentationContextConsumer;
  resultRenderer?: PresentationContextConsumer;
  readyPositionRenderer?: PresentationContextConsumer;
  runningMatRenderer?: PresentationContextConsumer | null;
  questionRenderer?: PresentationContextConsumer;
  presentationAdapter?: PresentationContextConsumer;
  beatHUDRenderer?: PresentationContextConsumer;
  bossRenderer?: PresentationContextConsumer;
  bossClimaxRenderer?: PresentationContextConsumer;
}

export class AppUIPresentationSyncManager {
  private _activeUIPresentation: Readonly<UIPresentationDocument> | null = null;
  private _activeUIArtifact: Readonly<UIPresentationArtifact> | null = null;
  private _pendingUIArtifact: Readonly<UIPresentationArtifact> | null = null;
  private _pendingUIPresentation: Readonly<UIPresentationDocument> | null = null;
  private _previousHealthyPresentation: Readonly<UIPresentationDocument> | null = null;
  private _previousHealthyArtifact: Readonly<UIPresentationArtifact> | null = null;
  private _activePublishedPack: PublishedContentPack | null = null;

  constructor(public readonly host: AppUIPresentationSyncHost) {}

  public get activeUIPresentation(): Readonly<UIPresentationDocument> | null {
    return this._activeUIPresentation;
  }

  public get activeUIArtifact(): Readonly<UIPresentationArtifact> | null {
    return this._activeUIArtifact;
  }

  public get pendingUIArtifact(): Readonly<UIPresentationArtifact> | null {
    return this._pendingUIArtifact;
  }

  public get pendingUIPresentation(): Readonly<UIPresentationDocument> | null {
    return this._pendingUIPresentation;
  }

  public get previousHealthyPresentation(): Readonly<UIPresentationDocument> | null {
    return this._previousHealthyPresentation;
  }

  public get previousHealthyArtifact(): Readonly<UIPresentationArtifact> | null {
    return this._previousHealthyArtifact;
  }

  public get activePublishedPack(): PublishedContentPack | null {
    return this._activePublishedPack;
  }

  public set activePublishedPack(pack: PublishedContentPack | null) {
    this._activePublishedPack = pack;
  }

  public setActivePublishedPack(pack: PublishedContentPack | null): void {
    this._activePublishedPack = pack;
  }

  public getActivePublishedPack(): PublishedContentPack | null {
    return this._activePublishedPack;
  }

  public getActiveUIPresentation(): Readonly<UIPresentationDocument> | null {
    return this._activeUIPresentation;
  }

  public getActiveUIArtifact(): Readonly<UIPresentationArtifact> | null {
    return this._activeUIArtifact;
  }

  public getPendingUIArtifact(): Readonly<UIPresentationArtifact> | null {
    return this._pendingUIArtifact;
  }

  public getPendingUIPresentation(): Readonly<UIPresentationDocument> | null {
    return this._pendingUIPresentation;
  }

  public getActiveUIHash(): string | null {
    if (this._activeUIArtifact?.contentHash) {
      return this._activeUIArtifact.contentHash;
    }
    if (this._activeUIPresentation) {
      return (
        (this._activeUIPresentation as any).contentHash ??
        computeContentHash({
          manifest: this._activeUIPresentation.manifest,
          pages: this._activeUIPresentation.pages,
          resolution: this._activeUIPresentation.resolution,
        })
      );
    }
    return null;
  }

  public applyUIPresentation(
    presentation: UIPresentationDocument | null,
    artifact?: UIPresentationArtifact | null,
  ): void {
    if (this._activeUIPresentation && presentation && this._activeUIPresentation !== presentation) {
      this._previousHealthyPresentation = this._activeUIPresentation;
      this._previousHealthyArtifact = this._activeUIArtifact;
    }
    this._activeUIPresentation = presentation;
    this._activeUIArtifact = artifact ?? null;

    const h = this.host;
    if (!presentation) {
      h.menuRenderer?.clearPresentationContext();
      h.hudLayer?.clearPresentationContext();
      h.bottomBar?.clearPresentationContext();
      h.pauseModal?.clearPresentationContext();
      h.settingsModal?.clearPresentationContext();
      h.resultRenderer?.clearPresentationContext();
      h.readyPositionRenderer?.clearPresentationContext();
      h.runningMatRenderer?.clearPresentationContext();
      h.questionRenderer?.clearPresentationContext();
      h.presentationAdapter?.clearPresentationContext();
      h.beatHUDRenderer?.clearPresentationContext();
      h.bossRenderer?.clearPresentationContext();
      h.bossClimaxRenderer?.clearPresentationContext();
      return;
    }

    h.menuRenderer?.setPresentationContext({ presentationDocument: presentation });
    h.hudLayer?.setPresentationContext({ presentationDocument: presentation });
    h.bottomBar?.setPresentationContext({ presentationDocument: presentation });
    h.pauseModal?.setPresentationContext({ presentationDocument: presentation, pageId: 'pause' });
    h.settingsModal?.setPresentationContext({ presentationDocument: presentation, pageId: 'options' });
    h.resultRenderer?.setPresentationContext({ presentationDocument: presentation, pageId: 'result' });
    h.readyPositionRenderer?.setPresentationContext({ presentationDocument: presentation, pageId: 'play_ready' });
    h.runningMatRenderer?.setPresentationContext({ presentationDocument: presentation, pageId: 'running_question' });
    h.questionRenderer?.setPresentationContext({ presentationDocument: presentation, pageId: 'running_question' });
    h.presentationAdapter?.setPresentationContext({ presentationDocument: presentation, pageId: 'hazard_evade' });
    h.beatHUDRenderer?.setPresentationContext({ presentationDocument: presentation, pageId: 'running_question' });
    h.bossRenderer?.setPresentationContext({ presentationDocument: presentation, pageId: 'boss_battle' });
    h.bossClimaxRenderer?.setPresentationContext({ presentationDocument: presentation, pageId: 'boss_battle' });
  }

  public flushPendingUIPresentation(): boolean {
    if (!this._pendingUIPresentation && !this._pendingUIArtifact) return false;
    if (this._pendingUIPresentation) {
      this.applyUIPresentation(this._pendingUIPresentation, this._pendingUIArtifact);
      this._pendingUIPresentation = null;
      this._pendingUIArtifact = null;
      return true;
    }
    return false;
  }

  public rollbackUIPresentation(): boolean {
    const targetDoc =
      this._previousHealthyPresentation ??
      this.host.uiPresentationLoadService?.previousHealthyPresentation;
    const targetArtifact = this._previousHealthyArtifact;
    if (targetDoc) {
      this.applyUIPresentation(targetDoc, targetArtifact);
      this._pendingUIPresentation = null;
      this._pendingUIArtifact = null;
      return true;
    }
    if (this._activeUIPresentation !== null) {
      this.applyUIPresentation(null, null);
      this._pendingUIPresentation = null;
      this._pendingUIArtifact = null;
      return true;
    }
    return false;
  }

  public async setUIPresentationArtifact(
    artifact: UIPresentationArtifact | null,
    options?: UIPresentationLoadOptions,
  ): Promise<UIPresentationLoadResult> {
    if (artifact === null) {
      this.applyUIPresentation(null, null);
      this._pendingUIArtifact = null;
      this._pendingUIPresentation = null;
      return {
        status: 'success',
        presentation: null as any,
        generation: this.host.uiPresentationLoadService.currentGeneration,
      };
    }

    const effectiveOptions: UIPresentationLoadOptions = {
      previousHealthyPresentation: (this._activeUIPresentation ?? undefined) as any,
      ...options,
    };

    const loadResult = await this.host.uiPresentationLoadService.loadPresentation(artifact, effectiveOptions);
    if (loadResult.status === 'success') {
      const isPlaying = this.isSessionPlaying();

      if (isPlaying) {
        this._pendingUIArtifact = loadResult.artifact ?? artifact;
        this._pendingUIPresentation = loadResult.presentation;
        return loadResult;
      }

      this.applyUIPresentation(loadResult.presentation, loadResult.artifact);
      this._pendingUIArtifact = null;
      this._pendingUIPresentation = null;
      return loadResult;
    }

    if (loadResult.status === 'fallback') {
      if (this._activeUIPresentation) {
        this.applyUIPresentation(this._activeUIPresentation, this._activeUIArtifact);
      } else {
        this.applyUIPresentation(loadResult.fallbackPresentation, null);
      }
      this._pendingUIArtifact = null;
      this._pendingUIPresentation = null;
      return loadResult;
    }

    return loadResult;
  }

  public async loadQuestions(): Promise<void> {
    try {
      const fetchFn = this.host.fetch ?? fetch;
      const resp = await fetchFn('/questions.csv');
      if (resp.ok) {
        const text = await resp.text();
        const records = parseCSV(text);
        this.host.questionBank.loadRecords(records);
        console.log(`[DG] ${records.length}개 문제 로드`);
      } else {
        this.host.questionBank.loadRecords([]);
      }
    } catch {
      this.host.questionBank.loadRecords([]);
    }
  }

  public async loadFitnessPatterns(): Promise<void> {
    const sessionLifecycle = this.host.sessionLifecycle;
    const sessionContext = this.host.getSessionContext?.() ?? this.host.sessionContext;
    const reqSession = sessionLifecycle?.sessionId;
    const reqGen = sessionContext ? sessionContext.contentGeneration : 0;
    try {
      const fetchFn = this.host.fetch ?? fetch;
      const resp = await fetchFn('/fitness pattern.csv');
      if (resp.ok) {
        const text = await resp.text();
        const records = parseFitnessPatternCSV(text);
        const keynotes = createKeynoteSequence(records, 7);

        // Issue #390: 경쟁 차단 가드 (세션 변경 또는 커스텀 팩 활성화 시 덮어쓰기 금지)
        if (sessionLifecycle && sessionLifecycle.sessionId !== reqSession) {
          console.log('[DG] 세션 변경으로 인한 CSV 피트니스 패턴 로드 무시');
          return;
        }
        if (sessionContext && sessionContext.contentMode === 'custom_pack') {
          console.log('[DG] 커스텀 팩 활성화 상태이므로 CSV 패턴으로 노트를 덮어쓰지 않습니다.');
          return;
        }

        if (sessionContext) {
          const applied = sessionContext.applyCsvKeynotes(keynotes, reqGen);
          if (!applied) return;
        }

        this.host.beatCoordinator?.setKeynotes(keynotes);
        console.log(`[DG] ${records.length}개 피트니스 패턴 로드 완료 및 ${keynotes.length}개 2~8박 키노트 생성 완료`);
      }
    } catch (err) {
      console.warn('[DG] 피트니스 패턴 로드 실패:', err);
    }
  }

  public async loadStaticManifest(
    manifestUrl?: string,
    options?: StaticManifestLoadOptions,
  ): Promise<boolean> {
    const mergedOptions = options ?? this.host.getStaticManifestOptions?.();
    const targetUrl = manifestUrl ?? this.host.getStaticManifestUrl?.();
    const result = await this.host.contentLoadService.loadStaticManifest(targetUrl, mergedOptions);
    if (result.status === 'success') {
      this._activePublishedPack = result.pack;
      return true;
    }
    if (result.status === 'fallback') {
      this._activePublishedPack = result.fallbackPack ?? null;
      return false;
    }
    this._activePublishedPack = null;
    return false;
  }

  public async loadLocalTestOverride(
    identifier: string,
    options?: ContentLoadOptions,
  ): Promise<boolean> {
    const isTest = options?.isTestMode ?? this.host.sessionLifecycle?.isTestSession ?? false;
    const result = await this.host.contentLoadService.loadLocalTestOverride(identifier, {
      ...options,
      isTestMode: isTest,
    });
    if (result.status === 'success') {
      this._activePublishedPack = result.pack;
      return true;
    }
    return false;
  }

  private isSessionPlaying(): boolean {
    if (this.host.isPlaying) {
      return this.host.isPlaying();
    }
    const state = this.host.stateMachine?.currentState;
    if (!state) return false;
    return (
      state !== 'MENU_MAIN' &&
      state !== 'MENU_SUB' &&
      state !== 'LOADING' &&
      state !== 'RESULT' &&
      state !== 'GAMEOVER'
    );
  }
}
