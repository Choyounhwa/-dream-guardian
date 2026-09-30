/**
 * BossFeverController.ts - Phase B 보스 결전 및 피버 연속 별모으기·콤보 보스타격 컨트롤러
 *
 * 10문제 종료 후 StageProgressController로부터 Phase B(BOSS_CLIMAX)로 진입한 후,
 * 무제한 별노트 시퀀스를 연속 생성/순환하며, 피버 콤보 누적과 등급 가중치 기반 치명 보스 타격을 수행한다.
 *
 * - Phase A와의 명확한 책임 분리:
 *   - Phase A의 별 수집은 보스 HP를 깎지 않음 (별가루 축적 전용)
 *   - Phase B의 별 수집은 보스에게 즉시 치명 피해를 입힘 (BossController.takeDamage)
 * - 콤보 및 피해 계산 (config/battle.config.ts 기반):
 *   - Perfect / Good / Late: 콤보 +1, 피해량 = baseDamage * ratingWeight * comboMultiplier
 *   - Miss: 콤보 0 리셋, 피해량 0
 *   - maxComboMultiplier 상한 클램프
 * - 피격 리셋 (#193 연동 규약):
 *   - onPlayerHit() 또는 resetCombo() 호출 시 피버 콤보 즉시 0 리셋
 * - 종결 판정:
 *   - 보스 HP <= 0 (처치): 피버 루프 중단, RESULT (승리) 1회 전이 및 통계 발행
 *   - 플레이어 HP <= 0 (패배): 피버 루프 중단, GAMEOVER 1회 전이
 *
 * @see Issue #213 [BOSS-FEVER-001]
 * @see Issue #241 [GAME-STAGE-HANDOFF-001]
 * @see Issue #193 [BATTLE-BOSS-001]
 * @see Issue #194 [BATTLE-TROOP-001]
 */

import { DEFAULT_BATTLE_CONFIG, type FeverConfig } from '../../config/battle.config.js';
import type { BattleState } from './BattleState.js';
import type { BossController } from './BossController.js';
import type { StateMachine } from '../core/StateMachine.js';
import type { StarNoteScheduler } from './StarNoteScheduler.js';
import type { StarCollectionResult, StarRating } from '../input/StarCollectionInput.js';
import type { Keynote } from '../types/keynote.js';
import type { PhaseAResourceSnapshot } from '../types/result.js';
import type { NormalizedLandmark } from '../types/index.js';
import type { PalmPositions, CursorUpdateOptions } from '../input/CursorTracker.js';

export interface BossFeverStats {
  readonly feverCombo: number;
  readonly maxFeverCombo: number;
  readonly totalFeverDamage: number;
  readonly collectedStars: number;
  readonly missedStars: number;
  readonly sequenceCount: number;
  readonly isVictory: boolean;
  readonly snapshot?: PhaseAResourceSnapshot | null;
}

export interface BossFeverControllerOptions {
  battleState?: BattleState;
  bossController?: BossController;
  stateMachine?: StateMachine;
  scheduler?: StarNoteScheduler;
  config?: FeverConfig;
  secondsPerBeat?: number;
  sequenceGenerator?: (sequenceIndex: number) => readonly Keynote[];
  onVictory?: (stats: BossFeverStats) => void;
  onGameOver?: (stats: BossFeverStats) => void;
  onDamageDealt?: (damage: number, bossHp: number, feverCombo: number) => void;
}

const PATTERN_1: readonly Keynote[] = Object.freeze([
  { beat: 1, patternId: 'FEVER_1_1', part: 'leftHand', zoneId: 1, instrument: 'hand' },
  { beat: 2, patternId: 'FEVER_1_2', part: 'rightHand', zoneId: 3, instrument: 'hand' },
  { beat: 3, patternId: 'FEVER_1_3', part: 'leftHand', zoneId: 4, instrument: 'hand' },
  { beat: 4, patternId: 'FEVER_1_4', part: 'rightHand', zoneId: 5, instrument: 'hand' },
  { beat: 5, patternId: 'FEVER_1_5', part: 'hip', zoneId: 9, instrument: 'foot' },
  { beat: 6, patternId: 'FEVER_1_6', part: 'hip', zoneId: 11, instrument: 'foot' },
  { beat: 7, patternId: 'FEVER_1_7', part: 'rightHand', zoneId: 2, instrument: 'hand' },
  { beat: 8, patternId: 'FEVER_1_8', part: 'hip', zoneId: 10, instrument: 'foot' },
]);

