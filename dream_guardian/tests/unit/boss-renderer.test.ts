import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { BossRenderer } from '../../src/render/BossRenderer.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
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

describe('BossRenderer - 5 Procedural Bosses (Issue #25)', () => {
  const ctx = createMockCtx();

  it('5개 챕터 보스(Ch.1~Ch.5)가 예외 없이 렌더링된다', () => {
    const renderer = new BossRenderer();

    // Ch.1 포겟
    expect(() => renderer.render(ctx, 1, 500, 300, 80, 'idle')).not.toThrow();

    // Ch.2 후다닥
    expect(() => renderer.render(ctx, 2, 500, 300, 80, 'idle')).not.toThrow();

    // Ch.3 뒤죽박죽
    expect(() => renderer.render(ctx, 3, 500, 300, 80, 'idle')).not.toThrow();

    // Ch.4 에라
    expect(() => renderer.render(ctx, 4, 500, 300, 80, 'idle')).not.toThrow();

    // Ch.5 나이트메어
    expect(() => renderer.render(ctx, 5, 500, 300, 80, 'idle')).not.toThrow();
  });

  it('모든 보스 페이즈(idle, warning, attacking, defeated)를 정상 처리한다', () => {
    const renderer = new BossRenderer();
    const phases = ['idle', 'warning', 'attacking', 'defeated'] as const;

    for (const phase of phases) {
      expect(() => renderer.render(ctx, 1, 400, 200, 60, phase)).not.toThrow();
    }
  });

  it('피격(triggerHit) 시 흔들림과 플래시가 활성화되고 update로 점차 소멸한다', () => {
    const renderer = new BossRenderer();
    renderer.triggerHit();

    // 피격 상태 렌더링 (플래시 합성 처리 확인)
    renderer.render(ctx, 1, 400, 200, 60, 'idle');
    expect(ctx.translate).toHaveBeenCalled();

    // 0.4초 후 피격 타이머 종료
    renderer.update(0.4);
    expect(() => renderer.render(ctx, 1, 400, 200, 60, 'idle')).not.toThrow();
  });

  it('공격(triggerAttack) 시 스케일 변환이 적용된다', () => {
    const renderer = new BossRenderer();
    renderer.triggerAttack();

    expect(() => renderer.render(ctx, 2, 400, 200, 70, 'attacking')).not.toThrow();
    expect(ctx.scale).toHaveBeenCalled();
  });

  // Issue #147: 공격 모션 타이머 update 감쇠 검증
  it('공격 모션(triggerAttack) 후 update(0.6s) 경과 시 기본 스케일(1.0)로 복귀한다', () => {
    const renderer = new BossRenderer();
    renderer.triggerAttack();

    const mockCtx = createMockCtx();
    // 0.6초 경과 -> _attackAnimTimer(0.5s) 종료
    renderer.update(0.6);
    renderer.render(mockCtx, 1, 400, 200, 60, 'idle');

    expect(mockCtx.scale).toHaveBeenCalledWith(1, 1);
  });

  it('시간 경과(update)에 따라 애니메이션이 진행된다', () => {
    const renderer = new BossRenderer();
    renderer.update(0.016);
    renderer.update(0.016);
    expect(() => renderer.render(ctx, 3, 300, 300, 80)).not.toThrow();
  });

  describe('[RENDER-BOSS-001 / #217] 압박성 하드코딩 대사 제거 및 신규 5대 보스 연출 정합성', () => {
    it('Ch.4 풀죽새 렌더링 시 "포기해..." 텍스트가 절대 렌더링되지 않는다', () => {
      const renderer = new BossRenderer();
      const mockCtx = createMockCtx();

      renderer.render(mockCtx, 4, 500, 300, 80, 'idle');

      const fillTextCalls = vi.mocked(mockCtx.fillText).mock.calls;
      const hasGiveupText = fillTextCalls.some((call) =>
        typeof call[0] === 'string' && call[0].includes('포기해')
      );
      expect(hasGiveupText).toBe(false);
    });

    it('구 보스 메서드명(_renderForget 등)이 제거되고 신규 5대 보스 메서드명으로 리팩터링되어 존재한다', () => {
      const proto = BossRenderer.prototype as unknown as Record<string, unknown>;

      // 구 메서드 제거 검증
      expect(proto['_renderForget']).toBeUndefined();
      expect(proto['_renderHurry']).toBeUndefined();
      expect(proto['_renderJumble']).toBeUndefined();
      expect(proto['_renderGiveup']).toBeUndefined();
      expect(proto['_renderNightmare']).toBeUndefined();

      // 신규 5대 보스 메서드 존재 검증
      expect(typeof proto['_renderBoss1HayeSini']).toBe('function');
      expect(typeof proto['_renderBoss2JaechokSae']).toBe('function');
      expect(typeof proto['_renderBoss3TaddolSini']).toBe('function');
      expect(typeof proto['_renderBoss4PuljukSae']).toBe('function');
      expect(typeof proto['_renderBoss5KamkamDaewang']).toBe('function');
    });

    it('chapter 분기에 따라 신규 5대 보스 전용 메서드가 정확히 디스패치된다', () => {
      const renderer = new BossRenderer();
      const mockCtx = createMockCtx();

      const spyBoss1 = vi.spyOn(renderer as unknown as Record<string, (...args: unknown[]) => void>, '_renderBoss1HayeSini');
      const spyBoss2 = vi.spyOn(renderer as unknown as Record<string, (...args: unknown[]) => void>, '_renderBoss2JaechokSae');
      const spyBoss3 = vi.spyOn(renderer as unknown as Record<string, (...args: unknown[]) => void>, '_renderBoss3TaddolSini');
      const spyBoss4 = vi.spyOn(renderer as unknown as Record<string, (...args: unknown[]) => void>, '_renderBoss4PuljukSae');
      const spyBoss5 = vi.spyOn(renderer as unknown as Record<string, (...args: unknown[]) => void>, '_renderBoss5KamkamDaewang');

      renderer.render(mockCtx, 1, 500, 300, 80, 'idle');
      expect(spyBoss1).toHaveBeenCalledWith(mockCtx, 80);

      renderer.render(mockCtx, 2, 500, 300, 80, 'idle');
      expect(spyBoss2).toHaveBeenCalledWith(mockCtx, 80);

      renderer.render(mockCtx, 3, 500, 300, 80, 'idle');
      expect(spyBoss3).toHaveBeenCalledWith(mockCtx, 80);

      renderer.render(mockCtx, 4, 500, 300, 80, 'idle');
      expect(spyBoss4).toHaveBeenCalledWith(mockCtx, 80);

      renderer.render(mockCtx, 5, 500, 300, 80, 'idle');
      expect(spyBoss5).toHaveBeenCalledWith(mockCtx, 80);
    });

    it('BossRenderer.ts 소스 코드에 "포기해..." 문자열이 존재하지 않는다', () => {
      const sourcePath = path.resolve(process.cwd(), 'src/render/BossRenderer.ts');
      const sourceCode = fs.readFileSync(sourcePath, 'utf-8');
      expect(sourceCode).not.toContain('포기해...');
    });
  });
});
