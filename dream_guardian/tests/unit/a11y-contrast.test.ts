import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { UI_COLOR_THEMES } from '../../config/ui.config.js';
import { CURSOR_COLORS } from '../../config/cursor.config.js';
import { MenuRenderer } from '../../src/ui/MenuRenderer.js';
import { ResultRenderer, type ResultData } from '../../src/ui/ResultRenderer.js';
import { SettingsModal } from '../../src/ui/SettingsModal.js';
import { QuestionRenderer } from '../../src/render/QuestionRenderer.js';

// ─── W3C WCAG 2.1 상대 휘도 및 대비율 계산 공식 ───

export function getChannelLuminance(c: number): number {
  const norm = c / 255;
  return norm <= 0.03928 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

export function getRelativeLuminance(hex: string): number {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((ch) => ch + ch).join('');
  }
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return 0.2126 * getChannelLuminance(r) + 0.7152 * getChannelLuminance(g) + 0.0722 * getChannelLuminance(b);
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

interface MockCanvasContext extends CanvasRenderingContext2D {
  __fillHistory: string[];
}

function createMockCtx(): MockCanvasContext {
  const fillHistory: string[] = [];
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    rect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    roundRect: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    ellipse: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 60 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    drawImage: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    setLineDash: vi.fn(),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    get fillStyle() {
      return fillHistory[fillHistory.length - 1] ?? '';
    },
    set fillStyle(val: string) {
      fillHistory.push(val);
    },
    __fillHistory: fillHistory,
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as MockCanvasContext;
}

describe('[A11Y-002 / #263] 저대비 색상 수정 및 WCAG AA 대비율 4.5:1 보장 검증', () => {
  describe('1. W3C 공식 대비율 계산기 정확도 검증', () => {
    it('완전한 흑백(#FFFFFF 대 #000000) 대비율은 21:1 이다', () => {
      const ratio = getContrastRatio('#FFFFFF', '#000000');
      expect(ratio).toBeCloseTo(21.0, 1);
    });

    it('동일한 색상(#888888 대 #888888) 대비율은 1:1 이다', () => {
      const ratio = getContrastRatio('#888888', '#888888');
      expect(ratio).toBeCloseTo(1.0, 2);
    });

    it('레거시 저대비 색상(#333333, #444444)은 어두운 배경에서 4.5:1 미달(Fail)임을 입증한다', () => {
      // #333333 vs #141828 (bgCard): 약 1.4:1 (WCAG AA 불합격)
      expect(getContrastRatio('#333333', '#141828')).toBeLessThan(4.5);
      // #444444 vs #141828: 약 2.1:1 (WCAG AA 불합격)
      expect(getContrastRatio('#444444', '#141828')).toBeLessThan(4.5);
      // #555555 vs #141828: 약 3.0:1 (WCAG AA 불합격)
      expect(getContrastRatio('#555555', '#141828')).toBeLessThan(4.5);
    });
  });

  describe('2. 교정 대상 색상의 WCAG AA 기준(4.5:1 이상) 달성 검증', () => {
    // 게임 내 주요 어두운 배경 목록
    const DARK_BACKGROUNDS = [
      { name: 'Canvas Base', hex: '#0a0a1a' },
      { name: 'Nightmare / Dark Space', hex: '#050308' },
      { name: 'Card Background', hex: '#141828' },
      { name: 'BottomBar / Overlay', hex: '#0a0e1a' },
      { name: 'Pure Black', hex: '#000000' },
    ];

    it('#BBBBBB (교정된 안내문 / 비활성 태그 / textMuted)는 모든 어두운 배경에서 4.5:1 이상이다', () => {
      for (const bg of DARK_BACKGROUNDS) {
        const ratio = getContrastRatio('#BBBBBB', bg.hex);
        expect(ratio, `#BBBBBB vs ${bg.name}(${bg.hex})`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('#CCCCCC (교정된 서브 문항수 / 키보드 힌트 / textSecondary)는 모든 어두운 배경에서 4.5:1 이상이다', () => {
      for (const bg of DARK_BACKGROUNDS) {
        const ratio = getContrastRatio('#CCCCCC', bg.hex);
        expect(ratio, `#CCCCCC vs ${bg.name}(${bg.hex})`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('#999999 (교정된 잠금 번호/아이콘)는 모든 어두운 배경에서 4.5:1 이상이다', () => {
      for (const bg of DARK_BACKGROUNDS) {
        const ratio = getContrastRatio('#999999', bg.hex);
        expect(ratio, `#999999 vs ${bg.name}(${bg.hex})`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('#888888 (교정된 잠금 챕터명 / textLocked)는 모든 어두운 배경에서 4.5:1 이상이다', () => {
      for (const bg of DARK_BACKGROUNDS) {
        const ratio = getContrastRatio('#888888', bg.hex);
        expect(ratio, `#888888 vs ${bg.name}(${bg.hex})`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('#777777 (교정된 잠금 부제)는 심야/순수 암실 배경(#050308, #000000)에서 4.5:1 이상이다', () => {
      expect(getContrastRatio('#777777', '#050308')).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio('#777777', '#000000')).toBeGreaterThanOrEqual(4.5);
    });

    it('UI_COLOR_THEMES.default의 모든 텍스트 색상은 카드 배경(#141828) 위에서 4.5:1 이상이다', () => {
      const theme = UI_COLOR_THEMES.default;
      const bgCard = '#141828';
      expect(getContrastRatio(theme.textPrimary, bgCard)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(theme.textSecondary, bgCard)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(theme.textMuted, bgCard)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(theme.textLocked, bgCard)).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('3. 정적 소스 코드 검사: 교정 대상 파일 내 저대비 색상 완전 퇴출 및 교정값 반영', () => {
    const TARGET_FILES = [
      'src/ui/ResultRenderer.ts',
      'src/ui/MenuRenderer.ts',
      'src/ui/SettingsModal.ts',
      'src/ui/BottomBar.ts',
      'src/render/QuestionRenderer.ts',
      'config/ui.config.ts',
    ];

    it('대상 파일들에서 #333333, #444444, #555555 색상 코드가 일체 사용되지 않는다 (0건)', () => {
      for (const relPath of TARGET_FILES) {
        const fullPath = path.resolve(process.cwd(), relPath);
        const code = fs.readFileSync(fullPath, 'utf-8');
        expect(code, `${relPath} 내 #333333 발견`).not.toMatch(/#333333/i);
        expect(code, `${relPath} 내 #444444 발견`).not.toMatch(/#444444/i);
        expect(code, `${relPath} 내 #555555 발견`).not.toMatch(/#555555/i);
      }
    });

    it('src/ui/ResultRenderer.ts: 하단 안내문에 #888888 대신 #BBBBBB가 적용되어 있다', () => {
      const fullPath = path.resolve(process.cwd(), 'src/ui/ResultRenderer.ts');
      const code = fs.readFileSync(fullPath, 'utf-8');
      expect(code).not.toMatch(/ctx\.fillStyle\s*=\s*['"]#888888['"]/);
      expect(code).toMatch(/ctx\.fillStyle\s*=\s*['"]#BBBBBB['"]/);
    });

    it('src/ui/MenuRenderer.ts: 잠금 챕터 관련 색상 및 서브 문항수 색상이 교정되어 있다', () => {
      const fullPath = path.resolve(process.cwd(), 'src/ui/MenuRenderer.ts');
      const code = fs.readFileSync(fullPath, 'utf-8');
      // 잠금 부제: #777777
      expect(code).toMatch(/locked\s*\?\s*['"]#777777['"]/);
      // 잠금 챕터명: #888888
      expect(code).toMatch(/locked\s*\?\s*['"]#888888['"]/);
      // 잠금 번호: #999999
      expect(code).toMatch(/locked\s*\?\s*['"]#999999['"]/);
      // 서브 문항수: #CCCCCC
      expect(code).not.toMatch(/ctx\.fillStyle\s*=\s*['"]#AAAAAA['"]/);
      expect(code).toMatch(/ctx\.fillStyle\s*=\s*['"]#CCCCCC['"]/);
    });

    it('src/ui/SettingsModal.ts: 비활성 상태 태그에 #888888 대신 #BBBBBB가 적용되어 있다', () => {
      const fullPath = path.resolve(process.cwd(), 'src/ui/SettingsModal.ts');
      const code = fs.readFileSync(fullPath, 'utf-8');
      expect(code).not.toMatch(/:\s*['"]#888888['"]/);
      expect(code).toMatch(/:\s*['"]#BBBBBB['"]/);
    });

    it('src/render/QuestionRenderer.ts: 키보드 힌트에 #AAAAAA 대신 #CCCCCC가 적용되어 있다', () => {
      const fullPath = path.resolve(process.cwd(), 'src/render/QuestionRenderer.ts');
      const code = fs.readFileSync(fullPath, 'utf-8');
      expect(code).not.toMatch(/ctx\.fillStyle\s*=\s*['"]#AAAAAA['"]/);
      expect(code).toMatch(/ctx\.fillStyle\s*=\s*['"]#CCCCCC['"]/);
    });

    it('config/ui.config.ts: UI_COLOR_THEMES.default의 textMuted는 #BBBBBB, textLocked는 #888888이다', () => {
      expect(UI_COLOR_THEMES.default.textMuted).toBe('#BBBBBB');
      expect(UI_COLOR_THEMES.default.textLocked).toBe('#888888');
    });
  });

  describe('4. 시그니처 색상 및 4색 커서 색상 불변 검증', () => {
    it('활성 상태 주요 테마 시그니처 색상이 원형 그대로 보존된다', () => {
      const theme = UI_COLOR_THEMES.default;
      expect(theme.primary).toBe('#28E6FF');
      expect(theme.secondary).toBe('#FFCB4D');
      expect(theme.accent).toBe('#C889FF');
      expect(theme.danger).toBe('#FF4444');
      expect(theme.success).toBe('#4DFFAA');
      expect(theme.textPrimary).toBe('#FFFFFF');
    });

    it('4색 신체 커서 색상이 불변으로 보존된다', () => {
      expect(CURSOR_COLORS.leftHand).toBe('#28E6FF');
      expect(CURSOR_COLORS.rightHand).toBe('#FFCB4D');
      expect(CURSOR_COLORS.head).toBe('#C889FF');
      expect(CURSOR_COLORS.hip).toBe('#FF865E');
    });
  });

  describe('5. 렌더러 런타임 fillStyle 검증 (Mock Context)', () => {
    it('MenuRenderer: 잠금 챕터 카드 렌더링 시 #777777, #888888, #999999가 fillStyle로 적용된다', () => {
      const renderer = new MenuRenderer();
      const ctx = createMockCtx();
      renderer.render(ctx, 1080, 2160, {
        unlockedChapter: 1, // Ch.2~Ch.5는 locked
        selectedChapter: 1,
        stars: { 1: 3 },
      });

      expect(ctx.__fillHistory).toContain('#999999');
      expect(ctx.__fillHistory).toContain('#888888');
      expect(ctx.__fillHistory).toContain('#777777');
      expect(ctx.__fillHistory).not.toContain('#333333');
      expect(ctx.__fillHistory).not.toContain('#444444');
      expect(ctx.__fillHistory).not.toContain('#555555');
    });

    it('MenuRenderer: 서브레벨 목록 렌더링 시 문항수에 #CCCCCC가 fillStyle로 적용된다', () => {
      const renderer = new MenuRenderer();
      const ctx = createMockCtx();
      renderer.renderSubMenu(
        ctx,
        1080,
        2160,
        1,
        [
          { subLevel: 1, title: '1단계', count: 5 },
        ],
        0,
      );

      expect(ctx.__fillHistory).toContain('#CCCCCC');
      expect(ctx.__fillHistory).not.toContain('#AAAAAA');
    });

    it('ResultRenderer: 렌더링 시 하단 안내문에 #BBBBBB가 fillStyle로 적용된다', () => {
      const renderer = new ResultRenderer();
      const ctx = createMockCtx();
      const mockResult: ResultData = {
        victory: true,
        chapter: 1,
        correctCount: 5,
        totalQuestions: 5,
        maxCombo: 5,
        elapsedTime: 60,
        steps: 100,
        squats: 10,
        jumps: 5,
      };

      renderer.render(ctx, 1080, 2160, mockResult);
      expect(ctx.__fillHistory).toContain('#BBBBBB');
      expect(ctx.__fillHistory).not.toContain('#888888');
    });

    it('SettingsModal: 토글 이미지 폴백 시 비활성 태그에 #BBBBBB가 fillStyle로 적용된다', () => {
      const modal = new SettingsModal();
      modal.open();
      const ctx = createMockCtx();
      modal.render(ctx, 1080, 2160);

      expect(ctx.__fillHistory).toContain('#BBBBBB');
      expect(ctx.__fillHistory).not.toContain('#888888');
    });

    it('QuestionRenderer: 키보드 힌트 렌더링 시 #CCCCCC가 fillStyle로 적용된다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();
      renderer.render(ctx, 1080, 2160, {
        question: {
          id: 'test-1',
          chapter: 1,
          level: 1,
          type: 'choice',
          questionText: '1 + 1 = ?',
          choices: ['2', '3'],
          answer: '2',
        } as any,
        questionVisible: true,
        selectedIndex: -1,
        timeRemaining: 10,
        totalTime: 10,
      } as any);

      expect(ctx.__fillHistory).toContain('#CCCCCC');
      expect(ctx.__fillHistory).not.toContain('#AAAAAA');
    });
  });
});
