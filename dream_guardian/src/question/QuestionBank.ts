/**
 * QuestionBank - 챕터별 문제 풀 관리 및 셔플 큐
 *
 * Ch.1~4: 해당 레벨 필터링
 * Ch.5 (나이트메어): 전 영역 랜덤 혼합
 * 중복 출제 방지 셔플 큐
 *
 * @see Issue #12 (GitHub #77)
 */

import type { QuestionRecord } from '../types/index.js';

/** 기본 안전 문제 (CSV 로드 실패 시 사용) */
const FALLBACK_QUESTIONS: QuestionRecord[] = [
  {
    level: 1, subLevel: 1,
    levelTitle: '덧셈', subLevelTitle: '한자리',
    questionTemplate: '{A} + {B} = ?',
    answerEval: 'A+B', wrongEval: 'A+B+pick(-2,-1,1,2)',
    varA: 'rand(1,9)', varB: 'rand(1,9)',
    varC: '0', varD: '0', shapeCode: '',
  },
  {
    level: 1, subLevel: 1,
    levelTitle: '뺄셈', subLevelTitle: '한자리',
    questionTemplate: '{A} - {B} = ?',
    answerEval: 'A-B', wrongEval: 'A-B+pick(-1,1,2)',
    varA: 'rand(4,9)', varB: 'rand(1,3)',
    varC: '0', varD: '0', shapeCode: '',
  },
];

export class QuestionBank {
  private _allRecords: QuestionRecord[] = [];
  private _pool: QuestionRecord[] = [];
  private _queue: QuestionRecord[] = [];
  private _currentLevel = 1;
  private _lastServed: QuestionRecord[] = [];

  /**
   * 전체 문제 데이터 로드
   */
  loadRecords(records: QuestionRecord[]): void {
    this._allRecords = records.length > 0 ? records : [...FALLBACK_QUESTIONS];
  }

  /**
   * 특정 챕터(레벨)로 풀 설정
   * Ch.5 = 전 영역 혼합
   */
  setLevel(level: number): void {
    this._currentLevel = level;

    if (level === 5) {
      // 나이트메어: 전체 풀
      this._pool = [...this._allRecords];
    } else {
      this._pool = this._allRecords.filter((r) => r.level === level);
    }

    // 풀이 비어있으면 fallback 사용
    if (this._pool.length === 0) {
      this._pool = [...FALLBACK_QUESTIONS];
    }

    this._queue = [];
    this._lastServed = [];
    this._shuffle();
  }

  /** 최근 제공된 문제 (최대 3개) */
  get lastServed(): readonly QuestionRecord[] {
    return this._lastServed;
  }

  /** 현재 레벨 */
  get currentLevel(): number {
    return this._currentLevel;
  }

  /** 현재 풀 크기 */
  get poolSize(): number {
    return this._pool.length;
  }

  /** 남은 큐 크기 */
  get queueSize(): number {
    return this._queue.length;
  }

  /** 전체 레코드 수 */
  get totalRecords(): number {
    return this._allRecords.length;
  }

  /**
   * 다음 문제 뽑기 (중복 방지 셔플 큐)
   * 큐가 비면 자동으로 다시 셔플
   */
  next(): QuestionRecord {
    if (this._queue.length === 0) {
      this._shuffle();
    }

    // 사이클 경계 및 연속 출제 방지 가드: 직전 문제와 동일 템플릿이면 큐 내부 다른 문제와 교체
    if (this._queue.length > 1 && this._lastServed.length > 0) {
      const lastTemplate = this._lastServed[this._lastServed.length - 1].questionTemplate;
      const topIdx = this._queue.length - 1;
      if (this._queue[topIdx].questionTemplate === lastTemplate) {
        for (let i = topIdx - 1; i >= 0; i--) {
          if (this._queue[i].questionTemplate !== lastTemplate) {
            [this._queue[topIdx], this._queue[i]] = [this._queue[i], this._queue[topIdx]];
            break;
          }
        }
      }
    }

    const item = this._queue.pop()!;
    this._lastServed.push(item);
    if (this._lastServed.length > 3) {
      this._lastServed.shift();
    }
    return item;
  }

  /** 셔플 큐 리셋 */
  private _shuffle(): void {
    this._queue = [...this._pool];
    // Fisher-Yates shuffle
    for (let i = this._queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this._queue[i], this._queue[j]] = [this._queue[j], this._queue[i]];
    }

    // 사이클 경계 anti-repeat 가드: 직전 사이클 최근 2문제와 새 사이클 시작 문제 겹침 방지
    if (this._pool.length > 2 && this._lastServed.length > 0) {
      const recentTemplates = this._lastServed.slice(-2).map((r) => r.questionTemplate);
      const topPositions = [this._queue.length - 1, this._queue.length - 2].filter((idx) => idx >= 0);

      for (const pos of topPositions) {
        if (recentTemplates.includes(this._queue[pos].questionTemplate)) {
          for (let i = 0; i < this._queue.length - topPositions.length; i++) {
            if (!recentTemplates.includes(this._queue[i].questionTemplate)) {
              [this._queue[pos], this._queue[i]] = [this._queue[i], this._queue[pos]];
              break;
            }
          }
        }
      }
    }
  }
}