const PATTERN_2: readonly Keynote[] = Object.freeze([
  { beat: 1, patternId: 'FEVER_2_1', part: 'rightHand', zoneId: 3, instrument: 'hand' },
  { beat: 2, patternId: 'FEVER_2_2', part: 'leftHand', zoneId: 1, instrument: 'hand' },
  { beat: 3, patternId: 'FEVER_2_3', part: 'rightHand', zoneId: 5, instrument: 'hand' },
  { beat: 4, patternId: 'FEVER_2_4', part: 'leftHand', zoneId: 4, instrument: 'hand' },
  { beat: 5, patternId: 'FEVER_2_5', part: 'hip', zoneId: 11, instrument: 'foot' },
  { beat: 6, patternId: 'FEVER_2_6', part: 'hip', zoneId: 9, instrument: 'foot' },
  { beat: 7, patternId: 'FEVER_2_7', part: 'leftHand', zoneId: 2, instrument: 'hand' },
  { beat: 8, patternId: 'FEVER_2_8', part: 'hip', zoneId: 10, instrument: 'foot' },
]);

/** 4대 신체 영역 중 손(1~5) 및 발(9~11)을 활용하는 기본 피버 시퀀스 프리셋 */
export const DEFAULT_FEVER_PATTERNS: readonly (readonly Keynote[])[] = Object.freeze([
  PATTERN_1,
  PATTERN_2,
]);

export class BossFeverController {
  private readonly _options: BossFeverControllerOptions;
  private readonly _config: FeverConfig;
  private readonly _secondsPerBeat: number;
  private readonly _sequenceGenerator: (sequenceIndex: number) => readonly Keynote[];

  private _battleState?: BattleState;
  private _bossController?: BossController;
  private _stateMachine?: StateMachine;
  private _scheduler?: StarNoteScheduler;

  private _isActive = false;
  private _isEnded = false;
  private _feverCombo = 0;
  private _maxFeverCombo = 0;
  private _totalFeverDamage = 0;
  private _collectedStars = 0;
  private _missedStars = 0;
  private _sequenceCount = 0;
  private _currentSequenceStartTime = 0;
  private _currentSequenceNotes: readonly Keynote[] = [];
  private _snapshot: PhaseAResourceSnapshot | null = null;
  private readonly _processedNoteIds = new Set<string>();

