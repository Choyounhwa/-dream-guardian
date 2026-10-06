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

export type ContentMode = 'default_csv' | 'custom_pack';

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
  private readonly _contentProvider: ContentProvider = new ContentProvider();
  private _contentGeneration = 0;

  constructor(options?: GameSessionContextOptions) {
    this._metadata = {
      chapterId: options?.metadata?.chapterId ?? 1,
      subLevel: options?.metadata?.subLevel,
      difficulty: options?.metadata?.difficulty ?? 'normal',
      gameMode: options?.metadata?.gameMode ?? 'story',
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

  /** 현재 콘텐츠 모드 (default_csv vs custom_pack) */
  get contentMode(): ContentMode {
    return this._contentMode;
  }

  /** 현재 적용된 세션 스테이지 번들 */
  get activeStageBundle(): SessionStageBundle | null {
    return this._activeStageBundle;
  }

  /** 현재 세션의 7개 별 노트 (커스텀 팩 또는 기본 입문 루틴) */
  get starNotes(): readonly Keynote[] {
    return this._activeStarNotes ?? BEGINNER_PHASE_A_STAR_NOTES;
  }

  /** 콘텐츠 요청/설정 세대 번호 */
  get contentGeneration(): number {
    return this._contentGeneration;
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

    this._metrics.totalSteps = 0;
    this._metrics.totalJumps = 0;
    this._metrics.totalDwellTime = 0;
    this._metrics.combo = 0;
    this._metrics.consecutiveWrongCount = 0;

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

  /** 챕터 시작 시 세션 상태 갱신 및 컨트롤러 초기화 */
  startChapter(chapterId: number, subLevel?: number): void {
    this.resetSession();

    this._metadata.chapterId = chapterId;
    this._metadata.subLevel = subLevel;
    this._metadata.phase = 'READY';
    this._isActive = true;

    // 세션 수명 사이클 갱신
    this._systems.sessionLifecycle?.startSession?.();

    // 보스 컨트롤러 초기화 (챕터 번호 전달)
    this._controllers.boss?.reset?.(chapterId);

    // 이벤트 발행
    this._systems.eventBus?.emit?.('session:start', { chapterId, subLevel });
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
   */
  setStageContent(options: {
    stageId: string;
    pack?: PublishedContentPack | null;
    fallbackPack?: PublishedContentPack | null;
    seed?: number;
  }): { contentMode: ContentMode; bundle: SessionStageBundle | null; starNotes: readonly Keynote[] } {
    this._contentGeneration++;

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
  resetContent(): void {
    this._contentGeneration++;
    this._contentMode = 'default_csv';
    this._activeStageBundle = null;
    this._activeStarNotes = [...BEGINNER_PHASE_A_STAR_NOTES];
  }
}
