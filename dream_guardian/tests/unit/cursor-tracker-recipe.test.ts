import { describe, it, expect, vi } from 'vitest';
import { CursorTracker } from '../../src/input/CursorTracker.js';
import { RecipeGenerator } from '../../src/input/RecipeGenerator.js';
import { AnswerSelector, getTierInfo } from '../../src/input/AnswerSelector.js';
import { AnswerSelectionRenderer } from '../../src/render/AnswerSelectionRenderer.js';
import { CURSOR_DIMENSIONS } from '../../config/cursor.config.js';
import type { NormalizedLandmark } from '../../src/types/index.js';

function createMockLandmarks(): NormalizedLandmark[] {
  const lm: NormalizedLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    lm.push({ x: 0.5, y: 0.5, z: 0, visibility: 0 });
  }
  // 코 (head): 0
  lm[0] = { x: 0.5, y: 0.2, z: 0, visibility: 0.95 };
  // 왼어깨 11, 오른어깨 12
  lm[11] = { x: 0.4, y: 0.35, z: 0, visibility: 0.9 };
  lm[12] = { x: 0.6, y: 0.35, z: 0, visibility: 0.9 };
  // 왼손목 15, 오른손목 16
  lm[15] = { x: 0.15, y: 0.4, z: 0, visibility: 0.95 };
  lm[16] = { x: 0.85, y: 0.4, z: 0, visibility: 0.95 };
  // 왼골반 23, 오른골반 24
  lm[23] = { x: 0.45, y: 0.65, z: 0, visibility: 0.9 };
  lm[24] = { x: 0.55, y: 0.65, z: 0, visibility: 0.9 };
  return lm;
}

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    rect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('CursorTracker (Issue #104)', () => {
  it('Pose 랜드마크로부터 4색 커서(head, hip, leftHand, rightHand)를 정상 추출한다', () => {
    const tracker = new CursorTracker();
    const lm = createMockLandmarks();
    const cursors = tracker.update(lm);

    expect(cursors.has('head')).toBe(true);
    expect(cursors.get('head')!.y).toBeCloseTo(0.2);

    expect(cursors.has('hip')).toBe(true);
    expect(cursors.get('hip')!.x).toBeCloseTo(0.5);
    expect(cursors.get('hip')!.y).toBeCloseTo(0.65);

    expect(cursors.has('leftHand')).toBe(true);
    expect(cursors.get('leftHand')!.x).toBeCloseTo(0.15);

    expect(cursors.has('rightHand')).toBe(true);
    expect(cursors.get('rightHand')!.x).toBeCloseTo(0.85);
  });

  it('Hands 손바닥 위치가 주어지면 Pose 손목보다 손바닥을 우선 적용한다', () => {
    const tracker = new CursorTracker();
    const lm = createMockLandmarks();
    const palms = {
      leftPalm: { x: 0.12, y: 0.38, confidence: 0.99 },
    };

    const cursors = tracker.update(lm, palms);
    expect(cursors.get('leftHand')!.source).toBe('hands');
    expect(cursors.get('leftHand')!.x).toBeCloseTo(0.12);

    // 오른손은 여전히 pose
    expect(cursors.get('rightHand')!.source).toBe('pose');
  });

  it('미러 모드(isMirrored=true) 시 X 좌표가 1-x로 반전된다', () => {
    const tracker = new CursorTracker();
    const lm = createMockLandmarks();
    // leftWrist x = 0.15 -> 반전 시 0.85
    const cursors = tracker.update(lm, undefined, true);
    expect(cursors.get('leftHand')!.x).toBeCloseTo(0.85);
  });

  it('Hands 부재 시 Pose 손목 및 손가락 관절로부터 손바닥(Palm) 중심점을 정밀 추정한다 (Issue #117)', () => {
    const tracker = new CursorTracker();
    const lm = createMockLandmarks();
    // 왼손목(#15): (0.2, 0.4), 왼팔꿈치(#13): (0.2, 0.5)
    // 검지 기저(#19): (0.2, 0.32), 소지 기저(#17): (0.18, 0.34)
    lm[13] = { x: 0.2, y: 0.5, z: 0, visibility: 0.9 };
    lm[15] = { x: 0.2, y: 0.4, z: 0, visibility: 0.95 };
    lm[17] = { x: 0.18, y: 0.34, z: 0, visibility: 0.9 };
    lm[19] = { x: 0.2, y: 0.32, z: 0, visibility: 0.9 };

    const cursors = tracker.update(lm);
    const leftHand = cursors.get('leftHand')!;
    expect(leftHand).toBeDefined();
    // 손바닥 중심은 손목(y=0.4)보다 손가락 기저(y=0.32~0.34) 쪽으로 위로 전진해야 함 (y < 0.4)
    expect(leftHand.y).toBeLessThan(0.40);
    expect(leftHand.y).toBeGreaterThan(0.32);
    // 중지 기저부 가중치 (Issue #145): 0.15*0.4 + 0.425*0.32 + 0.425*0.34 = 0.06 + 0.136 + 0.1445 = 0.3405
    expect(leftHand.y).toBeCloseTo(0.341, 2);
  });

  it('카메라 거리에 따른 신체 부위 크기 동적 추정이 적용된다 (Issue #117)', () => {
    const tracker = new CursorTracker({ virtualWidth: 1080, virtualHeight: 2160 });
    const lmClose = createMockLandmarks();
    // 가까운 상태: 어깨 너비 큼 (360px)
    lmClose[11] = { x: 0.35, y: 0.35, z: 0, visibility: 0.95 };
    lmClose[12] = { x: 0.68, y: 0.35, z: 0, visibility: 0.95 }; // dist = 0.33 * 1080 = 356px

    const lmFar = createMockLandmarks();
    // 먼 상태: 어깨 너비 작음 (150px)
    lmFar[11] = { x: 0.45, y: 0.35, z: 0, visibility: 0.95 };
    lmFar[12] = { x: 0.55, y: 0.35, z: 0, visibility: 0.95 }; // dist = 0.10 * 1080 = 108px

    const cursorsClose = tracker.update(lmClose);
    const headCloseRadiusX = cursorsClose.get('head')!.size?.radiusX;
    const headCloseRadiusY = cursorsClose.get('head')!.size?.radiusY;
    const handCloseRadius = cursorsClose.get('leftHand')!.size?.radius;

    const cursorsFar = tracker.update(lmFar);
    const headFarRadiusX = cursorsFar.get('head')!.size?.radiusX;
    const headFarRadiusY = cursorsFar.get('head')!.size?.radiusY;
    const handFarRadius = cursorsFar.get('leftHand')!.size?.radius;

    expect(headCloseRadiusX).toBeGreaterThan(headFarRadiusX!);
    expect(headCloseRadiusY).toBeGreaterThan(headFarRadiusY!);
    expect(handCloseRadius).toBeGreaterThan(handFarRadius!);
  });

  it('손바닥 및 손목이 화면 밖으로 나가도 커서가 소멸되지 않고 상위 관절(전완/팔꿈치)로 Fallback된다 (Issue #118)', () => {
    const tracker = new CursorTracker();
    const lm = createMockLandmarks();
    // 손목(#15): 화면 밖 x = -0.10, y = 0.4
    lm[15] = { x: -0.10, y: 0.4, z: 0, visibility: 0.95 };
    // 팔꿈치(#13): 화면 안 x = 0.08, y = 0.4 (전완 중점 = (-0.10 + 0.08)/2 = -0.01로 여전히 밖, 팔꿈치 0.08은 화면 안)
    lm[13] = { x: 0.08, y: 0.4, z: 0, visibility: 0.95 };

    const cursors = tracker.update(lm);
    const leftHand = cursors.get('leftHand');
    // 커서가 소멸(null)되지 않고 유지됨
    expect(leftHand).not.toBeNull();
    expect(leftHand).toBeDefined();
    // 화면 내부의 팔꿈치 관절로 fallback되어 화면 안쪽에 위치 (0.02 <= x <= 1.0)
    expect(leftHand!.x).toBeGreaterThanOrEqual(0.02);
    expect(leftHand!.x).toBeCloseTo(0.08, 1);
  });

  it('모든 상위 관절이 화면 밖으로 이탈해도 화면 경계 마진(0.02)으로 안전하게 클램핑된다 (Issue #118)', () => {
    const tracker = new CursorTracker();
    const lm = createMockLandmarks();
    // 손목, 팔꿈치, 어깨 모두 화면 좌측 밖으로 심하게 이탈
    lm[15] = { x: -0.40, y: 0.4, z: 0, visibility: 0.95 };
    lm[13] = { x: -0.30, y: 0.4, z: 0, visibility: 0.95 };
    lm[11] = { x: -0.20, y: 0.4, z: 0, visibility: 0.95 };

    const cursors = tracker.update(lm);
    const leftHand = cursors.get('leftHand');
    expect(leftHand).toBeDefined();
    // 마진 0.02로 안전 클램핑되어 화면 밖으로 소실되지 않음
    expect(leftHand!.x).toBeCloseTo(0.02, 2);
  });

  it('화면 이탈 Fallback 발생 시 지수 보간(Lerp Factor 0.25)을 통해 부드럽게 전환된다 (Issue #118)', () => {
    const tracker = new CursorTracker();
    const lmNormal = createMockLandmarks();
    // 1프레임: 정상 화면 내부 (x = 0.20)
    lmNormal[15] = { x: 0.20, y: 0.4, z: 0, visibility: 0.95 };
    const cursors1 = tracker.update(lmNormal);
    expect(cursors1.get('leftHand')!.x).toBeCloseTo(0.20);

    // 2프레임: 손목이 화면 밖(-0.10)으로 급격히 이탈, 팔꿈치가 0.06에 위치
    const lmOut = createMockLandmarks();
    lmOut[15] = { x: -0.10, y: 0.4, z: 0, visibility: 0.95 };
    lmOut[13] = { x: 0.06, y: 0.4, z: 0, visibility: 0.95 };

    const cursors2 = tracker.update(lmOut);
    const leftHand2 = cursors2.get('leftHand')!;
    // 0.20에서 0.06으로 즉시 순간이동(0.06)하지 않고, 이전 위치와 대상 위치 사이로 부드럽게 지수 보간됨
    // lerp(0.20, 0.06, 0.25) = 0.20 + (0.06 - 0.20) * 0.25 = 0.20 - 0.035 = 0.165
    expect(leftHand2.x).toBeLessThan(0.20);
    expect(leftHand2.x).toBeGreaterThan(0.06);
    expect(leftHand2.x).toBeCloseTo(0.165, 2);
  });

  it('Cover 변환(projectFn) 연동 시 랜드마크가 Cover 뷰포트 좌표계로 정확히 변환된다 (Issue #116)', () => {
    const tracker = new CursorTracker();
    const vw = 1080;
    const vh = 2160;
    // 16:9 웹캠(1280x720)을 18:9 캔버스(1080x2160)에 Cover 렌더링 시 스케일 3.0 (dw=3840, dh=2160, cx=540, cy=1080)
    const mockCoverProjectFn = (lm: { x: number; y: number }, canvasW: number, canvasH: number) => {
      const dw = 3840;
      const dh = 2160;
      const cx = canvasW / 2;
      const cy = canvasH / 2;
      return {
        x: cx + (0.5 - lm.x) * dw, // 미러 모드 Cover 변환
        y: cy + (lm.y - 0.5) * dh,
      };
    };

    tracker.setViewport(vw, vh, mockCoverProjectFn);

    const lm = createMockLandmarks();
    // leftWrist: x=0.4, y=0.3
    lm[15] = { x: 0.4, y: 0.3, z: 0, visibility: 0.95 };

    const cursors = tracker.update(lm);
    const leftHand = cursors.get('leftHand')!;
    expect(leftHand).toBeDefined();

    // 예상 Cover 픽셀 좌표: x = 540 + (0.5 - 0.4)*3840 = 540 + 384 = 924px, y = 1080 + (0.3 - 0.5)*2160 = 648px
    // 캔버스 정규화 좌표: 924 / 1080, 648 / 2160
    expect(leftHand.x * vw).toBeCloseTo(924);
    expect(leftHand.y * vh).toBeCloseTo(648);
  });

  it('가상 캔버스 픽셀 좌표(isVirtual=true) 전달 시 스켈레톤 관절 좌표와 커서 좌표가 0px 오차로 일치한다 (Issue #116)', () => {
    const tracker = new CursorTracker({ virtualWidth: 1080, virtualHeight: 2160 });
    const virtualLm: NormalizedLandmark[] = [];
    for (let i = 0; i < 33; i++) {
      virtualLm.push({ x: 540, y: 1080, z: 0, visibility: 0 });
    }

    // 스켈레톤 JointRenderer가 그리는 관절 픽셀 좌표
    const jointHead = { x: 540, y: 400 };
    const jointLeftHand = { x: 280, y: 850 };
    const jointRightHand = { x: 800, y: 850 };
    const jointLeftHip = { x: 490, y: 1300 };
    const jointRightHip = { x: 590, y: 1300 };

    virtualLm[0] = { ...jointHead, z: 0, visibility: 0.95 };
    virtualLm[15] = { ...jointLeftHand, z: 0, visibility: 0.95 };
    virtualLm[16] = { ...jointRightHand, z: 0, visibility: 0.95 };
    virtualLm[23] = { ...jointLeftHip, z: 0, visibility: 0.95 };
    virtualLm[24] = { ...jointRightHip, z: 0, visibility: 0.95 };

    const cursors = tracker.update(virtualLm, undefined, false, {
      isVirtual: true,
      virtualWidth: 1080,
      virtualHeight: 2160,
    });

    const vw = 1080;
    const vh = 2160;

    // 1. 머리 커서 중심 == 코 관절 좌표 (오차 0px)
    const headCursor = cursors.get('head')!;
    expect(headCursor.x * vw).toBeCloseTo(jointHead.x, 5);
    expect(headCursor.y * vh).toBeCloseTo(jointHead.y, 5);

    // 2. 왼손 커서 중심 == 왼손목 관절 좌표 (오차 0px)
    const leftCursor = cursors.get('leftHand')!;
    expect(leftCursor.x * vw).toBeCloseTo(jointLeftHand.x, 5);
    expect(leftCursor.y * vh).toBeCloseTo(jointLeftHand.y, 5);

    // 3. 오른손 커서 중심 == 오른손목 관절 좌표 (오차 0px)
    const rightCursor = cursors.get('rightHand')!;
    expect(rightCursor.x * vw).toBeCloseTo(jointRightHand.x, 5);
    expect(rightCursor.y * vh).toBeCloseTo(jointRightHand.y, 5);

    // 4. 골반 커서 중심 == 양 골반 중점 (오차 0px)
    const hipCursor = cursors.get('hip')!;
    const expectedHipX = (jointLeftHip.x + jointRightHip.x) / 2;
    const expectedHipY = (jointLeftHip.y + jointRightHip.y) / 2;
    expect(hipCursor.x * vw).toBeCloseTo(expectedHipX, 5);
    expect(hipCursor.y * vh).toBeCloseTo(expectedHipY, 5);
  });
});

