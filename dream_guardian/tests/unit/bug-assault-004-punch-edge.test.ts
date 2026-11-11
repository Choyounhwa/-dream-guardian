import { describe, it, expect, beforeEach } from 'vitest';
import { AssaultPunchAdapter } from '../../src/input/AssaultPunchAdapter.js';
import { LEGACY_BOX_ASSAULT_INPUT_CONFIG } from '../../config/assault-input.config.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';

describe('[BUG-ASSAULT-004 / #672] 회수 기반 펀치 어댑터 가짜 타격 경계 결함 3건', () => {
  let adapter: AssaultPunchAdapter;

  beforeEach(() => {
    adapter = new AssaultPunchAdapter(LEGACY_BOX_ASSAULT_INPUT_CONFIG);
  });

  const createBaseLandmarks = (): NormalizedLandmark[] =>
    Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 0.9,
    }));

  it('(1) [#722] 세션 시작 시 첫 프레임부터 박스 안으로 완전 신전 시 1회 정상 타격 발화 후 체류 중 0건 및 회수 후 재타격', () => {
    // 세션 시작(초기 상태) 직후 팔을 편 상태로 첫 프레임 진입 -> [#722] IDLE 전이 유실 방지로 1회 정상 발화
    const events = adapter.update({
      timestampMs: 1000,
      leftHand: {
        wrist: { x: 0.25, y: 0.25 }, // 왼쪽 타깃 박스 내부
        shoulder: { x: 0.35, y: 0.55 }, // reachDistance = 0.316, reachRatio = 1.58 >= 1.00
        elbow: { x: 0.30, y: 0.40 }, // straight arm (~180도)
      },
    });

    // [#722] IDLE에서 즉시 완전 신전 시 1회 타격 발화 및 EXTENDED 전이
    expect(events).toHaveLength(1);
    expect(events[0].hand).toBe('left');
    expect(adapter.getState('left')).toBe('EXTENDED');

    // 팔을 뻗은 채 머무르면 추가 발화 차단 (0건)
    const stayEvents = adapter.update({
      timestampMs: 1050,
      leftHand: {
        wrist: { x: 0.25, y: 0.25 },
        shoulder: { x: 0.35, y: 0.55 },
        elbow: { x: 0.30, y: 0.40 },
      },
    });
    expect(stayEvents).toHaveLength(0);
    expect(adapter.getState('left')).toBe('EXTENDED');

    // 팔을 접어 완전히 회수 (punchRetractRatio <= 0.85 또는 wrist.y > targetBox.yMax)
    const retractEvents = adapter.update({
      timestampMs: 1100,
      leftHand: {
        wrist: { x: 0.35, y: 0.45 },
        shoulder: { x: 0.35, y: 0.55 }, // reachDistance = 0.10, reachRatio = 0.50
        elbow: { x: 0.35, y: 0.50 },
      },
    });
    expect(retractEvents).toHaveLength(0);
    expect(adapter.getState('left')).toBe('READY');

    // 회수 후 정상 타격 시에만 이벤트 발화 (1건)
    const hitEvents = adapter.update({
      timestampMs: 1200,
      leftHand: {
        wrist: { x: 0.25, y: 0.25 },
        shoulder: { x: 0.35, y: 0.55 },
        elbow: { x: 0.30, y: 0.40 },
      },
    });
    expect(hitEvents).toHaveLength(1);
    expect(hitEvents[0].hand).toBe('left');
    expect(adapter.getState('left')).toBe('EXTENDED');
  });

  it('(2) 왼손만 visibility 0인 프레임 3회 후 뻗은 상태로 복귀 -> 이벤트 0건 (회수 요구)', () => {
    // 1. 양손 정상 대기(회수) 상태로 세션 진입 -> READY
    adapter.update({
      timestampMs: 1000,
      leftHand: {
        wrist: { x: 0.35, y: 0.45 },
        shoulder: { x: 0.35, y: 0.55 },
        elbow: { x: 0.35, y: 0.50 },
        visibility: 0.9,
      },
      rightHand: {
        wrist: { x: 0.65, y: 0.45 },
        shoulder: { x: 0.65, y: 0.55 },
        elbow: { x: 0.65, y: 0.50 },
        visibility: 0.9,
      },
    });
    expect(adapter.getState('left')).toBe('READY');
    expect(adapter.getState('right')).toBe('READY');

    // 2. 오른손은 정상 추적되나, 왼손만 visibility 0으로 3프레임 동안 추적 상실
    for (let i = 1; i <= 3; i++) {
      const landmarks = createBaseLandmarks();
      landmarks[POSE_LANDMARKS.LEFT_WRIST].visibility = 0;
      landmarks[POSE_LANDMARKS.LEFT_ELBOW].visibility = 0;
      landmarks[POSE_LANDMARKS.LEFT_SHOULDER].visibility = 0;

      // 오른손은 계속 정상 위치
      landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.65, y: 0.45, z: 0, visibility: 0.9 };
      landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.65, y: 0.55, z: 0, visibility: 0.9 };

      const dropEvents = adapter.update({
        timestampMs: 1000 + i * 100,
        landmarks,
      });
      expect(dropEvents).toHaveLength(0);
    }

    // 3. 왼손이 타깃 박스 안으로 팔을 뻗은 상태(EXTENDED)로 추적에 복귀
    const landmarksRecovered = createBaseLandmarks();
    landmarksRecovered[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.25, y: 0.25, z: 0, visibility: 0.95 };
    landmarksRecovered[POSE_LANDMARKS.LEFT_ELBOW] = { x: 0.30, y: 0.40, z: 0, visibility: 0.95 };
    landmarksRecovered[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.35, y: 0.55, z: 0, visibility: 0.95 };

    const recoverEvents = adapter.update({
      timestampMs: 1400,
      landmarks: landmarksRecovered,
    });

    // 한 손만 추적 복구된 경우에도 뻗은 채 복귀 시 가짜 타격 없이 회수를 요구해야 함
    expect(recoverEvents).toHaveLength(0);
    expect(adapter.getState('left')).toBe('EXTENDED');

    // 회수 후 다시 뻗으면 정상 1건 타격
    const retractLandmarks = createBaseLandmarks();
    retractLandmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.35, y: 0.45, z: 0, visibility: 0.95 };
    retractLandmarks[POSE_LANDMARKS.LEFT_ELBOW] = { x: 0.35, y: 0.50, z: 0, visibility: 0.95 };
    retractLandmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.35, y: 0.55, z: 0, visibility: 0.95 };

    adapter.update({
      timestampMs: 1500,
      landmarks: retractLandmarks,
    });
    expect(adapter.getState('left')).toBe('READY');

    const punchAgainEvents = adapter.update({
      timestampMs: 1600,
      landmarks: landmarksRecovered,
    });
    expect(punchAgainEvents).toHaveLength(1);
    expect(punchAgainEvents[0].hand).toBe('left');
  });

  it('(3) 어깨/팔꿈치 visibility 0 + 손목이 박스 안 -> 타격 발생 안 함 (0건, 상태 유지/보류)', () => {
    // 1. 정상 회수 자세로 READY 상태 확보
    adapter.update({
      timestampMs: 1000,
      leftHand: {
        wrist: { x: 0.35, y: 0.45 },
        shoulder: { x: 0.35, y: 0.55 },
        elbow: { x: 0.35, y: 0.50 },
      },
    });
    expect(adapter.getState('left')).toBe('READY');

    // 2. 어깨가 보이지 않는 경우 (shoulder undefined / visibility 부족)
    const noShoulderEvents = adapter.update({
      timestampMs: 1100,
      leftHand: {
        wrist: { x: 0.25, y: 0.25 }, // 타깃 박스 내부
        elbow: { x: 0.30, y: 0.40 },
        // shoulder 누락
      },
    });
    // 어깨가 없으면 신전 판정을 보류하여 타격이 발생하지 않아야 함
    expect(noShoulderEvents).toHaveLength(0);
    expect(adapter.getState('left')).toBe('READY');

    // 3. 팔꿈치가 보이지 않는 경우 (elbow 누락)
    const noElbowEvents = adapter.update({
      timestampMs: 1200,
      leftHand: {
        wrist: { x: 0.25, y: 0.25 },
        shoulder: { x: 0.35, y: 0.55 },
        // elbow 누락
      },
    });
    // 팔꿈치 각도 검증 불가 시 신전 판정을 보류하여 타격 0건 유지
    expect(noElbowEvents).toHaveLength(0);
    expect(adapter.getState('left')).toBe('READY');
  });

  it('(4) 정상 준비 -> 타격 -> 회수 -> 재타격 시 2회 정상 발생', () => {
    // 1. 초기 회수/준비 (READY)
    const prepEvents = adapter.update({
      timestampMs: 1000,
      leftHand: {
        wrist: { x: 0.35, y: 0.45 },
        shoulder: { x: 0.35, y: 0.55 },
        elbow: { x: 0.35, y: 0.50 },
      },
    });
    expect(prepEvents).toHaveLength(0);
    expect(adapter.getState('left')).toBe('READY');

    // 2. 1차 타격
    const hit1 = adapter.update({
      timestampMs: 1100,
      leftHand: {
        wrist: { x: 0.25, y: 0.25 },
        shoulder: { x: 0.35, y: 0.55 },
        elbow: { x: 0.30, y: 0.40 },
      },
    });
    expect(hit1).toHaveLength(1);
    expect(hit1[0].hand).toBe('left');
    expect(adapter.getState('left')).toBe('EXTENDED');

    // 3. 회수
    const retract = adapter.update({
      timestampMs: 1200,
      leftHand: {
        wrist: { x: 0.35, y: 0.45 },
        shoulder: { x: 0.35, y: 0.55 },
        elbow: { x: 0.35, y: 0.50 },
      },
    });
    expect(retract).toHaveLength(0);
    expect(adapter.getState('left')).toBe('READY');

    // 4. 2차 타격
    const hit2 = adapter.update({
      timestampMs: 1300,
      leftHand: {
        wrist: { x: 0.25, y: 0.25 },
        shoulder: { x: 0.35, y: 0.55 },
        elbow: { x: 0.30, y: 0.40 },
      },
    });
    expect(hit2).toHaveLength(1);
    expect(hit2[0].hand).toBe('left');
    expect(adapter.getState('left')).toBe('EXTENDED');
  });
});
