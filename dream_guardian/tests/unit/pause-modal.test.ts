import { describe, it, expect, beforeEach } from 'vitest';
import { PauseModal, PAUSE_DWELL_TIME } from '../../src/ui/PauseModal.js';

describe('PauseModal (Issue #172 / UI-PAUSE-001)', () => {
  let modal: PauseModal;
  const W = 1080;
  const H = 2160;

  beforeEach(() => {
    modal = new PauseModal();
  });

  describe('초기 상태 및 열기/닫기', () => {
    it('초기 상태는 닫혀 있고(isOpen=false) 호버 진행도는 0이다', () => {
      expect(modal.isOpen).toBe(false);
      expect(modal.hoverAction).toBeNull();
      expect(modal.hoverProgress).toBe(0);
    });

    it('open(), close(), toggle()이 상태를 정상 전환한다', () => {
      modal.open();
      expect(modal.isOpen).toBe(true);
      modal.close();
      expect(modal.isOpen).toBe(false);
      modal.toggle();
      expect(modal.isOpen).toBe(true);
      modal.toggle();
      expect(modal.isOpen).toBe(false);
    });
  });

  describe('버튼 레이아웃 및 영역 검증', () => {
    it('계속하기(resume) 및 나가기(quit) 버튼 영역이 정상 크기이며 겹치지 않는다', () => {
      const resumeSlot = modal.getButtonLayout('resume', W, H);
      const quitSlot = modal.getButtonLayout('quit', W, H);

      expect(resumeSlot.w).toBeGreaterThan(400);
      expect(resumeSlot.h).toBeGreaterThan(100);
      expect(quitSlot.w).toBeGreaterThan(400);
      expect(quitSlot.h).toBeGreaterThan(100);

      // 상하 배치로 세로 영역이 겹치지 않음
      expect(quitSlot.y).toBeGreaterThanOrEqual(resumeSlot.y + resumeSlot.h);
    });

    it('hitTest가 클릭 위치에 따라 resume, quit, backdrop을 정확히 판별한다', () => {
      const resumeSlot = modal.getButtonLayout('resume', W, H);
      const quitSlot = modal.getButtonLayout('quit', W, H);

      // resume 중심
      expect(modal.hitTest(resumeSlot.x + resumeSlot.w / 2, resumeSlot.y + resumeSlot.h / 2, W, H)).toBe('resume');

      // quit 중심
      expect(modal.hitTest(quitSlot.x + quitSlot.w / 2, quitSlot.y + quitSlot.h / 2, W, H)).toBe('quit');

      // 화면 모서리 (배경 클릭)
      expect(modal.hitTest(20, 20, W, H)).toBe('backdrop');
    });
  });

  describe('양손 합장 호버 체류(Dwell Time) 판정', () => {
    it('resume 버튼에 커서를 올리면 진행도가 증가하고 0.8초 경과 시 action: resume을 반환한다', () => {
      modal.open();
      const resumeSlot = modal.getButtonLayout('resume', W, H);
      const hx = resumeSlot.x + resumeSlot.w / 2;
      const hy = resumeSlot.y + resumeSlot.h / 2;

      // 0.4초 호버 (진행도 약 50%)
      const mid = modal.updateHover(hx, hy, W, H, 0.4);
      expect(mid.action).toBeNull();
      expect(mid.progress).toBeCloseTo(0.5, 2);
      expect(modal.hoverAction).toBe('resume');

      // 추가 0.4초 호버 (누적 0.8초 도달)
      const complete = modal.updateHover(hx, hy, W, H, 0.4);
      expect(complete.action).toBe('resume');
      expect(complete.progress).toBe(1.0);
    });

    it('quit 버튼에 커서를 올리고 0.8초 경과 시 action: quit을 반환한다', () => {
      modal.open();
      const quitSlot = modal.getButtonLayout('quit', W, H);
      const hx = quitSlot.x + quitSlot.w / 2;
      const hy = quitSlot.y + quitSlot.h / 2;

      modal.updateHover(hx, hy, W, H, PAUSE_DWELL_TIME);
      expect(modal.hoverAction).toBe('quit');
      expect(modal.hoverProgress).toBe(1.0);
    });

    it('호버 도중 버튼 밖으로 벗어나면 진행도가 초기화된다', () => {
      modal.open();
      const resumeSlot = modal.getButtonLayout('resume', W, H);
      modal.updateHover(resumeSlot.x + 50, resumeSlot.y + 50, W, H, 0.4);
      expect(modal.hoverProgress).toBeCloseTo(0.5, 2);

      // 버튼 밖으로 이탈
      const out = modal.updateHover(10, 10, W, H, 0.1);
      expect(out.action).toBeNull();
      expect(out.progress).toBe(0);
      expect(modal.hoverAction).toBeNull();
    });
  });

  describe('Canvas 렌더링 검증', () => {
    it('render() 실행 시 예외 없이 정상 드로잉을 완료한다', () => {
      const dummyCtx = {
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        closePath: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        fillText: () => {},
        measureText: () => ({ width: 100 }),
        roundRect: () => {},
      } as unknown as CanvasRenderingContext2D;

      modal.open();
      expect(() => modal.render(dummyCtx, W, H)).not.toThrow();

      modal.close();
      expect(() => modal.render(dummyCtx, W, H)).not.toThrow();
    });
  });
});