describe('RecipeGenerator (Issue #104)', () => {
  const generator = new RecipeGenerator();

  it('Tier 1~4 각각에 대해 좌/우 선택지 레시피 계획을 생성한다', () => {
    for (let t = 1; t <= 4; t++) {
      const tierInfo = getTierInfo(t === 1 ? 1 : t === 2 ? 5 : t === 3 ? 9 : 13);
      const plan = generator.generatePlan(tierInfo);

      expect(plan.choices).toHaveLength(2);
      expect(plan.activeZones.length).toBeGreaterThan(0);
    }
  });

  it('좌측 선택지와 우측 선택지는 동일한 신체 커서를 중복 공유하지 않는다', () => {
    const tierInfo = getTierInfo(1);
    const plan = generator.generatePlan(tierInfo);

    const leftCursors = plan.choices[0].requiredCursors;
    const rightCursors = plan.choices[1].requiredCursors;

    const hasOverlap = leftCursors.some((c) => rightCursors.includes(c));
    expect(hasOverlap).toBe(false);
  });

  it('신체 부위별(양손 전 존 1~11 및 머리 4~5, 골반 6~11) 허용 존이 엄격히 판정된다 (Issue #156 / FEAT-ZONE-003)', () => {
    // 왼손, 오른손: 전 존 1~11 허용
    for (let z = 1; z <= 11; z++) {
      expect(generator.isValidZoneForCursor('leftHand', z)).toBe(true);
      expect(generator.isValidZoneForCursor('rightHand', z)).toBe(true);
    }

    // 머리: 4, 5만 허용 (상단 1~3 및 하단 6~11 불허)
    expect(generator.isValidZoneForCursor('head', 4)).toBe(true);
    expect(generator.isValidZoneForCursor('head', 5)).toBe(true);
    expect(generator.isValidZoneForCursor('head', 1)).toBe(false);
    expect(generator.isValidZoneForCursor('head', 2)).toBe(false);
    expect(generator.isValidZoneForCursor('head', 7)).toBe(false);

    // 골반: 6, 8, 9, 10, 11 허용, 직립 기본 위치인 7번 및 1~5 불허
    expect(generator.isValidZoneForCursor('hip', 6)).toBe(true);
    expect(generator.isValidZoneForCursor('hip', 10)).toBe(true);
    expect(generator.isValidZoneForCursor('hip', 11)).toBe(true);
    expect(generator.isValidZoneForCursor('hip', 7)).toBe(false);
    expect(generator.isValidZoneForCursor('hip', 1)).toBe(false);
  });

  it('Tier 2 및 Tier 3 출제 시 머리는 2번(및 1, 3번)에 출제되지 않고, 골반은 7번에 출제되지 않는다', () => {
    // Tier 2 (문제 4~7)
    for (let q = 4; q <= 7; q++) {
      const tierInfo = getTierInfo(q);
      const plan = generator.generatePlan(tierInfo);
      for (const choice of plan.choices) {
        if (choice.requiredCursors.includes('head')) {
          expect(choice.targetZoneIds.includes(2)).toBe(false);
          expect(choice.targetZoneIds.includes(1)).toBe(false);
          expect(choice.targetZoneIds.includes(3)).toBe(false);
          // 머리는 4 또는 5만 허용
          for (const zid of choice.targetZoneIds) {
            expect([4, 5]).toContain(zid);
          }
        }
      }
    }

    // Tier 3 (문제 8~11)
    for (let q = 8; q <= 11; q++) {
      const tierInfo = getTierInfo(q);
      const plan = generator.generatePlan(tierInfo);
      for (const choice of plan.choices) {
        if (choice.requiredCursors.includes('head')) {
          expect(choice.targetZoneIds.includes(2)).toBe(false);
        }
        if (choice.requiredCursors.includes('hip')) {
          expect(choice.targetZoneIds.includes(7)).toBe(false);
        }
      }
    }
  });
});

