/**
 * result.ts - 라운드 정산 및 리듬 통계 데이터 타입 정의
 *
 * @see Issue #184 [GAME-ROUND-001]
 * @see Issue #176 [BEAT-SPEC-001]
 * @see Issue #182 [INPUT-STAR-001]
 */

export type RoundAnswerStatus = 'correct' | 'wrong' | 'timeout';

/**
 * BEAT MOTION 라운드 및 세션 리듬 통계 스키마
 * GDD 3.3.4 및 Issue #176 / #184 준수
 */
export interface BeatRhythmStats {
  /** 수집 성공한 총 별 개수 (Perfect + Good + Late) */
  beatStarsCollected: number;
  /** Perfect 판정 횟수 (±0.12s 이내) */
  perfectHits: number;
  /** Good 판정 횟수 (±0.25s 이내) */
  goodHits: number;
  /** Late 판정 횟수 (±0.40s 이내) */
  lateHits: number;
  /** 타격 실패/미스 별 개수 */
  missedStars: number;
  /** 오답 선택 횟수 */
  wrongAnswerCount: number;
  /** 8박 만료 미응답 타임아웃 횟수 (오답과 분리 기록) */
  timeoutCount: number;
  /** 오답/미응답 후 스웨이 회복 운동 수행 횟수 */
  recoverySwayCount: number;
}

export type RhythmStats = BeatRhythmStats;

/**
 * 단일 라운드 종료 시 정산 결과
 */
export interface RoundResolveResult {
  roundIndex: number;
  status: RoundAnswerStatus;
  manaGained: number;
  damageDealt: number;
  damageTaken: number;
  combo: number;
  spellCast: boolean;
  bossDefeated: boolean;
  playerDefeated: boolean;
  playerHp: number;
  bossHp: number;
  playerMana: number;
  rhythmStats: Readonly<BeatRhythmStats>;
}

export function createDefaultRhythmStats(): BeatRhythmStats {
  return {
    beatStarsCollected: 0,
    perfectHits: 0,
    goodHits: 0,
    lateHits: 0,
    missedStars: 0,
    wrongAnswerCount: 0,
    timeoutCount: 0,
    recoverySwayCount: 0,
  };
}

/**
 * Phase A 완료 및 상태 인계용 불변 자원 스냅샷 인터페이스
 * @see Issue #240 [BATTLE-PHASE-A-SETTLEMENT-001]
 * @see Issue #241 [GAME-STAGE-HANDOFF-001]
 */
export interface PhaseAResourceSnapshot {
  readonly playerHp: number;
  readonly maxPlayerHp: number;
  readonly playerMana: number;
  readonly bossHp: number;
  readonly maxBossHp: number;
  readonly bossChapter: number;
  readonly combo: number;
  readonly maxCombo: number;
  readonly correctCount: number;
  readonly wrongCount: number;
  readonly timeoutCount: number;
  readonly totalSettledQuestions: number;
  readonly guardianStage: number;
  readonly guardianCastCount: number;
  readonly rhythmStats: Readonly<BeatRhythmStats>;
  readonly isPhaseAComplete: boolean;
  readonly isPlayerDefeated: boolean;
  readonly isBossDefeated: boolean;
  readonly timestamp: number;
}
