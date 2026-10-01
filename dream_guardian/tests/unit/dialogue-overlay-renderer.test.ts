import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DialogueOverlayRenderer } from '../../src/render/DialogueOverlayRenderer.js';
import type { DialogueLine } from '../../src/types/story.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    roundRect: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 16 })),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
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

describe('DialogueOverlayRenderer (Issue #219 / STORY-RENDER-001)', () => {
  let renderer: DialogueOverlayRenderer;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    renderer = new DialogueOverlayRenderer();
    ctx = createMockCtx();
  });

  describe('1. 초기 상태 및 기본값', () => {
    it('초기에는 비활성(isActive=false) 상태이고 알파는 0이다', () => {
      expect(renderer.isActive()).toBe(false);
      expect(renderer.alpha).toBe(0);
      expect(renderer.displayedText).toBe('');
      expect(renderer.state).toBe('idle');
    });

    it('비활성 상태에서 render 호출 시 캔버스 save/draw를 실행하지 않는다', () => {
      renderer.render(ctx, 1080, 2160);
      expect(ctx.save).not.toHaveBeenCalled();
      expect(ctx.fillText).not.toHaveBeenCalled();
    });
  });

  describe('2. 화자별 테마 및 대사 설정', () => {
    it('깨비(kkebi) 대사 전달 시 화자 및 깨비 테마가 활성화된다', () => {
      const line: DialogueLine = {
        speaker: 'kkebi',
        speakerName: '깨비',
        text: '틀려도 괜찮아! 다시 박자를 맞춰보자!',
        trigger: 'answer_wrong',
        durationMs: 3000,
      };

      renderer.show(line);

      expect(renderer.isActive()).toBe(true);
      expect(renderer.speaker).toBe('kkebi');
      expect(renderer.speakerName).toBe('깨비');
      expect(renderer.fullText).toBe('틀려도 괜찮아! 다시 박자를 맞춰보자!');
      expect(renderer.alpha).toBe(1);
    });

    it('보스(boss) 대사 전달 시 보스 이름 및 보스 테마가 설정된다', () => {
      const line: DialogueLine = {
        speaker: 'boss',
        speakerName: '하얘시니',
        text: '이 깊은 안개 속에서는 애써 기억하려 하지 않아도 되느니라.',
        trigger: 'battle_start',
      };

      renderer.show(line, '하얘시니');

      expect(renderer.isActive()).toBe(true);
      expect(renderer.speaker).toBe('boss');
      expect(renderer.speakerName).toBe('하얘시니');
      expect(renderer.fullText).toBe('이 깊은 안개 속에서는 애써 기억하려 하지 않아도 되느니라.');
    });

    it('나레이터(narrator) 또는 임의 showDialogue 호출 시 정상 설정된다', () => {
      renderer.showDialogue('narrator', '수호신의 별빛이 몽계를 비춥니다.', {
        subtext: '시스템',
        duration: 2.5,
      });

      expect(renderer.isActive()).toBe(true);
      expect(renderer.speaker).toBe('narrator');
      expect(renderer.speakerName).toBe('안내');
      expect(renderer.subtext).toBe('시스템');
      expect(renderer.fullText).toBe('수호신의 별빛이 몽계를 비춥니다.');
    });
  });

  describe('3. 타이프라이터 효과 (Typewriter Effect)', () => {
    it('초당 약 30자의 속도로 글자가 순차 노출된다', () => {
      const text = '하나 둘 셋 넷 다섯 여섯 일곱 여덟 아홉 열!';
      renderer.showDialogue('kkebi', text);

      expect(renderer.displayedText).toBe('');

      // 0.1초 경과 (30자/초 기준 약 3글자)
      renderer.update(0.1);
      expect(renderer.displayedText.length).toBeGreaterThanOrEqual(2);
      expect(renderer.displayedText.length).toBeLessThanOrEqual(4);
      expect(text.startsWith(renderer.displayedText)).toBe(true);

      // 충분한 시간 경과 후 전체 글자 표시 및 dwelling 상태 전이
      renderer.update(1.5);
      expect(renderer.displayedText).toBe(text);
      expect(renderer.state).toBe('dwelling');
    });

    it('타이핑 완료 전에는 텍스트가 전체 길이를 초과하지 않는다', () => {
      renderer.showDialogue('kkebi', '짧은 글');
      renderer.update(0.05);
      expect(renderer.displayedText.length).toBeLessThanOrEqual(3);
    });
  });

  describe('4. 체류(Dwell) 및 페이드아웃(Fade-Out)', () => {
    it('대사 타이핑 완료 후 지정된 시간(기본 3초) 동안 체류한 뒤 부드럽게 페이드아웃된다', () => {
      renderer.showDialogue('kkebi', '안녕', { duration: 2.0 });

      // 타이핑 완료시키기 (짧은 글)
      renderer.update(0.5);
      expect(renderer.state).toBe('dwelling');
      expect(renderer.alpha).toBe(1.0);

      // 체류 1.0초 경과 (총 2.0초 중 1.0초 남아있음)
      renderer.update(1.0);
      expect(renderer.state).toBe('dwelling');
      expect(renderer.alpha).toBe(1.0);

      // 체류 시간 2.0초 도달 및 페이드인 진입 (1.1초 경과)
      renderer.update(1.1);
      expect(renderer.state).toBe('fading');
      expect(renderer.alpha).toBeLessThan(1.0);
      expect(renderer.alpha).toBeGreaterThan(0);

      // 페이드아웃 잔여 시간(0.4초 이상) 완료 후 완전 비활성화
      renderer.update(0.5);
      expect(renderer.state).toBe('idle');
      expect(renderer.isActive()).toBe(false);
      expect(renderer.alpha).toBe(0);
    });
  });

  describe('5. 새 대사 유입 시 즉시 교체 및 clear 동작', () => {
    it('기존 대사 진행 중 새 대사가 유입되면 즉시 교체되고 타이프라이터가 리셋된다', () => {
      renderer.showDialogue('boss', '첫 번째 보스 대사입니다.');
      renderer.update(0.2);
      const prevLength = renderer.displayedText.length;
      expect(prevLength).toBeGreaterThan(0);

      // 새 대사 투입
      renderer.showDialogue('kkebi', '새로운 깨비 대사!');
      expect(renderer.speaker).toBe('kkebi');
      expect(renderer.fullText).toBe('새로운 깨비 대사!');
      expect(renderer.displayedText).toBe('');
      expect(renderer.alpha).toBe(1.0);

      // 다시 타이핑 시작
      renderer.update(0.1);
      expect(renderer.displayedText.length).toBeGreaterThan(0);
      expect('새로운 깨비 대사!'.startsWith(renderer.displayedText)).toBe(true);
    });

    it('clear() 호출 시 즉시 모든 상태가 초기화되고 비활성화된다', () => {
      renderer.showDialogue('kkebi', '진행 중인 대사');
      renderer.update(0.2);
      expect(renderer.isActive()).toBe(true);

      renderer.clear();
      expect(renderer.isActive()).toBe(false);
      expect(renderer.alpha).toBe(0);
      expect(renderer.displayedText).toBe('');
      expect(renderer.state).toBe('idle');
    });
  });

  describe('6. 캔버스 렌더링 호출 및 격리 검증', () => {
    it('활성 상태에서 render 호출 시 save/restore 및 fillText/roundRect를 정상 호출한다', () => {
      renderer.showDialogue('kkebi', '테스트 대사입니다.');
      renderer.update(0.2);

      renderer.render(ctx, 1080, 2160);

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
      expect(ctx.roundRect).toHaveBeenCalled();
      expect(ctx.fillText).toHaveBeenCalled();
      expect(ctx.globalAlpha).toBeGreaterThan(0);
    });

    it('화면 상단 안전 영역(y 약 150~220px 영역)에 패널이 배치된다', () => {
      renderer.showDialogue('kkebi', '안전 영역 테스트');
      renderer.update(0.1);

      renderer.render(ctx, 1080, 2160);

      // roundRect 호출 파라미터 검증 (x, y, w, h, r)
      const roundRectCalls = (ctx.roundRect as any).mock.calls;
      expect(roundRectCalls.length).toBeGreaterThanOrEqual(1);

      const [panelX, panelY, panelW, panelH] = roundRectCalls[0];
      // 중앙 정렬 및 여백 검증
      expect(panelX).toBeGreaterThanOrEqual(0);
      // y는 140~200px 사이 (HUD 하단 안전 영역)
      expect(panelY).toBeGreaterThanOrEqual(140);
      expect(panelY).toBeLessThanOrEqual(220);
      // 높이는 약 120~180px
      expect(panelH).toBeGreaterThanOrEqual(100);
      expect(panelH).toBeLessThanOrEqual(200);
      // 너비는 화면의 80% 이상
      expect(panelW).toBeGreaterThan(800);
    });
  });
});