describe('Shared Active Zone & Color Cursor Mechanism (Issue #150 / REFACTOR-POSE-001)', () => {
  const generator = new RecipeGenerator();

  it('문제 출제 시 좌/우 답안이 동일한 공용 피트니스 존(targetZoneIds)을 공유한다', () => {
    for (let t = 1; t <= 4; t++) {
      const tierInfo = getTierInfo(t === 1 ? 1 : t === 2 ? 5 : t === 3 ? 9 : 13);
      const plan = generator.generatePlan(tierInfo);

      // 좌/우 답안 동일 공용 존 검증
      expect(plan.choices[0].targetZoneIds).toEqual(plan.choices[1].targetZoneIds);
      // activeZones가 공용 존과 1:1 일치하는지 검증
      const activeZoneIds = plan.activeZones.map((z) => z.id);
      expect(activeZoneIds).toEqual(plan.choices[0].targetZoneIds);
      // 요구 커서는 중복되지 않음 검증
      const hasCursorOverlap = plan.choices[0].requiredCursors.some((c) =>
        plan.choices[1].requiredCursors.includes(c)
      );
      expect(hasCursorOverlap).toBe(false);
    }
  });

  it('공용 피트니스 존에 진입한 커서 색상에 따라 해당 답안 선택지가 독립적으로 충전된다', () => {
    const as = new AnswerSelector();
    const plan = as.startQuestion(1); // Tier 1: 공용 존 (Zone 4)
    expect(plan.choices[0].targetZoneIds).toEqual([4]);
    expect(plan.choices[1].targetZoneIds).toEqual([4]);

    const lm = createMockLandmarks();
    // 1. 왼손만 공용 존 4(0.17, 0.32)에 진입, 오른손은 허공(0.5, 0.5)
    lm[15] = { x: 0.17, y: 0.32, z: 0, visibility: 0.95 };
    lm[16] = { x: 0.5, y: 0.5, z: 0, visibility: 0.95 };

    as.updateFromPose(lm, undefined, 0.3);
    expect(as.choiceProgress[0]).toBeGreaterThan(0);
    expect(as.choiceProgress[1]).toBe(0);

    // 2. 리셋 후 오른손만 공용 존 4(0.17, 0.32)에 진입, 왼손은 허공(0.5, 0.5)
    as.reset();
    expect(as.choiceProgress[0]).toBe(0);
    expect(as.choiceProgress[1]).toBe(0);

    lm[15] = { x: 0.5, y: 0.5, z: 0, visibility: 0.95 }; // 왼손 허공
    lm[16] = { x: 0.17, y: 0.32, z: 0, visibility: 0.95 }; // 오른손 공용 존 4

    as.updateFromPose(lm, undefined, 0.3);
    expect(as.choiceProgress[0]).toBe(0);
    expect(as.choiceProgress[1]).toBeGreaterThan(0);
  });

  it('공용 존에 양쪽 커서가 동시에 진입하면 Deadlock Guard가 작동하여 감쇠된다', () => {
    const as = new AnswerSelector();
    as.startQuestion(1);

    const lm = createMockLandmarks();
    // 양손 모두 공용 존 4(0.17, 0.32)에 진입
    lm[15] = { x: 0.17, y: 0.32, z: 0, visibility: 0.95 };
    lm[16] = { x: 0.17, y: 0.32, z: 0, visibility: 0.95 };

    const result = as.updateFromPose(lm, undefined, 0.3);
    expect(result).toBeNull();
    expect(as.choiceProgress[0]).toBe(0);
    expect(as.choiceProgress[1]).toBe(0);
  });
});

