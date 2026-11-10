/**
 * assault-recovery-question-source.test.ts
 *
 * [BOSS-ASSAULT-REC-01 / #589] 선택 문항 풀 읽기 전용 공급 포트 단위 테스트
 *
 * 검증 목표:
 * 1. QuestionBank.getPoolSnapshot() 포트가 현재 선택된 레벨/서브레벨에 맞는 스냅샷을 제공한다.
 * 2. 원본 메타데이터(id, level, subLevel, shapeCode, template, eval 등)가 완벽히 보존된다.
 * 3. 스냅샷 배열이나 레코드의 변형 시도가 내부 _pool, _queue, _allRecords 및 next() 동작에 영향을 주지 않는다 (불변성).
 * 4. 빈 풀/매칭 실패로 인한 fallback 풀과 정상 로드 풀의 출처(source: 'loaded' | 'fallback', isFallback)를 명확히 구분한다.
 * 5. getPoolSnapshot() 호출은 내부 셔플 큐 순서나 lastServed를 오염시키지 않는다.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QuestionBank, type QuestionPoolSnapshot } from '../../src/question/QuestionBank.js';
import type { QuestionRecord } from '../../src/types/index.js';

describe('[BOSS-ASSAULT-REC-01 / #589] QuestionBank Read-Only Snapshot Port', () => {
  let bank: QuestionBank;

  const mockRecords: (QuestionRecord & { id?: string | number })[] = [
    {
      id: 'q1',
      level: 1,
      subLevel: 1,
      levelTitle: '덧셈',
      subLevelTitle: '한자리 덧셈',
      questionTemplate: '{A} + {B} = ?',
      answerEval: 'A+B',
      wrongEval: 'A+B+1',
      varA: 'rand(1,5)',
      varB: 'rand(1,5)',
      varC: '0',
      varD: '0',
      shapeCode: '',
    },
    {
      id: 'q2',
      level: 1,
      subLevel: 2,
      levelTitle: '덧셈',
      subLevelTitle: '두자리 덧셈',
      questionTemplate: '{A} + {B} = ?',
      answerEval: 'A+B',
      wrongEval: 'A+B+2',
      varA: 'rand(10,20)',
      varB: 'rand(10,20)',
      varC: '0',
      varD: '0',
      shapeCode: 'TRIANGLE_A',
    },
    {
      id: 'q3',
      level: 2,
      subLevel: 1,
      levelTitle: '곱셈',
      subLevelTitle: '구구단 2단',
      questionTemplate: '2 * {A} = ?',
      answerEval: '2*A',
      wrongEval: '2*A+1',
      varA: 'rand(1,9)',
      varB: '0',
      varC: '0',
      varD: '0',
      shapeCode: '',
    },
  ];

  beforeEach(() => {
    bank = new QuestionBank();
  });

  describe('1. 포트 기본 동작 및 메타데이터 보존', () => {
    it('loadRecords 후 getPoolSnapshot()은 현재 레벨의 문제 스냅샷을 반환해야 한다', () => {
      bank.loadRecords(mockRecords);
      bank.setLevel(1, 1);

      const snapshot: QuestionPoolSnapshot = bank.getPoolSnapshot();

      expect(snapshot).toBeDefined();
      expect(snapshot.level).toBe(1);
      expect(snapshot.subLevel).toBe(1);
      expect(snapshot.source).toBe('loaded');
      expect(snapshot.isFallback).toBe(false);
      expect(snapshot.totalAvailable).toBe(1);
      expect(snapshot.questions.length).toBe(1);

      const q = snapshot.questions[0];
      expect(q.id).toBe('q1');
      expect(q.level).toBe(1);
      expect(q.subLevel).toBe(1);
      expect(q.questionTemplate).toBe('{A} + {B} = ?');
      expect(q.answerEval).toBe('A+B');
      expect(q.wrongEval).toBe('A+B+1');
      expect(q.shapeCode).toBe('');
    });

    it('subLevel 미지정 시 해당 레벨의 모든 문항을 포함해야 한다', () => {
      bank.loadRecords(mockRecords);
      bank.setLevel(1); // subLevel 미지정 -> level 1 전체 (q1, q2)

      const snapshot = bank.getPoolSnapshot();
      expect(snapshot.level).toBe(1);
      expect(snapshot.subLevel).toBeUndefined();
      expect(snapshot.totalAvailable).toBe(2);
      expect(snapshot.questions.map((q) => q.id)).toEqual(['q1', 'q2']);
      expect(snapshot.questions[1].shapeCode).toBe('TRIANGLE_A');
    });
  });

  describe('2. 불변성(Immutability) 및 내부 상태 격리', () => {
    it('반환된 snapshot.questions 배열을 변형하려 해도 내부 _pool과 _queue가 변경되지 않아야 한다', () => {
      bank.loadRecords(mockRecords);
      bank.setLevel(1, 1);

      const snapshot = bank.getPoolSnapshot();
      expect(snapshot.questions.length).toBe(1);

      // 배열 변형 시도 (push or mutate)
      expect(() => {
        (snapshot.questions as any).push({
          id: 'hacked',
          level: 1,
          subLevel: 1,
          questionTemplate: 'HACK',
        });
      }).toThrow();

      // 다시 조회해도 내부 풀 크기는 그대로 1이어야 함
      const snapshotAfter = bank.getPoolSnapshot();
      expect(snapshotAfter.questions.length).toBe(1);
      expect(snapshotAfter.questions[0].id).toBe('q1');
    });

    it('반환된 문항 객체의 프로퍼티를 변경하려 해도 동결(frozen)되어 있어야 한다', () => {
      bank.loadRecords(mockRecords);
      bank.setLevel(1, 1);

      const snapshot = bank.getPoolSnapshot();
      const q = snapshot.questions[0];

      expect(() => {
        (q as any).questionTemplate = 'MUTATED';
      }).toThrow();

      expect(bank.getPoolSnapshot().questions[0].questionTemplate).toBe('{A} + {B} = ?');
    });

    it('getPoolSnapshot() 호출은 next()의 셔플 순서나 lastServed를 변경시키지 않아야 한다', () => {
      bank.loadRecords(mockRecords);
      bank.setLevel(1);

      // 첫 번째 문제 인출
      const served1 = bank.next();
      expect(served1).toBeDefined();

      // 스냅샷 조회
      const snapshot = bank.getPoolSnapshot();
      expect(snapshot.totalAvailable).toBe(2);

      // lastServed가 getPoolSnapshot에 의해 오염되지 않았는지 검증
      expect(bank.lastServed.length).toBe(1);
      expect(bank.lastServed[0].questionTemplate).toBe(served1.questionTemplate);

      // 다음 인출이 정상 동작해야 함
      const served2 = bank.next();
      expect(served2).toBeDefined();
    });
  });

  describe('3. Fallback 풀과 로드 데이터의 출처 구분 (source / isFallback)', () => {
    it('빈 레코드로 loadRecords([]) 시 fallback 풀이 사용되며 isFallback: true여야 한다', () => {
      bank.loadRecords([]);
      bank.setLevel(1, 1);

      const snapshot = bank.getPoolSnapshot();
      expect(snapshot.isFallback).toBe(true);
      expect(snapshot.source).toBe('fallback');
      expect(snapshot.questions.length).toBeGreaterThan(0);
    });

    it('로드된 데이터에 없는 레벨/서브레벨 조회 시 fallback으로 전환되며 isFallback: true여야 한다', () => {
      bank.loadRecords(mockRecords);
      bank.setLevel(99, 1); // mockRecords에 레벨 99는 없음

      const snapshot = bank.getPoolSnapshot();
      expect(snapshot.isFallback).toBe(true);
      expect(snapshot.source).toBe('fallback');
      expect(snapshot.level).toBe(99);
    });

    it('loadRecords가 호출되지 않은 초기 상태에서 getPoolSnapshot()은 빈 풀 또는 fallback을 명확히 표시해야 한다', () => {
      const freshBank = new QuestionBank();
      const snapshot = freshBank.getPoolSnapshot();

      expect(snapshot.isFallback).toBe(true);
      expect(snapshot.source).toBe('fallback');
      expect(snapshot.totalAvailable).toBe(0);
      expect(snapshot.questions).toEqual([]);
    });
  });

  describe('4. 현재 상태를 변경하지 않는 오버라이드 조회 지원', () => {
    it('getPoolSnapshot(level, subLevel) 인자를 전달하면 bank.currentLevel을 바꾸지 않고 해당 범위를 조회해야 한다', () => {
      bank.loadRecords(mockRecords);
      bank.setLevel(1, 1);

      // 현재는 레벨 1, 서브레벨 1
      expect(bank.currentLevel).toBe(1);
      expect(bank.currentSubLevel).toBe(1);

      // 레벨 2, 서브레벨 1을 오버라이드 조회
      const snapshotL2 = bank.getPoolSnapshot(2, 1);
      expect(snapshotL2.level).toBe(2);
      expect(snapshotL2.subLevel).toBe(1);
      expect(snapshotL2.questions.length).toBe(1);
      expect(snapshotL2.questions[0].id).toBe('q3');

      // bank의 현재 설정은 그대로 1, 1이어야 함
      expect(bank.currentLevel).toBe(1);
      expect(bank.currentSubLevel).toBe(1);
      expect(bank.getPoolSnapshot().questions[0].id).toBe('q1');
    });
  });
});
