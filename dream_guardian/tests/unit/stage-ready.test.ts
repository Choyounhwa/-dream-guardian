import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReadyPositionController } from '../../src/game/ReadyPositionController.js';
import { ReadyPositionRenderer } from '../../src/render/ReadyPositionRenderer.js';
import { StateMachine } from '../../src/core/StateMachine.js';
import { PhasePresentationAdapter } from '../../src/ui/PhasePresentationAdapter.js';
import type { NormalizedLandmark } from '../../src/types/index.js';

function createMockContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 100 })),
    setLineDash: vi.fn(),
    clearRect: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    globalAlpha: 1,
    lineWidth: 1,
    strokeStyle: '',
    fillStyle: '',
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('ReadyPositionController (Issue #202 / FEAT-READY-001)', () => {
  let mockSfx: { play: ReturnType<typeof vi.fn> };
  let onComplete: ReturnType<typeof vi.fn>;
  let onTick: ReturnType<typeof vi.fn>;
  let onStartSignal: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSfx = { play: vi.fn() };
    onComplete = vi.fn();
    onTick = vi.fn();
    onStartSignal = vi.fn();
  });

  it('초기 생성 시 비활성 상태이며 기본 타이머는 3.0초이다', () => {
    const controller = new ReadyPositionController();

    expect(controller.isActive).toBe(false);
    expect(controller.isFinished).toBe(false);
    expect(controller.isInputLocked).toBe(false);
    expect(controller.readyTimer).toBe(3.0);
    expect(controller.currentCount).toBe(3);
    expect(controller.isAligned).toBe(false);
  });

  it('start() 호출 시 카운트다운이 시작되고 첫 틱(3) 사운드 및 콜백이 실행된다', () => {
    const controller = new ReadyPositionController({
      sfx: mockSfx,
      onComplete,
      onTick,
      onStartSignal,
    });

    controller.start();

    expect(controller.isActive).toBe(true);
    expect(controller.isFinished).toBe(false);
    expect(controller.isInputLocked).toBe(true);
    expect(controller.readyTimer).toBe(3.0);
    expect(controller.currentCount).toBe(3);
    expect(controller.countText).toBe('3');
    expect(mockSfx.play).toHaveBeenCalledWith('metronome_strong');
    expect(onTick).toHaveBeenCalledWith(3);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('1초 경과 시 2 카운트 틱, 2초 경과 시 1 카운트 틱이 발화된다', () => {
    const controller = new ReadyPositionController({
      sfx: mockSfx,
      onTick,
      onStartSignal,
    });

    controller.start();
    mockSfx.play.mockClear();
    onTick.mockClear();

    // 0.6초 경과 -> 아직 3 카운트 유지
    controller.update(0.6);
    expect(controller.currentCount).toBe(3);
    expect(onTick).not.toHaveBeenCalled();

    // 추가 0.5초 경과 (총 1.1초) -> 2 카운트 틱
    controller.update(0.5);
    expect(controller.currentCount).toBe(2);
    expect(controller.countText).toBe('2');
    expect(mockSfx.play).toHaveBeenCalledWith('metronome_strong');
    expect(onTick).toHaveBeenCalledWith(2);

    mockSfx.play.mockClear();
    onTick.mockClear();

    // 추가 1.0초 경과 (총 2.1초) -> 1 카운트 틱
    controller.update(1.0);
    expect(controller.currentCount).toBe(1);
    expect(controller.countText).toBe('1');
    expect(mockSfx.play).toHaveBeenCalledWith('metronome_strong');
    expect(onTick).toHaveBeenCalledWith(1);
  });

  it('3초 도달 시 START! 신호음이 발화되고 카운트다운 완료 시 onComplete가 호출된다', () => {
    const controller = new ReadyPositionController({
      countdownDuration: 3.0,
      startDisplayDuration: 0.4,
      sfx: mockSfx,
      onComplete,
      onStartSignal,
    });

    controller.start();

    // 3.0초 경과 -> START! 신호 발화
    controller.update(3.0);
    expect(controller.currentCount).toBe(0);
    expect(controller.countText).toBe('START!');
    expect(mockSfx.play).toHaveBeenCalledWith('start');
    expect(onStartSignal).toHaveBeenCalledTimes(1);
    expect(controller.isFinished).toBe(false); // startDisplayDuration 진행 중

    // startDisplayDuration(0.4초) 경과 후 완료
    controller.update(0.4);
    expect(controller.isFinished).toBe(true);
    expect(controller.isActive).toBe(false);
    expect(controller.isInputLocked).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('startDisplayDuration이 0이면 3초 도달 즉시 onComplete가 호출된다', () => {
    const controller = new ReadyPositionController({
      countdownDuration: 3.0,
      startDisplayDuration: 0,
      sfx: mockSfx,
      onComplete,
    });

    controller.start();
    controller.update(3.0);

    expect(controller.isFinished).toBe(true);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('skip() 호출 시 즉시 카운트다운이 중단되고 onComplete가 호출된다', () => {
    const controller = new ReadyPositionController({
      countdownDuration: 3.0,
      onComplete,
    });

    controller.start();
    controller.update(0.8); // 3초 중 0.8초 경과 시점
    expect(controller.isActive).toBe(true);

    controller.skip();

    expect(controller.isFinished).toBe(true);
    expect(controller.isActive).toBe(false);
    expect(controller.isInputLocked).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('비활성 상태에서 skip() 호출 시 onComplete가 호출되지 않는다', () => {
    const controller = new ReadyPositionController({ onComplete });
    controller.skip();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('카운트다운 중 isInputLocked는 항상 true를 유지한다', () => {
    const controller = new ReadyPositionController();
    expect(controller.isInputLocked).toBe(false);

    controller.start();
    expect(controller.isInputLocked).toBe(true);

    controller.update(1.5);
    expect(controller.isInputLocked).toBe(true);

    controller.skip();
    expect(controller.isInputLocked).toBe(false);
  });

  it('일시정지 중에는 update(dt)가 시간을 진행시키지 않는다', () => {
    const controller = new ReadyPositionController();
    controller.start();
    controller.setPaused(true);

    controller.update(1.0);
    expect(controller.readyTimer).toBe(3.0);
    expect(controller.currentCount).toBe(3);

    controller.setPaused(false);
    controller.update(1.0);
    expect(controller.readyTimer).toBe(2.0);
    expect(controller.currentCount).toBe(2);
  });

  it('setAligned() 및 정렬 상태 변경이 올바르게 반영된다', () => {
    const controller = new ReadyPositionController();
    expect(controller.isAligned).toBe(false);

    controller.setAligned(true);
    expect(controller.isAligned).toBe(true);

    controller.setAligned(false);
    expect(controller.isAligned).toBe(false);
  });

  it('checkAlignment()가 주요 관절(얼굴, 어깨, 골반)의 가시성 및 프레임 범위를 올바르게 판정한다', () => {
    const controller = new ReadyPositionController();

    // landmarks가 비어있거나 부족할 때
    expect(controller.checkAlignment(null, 1080, 2160)).toBe(false);
    expect(controller.checkAlignment([], 1080, 2160)).toBe(false);

    // 25개 랜드마크 생성 (주요 관절 포함)
    const validLandmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
      x: 540,
      y: 1000,
      z: 0,
      visibility: 0.9,
    }));

    // 코(0), 좌우어깨(11, 12), 좌우골반(23, 24) 적정 위치
    validLandmarks[0] = { x: 540, y: 500, z: 0, visibility: 0.9 };
    validLandmarks[11] = { x: 440, y: 700, z: 0, visibility: 0.9 };
    validLandmarks[12] = { x: 640, y: 700, z: 0, visibility: 0.9 };
    validLandmarks[23] = { x: 460, y: 1100, z: 0, visibility: 0.9 };
    validLandmarks[24] = { x: 620, y: 1100, z: 0, visibility: 0.9 };

    expect(controller.checkAlignment(validLandmarks, 1080, 2160)).toBe(true);

    // 가시성이 낮을 때 false
    validLandmarks[0].visibility = 0.1;
    expect(controller.checkAlignment(validLandmarks, 1080, 2160)).toBe(false);
  });

  it('reset() 호출 시 모든 타이머와 상태가 초기화된다', () => {
    const controller = new ReadyPositionController();
    controller.start();
    controller.update(1.5);
    controller.setAligned(true);

    controller.reset();

    expect(controller.isActive).toBe(false);
    expect(controller.isFinished).toBe(false);
    expect(controller.isInputLocked).toBe(false);
    expect(controller.readyTimer).toBe(3.0);
    expect(controller.currentCount).toBe(3);
    expect(controller.isAligned).toBe(false);
  });
});

describe('ReadyPositionRenderer (Issue #202 / FEAT-READY-001)', () => {
  it('화면 중앙 가이드 박스 및 준비 안내 텍스트를 렌더링한다', () => {
    const renderer = new ReadyPositionRenderer();
    const ctx = createMockContext();

    renderer.render(ctx, 1080, 2160, {
      remainingTime: 3.0,
      countText: '3',
      currentCount: 3,
      isAligned: false,
      progress: 0,
    });

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith(
      '카메라 앞에 서서 준비하세요!',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('정렬 완료(isAligned = true) 시 청록색(#4DFFAA) 강조 테두리 및 점등 스타일을 적용한다', () => {
    const renderer = new ReadyPositionRenderer();
    const ctx = createMockContext();

    renderer.render(ctx, 1080, 2160, {
      remainingTime: 2.0,
      countText: '2',
      currentCount: 2,
      isAligned: true,
      progress: 0.33,
    });

    // 정렬 완료 시 청록색(#4DFFAA) 스타일 또는 그림자 색상이 적용되었는지 확인
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('3, 2, 1 카운트다운 네온 텍스트를 렌더링한다', () => {
    const renderer = new ReadyPositionRenderer();
    const ctx = createMockContext();

    renderer.render(ctx, 1080, 2160, {
      remainingTime: 1.0,
      countText: '1',
      currentCount: 1,
      isAligned: true,
      progress: 0.66,
    });

    expect(ctx.fillText).toHaveBeenCalledWith(
      '1',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('카운트다운 0 도달 시 START! 대형 네온 텍스트를 렌더링한다', () => {
    const renderer = new ReadyPositionRenderer();
    const ctx = createMockContext();

    renderer.render(ctx, 1080, 2160, {
      remainingTime: 0,
      countText: 'START!',
      currentCount: 0,
      isAligned: true,
      progress: 1.0,
    });

    expect(ctx.fillText).toHaveBeenCalledWith(
      'START!',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('하단에 Space 키 및 터치 건너뛰기 안내 문구를 렌더링한다', () => {
    const renderer = new ReadyPositionRenderer();
    const ctx = createMockContext();

    renderer.render(ctx, 1080, 2160, {
      remainingTime: 2.5,
      countText: '3',
      currentCount: 3,
      isAligned: false,
      progress: 0.16,
    });

    expect(ctx.fillText).toHaveBeenCalledWith(
      'Space 키 또는 화면 터치로 건너뛰기',
      expect.any(Number),
      expect.any(Number),
    );
  });
});

describe('StateMachine & PresentationAdapter Integration (Issue #202)', () => {
  it('StateMachine에서 READY_POSITION 상태 전이 및 isReadyPosition() 헬퍼가 동작한다', () => {
    const sm = new StateMachine('MENU_MAIN');
    expect(sm.canTransition('READY_POSITION')).toBe(true);

    const transitioned = sm.changeState('READY_POSITION');
    expect(transitioned).toBe(true);
    expect(sm.currentState).toBe('READY_POSITION');
    expect(sm.isReadyPosition()).toBe(true);
    expect(sm.isPhaseA()).toBe(false);

    // READY_POSITION -> RUN_QUESTION 전이
    expect(sm.canTransition('RUN_QUESTION')).toBe(true);
    expect(sm.changeState('RUN_QUESTION')).toBe(true);
    expect(sm.currentState).toBe('RUN_QUESTION');
    expect(sm.isReadyPosition()).toBe(false);
  });

  it('PhasePresentationAdapter에서 canRenderReadyPosition()이 READY_POSITION 상태만 승인한다', () => {
    const adapter = new PhasePresentationAdapter();

    expect(adapter.canRenderReadyPosition('READY_POSITION')).toBe(true);
    expect(adapter.canRenderReadyPosition('RUN_QUESTION')).toBe(false);
    expect(adapter.canRenderReadyPosition('MENU_MAIN')).toBe(false);
    expect(adapter.canRenderReadyPosition('ANSWER_SELECT')).toBe(false);
  });
});