describe('AnswerSelector - updateFromPose & Deadlock Guard (Issue #104)', () => {
  it('동일 신체 조건으로 양쪽 선택지 조건을 동시에 만족할 경우 Deadlock Guard가 발동하여 취소된다', () => {
    const as = new AnswerSelector();
    as.startQuestion(1); // Tier 1: 공용 활성 존 Zone 4 (Left=leftHand, Right=rightHand)

    const lm = createMockLandmarks();
    // leftHand(Zone 4: x=0.04~0.30, y=0.24~0.40) -> x=0.17, y=0.32
    lm[15] = { x: 0.17, y: 0.32, z: 0, visibility: 0.95 };
    // rightHand도 공용 Zone 4에 동시 진입 -> x=0.17, y=0.32
    lm[16] = { x: 0.17, y: 0.32, z: 0, visibility: 0.95 };

    // 양쪽 모두 만족하는 상태
    const result = as.updateFromPose(lm, undefined, 0.5);
    // Deadlock Guard 발동 -> 확정되지 않음
    expect(result).toBeNull();
    expect(as.choiceProgress[0]).toBe(0);
    expect(as.choiceProgress[1]).toBe(0);
  });

  it('단일 선택지 조건만 만족할 경우 체류 시간이 누적되어 확정된다', () => {
    const as = new AnswerSelector();
    as.startQuestion(1); // Tier 1 (dwellTime = 0.7s)

    const lm = createMockLandmarks();
    // leftHand만 Zone 4(x=0.17, y=0.32, 중심)에 진입
    lm[15] = { x: 0.17, y: 0.32, z: 0, visibility: 0.95 };
    // rightHand는 허공(0.5, 0.5)
    lm[16] = { x: 0.5, y: 0.5, z: 0, visibility: 0.95 };

    // 0.4초 체류
    const r1 = as.updateFromPose(lm, undefined, 0.4);
    expect(r1).toBeNull();
    expect(as.choiceProgress[0]).toBeGreaterThan(0);
    expect(as.choiceProgress[1]).toBe(0);

    // 추가 0.4초 체류 (총 0.8s > 0.7s)
    const r2 = as.updateFromPose(lm, undefined, 0.4);
    expect(r2).not.toBeNull();
    expect(r2!.confirmedIndex).toBe(0);
  });

  it('가상 해상도 뷰포트(setViewport & isVirtual) 환경에서 답안 판정이 정확하게 동작한다 (Issue #116)', () => {
    const as = new AnswerSelector();
    const vw = 1080;
    const vh = 2160;
    as.setViewport(vw, vh);
    as.startQuestion(1); // Tier 1: Left=leftHand in Zone 4 (x: 0.04~0.30, y: 0.24~0.40)

    // Zone 4 가상 픽셀 범위: x: 43.2 ~ 324px, y: 518.4 ~ 864px (중심: x=183.6px, y=691.2px)
    const virtualLm: NormalizedLandmark[] = [];
    for (let i = 0; i < 33; i++) {
      virtualLm.push({ x: 540, y: 1080, z: 0, visibility: 0 });
    }
    // 왼손을 Zone 4 중심에 배치
    virtualLm[15] = { x: 183.6, y: 691.2, z: 0, visibility: 0.95 };
    // 오른손은 허공 (540, 1080)
    virtualLm[16] = { x: 540, y: 1080, z: 0, visibility: 0.95 };

    // 0.4초 체류
    const r1 = as.updateFromPose(virtualLm, undefined, 0.4, false, {
      isVirtual: true,
      virtualWidth: vw,
      virtualHeight: vh,
    });
    expect(r1).toBeNull();
    expect(as.choiceProgress[0]).toBeGreaterThan(0);
    expect(as.choiceProgress[1]).toBe(0);

    // 추가 0.4초 체류 (총 0.8s > 0.7s)
    const r2 = as.updateFromPose(virtualLm, undefined, 0.4, false, {
      isVirtual: true,
      virtualWidth: vw,
      virtualHeight: vh,
    });
    expect(r2).not.toBeNull();
    expect(r2!.confirmedIndex).toBe(0);
  });
});

