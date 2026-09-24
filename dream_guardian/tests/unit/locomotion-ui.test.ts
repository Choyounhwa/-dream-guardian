import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LocomotionModal,
  LOCOMOTION_MODES,
  type LocomotionModeInfo,
} from '../../src/ui/LocomotionModal.js';
import type { LocomotionMode } from '../../src/motion/LocomotionDetector.js';

describe('LocomotionModal (Issue #154 / FEAT-UI-006)', () => {
  let modal: LocomotionModal;
  const W = 1080;
  const H = 2160;

  beforeEach(() => {
    // Clear localStorage mock
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, val: string) => {
        store[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        for (const k of Object.keys(store)) delete store[k];
      }),
    });

    modal = new LocomotionModal();
  });

  describe('운동 모드 4종 메타데이터', () => {
    it('4가지 이동 모드(달리기, 골반 바운스, 골반 스웨이, 양손 교차)가 정의되어 있다', () => {
      expect(LOCOMOTION_MODES.length).toBe(4);
      const modeIds = LOCOMOTION_MODES.map((m: LocomotionModeInfo) => m.mode);
      expect(modeIds).toEqual(['run', 'hip_bounce', 'hip_sway', 'arm_cross']);
    });

    it('각 모드에 한국어 라벨, 아이콘, 부위, 소음 안내가 포함되어 있다', () => {
      for (const m of LOCOMOTION_MODES) {
        expect(m.label).toBeTruthy();
        expect(m.icon).toBeTruthy();
        expect(m.targetPart).toBeTruthy();
        expect(m.noiseLevel).toBeTruthy();
      }
    });
  });

  describe('상태 관리 및 모달 열기/닫기', () => {
    it('초기 상태는 닫혀 있고 기본 모드는 run이다', () => {
      expect(modal.isOpen).toBe(false);
      expect(modal.selectedMode).toBe('run');
    });

    it('open(), close(), toggle()이 정상 동작한다', () => {
      modal.open();
      expect(modal.isOpen).toBe(true);
      modal.close();
      expect(modal.isOpen).toBe(false);
      modal.toggle();
      expect(modal.isOpen).toBe(true);
    });

    it('selectMode()로 모드를 변경할 수 있다', () => {
      modal.selectMode('hip_bounce');
      expect(modal.selectedMode).toBe('hip_bounce');
    });
  });

  describe('2x2 카드 그리드 레이아웃', () => {
    it('4개 모드 카드가 2x2 형태로 배치되며 상호 겹치지 않는다', () => {
      const modes: LocomotionMode[] = ['run', 'hip_bounce', 'hip_sway', 'arm_cross'];
      const layouts = modes.map((m) => modal.getCardLayout(m, W, H));

      // 4개 슬롯 유효성 검사
      for (const l of layouts) {
        expect(l.w).toBeGreaterThan(200);
        expect(l.h).toBeGreaterThan(150);
      }

      // 2x2 형태 검증: row 0은 run & hip_bounce, row 1은 hip_sway & arm_cross
      expect(layouts[0].y).toBeCloseTo(layouts[1].y, 1);
      expect(layouts[2].y).toBeCloseTo(layouts[3].y, 1);
      expect(layouts[2].y).toBeGreaterThan(layouts[0].y);
      expect(layouts[1].x).toBeGreaterThan(layouts[0].x);
      expect(layouts[3].x).toBeGreaterThan(layouts[2].x);

      // 상호 겹침 검사
      for (let i = 0; i < layouts.length; i++) {
        for (let j = i + 1; j < layouts.length; j++) {
          const a = layouts[i];
          const b = layouts[j];
          const overlap =
            a.x < b.x + b.w &&
            a.x + a.w > b.x &&
            a.y < b.y + b.h &&
            a.y + a.h > b.y;
          expect(overlap).toBe(false);
        }
      }
    });
  });

  describe('클릭 인터랙션 (handleClick)', () => {
    it('모달이 닫혀 있을 때는 클릭이 무시된다', () => {
      const res = modal.handleClick(500, 500, W, H);
      expect(res).toBeNull();
    });

    it('카드 클릭 시 해당 모드가 선택되고 select 액션이 반환된다', () => {
      modal.open();
      const layout = modal.getCardLayout('hip_sway', W, H);
      const res = modal.handleClick(layout.x + layout.w / 2, layout.y + layout.h / 2, W, H);

      expect(res).toEqual({ action: 'select', mode: 'hip_sway' });
      expect(modal.selectedMode).toBe('hip_sway');
    });

    it('닫기 버튼 클릭 시 close 액션이 반환된다', () => {
      modal.open();
      const closeBtn = modal.getCloseButtonLayout(W, H);
      const res = modal.handleClick(closeBtn.x + closeBtn.w / 2, closeBtn.y + closeBtn.h / 2, W, H);
      expect(res?.action).toBe('close');
      expect(modal.isOpen).toBe(false);
    });

    it('모달 바깥 클릭 시 backdrop-close가 반환된다', () => {
      modal.open();
      const res = modal.handleClick(10, 10, W, H);
      expect(res?.action).toBe('backdrop-close');
    });
  });

  describe('신체 커서 체류 (updateHover)', () => {
    it('카드 위에 0.8초 미만 체류 시 진행도가 증가한다', () => {
      modal.open();
      const layout = modal.getCardLayout('arm_cross', W, H);
      const cx = layout.x + layout.w / 2;
      const cy = layout.y + layout.h / 2;

      const res1 = modal.updateHover(cx, cy, W, H, 0.4);
      expect(res1.hoveredMode).toBe('arm_cross');
      expect(res1.progress).toBeCloseTo(0.5, 1);
      expect(res1.modeSelected).toBeUndefined();
    });

    it('카드 위에 0.8초 이상 체류 시 모드가 자동 선택된다', () => {
      modal.open();
      const layout = modal.getCardLayout('arm_cross', W, H);
      const cx = layout.x + layout.w / 2;
      const cy = layout.y + layout.h / 2;

      modal.updateHover(cx, cy, W, H, 0.5);
      const res2 = modal.updateHover(cx, cy, W, H, 0.4); // 누적 0.9s >= 0.8s
      expect(res2.modeSelected).toBe('arm_cross');
      expect(modal.selectedMode).toBe('arm_cross');
    });

    it('커서가 카드 밖으로 이동하면 체류 진행도가 리셋된다', () => {
      modal.open();
      const layout = modal.getCardLayout('arm_cross', W, H);
      modal.updateHover(layout.x + 10, layout.y + 10, W, H, 0.4);
      expect(modal.hoverProgress).toBeGreaterThan(0);

      modal.updateHover(0, 0, W, H, 0.1);
      expect(modal.hoverProgress).toBe(0);
      expect(modal.hoveredCard).toBeNull();
    });
  });

  describe('localStorage 영속 저장 및 복원', () => {
    it('모드 선택 시 localStorage에 dg_locomotion_mode로 자동 저장된다', () => {
      modal.selectMode('hip_bounce');
      expect(localStorage.setItem).toHaveBeenCalledWith('dg_locomotion_mode', 'hip_bounce');
    });

    it('인스턴스 생성 시 localStorage에 저장된 모드를 복원한다', () => {
      localStorage.setItem('dg_locomotion_mode', 'arm_cross');
      const newModal = new LocomotionModal();
      expect(newModal.selectedMode).toBe('arm_cross');
    });

    it('localStorage에 잘못된 값이 저장되어 있으면 기본값 run으로 안전 폴백한다', () => {
      localStorage.setItem('dg_locomotion_mode', 'invalid_mode');
      const newModal = new LocomotionModal();
      expect(newModal.selectedMode).toBe('run');
    });
  });

  describe('render() Canvas 렌더링', () => {
    it('열려 있을 때 캔버스에 에러 없이 렌더링된다', () => {
      modal.open();
      const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        roundRect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn(() => ({ width: 100 })),
      } as unknown as CanvasRenderingContext2D;

      expect(() => modal.render(ctx, W, H)).not.toThrow();
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });
  });
});
