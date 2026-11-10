/**
 * AppPersistenceManager - 스테이지 진행도, 하이스코어, 보상 및 튜토리얼 영속성 관리자
 *
 * [REFACTOR-SRP-003] (Issue #634)
 * - AppBootstrap에서 거대화된 localStorage 영속성 로직(진행도, 하이스코어, 보상, 튜토리얼) 분리
 * - 테스트 세션 격리(isTestSession) 및 localStorage 미지원/권한 에러(SecurityError, QuotaExceededError) 방어
 * - 하이스코어 정렬 및 랭킹 관리
 */

export const STORAGE_KEY_STAGE_PROGRESS = 'dg_stage_progress';
export const STORAGE_KEY_HIGH_SCORES = 'dg_high_scores';
export const STORAGE_KEY_REWARDS = 'dg_rewards';
export const STORAGE_KEY_TUTORIAL_DONE = 'dream_guardian_tutorial_done';

export interface StageProgress {
  [chapterId: number]: number;
}

export interface HighScoreRecord {
  chapter: number;
  score: number;
  correctCount: number;
  maxCombo: number;
  recordedAt: number;
}

export interface RewardRecord {
  chapter: number;
  stars: number;
  unlockedAt: number;
}

export interface PersistenceOptions {
  isTestSession?: boolean;
}

export interface AppPersistenceManagerOptions {
  storage?: Storage | null;
}

export type HighScoreRecordInput = {
  chapter: number;
  score?: number;
  correctCount?: number;
  maxCombo?: number;
  recordedAt?: number;
};

export class AppPersistenceManager {
  private _customStorage?: Storage | null;
  private _starsMap: Record<number, number> = {};

  constructor(options?: AppPersistenceManagerOptions) {
    if (options && options.storage !== undefined) {
      this._customStorage = options.storage;
    }
    this.loadProgress();
  }

  private get _storage(): Storage | null {
    if (this._customStorage !== undefined) {
      return this._customStorage;
    }
    return typeof localStorage !== 'undefined' ? localStorage : null;
  }

  /**
   * 저장소에서 스테이지별 최고 별점(stars) 진행도를 불러옵니다.
   */
  public loadProgress(): Record<number, number> {
    if (!this._storage) {
      return this.getProgress();
    }

    try {
      const raw = this._storage.getItem(STORAGE_KEY_STAGE_PROGRESS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const map: Record<number, number> = {};
          for (const [key, value] of Object.entries(parsed)) {
            const chapterId = Number(key);
            const stars = Number(value);
            if (!Number.isNaN(chapterId) && !Number.isNaN(stars)) {
              map[chapterId] = stars;
            }
          }
          this._starsMap = map;
        }
      }
    } catch {
      // JSON 파싱 실패 또는 스토리지 접근 차단(SecurityError) 시 무시
    }