describe('AnswerSelectionRenderer (Issue #104)', () => {
  const ctx = createMockCtx();

  it('활성 피트니스 존과 4색 신체 커서를 에러 없이 렌더링한다', () => {
    const renderer = new AnswerSelectionRenderer();
    const as = new AnswerSelector();
    const plan = as.startQuestion(1);

    const lm = createMockLandmarks();
    as.updateFromPose(lm);

    expect(() =>
      renderer.render(
        ctx,
        1920,
        1080,
        plan.activeZones,
        as.cursorTracker.cursors,
        as.choiceProgress,
      ),
    ).not.toThrow();

    expect(ctx.strokeRect).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
  });

  it('다양한 화면 해상도 및 종횡비(1080x2160, 720x1440, 1920x1080)에서 스켈레톤 관절과 커서 중심 좌표가 0px 오차로 일치한다 (Issue #116)', () => {
    const resolutions = [
      { w: 1080, h: 2160 }, // 18:9 기본
      { w: 720, h: 1440 },  // 18:9 모바일
      { w: 1920, h: 1080 }, // 16:9 데스크톱
    ];

    for (const res of resolutions) {
      const tracker = new CursorTracker({ virtualWidth: res.w, virtualHeight: res.h });
      const virtualLm: NormalizedLandmark[] = [];
      for (let i = 0; i < 33; i++) {
        virtualLm.push({ x: res.w * 0.5, y: res.h * 0.5, z: 0, visibility: 0 });
      }

      // 임의의 스켈레톤 관절 픽셀 좌표
      const expectedWrist = { x: res.w * 0.25, y: res.h * 0.42 };
      virtualLm[15] = { ...expectedWrist, z: 0, visibility: 0.95 };

      const cursors = tracker.update(virtualLm, undefined, false, {
        isVirtual: true,
        virtualWidth: res.w,
        virtualHeight: res.h,
      });

      const leftHand = cursors.get('leftHand')!;
      expect(leftHand).toBeDefined();

      // AnswerSelectionRenderer가 그릴 때 계산하는 실제 화면 픽셀 좌표:
      const renderedCx = leftHand.x * res.w;
      const renderedCy = leftHand.y * res.h;

      // JointRenderer가 그리는 관절 픽셀 좌표와 0px 오차로 일치
      expect(renderedCx).toBeCloseTo(expectedWrist.x, 5);
      expect(renderedCy).toBeCloseTo(expectedWrist.y, 5);
      expect(Math.abs(renderedCx - expectedWrist.x)).toBeLessThan(0.0001);
      expect(Math.abs(renderedCy - expectedWrist.y)).toBeLessThan(0.0001);
    }
  });

  it('4색 커서(손, 머리, 골반) 렌더링 시 채움색이 전혀 없고 외곽선(Outline Only)으로만 렌더링된다 (Issue #117)', () => {
    const renderer = new AnswerSelectionRenderer();
    const tracker = new CursorTracker();
    const lm = createMockLandmarks();
    const cursors = tracker.update(lm);

    const mockCtx = createMockCtx();
    // 활성 존 없이 커서만 렌더링하도록 호출하여 커서 렌더링 중 ctx.fill 호출 여부 검사
    renderer.render(mockCtx, 1080, 2160, [], cursors, [0, 0]);

    // 커서 렌더링에서 ctx.fill()은 일체 호출되지 않아야 함 (채움색 없음)
    expect(mockCtx.fill).not.toHaveBeenCalled();
    // 네온 테두리 stroke는 정상 호출되어야 함
    expect(mockCtx.stroke).toHaveBeenCalled();
  });

  it('[BUG-SCALE-002 / Test 1] 귀가 완전히 가려져도(신뢰도 0) 눈 간격 또는 코-어깨 거리 기반으로 머리 크기를 동적 추정한다 (Issue #144)', () => {
    const tracker = new CursorTracker({ virtualWidth: 1080, virtualHeight: 2160 });
    const lm = createMockLandmarks();

    // 1. 양 귀(#7, #8)가 완전히 가려진 상태 (헤드셋/머리카락 등)
    lm[7] = { x: 0.35, y: 0.2, z: 0, visibility: 0 };
    lm[8] = { x: 0.65, y: 0.2, z: 0, visibility: 0 };

    // 2. 양 눈(#2 왼쪽 눈 바깥, #5 오른쪽 눈 바깥) 유효: 눈 간격 0.08 (가상 86.4px)
    lm[2] = { x: 0.46, y: 0.19, z: 0, visibility: 0.95 };
    lm[5] = { x: 0.54, y: 0.19, z: 0, visibility: 0.95 };

    const cursors = tracker.update(lm);
    const headCursor = cursors.get('head');
    expect(headCursor).toBeDefined();
    expect(headCursor!.size).toBeDefined();

    // 귀가 없어도 기본 최소 박제(14px)가 아니라 눈 간격에 기반한 현실적 안면 크기(radiusX >= 35px)로 동적 추정되어야 함
    expect(headCursor!.size!.radiusX).toBeGreaterThanOrEqual(35);
    expect(headCursor!.size!.radiusY).toBeGreaterThan(headCursor!.size!.radiusX!);
  });

  it('[BUG-SCALE-002 / Test 2] 팔꿈치가 화면 밖으로 이탈(신뢰도 0)해도 어깨-손목 축 기반으로 손목 너머 손바닥 중심점으로 커서가 전진한다 (Issue #144)', () => {
    const tracker = new CursorTracker({ virtualWidth: 1080, virtualHeight: 2160 });
    const virtualLm: NormalizedLandmark[] = [];
    for (let i = 0; i < 33; i++) {
      virtualLm.push({ x: 540, y: 1080, z: 0, visibility: 0 });
    }

    // 오른어깨(#12): (600, 700), 손목(#16): (850, 700)
    // 팔꿈치(#14) 및 손가락 관절(#18, #20)이 화면 밖으로 잘려 신뢰도 0
    virtualLm[12] = { x: 600, y: 700, z: 0, visibility: 0.95 };
    virtualLm[14] = { x: 1200, y: 700, z: 0, visibility: 0.0 }; // 팔꿈치 잘림
    virtualLm[16] = { x: 850, y: 700, z: 0, visibility: 0.95 }; // 손목은 화면 안
    virtualLm[18] = { x: 900, y: 700, z: 0, visibility: 0.0 }; // 손가락 잘림
    virtualLm[20] = { x: 900, y: 700, z: 0, visibility: 0.0 }; // 손가락 잘림

    const cursors = tracker.update(virtualLm, undefined, false, {
      isVirtual: true,
      virtualWidth: 1080,
      virtualHeight: 2160,
    });
    const rightHand = cursors.get('rightHand');
    expect(rightHand).toBeDefined();

    // 손목 x=850px에 멈추지 않고, 어깨->손목 방향(x 증가 방향)으로 손바닥 중심을 향해 손목 너머 40~70px 전진
    const renderedX = rightHand!.x * 1080;
    expect(renderedX).toBeGreaterThan(850 + 35);
  });

  it('[BUG-SCALE-002 / Test 3] 1080p 해상도 및 PC/모바일 환경에서 현실적 커서 규격(손 45px+, 머리 55px+)을 보장한다 (Issue #144)', () => {
    // 1. cursor.config.ts 규격 상향 확인
    expect(CURSOR_DIMENSIONS.hand.defaultRadius).toBeGreaterThanOrEqual(40);
    expect(CURSOR_DIMENSIONS.hand.maxRadius).toBeGreaterThanOrEqual(80);
    expect(CURSOR_DIMENSIONS.head.defaultRadiusX).toBeGreaterThanOrEqual(50);
    expect(CURSOR_DIMENSIONS.head.maxRadiusX).toBeGreaterThanOrEqual(100);
    expect(CURSOR_DIMENSIONS.hip.defaultHalfWidth).toBeGreaterThanOrEqual(50);

    // 2. 기본 신체(1080x2160 가상 좌표계)에서 실제 렌더링 반경 검증
    const tracker = new CursorTracker({ virtualWidth: 1080, virtualHeight: 2160 });
    const virtualLm: NormalizedLandmark[] = [];
    for (let i = 0; i < 33; i++) {
      virtualLm.push({ x: 540, y: 1080, z: 0, visibility: 0 });
    }
    // 어깨 간격 350px (PC 표준 거리)
    virtualLm[11] = { x: 365, y: 700, z: 0, visibility: 0.95 };
    virtualLm[12] = { x: 715, y: 700, z: 0, visibility: 0.95 };
    virtualLm[0] = { x: 540, y: 500, z: 0, visibility: 0.95 };
    virtualLm[15] = { x: 250, y: 900, z: 0, visibility: 0.95 };
    virtualLm[16] = { x: 830, y: 900, z: 0, visibility: 0.95 };
    virtualLm[23] = { x: 450, y: 1300, z: 0, visibility: 0.95 };
    virtualLm[24] = { x: 630, y: 1300, z: 0, visibility: 0.95 };

    const cursors = tracker.update(virtualLm, undefined, false, {
      isVirtual: true,
      virtualWidth: 1080,
      virtualHeight: 2160,
    });

    const head = cursors.get('head');
    const leftHand = cursors.get('leftHand');
    const hip = cursors.get('hip');

    expect(head?.size?.radiusX).toBeGreaterThanOrEqual(50);
    expect(leftHand?.size?.radius).toBeGreaterThanOrEqual(40);
    expect(hip?.size?.halfWidth).toBeGreaterThanOrEqual(45);
  });

  it('[FEAT-CURSOR-004 / Test 1] 손바닥 트래킹 좌표가 손목이 아닌 중지 손가락 시작부(3rd MCP, 검지-소지 기저부 축)로 위치 조절된다 (Issue #145)', () => {
    const tracker = new CursorTracker();
    const lm = createMockLandmarks();
    // 왼손목(#15): (0.2, 0.40), 왼팔꿈치(#13): (0.2, 0.50)
    // 검지 기저(#19): (0.2, 0.30), 소지 기저(#17): (0.2, 0.32)
    lm[13] = { x: 0.2, y: 0.50, z: 0, visibility: 0.9 };
    lm[15] = { x: 0.2, y: 0.40, z: 0, visibility: 0.95 };
    lm[17] = { x: 0.2, y: 0.32, z: 0, visibility: 0.9 };
    lm[19] = { x: 0.2, y: 0.30, z: 0, visibility: 0.9 };

    const cursors = tracker.update(lm);
    const leftHand = cursors.get('leftHand')!;
    expect(leftHand).toBeDefined();

    // 중지 손가락 시작부(3rd MCP): 손목(0.40)보다 손가락 기저선(0.30~0.32) 쪽에 매우 가깝게 전진해야 함 (y < 0.33)
    // 이전 손바닥 하단 공식 (가중치 0.40) -> y = 0.345
    // 신규 중지 기저 공식 (가중치 0.15) -> y = 0.40*0.15 + 0.30*0.425 + 0.32*0.425 = 0.3235
    expect(leftHand.y).toBeLessThan(0.33);
    expect(leftHand.y).toBeCloseTo(0.3235, 2);
  });

  it('[FEAT-CURSOR-004 / Test 2] 골반 커서 너비가 힙과 연결된 양다리 시작포인트(#23-#24) 사이 거리의 1.5배로 동적 확장된다 (Issue #145)', () => {
    const tracker = new CursorTracker({ virtualWidth: 1080, virtualHeight: 2160 });
    const virtualLm: NormalizedLandmark[] = [];
    for (let i = 0; i < 33; i++) {
      virtualLm.push({ x: 540, y: 1080, z: 0, visibility: 0 });
    }
    // 양다리 시작포인트: 왼골반(#23) x=440, 오른골반(#24) x=640 -> hipDist = 200px
    virtualLm[23] = { x: 440, y: 1300, z: 0, visibility: 0.95 };
    virtualLm[24] = { x: 640, y: 1300, z: 0, visibility: 0.95 };

    const cursors = tracker.update(virtualLm, undefined, false, {
      isVirtual: true,
      virtualWidth: 1080,
      virtualHeight: 2160,
    });

    const hip = cursors.get('hip')!;
    expect(hip).toBeDefined();
    expect(hip.size).toBeDefined();

    // 전체 너비 = hipDist(200px) * 1.5 = 300px
    // halfWidth = 300 / 2 = 150px
    expect(hip.size!.halfWidth).toBeCloseTo(150, 0);
  });

  it('[FEAT-CURSOR-004 / Test 3] 골반 커서가 상하 대칭의 납작한 마름모 비율(halfHeight = halfWidth * 0.45)로 설정된다 (Issue #145)', () => {
    const tracker = new CursorTracker({ virtualWidth: 1080, virtualHeight: 2160 });
    const virtualLm: NormalizedLandmark[] = [];
    for (let i = 0; i < 33; i++) {
      virtualLm.push({ x: 540, y: 1080, z: 0, visibility: 0 });
    }
    virtualLm[23] = { x: 450, y: 1300, z: 0, visibility: 0.95 };
    virtualLm[24] = { x: 650, y: 1300, z: 0, visibility: 0.95 };

    const cursors = tracker.update(virtualLm, undefined, false, {
      isVirtual: true,
      virtualWidth: 1080,
      virtualHeight: 2160,
    });

    const hip = cursors.get('hip')!;
    expect(hip).toBeDefined();
    expect(hip.size).toBeDefined();

    // 납작한 마름모: 상하 오프셋이 대칭이며 너비 대비 약 45% 두께
    const expectedHalfHeight = Math.round(hip.size!.halfWidth! * 0.45);
    expect(hip.size!.topOffset).toBe(expectedHalfHeight);
    expect(hip.size!.bottomOffset).toBe(expectedHalfHeight);
  });
});

