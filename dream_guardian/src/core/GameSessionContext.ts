/**
 * GameSessionContext - 런타임 게임 세션 컨텍스트 및 의존성 레지스트리
 *
 * [REFACTOR-CORE-001] (Issue #300)
 * - main.ts에 분산된 런타임 상태(배틀 상태, 챕터/서브레벨, 지표, 타이머 등)를 캡슐화
 * - 코어 시스템(EventBus, GameEngine, SessionLifecycle 등) 및 게임 컨트롤러 통합 관리
 * - 세션 리셋, 챕터 시작, 델타타임 업데이트 생명주기 통일
 */

import type {
  SessionMetadata,
  SessionMetrics,
  CoreSystems,
  GameControllers,
  GameSessionContextOptions,
  SessionPhase,
} from './types.js';
import { BEGINNER_PHASE_A_STAR_NOTES } from '../data/beginnerRhythmRoutine.js';
import { ContentProvider } from '../game/ContentProvider.js';
import type { SessionStageBundle } from '../game/SessionContent.js';
import type { CompiledStarNote, PublishedContentPack } from '../data/PublishedContentPack.js';
import type { Keynote, KeynoteInstrument, KeynotePart } from '../types/keynote.js';
import type { GameState, SessionMode } from '../types/index.js';

export type ContentMode = 'default_csv' | 'custom_pack';
export type { SessionMode };

/**
 * CompiledStarNote를 런타임 Keynote 모델로 변환
 */
export function compiledStarNoteToKeynote(note: CompiledStarNote): Keynote {
  const target = note.target;
  const part: KeynotePart =
    target.part === 'hip' || target.part === 'leftHand' || target.part === 'rightHand'
      ? target.part
      : 'leftHand';
  const instrument: KeynoteInstrument =
    target.instrument ?? (part === 'hip' ? 'foot' : 'hand');

  return {
    patternId: note.sourcePatternId ?? note.id ?? 'published-star-note',
    part,
    zoneId: target.zoneId,
    instrument,
    beat: note.landingBeat,
  };
}

export class GameSessionContext {
  private _metadata: SessionMetadata;
  private _metrics: SessionMetrics;
  private _isActive = false;
  private readonly _systems: CoreSystems;
  private readonly _controllers: GameControllers;

  // Issue #390: 콘텐츠 모드 및 별 노트 세션 바인딩
  private _contentMode: ContentMode = 'default_csv';
  private _activeStageBundle: SessionStageBundle | null = null;
  private _activeStarNotes: readonly Keynote[] | null = null;
  private _stagedBundle: SessionStageBundle | null = null;
  private _hasStagedContent = false;
  private readonly _contentProvider: ContentProvider = new ContentProvider();
  private _contentGeneration = 0;
  // Issue #391: 테스트 플레이 세션 격리 플래그
  private _isTestSession = false;

  // Issue #523: 세션 모드 및 모드 잠금 불변성 상태
  private _sessionMode: SessionMode = 'legacy';
  private _isModeLocked = false;
  private _sessionId = 0;

  constructor(options?: GameSessionContextOptions & { mode?: SessionMode; sessionMode?: SessionMode }) {
    this._isTestSession = Boolean((options as any)?.isTestSession);
    const explicitMode = (options as any)?.sessionMode ?? (options as any)?.mode;
    if (explicitMode === 'boss_assault' || explicitMode === 'legacy') {
      this._sessionMode = explicitMode;
    } else if (options?.metadata?.gameMode === 'boss_assault') {
      this._sessionMode = 'boss_assault';
    } else {
      this._sessionMode = 'legacy';
    }

    this._metadata = {
      chapterId: options?.metadata?.chapterId ?? 1,
      subLevel: options?.metadata?.subLevel,
      difficulty: options?.metadata?.difficulty ?? 'normal',
      gameMode: options?.metadata?.gameMode ?? (this._sessionMode === 'boss_assault' ? 'boss_assault' : 'story'),
      score: options?.metadata?.score ?? 0,
      elapsedTime: options?.metadata?.elapsedTime ?? 0,
      phase: options?.metadata?.phase ?? 'IDLE',
    };

    this._metrics = {
      totalSteps: options?.metrics?.totalSteps ?? 0,
      totalJumps: options?.metrics?.totalJumps ?? 0,
      totalDwellTime: options?.metrics?.totalDwellTime ?? 0,
      combo: options?.metrics?.combo ?? 0,
      consecutiveWrongCount: options?.metrics?.consecutiveWrongCount ?? 0,
    };

    this._systems = { ...(options?.systems ?? {}) };
    this._controllers = { ...(options?.controllers ?? {}) };
  }