    return this.getProgress();
  }

  /**
   * 현재 인메모리 별점 진행도의 복사본을 반환합니다.
   */
  public getProgress(): Record<number, number> {
    return { ...this._starsMap };
  }

  /**
   * 인메모리 별점 진행도를 강제 지정합니다.
   */
  public setProgress(progress: Record<number, number>): void {
    this._starsMap = { ...progress };
  }

  /**
   * 특정 챕터의 별점을 저장합니다. 기존 별점보다 높은 경우에만 갱신됩니다.
   * 테스트 세션(isTestSession: true)인 경우 저장이 차단됩니다.
   */
  public saveProgress(
    chapter: number,
    stars: number,
    options?: PersistenceOptions,
  ): Record<number, number> {
    if (options?.isTestSession) {
      return this.getProgress();
    }

    this._starsMap[chapter] = Math.max(this._starsMap[chapter] ?? 0, stars);

    if (this._storage) {
      try {
        this._storage.setItem(
          STORAGE_KEY_STAGE_PROGRESS,
          JSON.stringify(this._starsMap),
        );
      } catch {
        // QuotaExceededError 등 실패 시 무시하고 인메모리 상태 유지
      }
    }

    return this.getProgress();
  }

  /**
   * 저장된 하이스코어 목록을 점수 내림차순(랭킹)으로 불러옵니다.
   */
  public loadHighScores(): HighScoreRecord[] {
    if (!this._storage) {
      return [];
    }

    try {
      const raw = this._storage.getItem(STORAGE_KEY_HIGH_SCORES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((item): item is HighScoreRecord => item && typeof item === 'object')
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (b.recordedAt ?? 0) - (a.recordedAt ?? 0));
        }
        if (parsed && typeof parsed === 'object') {
          // 레거시 단일 레코드 지원
          const legacy = parsed as Partial<HighScoreRecord>;
          return [
            {
              chapter: legacy.chapter ?? 1,
              score: legacy.score ?? ((legacy.correctCount ?? 0) * 100),
              correctCount: legacy.correctCount ?? 0,
              maxCombo: legacy.maxCombo ?? 0,
              recordedAt: legacy.recordedAt ?? Date.now(),
            },
          ];
        }
      }
    } catch {
      // 오류 시 빈 목록 반환
    }

    return [];
  }

  /**
   * 하이스코어 레코드를 저장하고 정렬된 목록을 반환합니다.
   */
  public saveHighScore(
    scoreOrRecord: number | HighScoreRecordInput,
    chapterOrOptions?: number | PersistenceOptions,
    detailsOrOptions?: Partial<HighScoreRecord> | PersistenceOptions,
    maybeOptions?: PersistenceOptions,
  ): HighScoreRecord[] {
    let score = 0;
    let chapter = 1;
    let correctCount = 0;
    let maxCombo = 0;
    let recordedAt = Date.now();
    let options: PersistenceOptions | undefined;

    if (typeof scoreOrRecord === 'number') {
      score = scoreOrRecord;
      chapter = typeof chapterOrOptions === 'number' ? chapterOrOptions : 1;
      if (detailsOrOptions && typeof detailsOrOptions === 'object' && !('isTestSession' in detailsOrOptions)) {
        const details = detailsOrOptions as Partial<HighScoreRecord>;
        correctCount = details.correctCount ?? Math.floor(score / 100);
        maxCombo = details.maxCombo ?? 0;
        recordedAt = details.recordedAt ?? Date.now();
      } else {
        correctCount = Math.floor(score / 100);
      }

      if (detailsOrOptions && 'isTestSession' in detailsOrOptions) {
        options = detailsOrOptions as PersistenceOptions;
      } else if (maybeOptions) {
        options = maybeOptions;
      }
    } else {
      const record = scoreOrRecord;
      chapter = record.chapter ?? 1;
      score = record.score ?? ((record.correctCount ?? 0) * 100);
      correctCount = record.correctCount ?? Math.floor(score / 100);
      maxCombo = record.maxCombo ?? 0;
      recordedAt = record.recordedAt ?? Date.now();
      if (chapterOrOptions && typeof chapterOrOptions === 'object') {
        options = chapterOrOptions as PersistenceOptions;
      }
    }

    if (options?.isTestSession) {
      return this.loadHighScores();
    }

    const currentScores = this.loadHighScores();
    const newRecord: HighScoreRecord = {
      chapter,
      score,
      correctCount,
      maxCombo,
      recordedAt,
    };

    currentScores.push(newRecord);
    currentScores.sort(
      (a, b) => (b.score ?? 0) - (a.score ?? 0) || (b.recordedAt ?? 0) - (a.recordedAt ?? 0),
    );
    const trimmed = currentScores.slice(0, 50);

    if (this._storage) {
      try {
        this._storage.setItem(STORAGE_KEY_HIGH_SCORES, JSON.stringify(trimmed));
      } catch {
        // 무시
      }
    }

    return trimmed;
  }

  /**
   * 누적 보상 목록을 불러옵니다.
   */
  public loadRewards(): RewardRecord[] {
    if (!this._storage) {
      return [];
    }

    try {
      const raw = this._storage.getItem(STORAGE_KEY_REWARDS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (item): item is RewardRecord =>
              item && typeof item === 'object' && typeof item.chapter === 'number',
          );
        }
      }
    } catch {
      // 무시
    }

    return [];
  }

  /**
   * 챕터 승리 보상을 저장합니다.
   */
  public saveReward(
    chapter: number,
    stars: number,
    options?: PersistenceOptions,
  ): RewardRecord[] {
    if (options?.isTestSession) {
      return this.loadRewards();
    }

    const rewards = this.loadRewards();
    rewards.push({ chapter, stars, unlockedAt: Date.now() });

    if (this._storage) {
      try {
        this._storage.setItem(STORAGE_KEY_REWARDS, JSON.stringify(rewards));
      } catch {
        // 무시
      }
    }

    return rewards;
  }

  /**
   * 튜토리얼 완료 여부를 조회합니다.
   */
  public isTutorialCompleted(): boolean {
    if (!this._storage) {
      return false;
    }
    try {
      const val = this._storage.getItem(STORAGE_KEY_TUTORIAL_DONE);
      return val === 'true' || val === '1';
    } catch {
      return false;
    }
  }

  /**
   * 튜토리얼 완료 여부를 설정합니다.
   */
  public setTutorialCompleted(completed = true): void {
    if (!this._storage) {
      return;
    }
    try {
      this._storage.setItem(STORAGE_KEY_TUTORIAL_DONE, completed ? 'true' : 'false');
    } catch {
      // 무시
    }
  }

  /**
   * 관리 대상인 모든 영속성 데이터를 초기화합니다.
   */
  public clearAll(): void {
    this._starsMap = {};
    if (!this._storage) {
      return;
    }
    try {
      this._storage.removeItem(STORAGE_KEY_STAGE_PROGRESS);
      this._storage.removeItem(STORAGE_KEY_HIGH_SCORES);
      this._storage.removeItem(STORAGE_KEY_REWARDS);
      this._storage.removeItem(STORAGE_KEY_TUTORIAL_DONE);
    } catch {
      // 무시
    }
  }
}
