import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_ZONE_SOFT_BOUNDARY_CONFIG } from '../../config/judgment.config.js';
import {
  computeZoneWeight,
  getCursorMargin,
  matchPosture,
  PostureMatcher,
  resetPostureMatcher,
  computePointVariance,
} from '../../src/input/PostureMatcher.js';
import { DEFAULT_FITNESS_ZONES, type FitnessZone } from '../../config/zone.config.js';
import type { AnswerPosture } from '../../src/types/posture.js';

describe('Posture Soft Boundary - Issue #250 [INPUT-TOLERANCE-002]', () => {
  const zones: readonly FitnessZone[] = DEFAULT_FITNESS_ZONES;
  const zone1 = zones.find((z) => z.id === 1)!; // 좌상: x: 0.04, y: 0.04, w: 0.26, h: 0.16 (x: 0.04~0.30, y: 0.04~0.20)
  const zone2 = zones.find((z) => z.id === 2)!; // 상단: x: 0.37, y: 0.04, w: 0.26, h: 0.16 (x: 0.37~0.63, y: 0.04~0.20)

  beforeEach(() => {
    resetPostureMatcher();
  });

  describe('설정 검증 (judgment.config.ts)', () => {
    it('DEFAULT_ZONE_SOFT_BOUNDARY_CONFIG 설정값이 사양에 맞게 정의되어 있다', () => {
      expect(DEFAULT_ZONE_SOFT_BOUNDARY_CONFIG.exitMarginBonus).toBe(0.04);
      expect(DEFAULT_ZONE_SOFT_BOUNDARY_CONFIG.snapRadius).toBe(0.06);
      expect(DEFAULT_ZONE_SOFT_BOUNDARY_CONFIG.referenceShoulderWidth).toBe(0.25);
      expect(DEFAULT_ZONE_SOFT_BOUNDARY_CONFIG.handBaseMarginRatio).toBe(0.15);
      expect(DEFAULT_ZONE_SOFT_BOUNDARY_CONFIG.unstableMarginMultiplier).toBe(1.5);
      expect(DEFAULT_ZONE_SOFT_BOUNDARY_CONFIG.varianceHistoryLength).toBe(6);
      expect(DEFAULT_ZONE_SOFT_BOUNDARY_CONFIG.varianceThreshold).toBe(0.0005);
    });
  });

  describe('Red 시나리오 1: 히스테리시스 유지 (enterMargin과 exitMargin 사이)', () => {
    it('존 경계에서 진입 후 enterMargin과 exitMargin 사이로 이동해도 내부 상태가 유지된다(깜빡임 0)', () => {
      // Zone 2: left = 0.37.
      // head enterMargin = 0.03 -> 진입 허용 좌측 경계 = 0.34
      // exitMarginBonus = 0.04 -> 이탈 허용 좌측 경계 = 0.34 - 0.04 = 0.30
      const matcher = new PostureMatcher();

      // Frame 1: 진입 (0.35, y: 0.10) - 0.35 >= 0.34 이므로 진입 성공
      const frame1Inside = matcher.isCursorInsideZone('head', { x: 0.35, y: 0.10 }, zone2);
      expect(frame1Inside).toBe(true);

      // Frame 2: 진입 후 경계 밖인 0.32(enterMargin 0.34 밖, exitMargin 0.30 안쪽)로 이동
      const frame2Inside = matcher.isCursorInsideZone('head', { x: 0.32, y: 0.10 }, zone2);
      expect(frame2Inside).toBe(true); // 히스테리시스로 인해 여전히 내부 상태 유지
    });
  });

  describe('Red 시나리오 2: exitMargin 완전 이탈 시 상태 해제', () => {
    it('exitMargin을 완전히 벗어나면 이탈 처리되고 재진입 전까지 외부 상태가 유지된다', () => {
      const matcher = new PostureMatcher();

      // Frame 1: 먼저 존 내부로 진입
      matcher.isCursorInsideZone('head', { x: 0.40, y: 0.10 }, zone2);

      // Frame 2: exitMargin(0.30)을 완전히 벗어남 (x: 0.28)
      const frame2Inside = matcher.isCursorInsideZone('head', { x: 0.28, y: 0.10 }, zone2);
      expect(frame2Inside).toBe(false);

      // Frame 3: enterMargin(0.34)과 exitMargin(0.30) 사이인 0.32로 복귀 시도
      // 이미 이탈했으므로 enterMargin(0.34)을 충족하지 못하면 진입 불가
      const frame3Inside = matcher.isCursorInsideZone('head', { x: 0.32, y: 0.10 }, zone2);
      expect(frame3Inside).toBe(false);

      // Frame 4: enterMargin(0.34) 이내인 0.35로 이동해야 재진입
      const frame4Inside = matcher.isCursorInsideZone('head', { x: 0.35, y: 0.10 }, zone2);
      expect(frame4Inside).toBe(true);
    });
  });

  describe('Red 시나리오 3: 자석 존 부분 점수 (거리 0.03)', () => {
    it('존 바깥 거리 0.03(snapRadius 0.06 절반) 지점에서 0이 아닌 부분 weight를 반환한다', () => {
      // Zone 2 좌측 바깥 0.03 지점 (x: 0.34, y: 0.12 - center Y of Zone 2)
      const outsidePos = { x: 0.34, y: 0.12 };
      const weight = computeZoneWeight(outsidePos, zone2);

      // snapRadius = 0.06일 때 거리 0.03은 절반 지점
      // weight = (1 - 0.03 / 0.06) * edgeWeight(0.75) = 0.375
      expect(weight).toBeGreaterThan(0);
      expect(weight).toBeCloseTo(0.375, 2);
    });
  });

  describe('Red 시나리오 4: 자석 존 범위 초과 시 weight 0', () => {
    it('존 바깥 거리 0.06 초과 지점은 weight 0이다', () => {
      // Zone 2 좌측 바깥 0.07 지점 (x: 0.30, y: 0.12)
      const farPos = { x: 0.30, y: 0.12 };
      const weight = computeZoneWeight(farPos, zone2);

      expect(weight).toBe(0);
    });
  });

  describe('Red 시나리오 5: shoulderWidth 정규화 마진', () => {
    it('shoulderWidth 0.125(기준의 절반, 원거리)에서 손 마진이 기준 대비 절반으로 축소된다', () => {
      const refMargin = getCursorMargin('hand', undefined, { shoulderWidth: 0.25 });
      const halfMargin = getCursorMargin('hand', undefined, { shoulderWidth: 0.125 });

      // 기준 shoulderWidth 0.25일 때: 0.15 * 0.25 = 0.0375
      expect(refMargin).toBeCloseTo(0.0375, 4);
      // shoulderWidth 0.125일 때: 0.15 * 0.125 = 0.01875
      expect(halfMargin).toBeCloseTo(0.01875, 4);
      expect(halfMargin).toBeCloseTo(refMargin / 2, 4);

      // head 마진도 비율에 맞춰 축소
      const headRef = getCursorMargin('head', undefined, { shoulderWidth: 0.25 });
      const headHalf = getCursorMargin('head', undefined, { shoulderWidth: 0.125 });
      expect(headHalf).toBeCloseTo(headRef / 2, 4);
    });
  });

  describe('Red 시나리오 6: shoulderWidth 미제공 시 하위 호환 폴백', () => {
    it('shoulderWidth 미제공 시 기존 절대 마진 값과 동일하게 동작한다', () => {
      expect(getCursorMargin('head')).toBe(0.03);
      expect(getCursorMargin('hip')).toBe(0.04);
      expect(getCursorMargin('hand')).toBe(0.0);
      expect(getCursorMargin('leftHand')).toBe(0.0);
      expect(getCursorMargin('rightHand')).toBe(0.0);

      // 커스텀 마진 오버라이드 호환
      expect(getCursorMargin('head', { head: 0.05, hip: 0.04, hand: 0.0 })).toBe(0.05);
    });
  });

  describe('Red 시나리오 7: 불안정성(좌표 분산) 연동 마진 확장', () => {
    it('좌표 분산이 임계치(0.0005) 이상이면 마진이 1.5배까지 확장된다', () => {
      const stableMargin = getCursorMargin('hand', undefined, {
        shoulderWidth: 0.25,
        variance: 0.0001,
      });
      const unstableMargin = getCursorMargin('hand', undefined, {
        shoulderWidth: 0.25,
        variance: 0.0006,
      });

      expect(stableMargin).toBeCloseTo(0.0375, 4);
      expect(unstableMargin).toBeCloseTo(stableMargin * 1.5, 4);

      // recentPositions 이력으로부터 분산 계산 및 1.5배 확장 확인
      const jitterPositions = [
        { x: 0.50, y: 0.50 },
        { x: 0.55, y: 0.55 },
        { x: 0.50, y: 0.50 },
        { x: 0.55, y: 0.55 },
        { x: 0.50, y: 0.50 },
        { x: 0.55, y: 0.55 },
      ];
      const variance = computePointVariance(jitterPositions);
      expect(variance).toBeGreaterThan(0.0005);

      const jitterMargin = getCursorMargin('head', undefined, {
        shoulderWidth: 0.25,
        recentPositions: jitterPositions,
      });
      expect(jitterMargin).toBeCloseTo(0.03 * 1.5, 4);
    });
  });

  describe('Red 시나리오 8: 비목표 존 오판정 차단', () => {
    it('자석 범위 확장이 비목표 존에 대한 오판정을 만들지 않는다', () => {
      // 목표: Zone 1 (좌상, x: 0.04~0.30, y: 0.04~0.20)
      const posture: AnswerPosture = {
        choiceIndex: 0,
        parts: ['leftHand'],
        zoneIds: [1],
        binding: 'any',
        patternId: 'NON_TARGET_ZONE_GUARD',
      };

      // 1) Zone 4(좌, y: 0.24~0.40) 내부 위치:
      // Zone 1 하단(0.20)에서 0.04 거리로 snapRadius(0.06) 이내이지만,
      // 비목표 존인 Zone 4 내부에 있으므로 목표 Zone 1로 오판정되면 안 됨
      const inZone4 = new Map([['leftHand', { x: 0.17, y: 0.25 }]]);
      const res4 = matchPosture(posture, inZone4, zones);
      expect(res4.met).toBe(false);
      expect(res4.zoneCovered[1]).toBe(false);

      // 2) Zone 2(상단, x: 0.37~0.63) 내부 위치:
      const inZone2 = new Map([['leftHand', { x: 0.38, y: 0.12 }]]);
      const res2 = matchPosture(posture, inZone2, zones);
      expect(res2.met).toBe(false);
      expect(res2.zoneCovered[1]).toBe(false);

      // 3) 비목표 존이 zoneCovered에 잘못 등록되지 않음
      expect(res4.zoneCovered[4]).toBeUndefined();
      expect(res2.zoneCovered[2]).toBeUndefined();
    });
  });

  describe('Red 시나리오 9: 연속 감쇠 가중치 및 존 겹침 0% 유지', () => {
    it('존 중심(1.5)에서 가장자리(0.75), 자석 외곽(0.0)까지 연속적으로 감쇠한다', () => {
      const center = { x: zone1.x + zone1.width / 2, y: zone1.y + zone1.height / 2 };
      const midEdge = { x: zone1.x + zone1.width * 0.75, y: zone1.y + zone1.height / 2 };
      const edge = { x: zone1.x + zone1.width, y: zone1.y + zone1.height / 2 };
      const outsideSnapMid = { x: zone1.x + zone1.width + 0.03, y: zone1.y + zone1.height / 2 };
      const outsideFar = { x: zone1.x + zone1.width + 0.07, y: zone1.y + zone1.height / 2 };

      const wCenter = computeZoneWeight(center, zone1);
      const wMidEdge = computeZoneWeight(midEdge, zone1);
      const wEdge = computeZoneWeight(edge, zone1);
      const wOutsideMid = computeZoneWeight(outsideSnapMid, zone1);
      const wOutsideFar = computeZoneWeight(outsideFar, zone1);

      expect(wCenter).toBe(1.5);
      expect(wMidEdge).toBeLessThan(wCenter);
      expect(wMidEdge).toBeGreaterThan(wEdge);
      expect(wEdge).toBeCloseTo(0.75, 2);
      expect(wOutsideMid).toBeLessThan(wEdge);
      expect(wOutsideMid).toBeGreaterThan(0);
      expect(wOutsideFar).toBe(0);
    });
  });
});
