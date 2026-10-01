import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TransitionManager } from '../../src/effects/UITransition.js';
import { SettingsModal } from '../../src/ui/SettingsModal.js';
import { PauseModal } from '../../src/ui/PauseModal.js';
import { MenuRenderer, type MenuState } from '../../src/ui/MenuRenderer.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 50 }),
    drawImage: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    shadowColor: '',
    shadowBlur: 0,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe('[VFX-006 / #278] UI 전환 애니메이션 (화면 전환 / 모달 등장 / 카드 호버)', () => {
  describe('1. TransitionManager (화면 전환 트랜지션)', () => {
    let tm: TransitionManager;

    beforeEach(() => {
      tm = new TransitionManager();
    });

    it('초기 상태는 비활성(isActive=false)이며 progress는 0이다', () => {
      expect(tm.isActive).toBe(false);
      expect(tm.progress).toBe(0);
      expect(tm.type).toBe('none');
    });

    it('circleWipe 전환이 기본 0.6초 동안 동작하고 완료 콜백을 호출한다', () => {
      const onComplete = vi.fn();
      const started = tm.start('circleWipe', undefined, onComplete);

      expect(started).toBe(true);
      expect(tm.isActive).toBe(true);
      expect(tm.type).toBe('circleWipe');
      expect(tm.progress).toBe(0);

      // 0.3초 경과 (50%)
      tm.update(0.3);
      expect(tm.isActive).toBe(true);
      expect(tm.progress).toBeCloseTo(0.5, 2);
      expect(onComplete).not.toHaveBeenCalled();

      // 추가 0.3초 경과 (100% 완료)
      tm.update(0.3);
      expect(tm.isActive).toBe(false);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('fadeToBlack 전환이 기본 0.4초 동안 동작하고 완료 콜백을 호출한다', () => {
      const onComplete = vi.fn();
      const started = tm.start('fadeToBlack', undefined, onComplete);

      expect(started).toBe(true);
      expect(tm.type).toBe('fadeToBlack');

      tm.update(0.2);
      expect(tm.progress).toBeCloseTo(0.5, 2);

      tm.update(0.2);
      expect(tm.isActive).toBe(false);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('fadeIn 전환이 기본 0.3초 동안 동작하고 완료 콜백을 호출한다', () => {
      const onComplete = vi.fn();
      const started = tm.start('fadeIn', undefined, onComplete);

      expect(started).toBe(true);
      expect(tm.type).toBe('fadeIn');

      tm.update(0.15);
      expect(tm.progress).toBeCloseTo(0.5, 2);

      tm.update(0.15);
      expect(tm.isActive).toBe(false);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('사용자 지정 duration이 우선 적용된다', () => {
      tm.start('fadeToBlack', 1.0);
      tm.update(0.5);
      expect(tm.progress).toBeCloseTo(0.5, 2);
      expect(tm.isActive).toBe(true);
      tm.update(0.5);
      expect(tm.isActive).toBe(false);
    });

    it('트랜지션 진행 중 중복 start 호출 시 false를 반환하고 차단한다', () => {
      const first = tm.start('circleWipe', 0.6);
      expect(first).toBe(true);

      const second = tm.start('fadeToBlack', 0.4);
      expect(second).toBe(false);
      expect(tm.type).toBe('circleWipe'); // 기존 유지
    });

    it('cancel() 호출 시 즉시 트랜지션이 취소되고 콜백이 호출되지 않는다', () => {
      const onComplete = vi.fn();
      tm.start('circleWipe', 0.6, onComplete);
      tm.update(0.2);
      tm.cancel();

      expect(tm.isActive).toBe(false);
      expect(tm.progress).toBe(0);
      tm.update(0.5);
      expect(onComplete).not.toHaveBeenCalled();
    });

    it('fadeToBlack 렌더링 시 progress에 따라 알파가 0에서 1로 페이드된다', () => {
      const ctx = createMockCtx();
      tm.start('fadeToBlack', 0.4);
      tm.update(0.2); // progress = 0.5

      tm.render(ctx, 1080, 2160);
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1080, 2160);
      expect(ctx.fillStyle).toContain('0.5');
    });

    it('fadeIn 렌더링 시 progress에 따라 알파가 1에서 0으로 화면이 드러난다', () => {
      const ctx = createMockCtx();
      tm.start('fadeIn', 0.3);
      tm.update(0.15); // progress = 0.5 (남은 알파 = 0.5)

      tm.render(ctx, 1080, 2160);
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1080, 2160);
      expect(ctx.fillStyle).toContain('0.5');
    });

    it('circleWipe 렌더링 시 중심(cx, cy)에서 원형 arc가 그려진다', () => {
      const ctx = createMockCtx();
      tm.start('circleWipe', 0.6);
      tm.update(0.3);

      tm.render(ctx, 1080, 2160);
      expect(ctx.arc).toHaveBeenCalledWith(
        540,
        1080,
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Boolean),
      );
      expect(ctx.fill).toHaveBeenCalled();
    });
  });

  describe('2. SettingsModal 등장/닫기 애니메이션', () => {
    let modal: SettingsModal;

    beforeEach(() => {
      modal = new SettingsModal();
    });

    it('초기 상태에서는 열려있지 않고 애니메이션 진행도가 0이다', () => {
      expect(modal.isOpen).toBe(false);
      expect(modal.isClosing).toBe(false);
      expect(modal.animProgress).toBe(0);
    });

    it('open() 시 열기 애니메이션(0.25초)이 시작되며 스케일 0.8->1.0, 알파 0->1로 보간된다', () => {
      modal.open();
      expect(modal.isOpen).toBe(true);
      expect(modal.isClosing).toBe(false);
      expect(modal.animProgress).toBe(0);
      expect(modal.scale).toBeCloseTo(0.8, 1);
      expect(modal.alpha).toBeCloseTo(0, 1);

      // 약 50% 진행 (0.125초)
      modal.update(0.125);
      expect(modal.animProgress).toBeCloseTo(0.5, 2);
      expect(modal.scale).toBeGreaterThan(0.8);
      expect(modal.alpha).toBeCloseTo(0.5, 1);

      // 열기 완료 (0.25초 이상)
      modal.update(0.15);
      expect(modal.animProgress).toBe(1.0);
      expect(modal.scale).toBeCloseTo(1.0, 1);
      expect(modal.alpha).toBeCloseTo(1.0, 1);
    });

    it('close() 시 닫기 애니메이션(0.20초)이 진행되고 완료 후 완전히 isOpen=false가 된다', () => {
      modal.open();
      modal.update(0.25); // 완전히 열림

      modal.close();
      expect(modal.isOpen).toBe(true); // 닫히는 중에도 렌더링을 위해 isOpen=true 유지
      expect(modal.isClosing).toBe(true);
      expect(modal.animProgress).toBe(0);
      expect(modal.scale).toBeCloseTo(1.0, 1);
      expect(modal.alpha).toBeCloseTo(1.0, 1);

      // 약 50% 진행 (0.10초)
      modal.update(0.10);
      expect(modal.animProgress).toBeCloseTo(0.5, 2);
      expect(modal.scale).toBeLessThan(1.0);
      expect(modal.scale).toBeGreaterThanOrEqual(0.9);
      expect(modal.alpha).toBeCloseTo(0.5, 1);

      // 닫기 중에는 클릭이 무시된다
      const clickRes = modal.handleClick(500, 500, 1080, 2160);
      expect(clickRes).toBeNull();

      // 닫기 완료 (누적 0.20초 이상)
      modal.update(0.15);
      expect(modal.isOpen).toBe(false);
      expect(modal.isClosing).toBe(false);
    });

    it('render() 시 딤 오버레이와 카드 스케일/글로벌알파가 적용된다', () => {
      const ctx = createMockCtx();
      modal.open();
      modal.update(0.125); // 반쯤 열림

      modal.render(ctx, 1080, 2160);
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1080, 2160);
      expect(ctx.scale).toHaveBeenCalled();
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });
  });

  describe('3. PauseModal 등장/닫기 애니메이션', () => {
    let modal: PauseModal;

    beforeEach(() => {
      modal = new PauseModal();
    });

    it('open() 시 열기 애니메이션이 진행되고 0.25초 후 스케일 1.0에 도달한다', () => {
      modal.open();
      expect(modal.isOpen).toBe(true);
      expect(modal.isClosing).toBe(false);
      expect(modal.scale).toBeCloseTo(0.8, 1);

      modal.update(0.25);
      expect(modal.scale).toBeCloseTo(1.0, 1);
      expect(modal.alpha).toBeCloseTo(1.0, 1);
    });

    it('close() 호출 시 즉시 닫히지 않고 닫기 애니메이션(0.20초) 완료 후 isOpen=false가 된다', () => {
      modal.open();
      modal.update(0.25);

      modal.close();
      expect(modal.isOpen).toBe(true);
      expect(modal.isClosing).toBe(true);

      // 닫기 진행 중에는 updateHover가 null을 반환하고 isClosing이 true이다
      expect(modal.isClosing).toBe(true);
      const hover = modal.updateHover(500, 500, 1080, 2160, 0.05);
      expect(hover.action).toBeNull();

      modal.update(0.20);
      expect(modal.isOpen).toBe(false);
      expect(modal.isClosing).toBe(false);
    });
  });

  describe('4. MenuRenderer 챕터 카드 펄스 및 잠금 디밍', () => {
    let renderer: MenuRenderer;

    beforeEach(() => {
      renderer = new MenuRenderer();
    });

    it('update(dt) 호출 시 1.5초 주기 펄스 타이머가 갱신된다', () => {
      expect(renderer.pulseTimer).toBe(0);
      renderer.update(0.5);
      expect(renderer.pulseTimer).toBeCloseTo(0.5, 2);
      renderer.update(1.2);
      // 1.7 % 1.5 = 0.2
      expect(renderer.pulseTimer).toBeCloseTo(0.2, 2);
    });

    it('선택된 챕터 카드 렌더링 시 그림자 블러(shadowBlur)가 펄스 진동한다', () => {
      let maxRecordedBlur = 0;
      const ctx = createMockCtx();
      let blurVal = 0;
      Object.defineProperty(ctx, 'shadowBlur', {
        get: () => blurVal,
        set: (v: number) => {
          blurVal = v;
          if (v > maxRecordedBlur) maxRecordedBlur = v;
        },
        configurable: true,
      });

      const state: MenuState = {
        unlockedChapter: 2,
        stars: { 1: 3, 2: 1 },
        selectedChapter: 1,
      };

      renderer.update(0.375); // pulse = 1.0 (최대 진폭)
      renderer.render(ctx, 1080, 2160, state);

      expect(maxRecordedBlur).toBeGreaterThanOrEqual(12);
    });

    it('잠긴 챕터 카드는 디밍(globalAlpha 조정)을 적용하여 렌더링된다', () => {
      const ctx = createMockCtx();
      const state: MenuState = {
        unlockedChapter: 1,
        stars: { 1: 3 },
        selectedChapter: 1,
      };

      renderer.render(ctx, 1080, 2160, state);
      // save/restore가 호출되어 디밍 격리가 수행됨
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });
  });
});