  /** 세션 메타데이터 */
  get metadata(): SessionMetadata {
    return this._metadata;
  }

  /** 신체/플레이 지표 (Steps, Jumps, DwellTime, Combo) */
  get metrics(): SessionMetrics {
    return this._metrics;
  }

  /** 현재 세션 활성 여부 */
  get isActive(): boolean {
    return this._isActive;
  }

  /** 세션 모드 조회 ('legacy' | 'boss_assault' / Issue #523) */
  get sessionMode(): SessionMode {
    return this._sessionMode;
  }

  /** 세션 모드 축약 getter (Issue #523) */
  get mode(): SessionMode {
    return this._sessionMode;
  }

  /** 모드 잠금(고정) 여부 (Issue #523) */
  get isModeLocked(): boolean {
    return this._isModeLocked;
  }

  /** 현재 세션 ID 조회 (SessionLifecycle이 있으면 동기화, 없으면 내부 ID 반환) */
  get sessionId(): number {
    return this._systems.sessionLifecycle?.sessionId ?? this._sessionId;
  }

  /**
   * 세션 모드 잠금 및 고정 (Issue #523)
   * 이미 잠긴 상태에서 다른 모드를 설정하려 하면 예외 발생
   */
  lockMode(mode?: SessionMode): void {
    if (this._isModeLocked) {
      if (mode !== undefined && mode !== this._sessionMode) {
        throw new Error(
          `[GameSessionContext] Cannot change mode while locked: current=${this._sessionMode}, requested=${mode}`
        );
      }
      return;
    }
    if (mode !== undefined) {
      this._sessionMode = mode;
    }
    this._isModeLocked = true;
  }

  /**
   * 세션 모드 설정 (Issue #523)
   * 이미 잠겨있거나 세션 진행 중(isActive)일 때 다른 모드로의 변경은 거부(false 반환)
   */
  setMode(mode: SessionMode): boolean {
    if (this._sessionMode === mode) {
      return true;
    }
    if (this._isModeLocked || this._isActive) {
      return false;
    }
    this._sessionMode = mode;
    return true;
  }

  /** 현재 콘텐츠 모드 (default_csv vs custom_pack) */
  get contentMode(): ContentMode {
    return this._contentMode;
  }

  /** 현재 적용된 세션 스테이지 번들 */
  get activeStageBundle(): SessionStageBundle | null {
    return this._activeStageBundle;
  }

  /** 현재 적용된 세션 스테이지 번들 별칭 (Issue #402) */
  get stageBundle(): SessionStageBundle | null {
    return this._activeStageBundle;
  }

  /** 중간 게시 또는 로딩 지연으로 다음 스테이지에 적용 대기 중인 번들 (Issue #402) */
  get stagedBundle(): SessionStageBundle | null {
    return this._stagedBundle;
  }

  /** 현재 세션의 7개 별 노트 (커스텀 팩 또는 기본 입문 루틴) */
  get starNotes(): readonly Keynote[] {
    return this._activeStarNotes ?? BEGINNER_PHASE_A_STAR_NOTES;
  }

  /** 콘텐츠 요청/설정 세대 번호 */
  get contentGeneration(): number {
    return this._contentGeneration;
  }

  /** 현재 세션이 테스트 플레이 세션인지 여부 (Issue #391) */
  get isTestSession(): boolean {
    return this._isTestSession;
  }

  /** 테스트 플레이 세션 모드 설정 */
  setTestSession(isTest: boolean): void {
    this._isTestSession = isTest;
  }

  /** 진행도 저장 허용 여부 (테스트 세션에서는 차단) */
  get canSaveProgress(): boolean {
    return !this._isTestSession;
  }

  /** 보상 및 해금 저장 허용 여부 (테스트 세션에서는 차단) */
  get canSaveRewards(): boolean {
    return !this._isTestSession;
  }

  /** 하이스코어 및 기록 저장 허용 여부 (테스트 세션에서는 차단) */
  get canSaveHighScore(): boolean {
    return !this._isTestSession;
  }

  /** 등록된 시스템 참조 맵 */
  get systems(): CoreSystems {
    return this._systems;
  }

