/**
 * QuestionBank - 챕터별 문제 풀 관리 및 셔플 큐
 *
 * Ch.1~4: 해당 레벨 필터링
 * Ch.5 (나이트메어): 전 영역 랜덤 혼합
 * 중복 출제 방지 셔플 큐
 *
 * @see Issue #12 (GitHub #77)
 */

import type { QuestionRecord, SubLevelInfo } from '../types/index.js';

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
  private _currentSubLevel?: number;
  private _lastServed: QuestionRecord[] = [];

  /**
   * 전체 문제 데이터 로드
   */
  loadRecords(records: QuestionRecord[]): void {
    this._allRecords = records.length > 0 ? records : [...FALLBACK_QUESTIONS];
  }

  /**
   * 특정 챕터(레벨) 및 세부 난이도(subLevel)로 풀 설정
   * Ch.1~4: subLevel 미지정 시 해당 챕터 전체 풀, 지정 시 해당 subLevel만 필터링
   * Ch.5: subLevel 1~5 -> Level 5~9(제곱/2진수/도형/비율/기타), subLevel 6 또는 미지정 -> 전 영역 종합
   */
  setLevel(level: number, subLevel?: number): void {
    this._currentLevel = level;
    this._currentSubLevel = subLevel;

    if (level === 5) {
      // 나이트메어 (Ch.5) 매핑:
      // 1: Level 5 (거듭제곱)
      // 2: Level 6 (이진법)
      // 3: Level 7 (도형)
      // 4: Level 8 (백분율)
      // 5: Level 9 (기타)
      // 6 또는 미지정: Level 1~9 전 영역 종합 풀
      if (subLevel === 1) {
        this._pool = this._allRecords.filter((r) => r.level === 5);
      } else if (subLevel === 2) {
        this._pool = this._allRecords.filter((r) => r.level === 6);
      } else if (subLevel === 3) {
        this._pool = this._allRecords.filter((r) => r.level === 7);
      } else if (subLevel === 4) {
        this._pool = this._allRecords.filter((r) => r.level === 8);
      } else if (subLevel === 5) {
        this._pool = this._allRecords.filter((r) => r.level === 9);
      } else {
        this._pool = [...this._allRecords];
      }
    } else {
      if (subLevel !== undefined && subLevel > 0) {
        this._pool = this._allRecords.filter((r) => r.level === level && r.subLevel === subLevel);
      } else {
        this._pool = this._allRecords.filter((r) => r.level === level);
      }
    }

    // 풀이 비어있으면 fallback 사용
    if (this._pool.length === 0) {
      this._pool = [...FALLBACK_QUESTIONS];
    }

    this._queue = [];
    this._lastServed = [];
    this._shuffle();
  }

  /**
   * 챕터별 세부 단계(SubLevel) 메타데이터 목록 조회
   */
  getSubLevels(chapter: number): SubLevelInfo[] {
    if (chapter === 5) {
      const titles: Record<number, string> = {
        5: '거듭제곱',
        6: '이진법',
        7: '도형',
        8: '백분율',
        9: '기타(방정식/쌓기나무)',
      };
      const result: SubLevelInfo[] = [];
      for (let lvl = 5; lvl <= 9; lvl++) {
        const count = this._allRecords.filter((r) => r.level === lvl).length;
        result.push({
          subLevel: lvl - 4,
          title: titles[lvl],
          count,
        });
      }
      result.push({
        subLevel: 6,
        title: '전 영역 종합',
        count: this._allRecords.length,
      });
      return result;
    }

    // Ch.1~4
    const records = this._allRecords.filter((r) => r.level === chapter);
    const subMap = new Map<number, { title: string; count: number }>();

    for (const r of records) {
      if (!subMap.has(r.subLevel)) {
        subMap.set(r.subLevel, { title: r.subLevelTitle || `세부단계 ${r.subLevel}`, count: 0 });
      }
      subMap.get(r.subLevel)!.count++;
    }

    return Array.from(subMap.entries()).map(([subLevel, data]) => ({
      subLevel,
      title: data.title,
      count: data.count,
    }));
  }

  /** 현재 세부 단계 */
  get currentSubLevel(): number | undefined {
    return this._currentSubLevel;
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

  /** 고유한 템플릿이 2개 이상 존재하는지 확인 */
  private _hasDistinctTemplates(): boolean {
    if (this._pool.length < 2) return false;
    const first = this._pool[0].questionTemplate;
    return this._pool.some((r) => r.questionTemplate !== first);
  }

  /**
   * 다음 문제 뽑기 (중복 방지 셔플 큐)
   * 큐가 비면 자동으로 다시 셔플
   */
  next(): QuestionRecord {
    if (this._queue.length === 0) {
      this._shuffle();
    }

    const lastTemplate = this._lastServed.length > 0
      ? this._lastServed[this._lastServed.length - 1].questionTemplate
      : null;

    // 사이클 경계 및 연속 출제 방지 가드: 직전 문제와 동일 템플릿이면 큐 내부 다른 문제와 교체
    if (lastTemplate && this._hasDistinctTemplates()) {
      let topIdx = this._queue.length - 1;

      if (this._queue[topIdx].questionTemplate === lastTemplate) {
        let found = -1;
        for (let i = topIdx - 1; i >= 0; i--) {
          if (this._queue[i].questionTemplate !== lastTemplate) {
            found = i;
            break;
          }
        }

        if (found >= 0) {
          [this._queue[topIdx], this._queue[found]] = [this._queue[found], this._queue[topIdx]];
        } else {
          // 큐에 남은 항목이 1개이거나 남은 항목들이 모두 직전 템플릿과 동일한 경우
          // 조기 재셔플로 새 사이클을 시작하고 직전 템플릿이 아닌 문제로 교체
          this._shuffle();
          topIdx = this._queue.length - 1;
          if (this._queue[topIdx].questionTemplate === lastTemplate) {
            for (let i = topIdx - 1; i >= 0; i--) {
              if (this._queue[i].questionTemplate !== lastTemplate) {
                [this._queue[topIdx], this._queue[i]] = [this._queue[i], this._queue[topIdx]];
                break;
              }
            }
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

    // 사이클 경계 anti-repeat 가드: 직전 사이클 마지막 문제와 새 사이클 시작 문제 겹침 방지
    if (this._lastServed.length > 0 && this._hasDistinctTemplates()) {
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
  }
}
