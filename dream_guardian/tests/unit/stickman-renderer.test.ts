import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StickmanRenderer } from '../../src/skeleton/StickmanRenderer.js';
import { STICKMAN_CONFIG } from '../../config/skeleton.config.js';
import type { NormalizedLandmark } from '../../src/types/index.js';
import { POSE_LANDMARKS } from '../../src/types/index.js';
import { SettingsModal } from '../../src/ui/SettingsModal.js';

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
    roundRect: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: '',
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

function createSamplePoseLandmarks(): NormalizedLandmark[] {
  const lm: NormalizedLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    lm.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 });
  }

  // 머리 / 코
  lm[POSE_LANDMARKS.NOSE] = { x: 0.5, y: 0.2, z: 0, visibility: 0.95 };
  // 어깨
  lm[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.42, y: 0.32, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.58, y: 0.32, z: 0, visibility: 0.95 };
  // 팔꿈치
  lm[POSE_LANDMARKS.LEFT_ELBOW] = { x: 0.35, y: 0.44, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.RIGHT_ELBOW] = { x: 0.65, y: 0.44, z: 0, visibility: 0.95 };
  // 손목
  lm[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.30, y: 0.55, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.70, y: 0.55, z: 0, visibility: 0.95 };
  // 골반
  lm[POSE_LANDMARKS.LEFT_HIP] = { x: 0.45, y: 0.60, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.55, y: 0.60, z: 0, visibility: 0.95 };
  // 무릎
  lm[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.44, y: 0.76, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.56, y: 0.76, z: 0, visibility: 0.95 };
  // 발목
  lm[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.43, y: 0.92, z: 0, visibility: 0.95 };
  lm[POSE_LANDMARKS.RIGHT_ANKLE] = { x: 0.57, y: 0.92, z: 0, visibility: 0.95 };

  return lm;
}