  /** 등록된 컨트롤러 참조 맵 */
  get controllers(): GameControllers {
    return this._controllers;
  }

  /** 세션 활성 상태 전환 */
  setActive(active: boolean): void {
    this._isActive = active;
  }

  /** 시스템 동적 등록 */
  registerSystem<K extends keyof CoreSystems>(key: K, instance: CoreSystems[K]): void {
    this._systems[key] = instance;
  }

  /** 시스템 조회 */
  getSystem<K extends keyof CoreSystems>(key: K): CoreSystems[K] {
    return this._systems[key];
  }

  /** 컨트롤러 동적 등록 */
  registerController<K extends keyof GameControllers>(key: K, instance: GameControllers[K]): void {
    this._controllers[key] = instance;
  }

  /** 컨트롤러 조회 */
  getController<K extends keyof GameControllers>(key: K): GameControllers[K] {
    return this._controllers[key];
  }

  /** 점수 추가 */
  addScore(points: number): number {
    this._metadata.score += points;
    return this._metadata.score;
  }

  /** 현재 진행 페이즈 변경 */
  setPhase(phase: SessionPhase): void {
    this._metadata.phase = phase;
  }

  /** 걸음 수 증가 */
  incrementSteps(count = 1): number {
    this._metrics.totalSteps += count;
    return this._metrics.totalSteps;
  }

  /** 점프 수 증가 */
  incrementJumps(count = 1): number {
    this._metrics.totalJumps += count;
    return this._metrics.totalJumps;
  }

  /** 체류 시간 누적 (초 단위) */
  addDwellTime(seconds: number): number {
    this._metrics.totalDwellTime += seconds;
    return this._metrics.totalDwellTime;
  }

  /** 콤보 수치 설정 */
  setCombo(combo: number): void {
    this._metrics.combo = Math.max(0, combo);
  }

  /** 연속 오답 횟수 1 증가 */
  incrementWrongCount(): number {
    this._metrics.consecutiveWrongCount += 1;
    return this._metrics.consecutiveWrongCount;
  }

  /** 연속 오답 횟수 초기화 */
  resetWrongCount(): void {
    this._metrics.consecutiveWrongCount = 0;
  }

  /** 프레임 단위 경과 시간 누적 및 세션 갱신 */
  update(dt: number): void {
    if (!this._isActive) return;
    this._metadata.elapsedTime += dt;
  }

  /** 세션 점수, 시간, 지표 초기화 및 바인딩된 컨트롤러 일괄 리셋 */
  resetSession(): void {
    this._metadata.score = 0;
    this._metadata.elapsedTime = 0;
    this._metadata.phase = 'IDLE';
    this._isActive = false;
    this._isModeLocked = false;

    this._metrics.totalSteps = 0;
    this._metrics.totalJumps = 0;
    this._metrics.totalDwellTime = 0;
    this._metrics.combo = 0;
    this._metrics.consecutiveWrongCount = 0;
    this._isTestSession = false;

    // Issue #390: 콘텐츠 상태 초기화
    this.resetContent();

    // 바인딩된 컨트롤러 리셋 호출
    this._controllers.battle?.reset?.();
    this._controllers.guardian?.reset?.();
    this._controllers.stageProgress?.reset?.();
    this._controllers.bossFever?.reset?.();
    this._controllers.bossHazard?.reset?.();
    this._controllers.beatRoundResolver?.reset?.();
  }

  /** 챕터 시작 시 세션 상태 갱신 및 컨트롤러 초기화 (Issue #523: 모드 고정 및 불변성 확립) */
  startChapter(
    chapterId: number,
    subLevel?: number,
    options?: { isTestSession?: boolean; mode?: SessionMode; sessionMode?: SessionMode }
  ): void {
    const requestedMode = options?.sessionMode ?? options?.mode;

    this.resetSession();

    if (requestedMode) {
      this._sessionMode = requestedMode;
    }
    this._isModeLocked = true;
    this._sessionId++;

    this._metadata.chapterId = chapterId;
    this._metadata.subLevel = subLevel;
    this._metadata.phase = 'READY';
    if (this._sessionMode === 'boss_assault') {
      this._metadata.gameMode = 'boss_assault';
    }
    this._isActive = true;
    this._isTestSession = Boolean(options?.isTestSession);

    // 세션 수명 사이클 갱신
    this._systems.sessionLifecycle?.startSession?.(this._isTestSession);

    // 보스 컨트롤러 초기화 (챕터 번호 전달)
    this._controllers.boss?.reset?.(chapterId);

    // 이벤트 발행
    const eventPayload: { chapterId: number; subLevel?: number; isTestSession?: boolean } = { chapterId, subLevel };
    if (this._isTestSession) {
      eventPayload.isTestSession = true;
    }
    this._systems.eventBus?.emit?.('session:start', eventPayload);
  }

