import { describe, it, expect } from 'vitest';
import {
  matchPosture,
  isInsideZone,
  computeZoneWeight,
  createPostureProgress,
  getCursorMargin,
} from '../../src/input/PostureMatcher.js';
import { DEFAULT_FITNESS_ZONES, type FitnessZone } from '../../config/zone.config.js';
import { CURSOR_ENTRY_MARGIN, POSTURE_TIMING_CONFIG } from '../../config/posture.config.js';
import type { AnswerPosture } from '../../src/types/posture.js';

describe('PostureMatcher - Set Coverage Algorithm (Issue #124 - POSE-002)', () => {
  const zones: readonly FitnessZone[] = DEFAULT_FITNESS_ZONES;

  // 도우미 함수: 특정 존의 중심 좌표 반환
  const getZoneCenter = (zoneId: number) => {
    const z = zones.find((item) => item.id === zoneId);
    if (!z) throw new Error(`Zone ${zoneId} not found`);
    return { x: z.x + z.width / 2, y: z.y + z.height / 2 };
  };

  // 도우미 함수: 특정 존의 가장자리 좌표 반환 (중심에서 0.6 오프셋)
  const getZoneEdge = (zoneId: number) => {
    const z = zones.find((item) => item.id === zoneId);
    if (!z) throw new Error(`Zone ${zoneId} not found`);
    return { x: z.x + z.width * 0.9, y: z.y + z.height * 0.9 };
  };

  describe('2부위 1존 테스트', () => {
    const posture: AnswerPosture = {
      choiceIndex: 0,
      parts: ['leftHand', 'rightHand'],
      zoneIds: [2, 2], // 두 손 모두 상단 존 2 요구
      binding: 'any',
      patternId: 'D_TOP_HANDS',
    };

    it('두 부위 모두 해당 존 내부에 위치하면 met: true', () => {
      const cursors = new Map([
        ['leftHand', getZoneCenter(2)],
        ['rightHand', getZoneCenter(2)],
      ]);
      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(true);
      expect(result.partStates[0].inside).toBe(true);
      expect(result.partStates[1].inside).toBe(true);
      expect(result.zoneCovered[2]).toBe(true);
    });

    it('한 부위만 존 내부에 있고 다른 부위는 외부에 있으면 met: false', () => {
      const cursors = new Map([
        ['leftHand', getZoneCenter(2)],
        ['rightHand', { x: 0.1, y: 0.9 }], // Zone 2 외부
      ]);
      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(false);
      expect(result.partStates[0].inside).toBe(true);
      expect(result.partStates[1].inside).toBe(false);
    });
  });

  describe('2부위 2존 테스트 (RC-1 해결: 좌우 교환 및 몰림 방지)', () => {
    const posture: AnswerPosture = {
      choiceIndex: 0,
      parts: ['leftHand', 'rightHand'],
      zoneIds: [1, 3], // 좌상 1, 우상 3 요구 (만세 포즈)
      binding: 'any',
      patternId: 'D001',
    };

    it('정방향 배치(LH in 1, RH in 3) 시 met: true', () => {
      const cursors = new Map([
        ['leftHand', getZoneCenter(1)],
        ['rightHand', getZoneCenter(3)],
      ]);
      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(true);
      expect(result.zoneCovered[1]).toBe(true);
      expect(result.zoneCovered[3]).toBe(true);
    });

    it('역방향 배치(좌우 교환: LH in 3, RH in 1) 시에도 met: true (RC-1 해결)', () => {
      const cursors = new Map([
        ['leftHand', getZoneCenter(3)],
        ['rightHand', getZoneCenter(1)],
      ]);
      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(true);
      expect(result.partStates[0].zoneId).toBe(3);
      expect(result.partStates[1].zoneId).toBe(1);
      expect(result.zoneCovered[1]).toBe(true);
      expect(result.zoneCovered[3]).toBe(true);
    });

    it('두 부위가 같은 존(예: 존 1)에 몰리면 조건 B 위반으로 met: false', () => {
      const cursors = new Map([
        ['leftHand', getZoneCenter(1)],
        ['rightHand', getZoneCenter(1)],
      ]);
      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(false);
      expect(result.zoneCovered[1]).toBe(true);
      expect(result.zoneCovered[3]).toBe(false); // 존 3 비어있음
    });
  });

  describe('3부위 조합 테스트 (1존, 2존, 3존)', () => {
    it('3부위 1존: 세 부위 모두 한 존에 위치 시 met: true', () => {
      const posture: AnswerPosture = {
        choiceIndex: 1,
        parts: ['leftHand', 'rightHand', 'head'],
        zoneIds: [2, 2, 2],
        binding: 'any',
        patternId: 'T_ALL_IN_ONE',
      };
      const cursors = new Map([
        ['leftHand', getZoneCenter(2)],
        ['rightHand', getZoneCenter(2)],
        ['head', getZoneCenter(2)],
      ]);
      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(true);
      expect(result.zoneCovered[2]).toBe(true);
    });

    it('3부위 2존: 2+1 분배(LH, RH in 1, Head in 2) 시 met: true', () => {
      const posture: AnswerPosture = {
        choiceIndex: 1,
        parts: ['leftHand', 'rightHand', 'head'],
        zoneIds: [1, 2],
        binding: 'any',
        patternId: 'T_2_PLUS_1',
      };
      const cursors = new Map([
        ['leftHand', getZoneCenter(1)],
        ['rightHand', getZoneCenter(1)],
        ['head', getZoneCenter(2)],
      ]);
      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(true);
      expect(result.zoneCovered[1]).toBe(true);
      expect(result.zoneCovered[2]).toBe(true);
    });

    it('3부위 2존: 모든 부위가 한 존에 몰려 1개 존이 비면 met: false', () => {
      const posture: AnswerPosture = {
        choiceIndex: 1,
        parts: ['leftHand', 'rightHand', 'head'],
        zoneIds: [1, 2],
        binding: 'any',
        patternId: 'T_2_PLUS_1',
      };
      const cursors = new Map([
        ['leftHand', getZoneCenter(1)],
        ['rightHand', getZoneCenter(1)],
        ['head', getZoneCenter(1)],
      ]);
      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(false);
      expect(result.zoneCovered[1]).toBe(true);
      expect(result.zoneCovered[2]).toBe(false);
    });

    it('3부위 3존: 각 존에 1개씩 위치 시 met: true', () => {
      const posture: AnswerPosture = {
        choiceIndex: 0,
        parts: ['leftHand', 'rightHand', 'head'],
        zoneIds: [1, 3, 2],
        binding: 'any',
        patternId: 'T001',
      };
      const cursors = new Map([
        ['leftHand', getZoneCenter(1)],
        ['rightHand', getZoneCenter(3)],
        ['head', getZoneCenter(2)],
      ]);
      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(true);
      expect(result.zoneCovered[1]).toBe(true);
      expect(result.zoneCovered[2]).toBe(true);
      expect(result.zoneCovered[3]).toBe(true);
    });

    it('3부위 3존: 1개 존이 비어있으면 met: false', () => {
      const posture: AnswerPosture = {
        choiceIndex: 0,
        parts: ['leftHand', 'rightHand', 'head'],
        zoneIds: [1, 3, 2],
        binding: 'any',
        patternId: 'T001',
      };
      const cursors = new Map([
        ['leftHand', getZoneCenter(1)],
        ['rightHand', getZoneCenter(1)], // 존 1에 중복 몰림
        ['head', getZoneCenter(2)],
      ]);
      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(false);
      expect(result.zoneCovered[3]).toBe(false);
    });
  });

  describe('4부위 전신 포즈 테스트 (Q001)', () => {
    it('두 손과 머리가 상단(존 2), 골반이 스쿼트(존 7)에 위치하면 met: true', () => {
      const posture: AnswerPosture = {
        choiceIndex: 0,
        parts: ['leftHand', 'rightHand', 'head', 'hip'],
        zoneIds: [2, 7],
        binding: 'any',
        patternId: 'Q001',
      };
      const cursors = new Map([
        ['leftHand', getZoneCenter(2)],
        ['rightHand', getZoneCenter(2)],
        ['head', getZoneCenter(2)],
        ['hip', getZoneCenter(7)],
      ]);
      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(true);
      expect(result.zoneCovered[2]).toBe(true);
      expect(result.zoneCovered[7]).toBe(true);
    });
  });

  describe('바인딩 모드: ordered (순서 엄격) 테스트', () => {
    const posture: AnswerPosture = {
      choiceIndex: 0,
      parts: ['leftHand', 'rightHand'],
      zoneIds: [1, 3],
      binding: 'ordered',
      patternId: 'ORDERED_TEST',
    };

    it('정방향 순서 일치(LH in 1, RH in 3) 시 met: true', () => {
      const cursors = new Map([
        ['leftHand', getZoneCenter(1)],
        ['rightHand', getZoneCenter(3)],
      ]);
      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(true);
    });

    it('ordered 모드에서 역방향(LH in 3, RH in 1) 배치 시 met: false', () => {
      const cursors = new Map([
        ['leftHand', getZoneCenter(3)],
        ['rightHand', getZoneCenter(1)],
      ]);
      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(false);
    });
  });

  describe('예외 및 엣지 케이스', () => {
    it('요구 부위 커서가 누락(undefined)된 경우 met: false', () => {
      const posture: AnswerPosture = {
        choiceIndex: 0,
        parts: ['leftHand', 'rightHand'],
        zoneIds: [1, 3],
        binding: 'any',
        patternId: 'MISSING_TEST',
      };
      const cursors = new Map([['leftHand', getZoneCenter(1)]]);
      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(false);
    });

    it('목표 존이 아닌 다른 활성 존에 위치한 경우 met: false', () => {
      const posture: AnswerPosture = {
        choiceIndex: 0,
        parts: ['leftHand'],
        zoneIds: [1], // 좌상
        binding: 'any',
        patternId: 'WRONG_ZONE',
      };
      const cursors = new Map([['leftHand', getZoneCenter(4)]]); // 좌(4)에 위치
      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(false);
      expect(result.zoneCovered[1]).toBe(false);
    });

    it('가중치 계산: 존 중심(1.5)과 테두리(0.75)의 평균 가중치가 올바르게 계산된다', () => {
      const posture: AnswerPosture = {
        choiceIndex: 0,
        parts: ['leftHand', 'rightHand'],
        zoneIds: [1, 3],
        binding: 'any',
        patternId: 'WEIGHT_TEST',
      };
      const cursors = new Map([
        ['leftHand', getZoneCenter(1)], // center: 1.5
        ['rightHand', getZoneEdge(3)],  // edge: 0.75
      ]);
      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(true);
      expect(result.avgWeight).toBeCloseTo((1.5 + 0.75) / 2, 2);
    });

    it('createPostureProgress가 올바른 PostureProgress 구조를 생성한다', () => {
      const posture: AnswerPosture = {
        choiceIndex: 0,
        parts: ['leftHand'],
        zoneIds: [1],
        binding: 'any',
        patternId: 'PROG_TEST',
      };
      const cursors = new Map([['leftHand', getZoneCenter(1)]]);
      const matchRes = matchPosture(posture, cursors, zones);
      const prog = createPostureProgress(0, 0.45, matchRes);

      expect(prog.choiceIndex).toBe(0);
      expect(prog.progress).toBe(0.45);
      expect(prog.met).toBe(true);
      expect(prog.partStates).toHaveLength(1);
      expect(prog.zoneCovered[1]).toBe(true);
    });

    it('isInsideZone 및 computeZoneWeight 헬퍼 함수가 정확한 값을 반환한다', () => {
      const zone = zones[0]; // Zone 1
      const center = { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
      const outside = { x: zone.x - 0.1, y: zone.y - 0.1 };

      expect(isInsideZone(center, zone)).toBe(true);
      expect(isInsideZone(outside, zone)).toBe(false);

      expect(computeZoneWeight(center, zone, 1.5, 0.75)).toBe(1.5);
      expect(computeZoneWeight({ x: zone.x + zone.width * 0.95, y: zone.y + zone.height * 0.95 }, zone, 1.5, 0.75)).toBe(0.75);
    });
  });

  describe('Issue #170 (INPUT-ZONE-001) - Head 및 Hip 커서 피트니스 존 진입 감도 최적화', () => {
    it('진입 마진 설정값(CURSOR_ENTRY_MARGIN)이 올바르게 정의되어 있다', () => {
      expect(CURSOR_ENTRY_MARGIN.head).toBe(0.03);
      expect(CURSOR_ENTRY_MARGIN.hip).toBe(0.04);
      expect(CURSOR_ENTRY_MARGIN.hand).toBe(0.0);
      expect(POSTURE_TIMING_CONFIG.cursorEntryMargin).toEqual(CURSOR_ENTRY_MARGIN);
    });

    it('getCursorMargin 헬퍼가 부위별 올바른 마진값을 반환한다', () => {
      expect(getCursorMargin('head')).toBe(0.03);
      expect(getCursorMargin('hip')).toBe(0.04);
      expect(getCursorMargin('leftHand')).toBe(0.0);
      expect(getCursorMargin('rightHand')).toBe(0.0);
      expect(getCursorMargin('hand')).toBe(0.0);
      // 옵션 오버라이드 지원
      expect(getCursorMargin('head', { head: 0.05, hip: 0.04, hand: 0.0 })).toBe(0.05);
    });

    it('isInsideZone에 margin 파라미터 적용 시 외곽 진입 좌표를 판정할 수 있다', () => {
      const zone = zones[1]; // Zone 2: x: 0.37, y: 0.04, width: 0.26, height: 0.16
      const insidePos = { x: 0.40, y: 0.10 };
      const marginPos = { x: 0.35, y: 0.10 }; // x가 zone.x(0.37)보다 0.02 바깥
      const farPos = { x: 0.30, y: 0.10 };    // x가 zone.x(0.37)보다 0.07 바깥

      // 기본 margin = 0 일 때
      expect(isInsideZone(insidePos, zone)).toBe(true);
      expect(isInsideZone(marginPos, zone)).toBe(false);

      // margin = 0.03 적용 시
      expect(isInsideZone(marginPos, zone, 0.03)).toBe(true);
      expect(isInsideZone(farPos, zone, 0.03)).toBe(false);
    });

    it('Head 커서: 존 경계선 25% 진입(마진 0.03 이내) 시 met: true 및 edgeWeight(0.75)가 부여된다', () => {
      const posture: AnswerPosture = {
        choiceIndex: 0,
        parts: ['head'],
        zoneIds: [2], // 상단 (x: 0.37, y: 0.04, width: 0.26, height: 0.16)
        binding: 'any',
        patternId: 'HEAD_MARGIN_TEST',
      };

      // Zone 2의 좌측 경계선(0.37)에서 0.02 벗어난 0.35 위치 (마진 0.03 이내)
      const cursors = new Map([
        ['head', { x: 0.35, y: 0.12 }],
      ]);

      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(true);
      expect(result.partStates[0].inside).toBe(true);
      expect(result.zoneCovered[2]).toBe(true);
      // 외곽/마진 영역 충전은 edgeWeight (0.75)
      expect(result.avgWeight).toBe(0.75);
    });

    it('Head 커서: 존 중심부 진입 시 centerWeight(1.5)가 부여된다', () => {
      const posture: AnswerPosture = {
        choiceIndex: 0,
        parts: ['head'],
        zoneIds: [2],
        binding: 'any',
        patternId: 'HEAD_CENTER_TEST',
      };

      const cursors = new Map([
        ['head', getZoneCenter(2)],
      ]);

      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(true);
      expect(result.avgWeight).toBe(1.5);
    });

    it('Head 커서: 마진(0.03)을 초과하여 벗어난 경우 met: false', () => {
      const posture: AnswerPosture = {
        choiceIndex: 0,
        parts: ['head'],
        zoneIds: [2], // x: 0.37~0.63
        binding: 'any',
        patternId: 'HEAD_OUTSIDE_TEST',
      };

      // 0.37 - 0.04 = 0.33 (마진 0.03 초과)
      const cursors = new Map([
        ['head', { x: 0.33, y: 0.12 }],
      ]);

      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(false);
      expect(result.zoneCovered[2]).toBe(false);
    });

    it('Hip 커서: 스쿼트 하강 시 존 상단 0.04 마진 이내 진입 시 met: true 및 edgeWeight(0.75)가 부여된다', () => {
      const posture: AnswerPosture = {
        choiceIndex: 0,
        parts: ['hip'],
        zoneIds: [7], // 중하 (x: 0.37, y: 0.58, width: 0.26, height: 0.16)
        binding: 'any',
        patternId: 'HIP_MARGIN_TEST',
      };

      // Zone 7의 상단 경계선(0.58)에서 0.02 위쪽인 0.56 위치 (마진 0.04 이내)
      const cursors = new Map([
        ['hip', { x: 0.50, y: 0.56 }],
      ]);

      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(true);
      expect(result.partStates[0].inside).toBe(true);
      expect(result.zoneCovered[7]).toBe(true);
      expect(result.avgWeight).toBe(0.75);
    });

    it('Hip 커서: 존 중심부 진입 시 centerWeight(1.5)가 부여된다', () => {
      const posture: AnswerPosture = {
        choiceIndex: 0,
        parts: ['hip'],
        zoneIds: [7],
        binding: 'any',
        patternId: 'HIP_CENTER_TEST',
      };

      const cursors = new Map([
        ['hip', getZoneCenter(7)],
      ]);

      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(true);
      expect(result.avgWeight).toBe(1.5);
    });

    it('Hip 커서: 마진(0.04)을 초과하여 벗어난 경우 met: false', () => {
      const posture: AnswerPosture = {
        choiceIndex: 0,
        parts: ['hip'],
        zoneIds: [7], // y: 0.58~0.74
        binding: 'any',
        patternId: 'HIP_OUTSIDE_TEST',
      };

      // 0.58 - 0.05 = 0.53 (마진 0.04 초과)
      const cursors = new Map([
        ['hip', { x: 0.50, y: 0.53 }],
      ]);

      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(false);
      expect(result.zoneCovered[7]).toBe(false);
    });

    it('Hand 커서: 기존 정밀 판정 유지 (마진 0.0으로 경계선 밖 0.01 벗어남 시 met: false)', () => {
      const posture: AnswerPosture = {
        choiceIndex: 0,
        parts: ['leftHand'],
        zoneIds: [1], // x: 0.04~0.30
        binding: 'any',
        patternId: 'HAND_PRECISION_TEST',
      };

      // 좌측 경계(0.04) 바깥인 0.03
      const cursors = new Map([
        ['leftHand', { x: 0.03, y: 0.12 }],
      ]);

      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(false);
      expect(result.zoneCovered[1]).toBe(false);
    });

    it('인접한 다른 피트니스 존으로 오인식(False Positive)되지 않는다 (0건 검증)', () => {
      // 1) Head 커서: 목표 존이 Zone 1일 때, 인접한 Zone 2(우측)나 Zone 4(하단)에 위치하면 불충족
      const headPosture: AnswerPosture = {
        choiceIndex: 0,
        parts: ['head'],
        zoneIds: [1], // 좌상 (x: 0.04~0.30, y: 0.04~0.20)
        binding: 'any',
        patternId: 'HEAD_FALSE_POSITIVE',
      };

      // Zone 2(x: 0.37~) 경계
      const headAtZone2Edge = new Map([['head', { x: 0.37, y: 0.12 }]]);
      expect(matchPosture(headPosture, headAtZone2Edge, zones).met).toBe(false);

      // Zone 4(y: 0.24~) 상단
      const headAtZone4Edge = new Map([['head', { x: 0.17, y: 0.24 }]]);
      expect(matchPosture(headPosture, headAtZone4Edge, zones).met).toBe(false);

      // 2) Hip 커서: 목표 존이 Zone 7(중하)일 때, 인접한 Zone 6, Zone 8, Zone 10에 위치하면 불충족
      const hipPosture: AnswerPosture = {
        choiceIndex: 0,
        parts: ['hip'],
        zoneIds: [7], // 중하 (x: 0.37~0.63, y: 0.58~0.74)
        binding: 'any',
        patternId: 'HIP_FALSE_POSITIVE',
      };

      // Zone 6 우측 경계 (x: 0.30)
      const hipAtZone6 = new Map([['hip', { x: 0.30, y: 0.66 }]]);
      expect(matchPosture(hipPosture, hipAtZone6, zones).met).toBe(false);

      // Zone 8 좌측 경계 (x: 0.70)
      const hipAtZone8 = new Map([['hip', { x: 0.70, y: 0.66 }]]);
      expect(matchPosture(hipPosture, hipAtZone8, zones).met).toBe(false);

      // Zone 10(y: 0.78~0.94) 내부 (y: 0.80)
      const hipAtZone10 = new Map([['hip', { x: 0.50, y: 0.80 }]]);
      expect(matchPosture(hipPosture, hipAtZone10, zones).met).toBe(false);
    });

    it('ordered 바인딩 모드에서도 커서 진입 마진이 정상 적용된다', () => {
      const posture: AnswerPosture = {
        choiceIndex: 0,
        parts: ['leftHand', 'head'],
        zoneIds: [1, 2],
        binding: 'ordered',
        patternId: 'ORDERED_MARGIN_TEST',
      };

      // LH는 Zone 1 내부, Head는 Zone 2 마진 영역(0.35)
      const cursors = new Map([
        ['leftHand', getZoneCenter(1)],
        ['head', { x: 0.35, y: 0.12 }],
      ]);

      const result = matchPosture(posture, cursors, zones);
      expect(result.met).toBe(true);
      expect(result.partStates[0].inside).toBe(true);
      expect(result.partStates[1].inside).toBe(true);
    });
  });
});
