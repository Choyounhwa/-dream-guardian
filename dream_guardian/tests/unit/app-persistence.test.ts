import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AppPersistenceManager,
  STORAGE_KEY_STAGE_PROGRESS,
  STORAGE_KEY_HIGH_SCORES,
  STORAGE_KEY_REWARDS,
  STORAGE_KEY_TUTORIAL_DONE,
} from '../../src/core/bootstrap/AppPersistenceManager.js';

describe('AppPersistenceManager [REFACTOR-SRP-003] (#634)', () => {
  let mockStorageStore: Record<string, string>;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorageStore = {};
    mockStorage = {
      getItem: vi.fn((key: string) => mockStorageStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorageStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorageStore[key];
      }),
      clear: vi.fn(() => {
        mockStorageStore = {};
      }),
      key: vi.fn((index: number) => Object.keys(mockStorageStore)[index] ?? null),
      length: 0,
    } as unknown as Storage;
  });

  describe('1. Storage Constants Export', () => {
    it('defines standard local storage keys matching specification', () => {
      expect(STORAGE_KEY_STAGE_PROGRESS).toBe('dg_stage_progress');
      expect(STORAGE_KEY_HIGH_SCORES).toBe('dg_high_scores');
      expect(STORAGE_KEY_REWARDS).toBe('dg_rewards');
      expect(STORAGE_KEY_TUTORIAL_DONE).toBe('dream_guardian_tutorial_done');
    });
  });

  describe('2. Stage Progress Persistence', () => {
    it('returns empty object when storage is empty', () => {
      const pm = new AppPersistenceManager({ storage: mockStorage });
      expect(pm.loadProgress()).toEqual({});
      expect(pm.getProgress()).toEqual({});
    });

    it('saves progress to localStorage and updates in-memory progress', () => {
      const pm = new AppPersistenceManager({ storage: mockStorage });
      const progress = pm.saveProgress(1, 3);

      expect(progress[1]).toBe(3);
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY_STAGE_PROGRESS,
        JSON.stringify({ 1: 3 }),
      );
      expect(pm.getProgress()[1]).toBe(3);
    });

    it('preserves the highest star rating and never downgrades', () => {
      const pm = new AppPersistenceManager({ storage: mockStorage });
      pm.saveProgress(1, 2);
      expect(pm.getProgress()[1]).toBe(2);

      pm.saveProgress(1, 3);
      expect(pm.getProgress()[1]).toBe(3);

      pm.saveProgress(1, 1);
      expect(pm.getProgress()[1]).toBe(3);
    });

    it('loads previously stored stage progress accurately', () => {
      mockStorageStore[STORAGE_KEY_STAGE_PROGRESS] = JSON.stringify({ '1': 3, '2': 2 });
      const pm = new AppPersistenceManager({ storage: mockStorage });
      const loaded = pm.loadProgress();

      expect(loaded).toEqual({ 1: 3, 2: 2 });
      expect(pm.getProgress()).toEqual({ 1: 3, 2: 2 });
    });

    it('blocks saving progress when isTestSession is true', () => {
      const pm = new AppPersistenceManager({ storage: mockStorage });
      pm.saveProgress(1, 2);
      mockStorage.setItem = vi.fn();

      const result = pm.saveProgress(1, 3, { isTestSession: true });
      expect(result[1]).toBe(2); // In-memory unchanged
      expect(mockStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('3. Error Resilience & Graceful Fallbacks', () => {
    it('returns empty progress when storage contains corrupt JSON', () => {
      mockStorageStore[STORAGE_KEY_STAGE_PROGRESS] = '{"invalid json: 123';
      const pm = new AppPersistenceManager({ storage: mockStorage });

      expect(pm.loadProgress()).toEqual({});
      expect(pm.getProgress()).toEqual({});
    });

    it('handles localStorage throwing SecurityError/DOMException on getItem', () => {
      mockStorage.getItem = vi.fn(() => {
        throw new Error('SecurityError: The operation is insecure.');
      });
      const pm = new AppPersistenceManager({ storage: mockStorage });

      expect(() => pm.loadProgress()).not.toThrow();
      expect(pm.loadProgress()).toEqual({});
    });

    it('handles localStorage throwing QuotaExceededError on setItem gracefully', () => {
      mockStorage.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError');
      });
      const pm = new AppPersistenceManager({ storage: mockStorage });

      expect(() => pm.saveProgress(2, 3)).not.toThrow();
      // In-memory state should still be updated even if storage fails
      expect(pm.getProgress()[2]).toBe(3);
    });

    it('works safely when storage is null or undefined (e.g. SSR or blocked storage)', () => {
      const pm = new AppPersistenceManager({ storage: null });

      expect(pm.loadProgress()).toEqual({});
      expect(() => pm.saveProgress(1, 2)).not.toThrow();
      expect(pm.getProgress()[1]).toBe(2);
      expect(pm.loadHighScores()).toEqual([]);
      expect(pm.loadRewards()).toEqual([]);
    });
  });

  describe('4. High Score Persistence & Ranking', () => {
    it('returns empty array when high score storage is empty', () => {
      const pm = new AppPersistenceManager({ storage: mockStorage });
      expect(pm.loadHighScores()).toEqual([]);
    });

    it('saves high score with score and chapterId and sorts descending by score', () => {
      const pm = new AppPersistenceManager({ storage: mockStorage });

      pm.saveHighScore(300, 1, { correctCount: 3, maxCombo: 3 });
      pm.saveHighScore(800, 2, { correctCount: 8, maxCombo: 8 });
      pm.saveHighScore(500, 1, { correctCount: 5, maxCombo: 5 });

      const scores = pm.loadHighScores();
      expect(scores.length).toBe(3);
      expect(scores[0].score).toBe(800);
      expect(scores[0].chapter).toBe(2);
      expect(scores[1].score).toBe(500);
      expect(scores[2].score).toBe(300);

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY_HIGH_SCORES,
        expect.any(String),
      );
    });

    it('supports saving high score using result record object', () => {
      const pm = new AppPersistenceManager({ storage: mockStorage });

      pm.saveHighScore({
        chapter: 3,
        correctCount: 7,
        maxCombo: 5,
        score: 700,
      });

      const scores = pm.loadHighScores();
      expect(scores.length).toBe(1);
      expect(scores[0].chapter).toBe(3);
      expect(scores[0].score).toBe(700);
      expect(scores[0].correctCount).toBe(7);
      expect(scores[0].maxCombo).toBe(5);
    });

    it('parses legacy single object high score into array format', () => {
      mockStorageStore[STORAGE_KEY_HIGH_SCORES] = JSON.stringify({
        chapter: 1,
        correctCount: 4,
        maxCombo: 4,
        score: 400,
        recordedAt: 123456789,
      });

      const pm = new AppPersistenceManager({ storage: mockStorage });
      const scores = pm.loadHighScores();

      expect(scores.length).toBe(1);
      expect(scores[0].score).toBe(400);
      expect(scores[0].chapter).toBe(1);
    });

    it('handles corrupt JSON in high scores storage without throwing', () => {
      mockStorageStore[STORAGE_KEY_HIGH_SCORES] = 'CORRUPT_DATA';
      const pm = new AppPersistenceManager({ storage: mockStorage });

      expect(pm.loadHighScores()).toEqual([]);
    });

    it('blocks high score persistence during test sessions', () => {
      const pm = new AppPersistenceManager({ storage: mockStorage });
      mockStorage.setItem = vi.fn();

      pm.saveHighScore(500, 1, undefined, { isTestSession: true });
      expect(pm.loadHighScores()).toEqual([]);
      expect(mockStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('5. Reward Persistence', () => {
    it('returns empty array when rewards storage is empty', () => {
      const pm = new AppPersistenceManager({ storage: mockStorage });
      expect(pm.loadRewards()).toEqual([]);
    });

    it('appends rewards to storage', () => {
      const pm = new AppPersistenceManager({ storage: mockStorage });
      pm.saveReward(1, 3);
      pm.saveReward(2, 2);

      const rewards = pm.loadRewards();
      expect(rewards.length).toBe(2);
      expect(rewards[0].chapter).toBe(1);
      expect(rewards[0].stars).toBe(3);
      expect(rewards[1].chapter).toBe(2);
      expect(rewards[1].stars).toBe(2);

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY_REWARDS,
        expect.any(String),
      );
    });

    it('blocks reward persistence during test sessions', () => {
      const pm = new AppPersistenceManager({ storage: mockStorage });
      mockStorage.setItem = vi.fn();

      pm.saveReward(1, 3, { isTestSession: true });
      expect(pm.loadRewards()).toEqual([]);
      expect(mockStorage.setItem).not.toHaveBeenCalled();
    });

    it('handles corrupt JSON in rewards gracefully', () => {
      mockStorageStore[STORAGE_KEY_REWARDS] = 'INVALID';
      const pm = new AppPersistenceManager({ storage: mockStorage });

      expect(pm.loadRewards()).toEqual([]);
    });
  });

  describe('6. Tutorial State & Clearing', () => {
    it('tracks and persists tutorial completion status', () => {
      const pm = new AppPersistenceManager({ storage: mockStorage });
      expect(pm.isTutorialCompleted()).toBe(false);

      pm.setTutorialCompleted(true);
      expect(pm.isTutorialCompleted()).toBe(true);
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY_TUTORIAL_DONE,
        'true',
      );
    });

    it('clears all game persistence keys upon clearAll()', () => {
      const pm = new AppPersistenceManager({ storage: mockStorage });
      pm.saveProgress(1, 3);
      pm.saveHighScore(500, 1);
      pm.saveReward(1, 3);
      pm.setTutorialCompleted(true);

      pm.clearAll();

      expect(mockStorageStore[STORAGE_KEY_STAGE_PROGRESS]).toBeUndefined();
      expect(mockStorageStore[STORAGE_KEY_HIGH_SCORES]).toBeUndefined();
      expect(mockStorageStore[STORAGE_KEY_REWARDS]).toBeUndefined();
      expect(mockStorageStore[STORAGE_KEY_TUTORIAL_DONE]).toBeUndefined();
      expect(pm.getProgress()).toEqual({});
    });
  });
});