describe('Issue #203 [FEAT-SKEL-005] 화면 중앙 2/3 높이 메카 졸라맨(Mecha Stickman) 실시간 모션 아바타', () => {
  describe('1. 메카 졸라맨 설정 규격 (skeleton.config.ts)', () => {
    it('STICKMAN_CONFIG에 황금비율 크기, 앵커 좌표 및 색상 설정이 정의되어 있다', () => {
      expect(STICKMAN_CONFIG).toBeDefined();

      // 화면 중앙 2/3 높이 앵커 (X: 0.5, Y: 약 0.65~0.75)
      expect(STICKMAN_CONFIG.anchorXRatio).toBeCloseTo(0.5, 2);
      expect(STICKMAN_CONFIG.anchorYRatio).toBeGreaterThanOrEqual(0.60);
      expect(STICKMAN_CONFIG.anchorYRatio).toBeLessThanOrEqual(0.75);

      // 고정 비례 길이 (황금 비율 체형)
      expect(STICKMAN_CONFIG.limbLengths.torso).toBeGreaterThan(100);
      expect(STICKMAN_CONFIG.limbLengths.upperArm).toBeGreaterThan(70);
      expect(STICKMAN_CONFIG.limbLengths.forearm).toBeGreaterThan(60);
      expect(STICKMAN_CONFIG.limbLengths.upperLeg).toBeGreaterThan(90);
      expect(STICKMAN_CONFIG.limbLengths.lowerLeg).toBeGreaterThan(90);

      // 두께 및 색상 규격
      expect(STICKMAN_CONFIG.capsuleWidth.limb).toBeGreaterThanOrEqual(12);
      expect(STICKMAN_CONFIG.colors.visor).toBe('#C889FF'); // 발광 보라 바이저
      expect(STICKMAN_CONFIG.colors.leftLimb).toBe('#28E6FF'); // 왼손 시안
      expect(STICKMAN_CONFIG.colors.rightLimb).toBe('#FFCB4D'); // 오른손 노랑
      expect(STICKMAN_CONFIG.colors.hipJoint).toBe('#FF865E'); // 골반 주황
    });
  });

  describe('2. 고정 비례 순운동학(Fixed-Length FK) 및 각도 계산', () => {
    let renderer: StickmanRenderer;

    beforeEach(() => {
      renderer = new StickmanRenderer();
    });

    it('카메라 랜드마크 거리 왜곡에 영향받지 않고 일정한 팔다리 고정 길이를 유지한다', () => {
      const normalPose = createSamplePoseLandmarks();
      renderer.update(0.016, normalPose);
      const pose1 = renderer.calculateFKPositions(1080, 2160);

      // 왼어깨 -> 왼팔꿈치 거리 계산
      const leftUpperArmDist = Math.hypot(
        pose1.leftElbow.x - pose1.leftShoulder.x,
        pose1.leftElbow.y - pose1.leftShoulder.y,
      );
      // 왼팔꿈치 -> 왼손목 거리 계산
      const leftForearmDist = Math.hypot(
        pose1.leftWrist.x - pose1.leftElbow.x,
        pose1.leftWrist.y - pose1.leftElbow.y,
      );

      expect(leftUpperArmDist).toBeCloseTo(STICKMAN_CONFIG.limbLengths.upperArm, 1);
      expect(leftForearmDist).toBeCloseTo(STICKMAN_CONFIG.limbLengths.forearm, 1);

      // 카메라 앞으로 손을 뻗어 2D 손목 좌표가 극단적으로 축소된 랜드마크 시뮬레이션
      const distortedPose = createSamplePoseLandmarks();
      distortedPose[POSE_LANDMARKS.LEFT_WRIST] = {
        x: distortedPose[POSE_LANDMARKS.LEFT_ELBOW].x + 0.001,
        y: distortedPose[POSE_LANDMARKS.LEFT_ELBOW].y + 0.001,
        z: 0,
        visibility: 0.95,
      };

      renderer.reset();
      renderer.update(0.016, distortedPose);
      const pose2 = renderer.calculateFKPositions(1080, 2160);

      const distortedForearmDist = Math.hypot(
        pose2.leftWrist.x - pose2.leftElbow.x,
        pose2.leftWrist.y - pose2.leftElbow.y,
      );

      // 왜곡된 랜드마크에서도 FK에 의해 고정 길이가 온전히 보존된다
      expect(distortedForearmDist).toBeCloseTo(STICKMAN_CONFIG.limbLengths.forearm, 1);
    });

    it('각도 스무딩(Damping)을 통해 프레임 간 급격한 각도 떨림을 부드럽게 감쇠한다', () => {
      const poseA = createSamplePoseLandmarks();
      renderer.update(0.016, poseA);
      const anglesA = renderer.getSmoothedAngles();

      // 갑작스러운 손 위치 변화
      const poseB = createSamplePoseLandmarks();
      poseB[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.1, y: 0.1, z: 0, visibility: 0.95 };

      // 1프레임 업데이트 (스무딩 계수 적용)
      renderer.update(0.016, poseB);
      const anglesB = renderer.getSmoothedAngles();

      // 급격히 100% 점프하지 않고 완만한 보간각을 취함
      expect(anglesB.leftUpperArm).not.toBe(anglesA.leftUpperArm);
    });

    it('스쿼트 동작 시 골반 앵커가 하강하고 무릎이 벌어지는 모션이 반영된다', () => {
      const standPose = createSamplePoseLandmarks();
      renderer.update(0.016, standPose);
      const standPositions = renderer.calculateFKPositions(1080, 2160);

      // 스쿼트 자세: 엉덩이와 무릎이 아래로 내려가고 골반 Y가 증가
      const squatPose = createSamplePoseLandmarks();
      squatPose[POSE_LANDMARKS.LEFT_HIP].y += 0.08;
      squatPose[POSE_LANDMARKS.RIGHT_HIP].y += 0.08;
      squatPose[POSE_LANDMARKS.LEFT_KNEE].y += 0.06;
      squatPose[POSE_LANDMARKS.RIGHT_KNEE].y += 0.06;

      renderer.update(0.016, squatPose);
      const squatPositions = renderer.calculateFKPositions(1080, 2160);

      // 스쿼트 시 골반 Y 좌표가 직립보다 아래로 내려감
      expect(squatPositions.pelvis.y).toBeGreaterThan(standPositions.pelvis.y);
    });
  });

  describe('3. Canvas 2D 프로시저럴 드로잉 렌더링 검증', () => {
    let renderer: StickmanRenderer;
    let mockCtx: CanvasRenderingContext2D;

    beforeEach(() => {
      renderer = new StickmanRenderer();
      mockCtx = createMockCtx();
    });

    it('포즈가 주어졌을 때 머리 헬멧, 바이저, 몸통, 사지 캡슐, 관절 볼, 지면 링을 렌더링한다', () => {
      const pose = createSamplePoseLandmarks();
      renderer.update(0.016, pose);

      renderer.render(mockCtx, 1080, 2160);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();

      // 머리, 관절 볼, 지면 링 등에 의해 arc / ellipse / stroke / fill 등이 다수 호출됨
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
      expect(mockCtx.arc).toHaveBeenCalled();
    });

    it('호흡 펄스(breathScale)에 따라 중앙 마력 코어가 박동 연출을 갖는다', () => {
      const pose = createSamplePoseLandmarks();
      renderer.update(0.016, pose, 1.05); // breathScale 1.05

      renderer.render(mockCtx, 1080, 2160);

      // 코어 드로잉 검증
      expect(mockCtx.save).toHaveBeenCalled();
    });

    it('랜드마크가 비어있거나 visibility가 낮으면 안전하게 렌더링을 건너뛴다', () => {
      renderer.update(0.016, []);
      expect(() => renderer.render(mockCtx, 1080, 2160)).not.toThrow();
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('화면 중앙 2/3 높이(y ≈ 0.60 ~ 0.75 * vh)에 골반 중심이 위치한다', () => {
      const pose = createSamplePoseLandmarks();
      renderer.update(0.016, pose);
      const fk = renderer.calculateFKPositions(1080, 2160);

      expect(fk.pelvis.x).toBeCloseTo(1080 * 0.5, 1);
      expect(fk.pelvis.y).toBeGreaterThan(2160 * 0.55);
      expect(fk.pelvis.y).toBeLessThan(2160 * 0.75);
    });
  });

  describe('4. Issue #280 [BUG-AVATAR-001] 미러링 각도 정합성 및 스켈레톤 본 토글 분리 검증', () => {
    let renderer: StickmanRenderer;

    beforeEach(() => {
      renderer = new StickmanRenderer();
    });

    it('사용자가 오른손을 화면 오른쪽으로 뻗을 때(dx > 0) 아바타 오른팔도 화면 오른쪽 바깥(dx > 0)으로 뻗는다', () => {
      const pose = createSamplePoseLandmarks();
      // 오른팔을 오른쪽 수평 바깥으로 뻗음
      pose[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.55, y: 0.35, z: 0, visibility: 0.95 };
      pose[POSE_LANDMARKS.RIGHT_ELBOW] = { x: 0.75, y: 0.35, z: 0, visibility: 0.95 };
      pose[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.90, y: 0.35, z: 0, visibility: 0.95 };

      renderer.update(0.016, pose);
      const angles = renderer.getSmoothedAngles();
      const fk = renderer.calculateFKPositions(1920, 1080);

      // 각도 및 FK 위치가 화면 오른쪽(+X)을 향해야 함
      expect(Math.cos(angles.rightUpperArm)).toBeGreaterThan(0);
      expect(Math.cos(angles.rightForearm)).toBeGreaterThan(0);
      expect(fk.rightElbow.x).toBeGreaterThan(fk.rightShoulder.x);
      expect(fk.rightWrist.x).toBeGreaterThan(fk.rightElbow.x);
    });

    it('사용자가 왼손을 화면 왼쪽으로 뻗을 때(dx < 0) 아바타 왼팔도 화면 왼쪽 바깥(dx < 0)으로 뻗는다', () => {
      const pose = createSamplePoseLandmarks();
      // 왼팔을 왼쪽 수평 바깥으로 뻗음
      pose[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.45, y: 0.35, z: 0, visibility: 0.95 };
      pose[POSE_LANDMARKS.LEFT_ELBOW] = { x: 0.25, y: 0.35, z: 0, visibility: 0.95 };
      pose[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.10, y: 0.35, z: 0, visibility: 0.95 };

      renderer.update(0.016, pose);
      const angles = renderer.getSmoothedAngles();
      const fk = renderer.calculateFKPositions(1920, 1080);

      // 각도 및 FK 위치가 화면 왼쪽(-X)을 향해야 함
      expect(Math.cos(angles.leftUpperArm)).toBeLessThan(0);
      expect(Math.cos(angles.leftForearm)).toBeLessThan(0);
      expect(fk.leftElbow.x).toBeLessThan(fk.leftShoulder.x);
      expect(fk.leftWrist.x).toBeLessThan(fk.leftElbow.x);
    });

    it('비미러(raw camera) 좌표계 랜드마크(rs.x < ls.x)가 유입되어도 거울 모드 화면 뷰에 맞게 자동 보정된다', () => {
      // 카메라 센서 raw 좌표계: 사용자의 실제 오른손이 센서 좌측(x < 0.5), 왼손이 센서 우측(x > 0.5)
      const rawPose: NormalizedLandmark[] = [];
      for (let i = 0; i < 33; i++) {
        rawPose.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 });
      }
      rawPose[POSE_LANDMARKS.NOSE] = { x: 0.5, y: 0.2, z: 0, visibility: 0.95 };
      // 카메라 센서 기준 어깨 (오른어깨가 센서 좌측, 왼어깨가 센서 우측)
      rawPose[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.45, y: 0.35, z: 0, visibility: 0.95 };
      rawPose[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.55, y: 0.35, z: 0, visibility: 0.95 };
      rawPose[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.45, y: 0.60, z: 0, visibility: 0.95 };
      rawPose[POSE_LANDMARKS.LEFT_HIP] = { x: 0.55, y: 0.60, z: 0, visibility: 0.95 };

      // 사용자가 실제 오른손을 자기 오른쪽(카메라 센서 기준 왼쪽 x: 0.10)으로 뻗음
      rawPose[POSE_LANDMARKS.RIGHT_ELBOW] = { x: 0.25, y: 0.35, z: 0, visibility: 0.95 };
      rawPose[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.10, y: 0.35, z: 0, visibility: 0.95 };

      // 미러 뷰에 맞춰 아바타는 화면 오른쪽(+X)으로 뻗어야 함
      renderer.update(0.016, rawPose);
      const angles = renderer.getSmoothedAngles();
      const fk = renderer.calculateFKPositions(1920, 1080);

      expect(Math.cos(angles.rightUpperArm)).toBeGreaterThan(0);
      expect(Math.cos(angles.rightForearm)).toBeGreaterThan(0);
      expect(fk.rightWrist.x).toBeGreaterThan(fk.rightShoulder.x);
    });

    it('가상 캔버스 픽셀 좌표계(1920x1080) 랜드마크가 유입되어도 스쿼트 오프셋이 폭주하지 않고 정상 범위로 보정된다', () => {
      const standPose = createSamplePoseLandmarks().map((lm) => ({
        ...lm,
        x: lm.x * 1920,
        y: lm.y * 1080,
      }));
      renderer.update(0.016, standPose);
      const standPositions = renderer.calculateFKPositions(1920, 1080);

      // 스쿼트 자세: 픽셀 Y가 100px 증가
      const squatPose = standPose.map((lm) => ({ ...lm }));
      squatPose[POSE_LANDMARKS.LEFT_HIP].y += 100;
      squatPose[POSE_LANDMARKS.RIGHT_HIP].y += 100;
      squatPose[POSE_LANDMARKS.LEFT_KNEE].y += 80;
      squatPose[POSE_LANDMARKS.RIGHT_KNEE].y += 80;

      renderer.update(0.016, squatPose);
      const squatPositions = renderer.calculateFKPositions(1920, 1080);

      const yDiff = squatPositions.pelvis.y - standPositions.pelvis.y;
      // 픽셀 좌표라도 정규화되어 10px ~ 80px 사이의 적정 오프셋이어야 함 (수만 픽셀 폭주 방지)
      expect(yDiff).toBeGreaterThan(5);
      expect(yDiff).toBeLessThan(100);
    });

    it('SettingsModal에서 스켈레톤 토글 버튼 라벨이 "🦴 스켈레톤 본"으로 복원되어 렌더링된다', () => {
      const modal = new SettingsModal();
      modal.open();
      const mockCtx = createMockCtx();

      modal.render(mockCtx, 1080, 2160);

      // 렌더링 시 "🦴 스켈레톤 본" 라벨이 드로잉되어야 함
      expect(mockCtx.fillText).toHaveBeenCalledWith(
        '🦴 스켈레톤 본',
        expect.any(Number),
        expect.any(Number),
      );
    });
  });

  describe('5. Issue #281 [FEAT-AVATAR-002] 모션 아바타 화이트 클레이(White Clay Stickman) 점토 피규어 비주얼 규격', () => {
    let renderer: StickmanRenderer;
    let mockCtx: CanvasRenderingContext2D;

    beforeEach(() => {
      renderer = new StickmanRenderer();
      mockCtx = createMockCtx();
    });

    it('사지 캡슐 폭(24~28px), 몸통 폭(40~44px), 두상 반지름(32~36px)이 도톰한 화이트 클레이 규격으로 설정되어 있다', () => {
      expect(STICKMAN_CONFIG.capsuleWidth.limb).toBeGreaterThanOrEqual(24);
      expect(STICKMAN_CONFIG.capsuleWidth.limb).toBeLessThanOrEqual(28);

      expect(STICKMAN_CONFIG.capsuleWidth.torso).toBeGreaterThanOrEqual(40);
      expect(STICKMAN_CONFIG.capsuleWidth.torso).toBeLessThanOrEqual(44);

      expect(STICKMAN_CONFIG.limbLengths.headRadius).toBeGreaterThanOrEqual(32);
      expect(STICKMAN_CONFIG.limbLengths.headRadius).toBeLessThanOrEqual(36);

      expect(STICKMAN_CONFIG.capsuleWidth.jointBall).toBeGreaterThanOrEqual(12);
      expect(STICKMAN_CONFIG.capsuleWidth.jointBall).toBeLessThanOrEqual(16);
    });

    it('순백색 점토 바디 컬러(#F8FAFC / #F1F5F9) 및 음영 테두리, 앰비언트 지면 그림자 컬러가 정의되어 있다', () => {
      const validBodyColors = ['#F8FAFC', '#F1F5F9'];
      expect(validBodyColors).toContain(STICKMAN_CONFIG.colors.body);

      const validBorderColors = ['#CBD5E1', '#94A3B8', '#E2E8F0'];
      expect(validBorderColors).toContain(STICKMAN_CONFIG.colors.bodyBorder);

      expect(STICKMAN_CONFIG.colors.groundShadow).toBeDefined();
      expect(STICKMAN_CONFIG.colors.groundShadow).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.(2[5-9]|3[0-5])\)/);

      // 인게임 11개 피트니스 존 판별을 위한 양손 네온 포인트 유지
      expect(STICKMAN_CONFIG.colors.leftLimb).toBe('#28E6FF');
      expect(STICKMAN_CONFIG.colors.rightLimb).toBe('#FFCB4D');
    });

    it('발밑에 부드러운 타원형 앰비언트 접지 그림자(Soft Drop Shadow)를 드로잉한다', () => {
      const pose = createSamplePoseLandmarks();
      renderer.update(0.016, pose);

      renderer.render(mockCtx, 1080, 2160);

      // 접지 그림자 드로잉 시 ellipse 및 fill 호출 확인
      expect(mockCtx.ellipse).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
      // createRadialGradient를 이용한 부드러운 앰비언트 감쇠 검증
      expect(mockCtx.createRadialGradient).toHaveBeenCalled();
    });

    it('기계식 바이저 슬릿 대신 매끄럽고 둥근 순백색 미니멀 구체 점토 머리를 렌더링한다', () => {
      const pose = createSamplePoseLandmarks();
      renderer.update(0.016, pose);

      // 기본 옵션에서는 showVisor가 false로 동작하여 roundRect 또는 rect 기반 바이저 슬릿을 그리지 않음
      renderer.render(mockCtx, 1080, 2160);

      expect(mockCtx.arc).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
      expect(mockCtx.roundRect).not.toHaveBeenCalled();
    });

    it('사지 및 몸통 드로잉 시 점토 입체감을 위한 베이스 바디와 부드러운 하이라이트가 드로잉된다', () => {
      const pose = createSamplePoseLandmarks();
      renderer.update(0.016, pose);

      renderer.render(mockCtx, 1080, 2160);

      // 라운드 캡슐 스트로크 호출 검증 (외곽 음영, 베이스 바디, 하이라이트 림 등)
      expect(mockCtx.stroke).toHaveBeenCalled();
      expect(mockCtx.beginPath).toHaveBeenCalled();
    });
  });

  describe('6. Issue #304 [BUG-SKEL-006] 무릎·종아리 프레이밍에서 졸라맨 다리 각도 폭주 방지', () => {
    let renderer: StickmanRenderer;

    beforeEach(() => {
      renderer = new StickmanRenderer();
    });

    it('발목 visibility가 임계값 미만(예: < 0.25 또는 undefined)인 경우 종아리(lowerLeg) 각도가 수직 기본 자세를 유지한다', () => {
      const pose = createSamplePoseLandmarks();
      // 발목 좌표가 엉뚱한 곳(예: X=0.95로 심하게 왜곡)으로 튀었으나 visibility가 낮음
      pose[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.95, y: 0.80, z: 0, visibility: 0.1 };
      pose[POSE_LANDMARKS.RIGHT_ANKLE] = { x: 0.05, y: 0.80, z: 0, visibility: 0.15 };

      // 여러 프레임 업데이트하여 수렴 확인
      for (let i = 0; i < 10; i++) {
        renderer.update(0.016, pose);
      }
      const angles = renderer.getSmoothedAngles();

      // 수직 기본 각도 (leftLowerLeg, rightLowerLeg = Math.PI * 0.50) 유지
      expect(angles.leftLowerLeg).toBeCloseTo(Math.PI * 0.50, 2);
      expect(angles.rightLowerLeg).toBeCloseTo(Math.PI * 0.50, 2);
    });

    it('발목이 화면 하단 밖(y >= 1.0 또는 1080)으로 벗어난 경우 종아리 각도가 수직 기본 자세로 폴백된다', () => {
      const pose = createSamplePoseLandmarks();
      // 화면 밖으로 잘린 발목 (y = 1.05)
      pose[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.80, y: 1.05, z: 0, visibility: 0.9 };
      pose[POSE_LANDMARKS.RIGHT_ANKLE] = { x: 0.20, y: 1.10, z: 0, visibility: 0.9 };

      for (let i = 0; i < 10; i++) {
        renderer.update(0.016, pose);
      }
      const angles = renderer.getSmoothedAngles();

      expect(angles.leftLowerLeg).toBeCloseTo(Math.PI * 0.50, 2);
      expect(angles.rightLowerLeg).toBeCloseTo(Math.PI * 0.50, 2);
    });

    it('무릎이 화면 밖(y >= 1.0)이거나 visibility 부족인 경우 허벅지(upperLeg)와 종아리 모두 기본 자세를 유지한다', () => {
      const pose = createSamplePoseLandmarks();
      // 무릎이 화면 밖으로 잘림
      pose[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.80, y: 1.02, z: 0, visibility: 0.9 };
      pose[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.20, y: 0.70, z: 0, visibility: 0.1 };

      for (let i = 0; i < 10; i++) {
        renderer.update(0.016, pose);
      }
      const angles = renderer.getSmoothedAngles();

      // leftUpperLeg: Math.PI * 0.48, leftLowerLeg: Math.PI * 0.50
      expect(angles.leftUpperLeg).toBeCloseTo(Math.PI * 0.48, 2);
      expect(angles.leftLowerLeg).toBeCloseTo(Math.PI * 0.50, 2);
      // rightUpperLeg: Math.PI * 0.52, rightLowerLeg: Math.PI * 0.50
      expect(angles.rightUpperLeg).toBeCloseTo(Math.PI * 0.52, 2);
      expect(angles.rightLowerLeg).toBeCloseTo(Math.PI * 0.50, 2);
    });

    it('다리가 잘려서 기본 각도로 폴백되더라도 팔, 어깨, 머리, 몸통 각도 추종은 정상 동작한다', () => {
      const pose = createSamplePoseLandmarks();
      // 다리 전체 잘림
      pose[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.5, y: 1.2, z: 0, visibility: 0.1 };
      pose[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.5, y: 1.2, z: 0, visibility: 0.1 };
      // 오른팔 수평 뻗기
      pose[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.55, y: 0.35, z: 0, visibility: 0.95 };
      pose[POSE_LANDMARKS.RIGHT_ELBOW] = { x: 0.75, y: 0.35, z: 0, visibility: 0.95 };
      pose[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.90, y: 0.35, z: 0, visibility: 0.95 };

      for (let i = 0; i < 10; i++) {
        renderer.update(0.016, pose);
      }
      const angles = renderer.getSmoothedAngles();

      // 오른팔은 정상적으로 오른쪽을 향해야 함
      expect(Math.cos(angles.rightUpperArm)).toBeGreaterThan(0);
      expect(Math.cos(angles.rightForearm)).toBeGreaterThan(0);
      // 다리는 기본 각도 유지
      expect(angles.leftLowerLeg).toBeCloseTo(Math.PI * 0.50, 2);
      expect(angles.rightLowerLeg).toBeCloseTo(Math.PI * 0.50, 2);
    });
  });
});
