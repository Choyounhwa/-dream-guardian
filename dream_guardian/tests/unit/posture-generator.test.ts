import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  PostureGenerator,
  validatePosturePair,
  DEFAULT_CURATED_PATTERNS,
} from '../../src/input/PostureGenerator.js';
import { parseFitnessPatternCSV } from '../../src/data/FitnessPatternLoader.js';
import type { AnswerPosture } from '../../src/types/posture.js';
import { DEFAULT_FITNESS_ZONES } from '../../config/zone.config.js';

describe('PostureGenerator & Constraints C1~C7 (Issue #125 - POSE-003)', () => {
  it('기본 큐레이션 패턴으로 초기화된 생성기가 각 티어별 유효한 계획을 생성한다', () => {
    const generator = new PostureGenerator();

    for (let t = 1; t <= 4; t++) {
      const plan = generator.generatePlan(t as 1 | 2 | 3 | 4);
      expect(plan.tier).toBe(t);
      expect(plan.postures).toHaveLength(2);
      expect(plan.activeZoneIds.length).toBeGreaterThan(0);
      expect(plan.activeZoneIds.length).toBeLessThanOrEqual(3); // C1: 최대 3개
    }
  });

  it('100회 연속 생성 시 C1~C7 위반이 0건이어야 한다', () => {
    const generator = new PostureGenerator();
    let violationCount = 0;

    for (let i = 0; i < 100; i++) {
      const tier = ((i % 4) + 1) as 1 | 2 | 3 | 4;
      const plan = generator.generatePlan(tier);

      const check = validatePosturePair(plan.postures[0], plan.postures[1], {
        zones: DEFAULT_FITNESS_ZONES,
        maxActiveZones: 3,
        // 최근 쿨다운 큐는 generator 내부에서 관리되므로 C1~C6 및 생성 유효성 검증
      });

      if (!check.valid) {
        violationCount++;
        // eslint-disable-next-line no-console
        console.error(`Iteration ${i} failed:`, check.reason);
      }
    }

    expect(violationCount).toBe(0);
  });

  describe('C1~C7 개별 제약조건 검증 테스트', () => {
    it('C1: 활성 존 합집합이 3개를 초과하면 거부된다', () => {
      const postureA: AnswerPosture = {
        choiceIndex: 0,
        parts: ['leftHand', 'rightHand'],
        zoneIds: [1, 2],
        binding: 'any',
        patternId: 'C1_A',
      };
      const postureB: AnswerPosture = {
        choiceIndex: 1,
        parts: ['head', 'hip'],
        zoneIds: [3, 7], // 1, 2, 3, 7 -> 4개 존
        binding: 'any',
        patternId: 'C1_B',
      };

      const result = validatePosturePair(postureA, postureB, { maxActiveZones: 3 });
      expect(result.valid).toBe(false);
      expect(result.violatedConstraint).toBe('C1');
    });

    it('C2: 양측 선택지 간 단 하나라도 부위(커서 색상)를 공유하면 완전 색상 비공유 원칙(A.parts ∩ B.parts = ∅) 위반으로 거부된다 (Issue #151)', () => {
      // 1. 단일 부위 중복
      const postureA1: AnswerPosture = {
        choiceIndex: 0,
        parts: ['leftHand'],
        zoneIds: [4],
        binding: 'any',
        patternId: 'C2_A1',
      };
      const postureB1: AnswerPosture = {
        choiceIndex: 1,
        parts: ['leftHand', 'rightHand'],
        zoneIds: [4, 8],
        binding: 'any',
        patternId: 'C2_B1',
      };
      const result1 = validatePosturePair(postureA1, postureB1);
      expect(result1.valid).toBe(false);
      expect(result1.violatedConstraint).toBe('C2');

      // 2. 부분집합이 아니지만 공통 부위(leftHand)를 1개라도 공유하는 경우 (기존 C2는 통과했으나 신규 C2는 거부 필수)
      const postureA2: AnswerPosture = {
        choiceIndex: 0,
        parts: ['leftHand', 'head'],
        zoneIds: [4, 2],
        binding: 'any',
        patternId: 'C2_A2',
      };
      const postureB2: AnswerPosture = {
        choiceIndex: 1,
        parts: ['leftHand', 'hip'], // leftHand 공통 공유 -> A ∩ B = {leftHand} ≠ ∅
        zoneIds: [4, 7],
        binding: 'any',
        patternId: 'C2_B2',
      };
      const result2 = validatePosturePair(postureA2, postureB2);
      expect(result2.valid).toBe(false);
      expect(result2.violatedConstraint).toBe('C2');

      // 3. 완전 색상 비공유인 경우 C2 통과
      const postureA3: AnswerPosture = {
        choiceIndex: 0,
        parts: ['leftHand', 'hip'],
        zoneIds: [4, 7], // LH in 4, Hip in 7
        binding: 'any',
        patternId: 'C2_A3',
      };
      const postureB3: AnswerPosture = {
        choiceIndex: 1,
        parts: ['head', 'rightHand'], // 완전 상호 배타, Head in 5, RH in 7 (총 활성존 4, 7, 5 = 3개로 C1 준수)
        zoneIds: [5, 7],
        binding: 'any',
        patternId: 'C2_B3',
      };
      const result3 = validatePosturePair(postureA3, postureB3);
      expect(result3.valid).toBe(true);
    });

    it('C3: 머리와 골반이 동일한 존을 요구하면 거부된다', () => {
      const postureA: AnswerPosture = {
        choiceIndex: 0,
        parts: ['head', 'hip'],
        zoneIds: [7, 7], // 동일 존 7 요구
        binding: 'any',
        patternId: 'C3_A',
      };
      const postureB: AnswerPosture = {
        choiceIndex: 1,
        parts: ['leftHand'],
        zoneIds: [4],
        binding: 'any',
        patternId: 'C3_B',
      };

      const result = validatePosturePair(postureA, postureB);
      expect(result.valid).toBe(false);
      // C5(머리 허용존) 또는 C3(동일존) 위반
      expect(['C3', 'C5']).toContain(result.violatedConstraint);
    });

    it('C4: 머리와 골반 동시 요구 시 머리가 골반보다 아래에 위치하면 거부된다', () => {
      // 가상 존: 머리 존 y=0.8, 골반 존 y=0.5
      const mockZones = [
        { id: 4, label: '머리하단', x: 0.1, y: 0.8, width: 0.2, height: 0.1 },
        { id: 7, label: '골반상단', x: 0.4, y: 0.5, width: 0.2, height: 0.1 },
      ];
      const postureA: AnswerPosture = {
        choiceIndex: 0,
        parts: ['head', 'hip'],
        zoneIds: [4, 7],
        binding: 'any',
        patternId: 'C4_A',
      };
      const postureB: AnswerPosture = {
        choiceIndex: 1,
        parts: ['rightHand'],
        zoneIds: [7],
        binding: 'any',
        patternId: 'C4_B',
      };

      const result = validatePosturePair(postureA, postureB, { zones: mockZones });
      expect(result.valid).toBe(false);
      expect(result.violatedConstraint).toBe('C4');
    });

    it('C5: 머리/골반 허용 구역 제약을 위반하면 거부된다 (Issue #156)', () => {
      // 1. 머리가 중단 좌/우(4, 5)가 아닌 상단 존(2)에 배정된 경우
      const postureHeadInvalid: AnswerPosture = {
        choiceIndex: 0,
        parts: ['head'],
        zoneIds: [2], // 존 2는 상단 존 (머리 사용 불가)
        binding: 'any',
        patternId: 'C5_HEAD',
      };
      const postureValidOther: AnswerPosture = {
        choiceIndex: 1,
        parts: ['rightHand'],
        zoneIds: [8],
        binding: 'any',
        patternId: 'C5_OTHER',
      };
      expect(validatePosturePair(postureHeadInvalid, postureValidOther).violatedConstraint).toBe('C5');

      // 2. 골반이 하단 존(6~11)이 아닌 중단 존(4)에 배정된 경우
      const postureHipInvalid: AnswerPosture = {
        choiceIndex: 0,
        parts: ['hip'],
        zoneIds: [4],
        binding: 'any',
        patternId: 'C5_HIP_INVALID',
      };
      expect(validatePosturePair(postureHipInvalid, postureValidOther).violatedConstraint).toBe('C5');
    });

    it('C6: 부위 수보다 고유 존 수가 많으면 집합 덮기 불가능으로 거부된다', () => {
      const postureA: AnswerPosture = {
        choiceIndex: 0,
        parts: ['leftHand'], // 부위 1개
        zoneIds: [1, 2],     // 존 2개 요구
        binding: 'any',
        patternId: 'C6_A',
      };
      const postureB: AnswerPosture = {
        choiceIndex: 1,
        parts: ['rightHand'],
        zoneIds: [8],
        binding: 'any',
        patternId: 'C6_B',
      };

      const result = validatePosturePair(postureA, postureB);
      expect(result.valid).toBe(false);
      expect(result.violatedConstraint).toBe('C6');
    });

    it('C7: 최근 3문제 내 사용된 patternId는 쿨다운에 걸려 거부된다', () => {
      const postureA = { ...DEFAULT_CURATED_PATTERNS[0], choiceIndex: 0 as const };
      const postureB = { ...DEFAULT_CURATED_PATTERNS[1], choiceIndex: 1 as const };

      const recentQueue = [postureA.patternId, 'OTHER_01', 'OTHER_02'];
      const result = validatePosturePair(postureA, postureB, { recentPatternIds: recentQueue });
      expect(result.valid).toBe(false);
      expect(result.violatedConstraint).toBe('C7');
    });

    it('C8: 골반 최하단(9~11)과 손 최상단(1~3) 동시 배치는 Cross-Body 제약 위반으로 거부된다 (Issue #158 / FEAT-ZONE-004)', () => {
      const otherPosture: AnswerPosture = {
        choiceIndex: 1,
        parts: ['head'],
        zoneIds: [4],
        binding: 'any',
        patternId: 'OTHER_HEAD',
      };

      // 1. 왼손 존 1 (최상단) + 골반 존 9 (최하단)
      const postureC8_1: AnswerPosture = {
        choiceIndex: 0,
        parts: ['leftHand', 'hip'],
        zoneIds: [1, 9],
        binding: 'any',
        patternId: 'C8_TEST_1',
      };
      const res1 = validatePosturePair(postureC8_1, otherPosture);
      expect(res1.valid).toBe(false);
      expect(res1.violatedConstraint).toBe('C8');
      expect(res1.reason).toContain('Cross-Body');

      // 2. 오른손 존 3 (최상단) + 골반 존 10 (최하단)
      const postureC8_2: AnswerPosture = {
        choiceIndex: 0,
        parts: ['rightHand', 'hip'],
        zoneIds: [3, 10],
        binding: 'any',
        patternId: 'C8_TEST_2',
      };
      const res2 = validatePosturePair(postureC8_2, otherPosture);
      expect(res2.valid).toBe(false);
      expect(res2.violatedConstraint).toBe('C8');

      // 3. 정상 통과 케이스 1: 골반 중하단(7) + 손 최상단(2) -> C8 통과
      const postureValid1: AnswerPosture = {
        choiceIndex: 0,
        parts: ['leftHand', 'hip'],
        zoneIds: [2, 7],
        binding: 'any',
        patternId: 'C8_VALID_1',
      };
      const resPass1 = validatePosturePair(postureValid1, otherPosture);
      expect(resPass1.valid).toBe(true);

      // 4. 정상 통과 케이스 2: 골반 최하단(10) + 손 중단(4) -> C8 통과
      const postureValid2: AnswerPosture = {
        choiceIndex: 0,
        parts: ['leftHand', 'hip'],
        zoneIds: [4, 10],
        binding: 'any',
        patternId: 'C8_VALID_2',
      };
      const resPass2 = validatePosturePair(postureValid2, otherPosture);
      expect(resPass2.valid).toBe(true);
    });
  });

  it('실제 fitness pattern.csv 원본 데이터를 로드하여 주입해도 100회 연속 정상 생성된다', () => {
    const csvPath = path.resolve(__dirname, '../../../fitness pattern.csv');
    const raw = fs.readFileSync(csvPath, 'utf-8');
    const records = parseFitnessPatternCSV(raw);

    const generator = new PostureGenerator({ patterns: records });

    let count = 0;
    for (let i = 0; i < 100; i++) {
      const tier = ((i % 4) + 1) as 1 | 2 | 3 | 4;
      const plan = generator.generatePlan(tier);

      expect(plan.postures).toHaveLength(2);
      expect(plan.activeZoneIds.length).toBeLessThanOrEqual(3);
      count++;
    }

    expect(count).toBe(100);
  });

  it('toRecipePlan() 호출 시 레거시 QuestionRecipePlan 형식으로 완벽 변환된다', () => {
    const generator = new PostureGenerator();
    const plan = generator.generatePlan(1);
    const recipePlan = generator.toRecipePlan(plan);

    expect(recipePlan.choices).toHaveLength(2);
    expect(recipePlan.tier.tier).toBe(1);
    expect(recipePlan.activeZones.length).toBe(plan.activeZoneIds.length);
  });
});