describe('RecipeGenerator Zone Diversity & Cooldown (Issue #175 / BUG-ZONE-003)', () => {
  it('Tier 1에서 연속 생성 시 존 4번에만 고정되지 않고 다양한 피트니스 존(1~8번)이 출제된다', () => {
    const generator = new RecipeGenerator();
    const tierInfo = getTierInfo(1);
    const zoneSet = new Set<number>();

    for (let i = 0; i < 20; i++) {
      const plan = generator.generatePlan(tierInfo, (i * 0.17) % 1);
      for (const z of plan.activeZones) {
        zoneSet.add(z.id);
      }
    }

    // 20회 생성 시 최소 4개 이상의 서로 다른 존이 출제되어야 함 (기존: 4번 1개만 고정)
    expect(zoneSet.size).toBeGreaterThanOrEqual(4);
    // 4번 외에도 상단(1, 2, 3), 우측(5), 하단(6, 8) 등 다양한 존 포함 검증
    expect(zoneSet.has(4)).toBe(true);
    const nonFourZones = Array.from(zoneSet).filter((id) => id !== 4);
    expect(nonFourZones.length).toBeGreaterThanOrEqual(3);
  });

  it('Tier 3에서 연속 생성 시 [4, 10]에만 고정되지 않고 다양한 2존 조합이 출제된다', () => {
    const generator = new RecipeGenerator();
    const tierInfo = getTierInfo(9); // Tier 3
    const combinationSet = new Set<string>();

    for (let i = 0; i < 20; i++) {
      const plan = generator.generatePlan(tierInfo, (i * 0.23) % 1);
      const key = plan.activeZones.map((z) => z.id).sort((a, b) => a - b).join(',');
      combinationSet.add(key);
    }

    // 최소 3종류 이상의 서로 다른 2존 조합 출제 검증 (기존: "4,10" 1종류만 고정)
    expect(combinationSet.size).toBeGreaterThanOrEqual(3);
  });

  it('Tier 4에서 연속 생성 시 2번에만 고정되지 않고 1, 2, 3번 상단 존들이 다양하게 출제된다', () => {
    const generator = new RecipeGenerator();
    const tierInfo = getTierInfo(13); // Tier 4
    const zoneSet = new Set<number>();

    for (let i = 0; i < 20; i++) {
      const plan = generator.generatePlan(tierInfo, (i * 0.31) % 1);
      for (const z of plan.activeZones) {
        zoneSet.add(z.id);
      }
    }

    // 최소 2개 이상의 상단 만세 존 출제 검증 (기존: 2번 1개만 고정)
    expect(zoneSet.size).toBeGreaterThanOrEqual(2);
  });

  it('연속으로 문제 생성 시 직전 문제와 동일한 피트니스 존 배치가 연속 출제되지 않는다 (Cooldown 검증)', () => {
    const generator = new RecipeGenerator();
    const tierInfo = getTierInfo(1);
    let previousZoneKey = '';
    let consecutiveRepeatCount = 0;

    for (let i = 0; i < 20; i++) {
      const plan = generator.generatePlan(tierInfo, (i * 0.29 + 0.1) % 1);
      const currentZoneKey = plan.activeZones.map((z) => z.id).sort((a, b) => a - b).join(',');
      if (previousZoneKey !== '' && currentZoneKey === previousZoneKey) {
        consecutiveRepeatCount++;
      }
      previousZoneKey = currentZoneKey;
    }

    expect(consecutiveRepeatCount).toBe(0);
  });

  it('AnswerSelector에서 문제 번호(questionNumber) 진행에 따라 피트니스 존이 정적으로 고정되지 않고 다양하게 변화한다', () => {
    const as = new AnswerSelector();
    const zoneHistory: string[] = [];

    // 문제 1(웜업)부터 10번까지 진행
    for (let q = 1; q <= 10; q++) {
      const plan = as.startQuestion(q);
      const key = plan.activeZones.map((z) => z.id).sort((a, b) => a - b).join(',');
      zoneHistory.push(key);
    }

    // 첫 문제는 튜토리얼 일관성을 위해 4번(좌중)으로 시작
    expect(zoneHistory[0]).toBe('4');

    // 10문제 중 서로 다른 고유 존 조합이 최소 4가지 이상이어야 함
    const uniqueKeys = new Set(zoneHistory);
    expect(uniqueKeys.size).toBeGreaterThanOrEqual(4);

    // 문제 2번은 1번(4번)과 다른 존이어야 함
    expect(zoneHistory[1]).not.toBe('4');
  });
});