  constructor(options?: BossFeverControllerOptions) {
    this._options = options ?? {};
    this._battleState = options?.battleState;
    this._bossController = options?.bossController;
    this._stateMachine = options?.stateMachine;
    this._scheduler = options?.scheduler;
    this._config = options?.config ?? DEFAULT_BATTLE_CONFIG.fever;
    this._secondsPerBeat = options?.secondsPerBeat ?? 0.5;
    this._sequenceGenerator =
      options?.sequenceGenerator ?? ((idx) => this.generateFeverSequence(idx));
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get isEnded(): boolean {
    return this._isEnded;
  }

  get feverCombo(): number {
    return this._feverCombo;
  }

  get maxFeverCombo(): number {
    return this._maxFeverCombo;
  }

  get totalFeverDamage(): number {
    return this._totalFeverDamage;
  }

  get collectedStars(): number {
    return this._collectedStars;
  }

  get missedStars(): number {
    return this._missedStars;
  }

  get sequenceCount(): number {
    return this._sequenceCount;
  }

  get snapshot(): PhaseAResourceSnapshot | null {
    return this._snapshot;
  }

  get scheduler(): StarNoteScheduler | undefined {
    return this._scheduler;
  }

  setScheduler(scheduler: StarNoteScheduler): void {
    this._scheduler = scheduler;
  }

  setBattleState(state: BattleState): void {
    this._battleState = state;
  }

  setBossController(boss: BossController): void {
    this._bossController = boss;
  }

  setStateMachine(sm: StateMachine): void {
    this._stateMachine = sm;
  }

  /**
   * 지정 인덱스의 피버 노트 시퀀스 반환 (1부터 시작)
   */
  generateFeverSequence(sequenceIndex = 1): readonly Keynote[] {
    const patternIndex = (Math.max(1, sequenceIndex) - 1) % DEFAULT_FEVER_PATTERNS.length;
    return DEFAULT_FEVER_PATTERNS[patternIndex];
  }

  /**
   * Phase B 진입 및 피버 모드 시작 (1회 호출)
   */
  start(startTime: number, snapshot?: PhaseAResourceSnapshot): void {
    this._isActive = true;
    this._isEnded = false;
    this._feverCombo = 0;
    this._maxFeverCombo = 0;
    this._totalFeverDamage = 0;
    this._collectedStars = 0;
    this._missedStars = 0;
    this._sequenceCount = 0;
    this._processedNoteIds.clear();

    if (snapshot) {
      this._snapshot = snapshot;
    }

    if (this._battleState) {
      this._battleState.resetFeverCombo();
    }

    // 첫 번째 시퀀스 스케줄링
    this._spawnSequence(startTime);
  }

  /**
   * 피버 루프 정지
   */
  stop(): void {
    this._isActive = false;
    if (this._scheduler) {
      this._scheduler.reset();
    }
  }

  /**
   * 세션 및 통계 초기화
   */
  reset(): void {
    this.stop();
    this._isEnded = false;
    this._feverCombo = 0;
    this._maxFeverCombo = 0;
    this._totalFeverDamage = 0;
    this._collectedStars = 0;
    this._missedStars = 0;
    this._sequenceCount = 0;
    this._currentSequenceStartTime = 0;
    this._currentSequenceNotes = [];
    this._snapshot = null;
    this._processedNoteIds.clear();
    if (this._battleState) {
      this._battleState.resetFeverCombo();
    }
  }

  /**
   * 특정 판정 및 콤보에 따른 단일 피해량 계산
   */
  computeDamage(rating: StarRating, combo = this._feverCombo): number {
    const ratingWeight = this._config.ratingWeights[rating] ?? 0;
    if (ratingWeight <= 0 || combo <= 0) return 0;
    const comboMultiplier = Math.min(
      this._config.maxComboMultiplier,
      1.0 + Math.max(0, combo - 1) * this._config.comboMultiplierStep,
    );
    return this._config.baseDamage * ratingWeight * comboMultiplier;
  }

  /**
   * 별 수집 판정 기록 및 보스 치명 피해 적용
   */
  recordRating(
    resultOrRating: StarCollectionResult | StarRating,
    explicitNoteId?: string,
  ): number {
    if (!this._isActive || this._isEnded) return 0;

    const rating: StarRating =
      typeof resultOrRating === 'string' ? resultOrRating : resultOrRating.rating;

    const noteId =
      explicitNoteId ??
      (typeof resultOrRating === 'object' && resultOrRating.target
        ? (resultOrRating.target as any).id
        : undefined);

    if (noteId) {
      if (this._processedNoteIds.has(noteId)) {
        return 0;
      }
      this._processedNoteIds.add(noteId);
    }

    if (rating === 'Miss') {
      this._feverCombo = 0;
      this._missedStars++;
      if (this._battleState) {
        this._battleState.resetFeverCombo();
      }
      return 0;
    }

    // 성공 판정: Perfect, Good, Late
    this._collectedStars++;
    this._feverCombo++;
    if (this._feverCombo > this._maxFeverCombo) {
      this._maxFeverCombo = this._feverCombo;
    }
    if (this._battleState) {
      this._battleState.incrementFeverCombo();
    }

    const damage = this.computeDamage(rating, this._feverCombo);

    if (this._bossController && damage > 0) {
      this._bossController.takeDamage(damage);
    }
    this._totalFeverDamage += damage;
    this._options.onDamageDealt?.(
      damage,
      this._bossController ? this._bossController.hp : 0,
      this._feverCombo,
    );

    if (this._bossController && this._bossController.isDefeated) {
      this.handleVictory();
    }

    return damage;
  }

  /**
   * 플레이어 피격 시 콤보 리셋 (#193 연동 규약)
   */
  onPlayerHit(): void {
    this.resetCombo();
    if (this._battleState && !this._battleState.isAlive) {
      this.handleGameOver();
    }
  }

  /**
   * 콤보 강제 리셋
   */
  resetCombo(): void {
    this._feverCombo = 0;
    if (this._battleState) {
      this._battleState.resetFeverCombo();
    }
  }

  /**
   * 매 프레임 업데이트: 스케줄러 갱신, 만료/수집 평가 및 시퀀스 순환 체크
   */
  update(
    currentTime: number,
    landmarks?: readonly NormalizedLandmark[] | null,
    palms?: PalmPositions,
    isMirrored = false,
    options?: CursorUpdateOptions,
  ): StarCollectionResult[] {
    if (!this._isActive || this._isEnded) return [];

    // 플레이어 체력 체크 (패배 시 게임오버 우선)
    if (this._battleState && !this._battleState.isAlive) {
      this.handleGameOver();
      return [];
    }

    let results: StarCollectionResult[] = [];
    if (this._scheduler) {
      results = this._scheduler.update(currentTime, landmarks, palms, isMirrored, options);
      for (const res of results) {
        this.recordRating(res);
      }
    }

    // 보스 처치 체크
    if (this._bossController && this._bossController.isDefeated) {
      this.handleVictory();
      return results;
    }

    // 무제한 시퀀스 연속 순환
    if (this._scheduler && !this._isEnded && this._isActive) {
      const sequenceDuration = (this._currentSequenceNotes.length || 8) * this._secondsPerBeat;
      const isSchedulerDone = this._scheduler.activeNotes.length === 0;
      const isDurationPassed = currentTime >= this._currentSequenceStartTime + sequenceDuration;

      if (isSchedulerDone || isDurationPassed) {
        const nextStartTime = Math.max(
          this._currentSequenceStartTime + sequenceDuration,
          currentTime,
        );
        this._spawnSequence(nextStartTime);
      }
    }

    return results;
  }

  /**
   * 보스 처치 승리 종결 처리
   */
  handleVictory(): void {
    if (this._isEnded) return;
    this._isEnded = true;
    this._isActive = false;

    if (this._scheduler) {
      this._scheduler.reset();
    }

    const stats = this.getStats(true);
    this._options.onVictory?.(stats);

    if (this._stateMachine && this._stateMachine.currentState !== 'RESULT') {
      this._stateMachine.changeState('RESULT');
    }
  }

  /**
   * 플레이어 패배 게임오버 종결 처리
   */
  handleGameOver(): void {
    if (this._isEnded) return;
    this._isEnded = true;
    this._isActive = false;

    if (this._scheduler) {
      this._scheduler.reset();
    }

    const stats = this.getStats(false);
    this._options.onGameOver?.(stats);

    if (this._stateMachine && this._stateMachine.currentState !== 'GAMEOVER') {
      this._stateMachine.changeState('GAMEOVER');
    }
  }

  /**
   * 현재 피버 세션 통계 스냅샷 반환
   */
  getStats(
    isVictory = this._bossController ? this._bossController.isDefeated : false,
  ): BossFeverStats {
    return Object.freeze({
      feverCombo: this._feverCombo,
      maxFeverCombo: this._maxFeverCombo,
      totalFeverDamage: this._totalFeverDamage,
      collectedStars: this._collectedStars,
      missedStars: this._missedStars,
      sequenceCount: this._sequenceCount,
      isVictory,
      snapshot: this._snapshot,
    });
  }

  private _spawnSequence(startTime: number): void {
    this._sequenceCount++;
    this._currentSequenceStartTime = startTime;
    const notes = this._sequenceGenerator(this._sequenceCount);
    this._currentSequenceNotes = notes;
    if (this._scheduler) {
      this._scheduler.start(startTime, {
        roundId: 100 + this._sequenceCount,
        notes,
      });
    }
  }
}