  /**
   * 현재 모드에서 유효한 상태인지 판정 (Issue #523: 모드별 혼합 상태 차단)
   */
  isValidStateForMode(state: GameState): boolean {
    if (this._sessionMode === 'legacy') {
      // legacy 모드에서는 신규 ASSAULT_ROUND 진입 불가
      return state !== 'ASSAULT_ROUND';
    }
    if (this._sessionMode === 'boss_assault') {
      // boss_assault 모드에서는 레거시 전용 인게임 전투 상태(Phase A, Phase B) 진입 불가
      const legacyCombatStates: readonly GameState[] = [
        'RUN_QUESTION',
        'ANSWER_SELECT',
        'STAR_COLLECT',
        'HAZARD_EVADE',
        'ROUND_RESOLVE',
        'BOSS_CLIMAX',
      ];
      return !legacyCombatStates.includes(state);
    }
    return true;
  }

  /**
   * 상태 전환 가능 여부 확인
   */
  canTransitionToState(targetState: GameState, sessionId?: number): boolean {
    if (sessionId !== undefined && sessionId !== this.sessionId) {
      return false;
    }
    if (!this.isValidStateForMode(targetState)) {
      return false;
    }
    const sm = this._systems.stateMachine;
    if (!sm) {
      return false;
    }
    return sm.canTransition(targetState);
  }

  /**
   * 상태 전환 요청 검증 및 실행 (A16: 이전 세션 전환 거부, 혼합 상태 차단, 현재 세션 보존)
   */
  requestStateTransition(targetState: GameState, sessionId?: number): boolean {
    if (sessionId !== undefined && sessionId !== this.sessionId) {
      return false;
    }
    if (!this.isValidStateForMode(targetState)) {
      return false;
    }
    const sm = this._systems.stateMachine;
    if (!sm) {
      return false;
    }
    if (!sm.canTransition(targetState)) {
      return false;
    }
    return sm.changeState(targetState);
  }

  /** 테스트 플레이 세션 시작 (Issue #391) */
  startTestSession(chapterId: number, subLevel?: number): void {
    this.startChapter(chapterId, subLevel, { isTestSession: true });
  }

  /** 보스 격파 여부 판정 */
  isBossDefeated(): boolean {
    const boss = this._controllers.boss;
    return Boolean(boss && boss.hp <= 0);
  }

  /** 플레이어 패배 여부 판정 */
  isPlayerDefeated(): boolean {
    const battle = this._controllers.battle;
    return Boolean(battle && battle.hp <= 0);
  }

  /** 보스 광폭화 여부 판정 */
  isEnraged(): boolean {
    if (this._controllers.bossHazard && typeof this._controllers.bossHazard.isEnraged === 'boolean') {
      return this._controllers.bossHazard.isEnraged;
    }
    const boss = this._controllers.boss;
    if (boss && boss.maxHp > 0) {
      return boss.hp / boss.maxHp <= 0.3;
    }
    return false;
  }

