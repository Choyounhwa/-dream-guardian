import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AssaultPunchAdapter } from '../../src/input/AssaultPunchAdapter.js';
import {
  DEFAULT_ASSAULT_INPUT_CONFIG,
  type AssaultInputConfig,
} from '../../config/assault-input.config.js';
import type { NormalizedLandmark } from '../../src/types/index.js';
import { POSE_LANDMARKS } from '../../src/types/index.js';

describe('[BOSS-ASSAULT-09 / #511] 회수 기반 반복 펀치 입력 어댑터 (AssaultPunchAdapter)', () => {
  let adapter: AssaultPunchAdapter;

  beforeEach(() => {
    adapter = new AssaultPunchAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. 순수 어댑터 제약 및 기본 설정 검증', () => {
    it('새 requestAnimationFrame, setInterval, DOM 이벤트 리스너를 일체 등록하지 않아야 한다', () => {
      const g = globalThis as Record<string, unknown>;
      const originalRaf = g.requestAnimationFrame;
      const originalAddEventListener = g.addEventListener;

      const rafMock = vi.fn();
      const addEventListenerMock = vi.fn();
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

      g.requestAnimationFrame = rafMock;
      g.addEventListener = addEventListenerMock;

      try {
        const testAdapter = new AssaultPunchAdapter();
        testAdapter.update({ timestampMs: 1000 });
        testAdapter.reset();

        expect(rafMock).not.toHaveBeenCalled();
        expect(setIntervalSpy).not.toHaveBeenCalled();
        expect(addEventListenerMock).not.toHaveBeenCalled();
      } finally {
        if (originalRaf === undefined) {
          delete g.requestAnimationFrame;
        } else {
          g.requestAnimationFrame = originalRaf;
        }
        if (originalAddEventListener === undefined) {
          delete g.addEventListener;
        } else {
          g.addEventListener = originalAddEventListener;
        }
      }
    });

    it('기본값으로 DEFAULT_ASSAULT_INPUT_CONFIG를 소비해야 한다', () => {
      expect(adapter.config.profileId).toBe(DEFAULT_ASSAULT_INPUT_CONFIG.profileId);
      expect(adapter.config.punchReachRatio).toBe(DEFAULT_ASSAULT_INPUT_CONFIG.punchReachRatio);
      expect(adapter.config.punchRetractRatio).toBe(DEFAULT_ASSAULT_INPUT_CONFIG.punchRetractRatio);
      expect(adapter.config.elbowExtensionAngleDeg).toBe(DEFAULT_ASSAULT_INPUT_CONFIG.elbowExtensionAngleDeg);
      expect(adapter.config.targetBoxes).toEqual(DEFAULT_ASSAULT_INPUT_CONFIG.targetBoxes);
    });

    it('커스텀 config 주입을 지원해야 한다', () => {
      const customConfig: AssaultInputConfig = {
        ...DEFAULT_ASSAULT_INPUT_CONFIG,
        punchReachRatio: 1.5,
        punchRetractRatio: 0.7,
      };
      const customAdapter = new AssaultPunchAdapter(customConfig);
      expect(customAdapter.config.punchReachRatio).toBe(1.5);
      expect(customAdapter.config.punchRetractRatio).toBe(0.7);
    });
  });

  describe('2. DEC-A3 2D 목표 영역 뻗기 임계치 판정', () => {
    // left targetBox: x: 0.08~0.44, y: 0.12~0.48
    // shoulder width: 0.20
    // reach ratio threshold: 1.25 -> reach distance >= 0.25
    it('왼손이 왼쪽 타깃 박스 진입 + 팔 신전(punchReachRatio >= 1.25) 시 타격 이벤트 1회를 발화해야 한다', () => {
      const events = adapter.update({
        timestampMs: 1000,
        leftHand: {
          wrist: { x: 0.25, y: 0.25 }, // inside left box
          shoulder: { x: 0.35, y: 0.55 }, // dist = hypot(0.10, 0.30) = 0.316 -> reach ratio = 0.316/0.2 = 1.58 (>= 1.25)
          elbow: { x: 0.30, y: 0.40 }, // straight arm -> angle ~180 deg (>= 140 deg)
        },
      });

      expect(events).toHaveLength(1);
      expect(events[0].hand).toBe('left');
      expect(events[0].targetSide).toBe('left');
      expect(events[0].rawTimestampMs).toBe(1000);
      expect(events[0].compensatedTimestampMs).toBe(1000 - DEFAULT_ASSAULT_INPUT_CONFIG.inputLatencyMs);
      expect(events[0].reachRatio).toBeGreaterThanOrEqual(DEFAULT_ASSAULT_INPUT_CONFIG.punchReachRatio);
      expect(adapter.getState('left')).toBe('EXTENDED');
    });

    it('팔꿈치 각도가 임계치(140도) 미만으로 굽혀진 상태면 reachRatio가 높아도 타격하지 않아야 한다', () => {
      const events = adapter.update({
        timestampMs: 1000,
        leftHand: {
          wrist: { x: 0.25, y: 0.25 },
          shoulder: { x: 0.25, y: 0.60 },
          elbow: { x: 0.05, y: 0.42 }, // sharp bend (~90 deg)
        },
      });

      expect(events).toHaveLength(0);
      expect(adapter.getState('left')).toBe('READY');
    });

    it('타깃 박스 밖에서는 팔을 뻗어도 타격 이벤트를 발화하지 않아야 한다', () => {
      const events = adapter.update({
        timestampMs: 1000,
        leftHand: {
          wrist: { x: 0.02, y: 0.25 }, // x < 0.08 (outside target box)
          shoulder: { x: 0.35, y: 0.55 },
          elbow: { x: 0.20, y: 0.40 },
        },
      });

      expect(events).toHaveLength(0);
      expect(adapter.getState('left')).toBe('READY');
    });
  });

  describe('3. DEC-A4 손-답 매핑 및 교차 펀치 차단', () => {
    it('왼손은 오직 left 타깃 박스만 타격 가능하며 right 박스 진입 시 타격하지 않아야 한다', () => {
      // right targetBox: x: 0.56~0.92, y: 0.12~0.48
      const events = adapter.update({
        timestampMs: 1000,
        leftHand: {
          wrist: { x: 0.70, y: 0.25 }, // left hand crossed to right side!
          shoulder: { x: 0.35, y: 0.55 },
        },
      });

      expect(events).toHaveLength(0);
      expect(adapter.getState('left')).toBe('READY');
    });

    it('오른손은 오직 right 타깃 박스만 타격 가능하며 left 박스 진입 시 타격하지 않아야 한다', () => {
      const events = adapter.update({
        timestampMs: 1000,
        rightHand: {
          wrist: { x: 0.25, y: 0.25 }, // right hand crossed to left side!
          shoulder: { x: 0.65, y: 0.55 },
        },
      });

      expect(events).toHaveLength(0);
      expect(adapter.getState('right')).toBe('READY');
    });
  });

  describe('4. 회수(Retract) 히스테리시스 및 반복 발화 차단 (A09)', () => {
    it('손을 뻗은 채 계속 머물러도 추가 타격 이벤트는 0회여야 한다 (연속 발화 차단)', () => {
      // 1st frame: punch
      const e1 = adapter.update({
        timestampMs: 1000,
        leftHand: {
          wrist: { x: 0.25, y: 0.25 },
          shoulder: { x: 0.35, y: 0.55 },
        },
      });
      expect(e1).toHaveLength(1);
      expect(adapter.getState('left')).toBe('EXTENDED');

      // 2nd frame: still holding hand extended
      const e2 = adapter.update({
        timestampMs: 1050,
        leftHand: {
          wrist: { x: 0.25, y: 0.25 },
          shoulder: { x: 0.35, y: 0.55 },
        },
      });
      expect(e2).toHaveLength(0);

      // 3rd frame: still holding hand extended
      const e3 = adapter.update({
        timestampMs: 1100,
        leftHand: {
          wrist: { x: 0.24, y: 0.26 },
          shoulder: { x: 0.35, y: 0.55 },
        },
      });
      expect(e3).toHaveLength(0);
      expect(adapter.getState('left')).toBe('EXTENDED');
    });

    it('타깃 박스 경계에서 떨림(jitter)이 발생해도 회수되지 않은 상태라면 가짜 타격 발화 0회여야 한다', () => {
      // Punch fired
      adapter.update({
        timestampMs: 1000,
        leftHand: {
          wrist: { x: 0.25, y: 0.25 },
          shoulder: { x: 0.35, y: 0.55 },
        },
      });
      expect(adapter.getState('left')).toBe('EXTENDED');

      // Jitter outside targetBox (x: 0.05 < 0.08), but arm still extended (reachRatio = 1.45 > 0.85)
      const e1 = adapter.update({
        timestampMs: 1050,
        leftHand: {
          wrist: { x: 0.05, y: 0.25 },
          shoulder: { x: 0.35, y: 0.55 },
        },
      });
      expect(e1).toHaveLength(0);
      expect(adapter.getState('left')).toBe('EXTENDED');

      // Jitter back inside targetBox (x: 0.25)
      const e2 = adapter.update({
        timestampMs: 1100,
        leftHand: {
          wrist: { x: 0.25, y: 0.25 },
          shoulder: { x: 0.35, y: 0.55 },
        },
      });
      expect(e2).toHaveLength(0);
      expect(adapter.getState('left')).toBe('EXTENDED');
    });

    it('보기 쌍(pairId)이 변경되어도 손을 뻗은 채 머물러 있으면 가짜 타격 발화 0회여야 한다', () => {
      adapter.update({
        timestampMs: 1000,
        pairId: 'pair-1',
        leftHand: {
          wrist: { x: 0.25, y: 0.25 },
          shoulder: { x: 0.35, y: 0.55 },
        },
      });
      expect(adapter.getState('left')).toBe('EXTENDED');

      // Pair changed while hand extended
      const events = adapter.update({
        timestampMs: 1200,
        pairId: 'pair-2',
        leftHand: {
          wrist: { x: 0.25, y: 0.25 },
          shoulder: { x: 0.35, y: 0.55 },
        },
      });

      expect(events).toHaveLength(0);
      expect(adapter.getState('left')).toBe('EXTENDED');
    });

    it('완전히 회수 임계치(punchRetractRatio <= 0.85) 이하로 돌아와야만 다음 타격이 가능해야 한다', () => {
      // 1. Initial punch
      adapter.update({
        timestampMs: 1000,
        leftHand: {
          wrist: { x: 0.25, y: 0.25 },
          shoulder: { x: 0.35, y: 0.55 }, // reach ratio = 1.58
        },
      });
      expect(adapter.getState('left')).toBe('EXTENDED');

      // 2. Partial retract (reach ratio = 1.0 > 0.85) -> Still EXTENDED
      const ePartial = adapter.update({
        timestampMs: 1100,
        leftHand: {
          wrist: { x: 0.35, y: 0.35 },
          shoulder: { x: 0.35, y: 0.55 }, // dist = 0.20 -> reach ratio = 1.00
        },
      });
      expect(ePartial).toHaveLength(0);
      expect(adapter.getState('left')).toBe('EXTENDED');

      // 3. Complete retract (reach ratio = 0.10 / 0.20 = 0.50 <= 0.85) -> Transitions to RETRACTED / READY
      const eRetract = adapter.update({
        timestampMs: 1200,
        leftHand: {
          wrist: { x: 0.35, y: 0.45 },
          shoulder: { x: 0.35, y: 0.55 }, // dist = 0.10 -> reach ratio = 0.50
        },
      });
      expect(eRetract).toHaveLength(0);
      expect(adapter.getState('left')).toBe('READY');

      // 4. Punch again!
      const eSecond = adapter.update({
        timestampMs: 1300,
        leftHand: {
          wrist: { x: 0.25, y: 0.25 },
          shoulder: { x: 0.35, y: 0.55 },
        },
      });
      expect(eSecond).toHaveLength(1);
      expect(eSecond[0].hand).toBe('left');
      expect(adapter.getState('left')).toBe('EXTENDED');
    });
  });

  describe('5. 양손 독립 상태 머신 및 동시 타격(A10)', () => {
    it('왼손과 오른손이 독립적인 상태 머신으로 동작해야 한다', () => {
      // Left hand punches
      const e1 = adapter.update({
        timestampMs: 1000,
        leftHand: {
          wrist: { x: 0.25, y: 0.25 },
          shoulder: { x: 0.40, y: 0.55 },
        },
        rightHand: {
          wrist: { x: 0.60, y: 0.45 }, // retracted
          shoulder: { x: 0.60, y: 0.55 },
        },
      });
      expect(e1).toHaveLength(1);
      expect(e1[0].hand).toBe('left');
      expect(adapter.getState('left')).toBe('EXTENDED');
      expect(adapter.getState('right')).toBe('READY');

      // Next frame: right hand punches while left hand is still extended
      const e2 = adapter.update({
        timestampMs: 1050,
        leftHand: {
          wrist: { x: 0.25, y: 0.25 },
          shoulder: { x: 0.40, y: 0.55 },
        },
        rightHand: {
          wrist: { x: 0.75, y: 0.25 }, // right box punch
          shoulder: { x: 0.60, y: 0.55 },
        },
      });
      expect(e2).toHaveLength(1);
      expect(e2[0].hand).toBe('right');
      expect(adapter.getState('left')).toBe('EXTENDED');
      expect(adapter.getState('right')).toBe('EXTENDED');
    });

    it('양손이 동시에 타깃 박스에 진입했을 때 두 손 이벤트가 모두 전달되어야 한다', () => {
      const events = adapter.update({
        timestampMs: 1000,
        leftHand: {
          wrist: { x: 0.25, y: 0.25 },
          shoulder: { x: 0.40, y: 0.55 },
        },
        rightHand: {
          wrist: { x: 0.75, y: 0.25 },
          shoulder: { x: 0.60, y: 0.55 },
        },
      });

      expect(events).toHaveLength(2);
      const hands = events.map((e) => e.hand).sort();
      expect(hands).toEqual(['left', 'right']);
      expect(adapter.getState('left')).toBe('EXTENDED');
      expect(adapter.getState('right')).toBe('EXTENDED');
    });
  });

  describe('6. 추적 상실 및 복구 안전 정책 (A10, A19)', () => {
    it('추적 상실 플래그(isTrackingLost)가 true일 때 펀치 발화가 0회여야 한다', () => {
      const events = adapter.update({
        timestampMs: 1000,
        isTrackingLost: true,
        leftHand: {
          wrist: { x: 0.25, y: 0.25 },
          shoulder: { x: 0.35, y: 0.55 },
        },
      });

      expect(events).toHaveLength(0);
      expect(adapter.isTrackingLost).toBe(true);
    });

    it('추적 상실 중 손을 뻗은 채로 복구되었을 때 즉시 가짜 타격을 발화하지 않아야 한다', () => {
      // 1. Initial normal state
      adapter.update({
        timestampMs: 1000,
        leftHand: {
          wrist: { x: 0.35, y: 0.45 },
          shoulder: { x: 0.35, y: 0.55 },
        },
      });

      // 2. Tracking lost
      adapter.update({
        timestampMs: 1100,
        isTrackingLost: true,
      });
      expect(adapter.isTrackingLost).toBe(true);

      // 3. Tracking recovered with hand ALREADY extended
      const eventsRecover = adapter.update({
        timestampMs: 1200,
        isTrackingLost: false,
        leftHand: {
          wrist: { x: 0.25, y: 0.25 }, // extended in target box
          shoulder: { x: 0.35, y: 0.55 },
        },
      });

      // MUST NOT FIRE!
      expect(eventsRecover).toHaveLength(0);
      expect(adapter.getState('left')).toBe('EXTENDED');

      // 4. Must retract before punching again
      adapter.update({
        timestampMs: 1300,
        leftHand: {
          wrist: { x: 0.35, y: 0.45 }, // retracted
          shoulder: { x: 0.35, y: 0.55 },
        },
      });
      expect(adapter.getState('left')).toBe('READY');

      // 5. Now it can punch
      const validPunch = adapter.update({
        timestampMs: 1400,
        leftHand: {
          wrist: { x: 0.25, y: 0.25 },
          shoulder: { x: 0.35, y: 0.55 },
        },
      });
      expect(validPunch).toHaveLength(1);
    });
  });

  describe('7. reset() 및 고유 inputId 채번', () => {
    it('reset() 시 상태가 초기화되어야 한다', () => {
      adapter.update({
        timestampMs: 1000,
        leftHand: {
          wrist: { x: 0.25, y: 0.25 },
          shoulder: { x: 0.35, y: 0.55 },
        },
      });
      expect(adapter.getState('left')).toBe('EXTENDED');

      adapter.reset();
      expect(adapter.getState('left')).toBe('IDLE');
      expect(adapter.getState('right')).toBe('IDLE');
    });

    it('reset() 후에도 과거 inputId가 재사용되지 않고 항상 고유해야 한다', () => {
      const e1 = adapter.update({
        timestampMs: 1000,
        leftHand: {
          wrist: { x: 0.25, y: 0.25 },
          shoulder: { x: 0.35, y: 0.55 },
        },
      });
      const id1 = e1[0].inputId;

      adapter.reset();

      // retract first to get READY
      adapter.update({
        timestampMs: 1100,
        leftHand: {
          wrist: { x: 0.35, y: 0.45 },
          shoulder: { x: 0.35, y: 0.55 },
        },
      });

      const e2 = adapter.update({
        timestampMs: 1200,
        leftHand: {
          wrist: { x: 0.25, y: 0.25 },
          shoulder: { x: 0.35, y: 0.55 },
        },
      });
      const id2 = e2[0].inputId;

      expect(id1).not.toBe(id2);
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
    });
  });

  describe('8. MediaPipe 랜드마크 배열 직접 입력 지원', () => {
    it('NormalizedLandmark 배열을 전달받아 손목, 팔꿈치, 어깨 위치를 자동 추출하여 판정해야 한다', () => {
      const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.5,
        z: 0,
        visibility: 0.9,
      }));

      // Set left arm landmarks
      landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.25, y: 0.25, z: 0, visibility: 0.95 };
      landmarks[POSE_LANDMARKS.LEFT_ELBOW] = { x: 0.30, y: 0.40, z: 0, visibility: 0.95 };
      landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.35, y: 0.55, z: 0, visibility: 0.95 };
      landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.55, y: 0.55, z: 0, visibility: 0.95 }; // shoulder width = 0.20

      const events = adapter.update({
        timestampMs: 1000,
        landmarks,
      });

      expect(events).toHaveLength(1);
      expect(events[0].hand).toBe('left');
      expect(events[0].reachRatio).toBeGreaterThanOrEqual(DEFAULT_ASSAULT_INPUT_CONFIG.punchReachRatio);
    });
  });

  describe('9. 카메라 Fallback (키보드/가상 입력 지원 - Rule 4)', () => {
    it('triggerFallbackPunch로 키보드 펀치를 발화하고 연타/유지 시 반복 발화를 차단해야 한다', () => {
      // 1. Initial key press
      const e1 = adapter.triggerFallbackPunch('left', { timestampMs: 1000 });
      expect(e1).not.toBeNull();
      expect(e1?.hand).toBe('left');
      expect(e1?.targetSide).toBe('left');
      expect(adapter.getState('left')).toBe('EXTENDED');

      // 2. Holding key down (repetitive trigger) -> 0 events
      const e2 = adapter.triggerFallbackPunch('left', { timestampMs: 1050 });
      expect(e2).toBeNull();

      // 3. Release key
      adapter.releaseFallbackPunch('left');
      expect(adapter.getState('left')).toBe('READY');

      // 4. Next key press can punch again
      const e3 = adapter.triggerFallbackPunch('left', { timestampMs: 1100 });
      expect(e3).not.toBeNull();
      expect(e3?.hand).toBe('left');
    });
  });
});
