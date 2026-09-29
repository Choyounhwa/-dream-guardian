/**
 * star-collection-input.test.ts - 11존 단일 별 Perfect Good Late Miss 리듬 판정 단위 테스트
 *
 * @see Issue #182 [INPUT-STAR-001]
 * @see Issue #176 [BEAT-SPEC-001]
 * @see Issue #181 [CHOREO-STAR-001]
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StarCollectionInput,
  judgeStarTiming,
} from '../../src/input/StarCollectionInput.js';
import {
  DEFAULT_FITNESS_ZONES,
  HEAD_ZONES,
  HIP_ZONES,
  isValidZoneForCursor,
} from '../../config/zone.config.js';
import type { BodyPart } from '../../src/types/posture.js';
import type { StarTarget } from '../../src/types/star.js';

describe('StarCollectionInput (Issue #182 - INPUT-STAR-001)', () => {
  let input: StarCollectionInput;

  beforeEach(() => {
    input = new StarCollectionInput();
  });

  describe('1. 타이밍 경계값 판정 (judgeStarTiming / judgeTiming)', () => {
    const landingTime = 5.0;

    it('비트 착지 시각 정박 (dt = 0)은 Perfect이다', () => {
      expect(judgeStarTiming(5.0, landingTime)).toBe('Perfect');
      expect(input.judgeTiming(5.0, landingTime)).toBe('Perfect');
    });

    it('Perfect 허용 범위 (±0.12s) 내부는 Perfect이다', () => {
      expect(judgeStarTiming(5.0 - 0.12, landingTime)).toBe('Perfect');
      expect(judgeStarTiming(5.0 + 0.12, landingTime)).toBe('Perfect');
      expect(judgeStarTiming(5.0 - 0.05, landingTime)).toBe('Perfect');
      expect(judgeStarTiming(5.0 + 0.05, landingTime)).toBe('Perfect');
    });

    it('Perfect 경계 초과 및 Good 허용 범위 (0.12s 초과 ~ ±0.25s)는 Good이다', () => {
      expect(judgeStarTiming(5.0 - 0.121, landingTime)).toBe('Good');
      expect(judgeStarTiming(5.0 + 0.121, landingTime)).toBe('Good');
      expect(judgeStarTiming(5.0 - 0.25, landingTime)).toBe('Good');
      expect(judgeStarTiming(5.0 + 0.25, landingTime)).toBe('Good');
    });

    it('Good 경계 초과 및 Late 허용 범위 (0.25s 초과 ~ ±0.40s)는 Late이다', () => {
      expect(judgeStarTiming(5.0 - 0.251, landingTime)).toBe('Late');
      expect(judgeStarTiming(5.0 + 0.251, landingTime)).toBe('Late');
      expect(judgeStarTiming(5.0 - 0.40, landingTime)).toBe('Late');
      expect(judgeStarTiming(5.0 + 0.40, landingTime)).toBe('Late');
    });

    it('Late 경계 초과 (0.40s 초과)는 Miss이다', () => {
      expect(judgeStarTiming(5.0 - 0.401, landingTime)).toBe('Miss');
      expect(judgeStarTiming(5.0 + 0.401, landingTime)).toBe('Miss');
      expect(judgeStarTiming(0.0, landingTime)).toBe('Miss');
      expect(judgeStarTiming(10.0, landingTime)).toBe('Miss');
    });

    it('커스텀 timingWindows 설정 시 지정된 임계값을 따른다', () => {
      const customWindows = { perfect: 0.10, good: 0.20, late: 0.30 };
      expect(judgeStarTiming(5.10, landingTime, customWindows)).toBe('Perfect');
      expect(judgeStarTiming(5.15, landingTime, customWindows)).toBe('Good');
      expect(judgeStarTiming(5.25, landingTime, customWindows)).toBe('Late');
      expect(judgeStarTiming(5.35, landingTime, customWindows)).toBe('Miss');
    });
  });

  describe('2. 11개 존 및 4색 커서 매트릭스 유효성 전체 검증 (44개 조합)', () => {
    const cursors: BodyPart[] = ['leftHand', 'rightHand', 'head', 'hip'];
    const zoneIds = Array.from({ length: 11 }, (_, i) => i + 1);

    it('모든 11존과 4색 커서의 44개 조합에 대해 유효/무효 판정이 매트릭스와 100% 일치한다', () => {
      for (const cursor of cursors) {
        for (const zoneId of zoneIds) {
          const expectedValid = isValidZoneForCursor(cursor, zoneId);

          const target: StarTarget = {
            patternId: 'TEST',
            part: cursor,
            zoneId,
            beatIndex: 1,
            landingTime: 4.0,
          };
          input.setTarget(target);

          const zone = DEFAULT_FITNESS_ZONES.find((z) => z.id === zoneId)!;
          const centerPos = { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };

          const result = input.evaluateCursor(cursor, centerPos, 4.0);

          if (expectedValid) {
            expect(result).not.toBeNull();
            expect(result?.collected).toBe(true);
            expect(result?.rating).toBe('Perfect');
            expect(result?.zoneId).toBe(zoneId);
            expect(result?.cursorType).toBe(cursor);
          } else {
            // 유효하지 않은 존-부위 조합은 차단되어야 함
            expect(result).toBeNull();
          }

          input.reset();
        }
      }
    });

    it('머리 커서는 4, 5번 존에서만 유효하고 나머지 9개 존에서는 차단된다', () => {
      for (const zoneId of zoneIds) {
        input.setTarget({
          patternId: 'HEAD_TEST',
          part: 'head',
          zoneId,
          beatIndex: 1,
          landingTime: 2.0,
        });

        const zone = DEFAULT_FITNESS_ZONES.find((z) => z.id === zoneId)!;
        const pos = { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
        const result = input.evaluateCursor('head', pos, 2.0);

        if (HEAD_ZONES.has(zoneId)) {
          expect(result).not.toBeNull();
          expect(result?.collected).toBe(true);
        } else {
          expect(result).toBeNull();
        }
        input.reset();
      }
    });

    it('골반 커서는 6, 8, 9, 10, 11번 존에서만 유효하고 직립 존(7) 및 상단/중단 존에서는 차단된다', () => {
      for (const zoneId of zoneIds) {
        input.setTarget({
          patternId: 'HIP_TEST',
          part: 'hip',
          zoneId,
          beatIndex: 1,
          landingTime: 2.0,
        });

        const zone = DEFAULT_FITNESS_ZONES.find((z) => z.id === zoneId)!;
        const pos = { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
        const result = input.evaluateCursor('hip', pos, 2.0);

        if (HIP_ZONES.has(zoneId)) {
          expect(result).not.toBeNull();
          expect(result?.collected).toBe(true);
        } else {
          expect(result).toBeNull();
        }
        input.reset();
      }
    });

    it('왼손과 오른손 커서는 11개 모든 존에서 유효하다', () => {
      for (const hand of ['leftHand', 'rightHand'] as const) {
        for (const zoneId of zoneIds) {
          input.setTarget({
            patternId: 'HAND_TEST',
            part: hand,
            zoneId,
            beatIndex: 1,
            landingTime: 3.0,
          });

          const zone = DEFAULT_FITNESS_ZONES.find((z) => z.id === zoneId)!;
          const pos = { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
          const result = input.evaluateCursor(hand, pos, 3.0);

          expect(result).not.toBeNull();
          expect(result?.collected).toBe(true);
          input.reset();
        }
      }
    });
  });

  describe('3. 지정되지 않은 커서 차단', () => {
    it('목표 부위가 leftHand일 때 rightHand의 진입은 차단된다', () => {
      input.setTarget({
        patternId: 'S001',
        part: 'leftHand',
        zoneId: 1,
        beatIndex: 1,
        landingTime: 4.0,
      });

      const z1 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 1)!;
      const pos = { x: z1.x + z1.width / 2, y: z1.y + z1.height / 2 };

      // 지정되지 않은 커서 (rightHand) 진입
      const invalidResult = input.evaluateCursor('rightHand', pos, 4.0);
      expect(invalidResult).toBeNull();
      expect(input.isCollected).toBe(false);

      // 지정된 커서 (leftHand) 진입 시 정상 수집
      const validResult = input.evaluateCursor('leftHand', pos, 4.0);
      expect(validResult).not.toBeNull();
      expect(validResult?.collected).toBe(true);
      expect(validResult?.cursorType).toBe('leftHand');
    });

    it('목표 부위가 head일 때 leftHand의 진입은 차단된다', () => {
      input.setTarget({
        patternId: 'S002',
        part: 'head',
        zoneId: 4,
        beatIndex: 1,
        landingTime: 4.0,
      });

      const z4 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 4)!;
      const pos = { x: z4.x + z4.width / 2, y: z4.y + z4.height / 2 };

      expect(input.evaluateCursor('leftHand', pos, 4.0)).toBeNull();
      expect(input.evaluateCursor('hip', pos, 4.0)).toBeNull();
      expect(input.isCollected).toBe(false);

      const headResult = input.evaluateCursor('head', pos, 4.0);
      expect(headResult).not.toBeNull();
      expect(headResult?.collected).toBe(true);
    });

    it('목표 부위가 hip일 때 head의 진입은 차단된다', () => {
      input.setTarget({
        patternId: 'S003',
        part: 'hip',
        zoneId: 6,
        beatIndex: 1,
        landingTime: 4.0,
      });

      const z6 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 6)!;
      const pos = { x: z6.x + z6.width / 2, y: z6.y + z6.height / 2 };

      expect(input.evaluateCursor('head', pos, 4.0)).toBeNull();
      expect(input.isCollected).toBe(false);

      const hipResult = input.evaluateCursor('hip', pos, 4.0);
      expect(hipResult).not.toBeNull();
      expect(hipResult?.collected).toBe(true);
    });
  });

  describe('4. 중복 수집 차단', () => {
    it('한 번 수집된 별은 동일한 프레임 또는 이후 프레임에서 재수집되지 않는다', () => {
      input.setTarget({
        patternId: 'DUP_TEST',
        part: 'leftHand',
        zoneId: 1,
        beatIndex: 1,
        landingTime: 5.0,
      });

      const z1 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 1)!;
      const pos = { x: z1.x + z1.width / 2, y: z1.y + z1.height / 2 };

      // 첫 번째 수집 (Perfect)
      const first = input.evaluateCursor('leftHand', pos, 5.0);
      expect(first).not.toBeNull();
      expect(first?.collected).toBe(true);
      expect(input.isCollected).toBe(true);

      // 두 번째 수집 시도 (차단)
      const second = input.evaluateCursor('leftHand', pos, 5.05);
      expect(second).toBeNull();

      // 키보드 폴백으로 재시도해도 차단
      const kb = input.fromKeyboard(5.08);
      expect(kb).toBeNull();

      // 터치 폴백으로 재시도해도 차단
      const touch = input.fromTouch(1, 5.10);
      expect(touch).toBeNull();
    });
  });

  describe('5. 일시정지 (pause) 상태 차단', () => {
    it('일시정지 상태에서는 모션, 키보드, 터치 입력이 모두 차단된다', () => {
      input.setTarget({
        patternId: 'PAUSE_TEST',
        part: 'rightHand',
        zoneId: 3,
        beatIndex: 1,
        landingTime: 4.0,
      });

      input.setPaused(true);
      expect(input.isPaused).toBe(true);

      const z3 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 3)!;
      const pos = { x: z3.x + z3.width / 2, y: z3.y + z3.height / 2 };

      expect(input.evaluateCursor('rightHand', pos, 4.0)).toBeNull();
      expect(input.fromKeyboard(4.0)).toBeNull();
      expect(input.fromTouch(3, 4.0)).toBeNull();
      expect(input.isCollected).toBe(false);

      // 일시정지 해제 후 정상 수집
      input.setPaused(false);
      expect(input.isPaused).toBe(false);

      const result = input.evaluateCursor('rightHand', pos, 4.0);
      expect(result).not.toBeNull();
      expect(result?.collected).toBe(true);
    });
  });

  describe('6. 타임아웃 및 Miss 판정 시 전투 페널티 배제', () => {
    it('시간이 +0.40s를 초과하여 경과하면 Miss로 판정된다', () => {
      input.setTarget({
        patternId: 'MISS_TEST',
        part: 'leftHand',
        zoneId: 1,
        beatIndex: 1,
        landingTime: 3.0,
      });

      const timeoutResult = input.checkTimeout(3.45);
      expect(timeoutResult).not.toBeNull();
      expect(timeoutResult?.collected).toBe(false);
      expect(timeoutResult?.rating).toBe('Miss');
      expect(timeoutResult?.hasBattlePenalty).toBe(false);
    });

    it('Miss 판정은 전투 페널티(hasBattlePenalty)를 일체 발생시키지 않는다', () => {
      input.setTarget({
        patternId: 'NO_PENALTY_TEST',
        part: 'rightHand',
        zoneId: 5,
        beatIndex: 1,
        landingTime: 2.0,
      });

      const missResult = input.fromKeyboard(2.6); // dt = 0.6s > 0.40s -> Miss
      expect(missResult).not.toBeNull();
      expect(missResult?.rating).toBe('Miss');
      expect(missResult?.hasBattlePenalty).toBe(false);
      expect(missResult?.collected).toBe(false);
    });
  });

  describe('7. 키보드 및 터치 폴백 (Fallback)', () => {
    it('fromKeyboard는 활성 별의 지정 부위와 존으로 타이밍 판정을 수행한다', () => {
      input.setTarget({
        patternId: 'KB_TEST',
        part: 'head',
        zoneId: 4,
        beatIndex: 1,
        landingTime: 5.0,
      });

      const res = input.fromKeyboard(5.10); // dt = +0.10s -> Perfect
      expect(res).not.toBeNull();
      expect(res?.collected).toBe(true);
      expect(res?.rating).toBe('Perfect');
      expect(res?.cursorType).toBe('head');
      expect(res?.zoneId).toBe(4);
      expect(res?.source).toBe('keyboard');
      expect(input.isCollected).toBe(true);
    });

    it('fromTouch는 올바른 목표 존 터치 시 수집하고 다른 존 터치는 차단한다', () => {
      input.setTarget({
        patternId: 'TOUCH_TEST',
        part: 'hip',
        zoneId: 9,
        beatIndex: 1,
        landingTime: 6.0,
      });

      // 잘못된 존 (10번) 터치
      expect(input.fromTouch(10, 6.0)).toBeNull();
      expect(input.isCollected).toBe(false);

      // 올바른 존 (9번) 터치
      const res = input.fromTouch(9, 6.20); // dt = +0.20s -> Good
      expect(res).not.toBeNull();
      expect(res?.collected).toBe(true);
      expect(res?.rating).toBe('Good');
      expect(res?.source).toBe('touch');
    });
  });

  describe('8. cursorType 및 part 상호 호환성', () => {
    it('target 객체에 cursorType이 명시된 경우에도 정상 작동한다', () => {
      const target: StarTarget = {
        patternId: 'ALIAS_TEST',
        part: 'leftHand',
        cursorType: 'leftHand',
        zoneId: 2,
        beatIndex: 1,
        landingTime: 4.0,
      };
      input.setTarget(target);

      const z2 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 2)!;
      const pos = { x: z2.x + z2.width / 2, y: z2.y + z2.height / 2 };

      const res = input.evaluateCursor('leftHand', pos, 4.0);
      expect(res).not.toBeNull();
      expect(res?.collected).toBe(true);
      expect(res?.cursorType).toBe('leftHand');
    });
  });

  describe('9. update / updateFromPose 및 랜드마크 연동', () => {
    it('포즈 랜드마크로부터 CursorTracker를 통해 별을 수집한다', () => {
      input.setTarget({
        patternId: 'POSE_STAR',
        part: 'head',
        zoneId: 4,
        beatIndex: 1,
        landingTime: 2.0,
      });

      const z4 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 4)!;
      const targetX = z4.x + z4.width / 2;
      const targetY = z4.y + z4.height / 2;

      // Nose(0) 랜드마크를 z4 중심에 위치
      const landmarks = Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.5,
        z: 0,
        visibility: 0.9,
      }));
      landmarks[0] = {
        x: targetX,
        y: targetY,
        z: 0,
        visibility: 0.95,
      };

      const result = input.update(2.0, landmarks, undefined, false);
      expect(result).not.toBeNull();
      expect(result?.collected).toBe(true);
      expect(result?.rating).toBe('Perfect');
      expect(result?.cursorType).toBe('head');
      expect(result?.zoneId).toBe(4);
    });

    it('미러 모드(isMirrored: true) 시 좌표 반전을 고려하여 수집한다', () => {
      input.setTarget({
        patternId: 'MIRROR_STAR',
        part: 'head',
        zoneId: 4,
        beatIndex: 1,
        landingTime: 2.0,
      });

      const z4 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 4)!;
      const targetX = z4.x + z4.width / 2;
      const targetY = z4.y + z4.height / 2;

      // 미러 시 x는 1 - x_raw로 변환되므로, 원본 x_raw는 1 - targetX여야 함
      const landmarks = Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.5,
        z: 0,
        visibility: 0.9,
      }));
      landmarks[0] = {
        x: 1 - targetX,
        y: targetY,
        z: 0,
        visibility: 0.95,
      };

      const result = input.update(2.0, landmarks, undefined, true);
      expect(result).not.toBeNull();
      expect(result?.collected).toBe(true);
      expect(result?.rating).toBe('Perfect');
    });

    it('updateFromPose 별칭 메서드도 동일하게 동작한다', () => {
      input.setTarget({
        patternId: 'ALIAS_POSE',
        part: 'head',
        zoneId: 5,
        beatIndex: 1,
        landingTime: 3.0,
      });

      const z5 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 5)!;
      const landmarks = Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.5,
        z: 0,
        visibility: 0.9,
      }));
      landmarks[0] = {
        x: z5.x + z5.width / 2,
        y: z5.y + z5.height / 2,
        z: 0,
        visibility: 0.95,
      };

      const result = input.updateFromPose(landmarks, 3.0, undefined, false);
      expect(result).not.toBeNull();
      expect(result?.collected).toBe(true);
      expect(result?.zoneId).toBe(5);
    });
  });

  describe('10. 상태 관리 및 수명 주기 (reset, clearTarget, viewport)', () => {
    it('clearTarget 호출 시 목표가 제거되고 수집 상태가 초기화된다', () => {
      input.setTarget({
        patternId: 'CLEAR_TEST',
        part: 'leftHand',
        zoneId: 1,
        beatIndex: 1,
        landingTime: 4.0,
      });
      expect(input.currentTarget).not.toBeNull();

      input.clearTarget();
      expect(input.currentTarget).toBeNull();
      expect(input.isCollected).toBe(false);
      expect(input.lastResult).toBeNull();
    });

    it('reset 호출 시 커서 트래커와 목표가 모두 초기화된다', () => {
      input.setTarget({
        patternId: 'RESET_TEST',
        part: 'rightHand',
        zoneId: 3,
        beatIndex: 1,
        landingTime: 4.0,
      });
      input.reset();

      expect(input.currentTarget).toBeNull();
      expect(input.isCollected).toBe(false);
      expect(input.cursorTracker.cursors.size).toBe(0);
    });

    it('setViewport 호출 시 config 및 cursorTracker에 해상도가 반영된다', () => {
      input.setViewport(1920, 1080);
      expect(input.config.virtualWidth).toBe(1920);
      expect(input.config.virtualHeight).toBe(1080);
      expect(input.cursorTracker.virtualWidth).toBe(1920);
      expect(input.cursorTracker.virtualHeight).toBe(1080);
    });
  });
});