  /**
   * 스테이지 콘텐츠 설정 (PublishedContentPack 주입 또는 Default CSV 모드 확정)
   * 불완전 팩(notes=[] 등)은 거부하고 whole-pack fallback으로 default_csv 모드로 처리
   * Issue #402: 세션 진행 중(isActive)일 때 mid-stage pinning 적용 (현재 실행 팩 보존, 다음 팩 staged)
   */
  setStageContent(options: {
    stageId: string;
    pack?: PublishedContentPack | null;
    fallbackPack?: PublishedContentPack | null;
    seed?: number;
    isTestSession?: boolean;
    force?: boolean;
  }): { contentMode: ContentMode; bundle: SessionStageBundle | null; starNotes: readonly Keynote[]; staged?: boolean } {
    this._contentGeneration++;
    if (options.isTestSession !== undefined) {
      this._isTestSession = options.isTestSession;
    }

    // Issue #402: 세션 진행 중(active) 호출 시 mid-stage pinning 적용
    // 현재 진행 중인 스테이지 번들은 변경하지 않고 다음 스테이지(stagedBundle)로 유예
    if (this._isActive && !options.force) {
      let stagedResolved: SessionStageBundle | null = null;
      if (options.pack) {
        const bundle = this._contentProvider.resolveSessionStage({
          stageId: options.stageId,
          pack: options.pack,
          fallbackPack: options.fallbackPack,
          seed: options.seed,
        });
        const rawStarNotes = bundle.phaseA?.starNotes;
        const isComplete = !bundle.isFallback && Array.isArray(rawStarNotes) && rawStarNotes.length === 7;
        if (isComplete) {
          stagedResolved = bundle;
        }
      }
      this._stagedBundle = stagedResolved;
      this._hasStagedContent = true;
      return {
        contentMode: this._contentMode,
        bundle: this._activeStageBundle,
        starNotes: this.starNotes,
        staged: true,
      };
    }

    this._stagedBundle = null;
    this._hasStagedContent = false;

    if (!options.pack) {
      this._contentMode = 'default_csv';
      this._activeStageBundle = null;
      this._activeStarNotes = [...BEGINNER_PHASE_A_STAR_NOTES];
      return {
        contentMode: 'default_csv',
        bundle: null,
        starNotes: this._activeStarNotes,
      };
    }

    const bundle = this._contentProvider.resolveSessionStage({
      stageId: options.stageId,
      pack: options.pack,
      fallbackPack: options.fallbackPack,
      seed: options.seed,
    });

    const rawStarNotes = bundle.phaseA?.starNotes;
    const isComplete = !bundle.isFallback && Array.isArray(rawStarNotes) && rawStarNotes.length === 7;

    if (!isComplete) {
      this._contentMode = 'default_csv';
      this._activeStageBundle = null;
      this._activeStarNotes = [...BEGINNER_PHASE_A_STAR_NOTES];
      return {
        contentMode: 'default_csv',
        bundle: null,
        starNotes: this._activeStarNotes,
      };
    }

    const keynotes = rawStarNotes.map((note) => compiledStarNoteToKeynote(note));
    this._contentMode = 'custom_pack';
    this._activeStageBundle = bundle;
    this._activeStarNotes = Object.freeze(keynotes);

    return {
      contentMode: 'custom_pack',
      bundle: this._activeStageBundle,
      starNotes: this._activeStarNotes,
    };
  }

  /**
   * 지연 등록된 콘텐츠 팩 적용 (Issue #402)
   */
  applyStagedContent(): boolean {
    if (!this._hasStagedContent) return false;
    if (this._stagedBundle) {
      this._activeStageBundle = this._stagedBundle;
      this._contentMode = 'custom_pack';
      const rawStarNotes = this._stagedBundle.phaseA?.starNotes;
      if (Array.isArray(rawStarNotes) && rawStarNotes.length === 7) {
        this._activeStarNotes = Object.freeze(rawStarNotes.map((note) => compiledStarNoteToKeynote(note)));
      }
    } else {
      this._activeStageBundle = null;
      this._contentMode = 'default_csv';
      this._activeStarNotes = [...BEGINNER_PHASE_A_STAR_NOTES];
    }
    this._stagedBundle = null;
    this._hasStagedContent = false;
    return true;
  }

  /**
   * 기본 CSV 피트니스 패턴 기반 키노트 업데이트 (경쟁 차단 적용)
   * 커스텀 팩이 활성화되어 있거나 세션/생성번호가 불일치하는 경우 무시
   */
  applyCsvKeynotes(keynotes: readonly Keynote[], generation?: number): boolean {
    if (this._contentMode === 'custom_pack') {
      return false;
    }
    if (generation !== undefined && generation !== this._contentGeneration) {
      return false;
    }
    this._activeStarNotes = Object.freeze([...keynotes]);
    return true;
  }

  /**
   * 콘텐츠 상태 초기화 (Default CSV 모드로 복구)
   */
  resetContent(keepStaged = false): void {
    this._contentGeneration++;
    this._contentMode = 'default_csv';
    this._activeStageBundle = null;
    this._activeStarNotes = [...BEGINNER_PHASE_A_STAR_NOTES];
    if (!keepStaged) {
      this._stagedBundle = null;
      this._hasStagedContent = false;
    }
    this._isTestSession = false;
  }
}
