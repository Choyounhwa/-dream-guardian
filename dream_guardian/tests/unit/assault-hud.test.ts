/**
 * assault-hud.test.ts - 보스 접근전 MVP 읽기 전용 HUD 및 진입 오류 표시 단위 테스트
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§6.2, 6.3, 11.2, A02, A11, A19)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-20 / Issue #522)
 *
 * 검증 목표:
 * 1. 실제 스냅샷 지표 표시: 플레이어 HP (수치/바), 완료 문제/목표 문제 (A02, A11), 타격 수 구분, 콤보, 리듬 판정.
 * 2. 안전/상태 표시: isPaused, trackingLost, needsMotionReprep, validationError 사유 배너 (A02, A19).
 * 3. 미지원 보상 숨김: 마나 게이지, 별가루 보상, 수호신 스펠 게이지, 보스 HP바 표시 0회 (임의 0 위조 금지).
 * 4. 멱등성 및 아키텍처 제약: 동결(Object.freeze) 스냅샷에 대해 반복 render 호출 시 상태 불변, 순수 UI 단일 책임.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  AssaultHUD,
  type AssaultHUDSnapshot,
} from '../../src/ui/AssaultHUD.js';

function createMockContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 12 })),
    drawImage: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    globalAlpha: 1.0,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    clearRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

function getAllRenderedTexts(ctx: CanvasRenderingContext2D): string[] {
  return (ctx.fillText as any).mock.calls.map((call: any[]) => String(call[0]));
}

describe('[BOSS-ASSAULT-20 / #522] AssaultHUD - MVP 읽기 전용 HUD 및 진입 오류 표시', () => {
  it('1. 플레이어 HP(수치 및 바)를 정상 렌더링해야 한다', () => {
    const hud = new AssaultHUD();
    const ctx = createMockContext();
    const snapshot: AssaultHUDSnapshot = {
      playerHp: 75,
      playerMaxHp: 100,
      completedQuestions: 1,
      targetRounds: 3,
    };

    hud.render(ctx, 1080, 720, snapshot);

    const texts = getAllRenderedTexts(ctx);
    // HP 수치가 렌더링되었는지 확인
    const hasHpText = texts.some((t) => t.includes('75') && (t.includes('100') || t.includes('HP')));
    expect(hasHpText).toBe(true);

    // HP 게이지 바 fillRect 호출 확인
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('2. [A02, A11] 문제 완료 수(completedQuestions)와 타격 수(strikeCount)를 명확히 분리하여 표시해야 한다', () => {
    const hud = new AssaultHUD();
    const ctx = createMockContext();
    const snapshot: AssaultHUDSnapshot = {
      playerHp: 100,
      playerMaxHp: 100,
      completedQuestions: 1,
      targetRounds: 3,
      strikeCount: 3, // 한 문제 내에서 3회 타격
    };

    hud.render(ctx, 1080, 720, snapshot);

    const texts = getAllRenderedTexts(ctx);

    // 접근전 진행도: 완료 문제 1 / 목표 3
    const hasQuestionProgress = texts.some(
      (t) => (t.includes('1 / 3') || t.includes('1/3')) && (t.includes('문제') || t.includes('STAGE') || t.includes('ROUND') || t.includes('진행'))
    );
    expect(hasQuestionProgress).toBe(true);

    // 타격 수(3회)가 문제 수(1)와 별도로 명시되어야 함
    const hasStrikeText = texts.some(
      (t) => t.includes('3') && (t.includes('타격') || t.includes('HIT') || t.includes('STRIKE'))
    );
    expect(hasStrikeText).toBe(true);
  });

  it('3. 현재 콤보(combo) 및 리듬 판정 피드백을 표시해야 한다', () => {
    const hud = new AssaultHUD();
    const ctx = createMockContext();
    const snapshot: AssaultHUDSnapshot = {
      playerHp: 100,
      completedQuestions: 2,
      targetRounds: 3,
      combo: 5,
      judgmentRating: 'Perfect',
    };

    hud.render(ctx, 1080, 720, snapshot);

    const texts = getAllRenderedTexts(ctx);
    const hasCombo = texts.some((t) => t.includes('5') && t.includes('COMBO'));
    expect(hasCombo).toBe(true);

    const hasRating = texts.some((t) => t.toUpperCase().includes('PERFECT'));
    expect(hasRating).toBe(true);
  });

  it('4. 콤보가 0일 때는 콤보 카운터를 렌더링하지 않아야 한다', () => {
    const hud = new AssaultHUD();
    const ctx = createMockContext();
    const snapshot: AssaultHUDSnapshot = {
      playerHp: 100,
      completedQuestions: 0,
      targetRounds: 3,
      combo: 0,
    };

    hud.render(ctx, 1080, 720, snapshot);

    const texts = getAllRenderedTexts(ctx);
    const hasZeroCombo = texts.some((t) => t.includes('0 COMBO') || t.includes('0COMBO'));
    expect(hasZeroCombo).toBe(false);
  });

  it('5. 일시정지(isPaused) 상태를 명확히 표시해야 한다', () => {
    const hud = new AssaultHUD();
    const ctx = createMockContext();
    const snapshot: AssaultHUDSnapshot = {
      playerHp: 100,
      completedQuestions: 1,
      targetRounds: 3,
      isPaused: true,
    };

    hud.render(ctx, 1080, 720, snapshot);

    const texts = getAllRenderedTexts(ctx);
    const hasPaused = texts.some((t) => t.includes('일시정지') || t.toUpperCase().includes('PAUSE'));
    expect(hasPaused).toBe(true);
  });

  it('6. [A19] 카메라 추적 상실(trackingLost) 경고를 표시해야 한다', () => {
    const hud = new AssaultHUD();
    const ctx = createMockContext();
    const snapshot: AssaultHUDSnapshot = {
      playerHp: 100,
      completedQuestions: 1,
      targetRounds: 3,
      trackingLost: true,
    };

    hud.render(ctx, 1080, 720, snapshot);

    const texts = getAllRenderedTexts(ctx);
    const hasTrackingWarning = texts.some(
      (t) => (t.includes('추적') || t.toUpperCase().includes('TRACKING')) && (t.includes('상실') || t.includes('경고') || t.toUpperCase().includes('LOST'))
    );
    expect(hasTrackingWarning).toBe(true);
  });

  it('7. [A19] 모션 재준비(needsMotionReprep) 안내를 표시해야 한다', () => {
    const hud = new AssaultHUD();
    const ctx = createMockContext();
    const snapshot: AssaultHUDSnapshot = {
      playerHp: 100,
      completedQuestions: 1,
      targetRounds: 3,
      needsMotionReprep: true,
    };

    hud.render(ctx, 1080, 720, snapshot);

    const texts = getAllRenderedTexts(ctx);
    const hasReprepNotice = texts.some(
      (t) => (t.includes('재준비') || t.toUpperCase().includes('RE-PREP') || t.includes('자세'))
    );
    expect(hasReprepNotice).toBe(true);
  });

  it('8. [A02] 진입 유효성 검증 실패(validationError) 발생 시 사유 배너를 표시해야 한다', () => {
    const hud = new AssaultHUD();
    const ctx = createMockContext();
    const errorReason = '유효하지 않은 프로필: 8박 미만 공격 포함';
    const snapshot: AssaultHUDSnapshot = {
      playerHp: 100,
      completedQuestions: 0,
      targetRounds: 3,
      validationError: errorReason,
    };

    hud.render(ctx, 1080, 720, snapshot);

    const texts = getAllRenderedTexts(ctx);
    const hasErrorBanner = texts.some((t) => t.includes(errorReason) || (t.includes('8박 미만') && t.includes('오류')));
    expect(hasErrorBanner).toBe(true);
  });

  it('9. 객체 형태의 validationError({ reason })도 정상 렌더링해야 한다', () => {
    const hud = new AssaultHUD();
    const ctx = createMockContext();
    const snapshot: AssaultHUDSnapshot = {
      playerHp: 100,
      completedQuestions: 0,
      targetRounds: 3,
      validationError: {
        code: 'INVALID_GOAL',
        reason: '목표 라운드 누락',
      },
    };

    hud.render(ctx, 1080, 720, snapshot);

    const texts = getAllRenderedTexts(ctx);
    const hasErrorReason = texts.some((t) => t.includes('목표 라운드 누락'));
    expect(hasErrorReason).toBe(true);
  });

  it('10. [DEC-A7] MVP 미지원 요소(마나 게이지, 별가루 보상, 수호신 스펠, 보스 HP)를 표시하지 않아야 한다', () => {
    const hud = new AssaultHUD();
    const ctx = createMockContext();
    const snapshot: AssaultHUDSnapshot = {
      playerHp: 100,
      playerMaxHp: 100,
      completedQuestions: 1,
      targetRounds: 3,
    };

    hud.render(ctx, 1080, 720, snapshot);

    const texts = getAllRenderedTexts(ctx);

    // 마나 관련 표시 0건
    const hasMana = texts.some((t) => t.toUpperCase().includes('MANA') || t.includes('마나'));
    expect(hasMana).toBe(false);

    // 별가루 보상 표시 0건
    const hasStardust = texts.some((t) => t.toUpperCase().includes('STARDUST') || t.includes('별가루'));
    expect(hasStardust).toBe(false);

    // 수호신 스펠 표시 0건
    const hasSpell = texts.some((t) => t.toUpperCase().includes('SPELL') || t.includes('스펠') || t.includes('수호신'));
    expect(hasSpell).toBe(false);

    // 보스 HP바 관련 표시 0건 (MVP에서는 보스 HP바 숨김 확정)
    const hasBossHp = texts.some((t) => t.includes('BOSS') || t.includes('보스'));
    expect(hasBossHp).toBe(false);
  });

  it('11. 멱등성: Object.freeze된 스냅샷에 대해 반복 render 호출 시 스냅샷 및 내부 상태가 불변이어야 한다', () => {
    const hud = new AssaultHUD();
    const ctx = createMockContext();
    const snapshot: AssaultHUDSnapshot = Object.freeze({
      playerHp: 80,
      playerMaxHp: 100,
      completedQuestions: 2,
      targetRounds: 3,
      strikeCount: 4,
      combo: 3,
      judgmentRating: 'Good',
      trackingLost: false,
      isPaused: false,
    });

    // 10회 반복 렌더링 호출
    for (let i = 0; i < 10; i++) {
      expect(() => hud.render(ctx, 1080, 720, snapshot)).not.toThrow();
    }

    // snapshot 프로퍼티 변경 없음 확인
    expect(snapshot.playerHp).toBe(80);
    expect(snapshot.completedQuestions).toBe(2);
    expect(snapshot.strikeCount).toBe(4);
    expect(snapshot.combo).toBe(3);
  });

  it('12. 플레이어 HP 0 (사망/패배) 상태를 정확히 구분하여 표시해야 한다', () => {
    const hud = new AssaultHUD();
    const ctx = createMockContext();
    const snapshot: AssaultHUDSnapshot = {
      playerHp: 0,
      playerMaxHp: 100,
      completedQuestions: 1,
      targetRounds: 3,
      isDefeated: true,
    };

    hud.render(ctx, 1080, 720, snapshot);

    const texts = getAllRenderedTexts(ctx);
    const hasDefeatOrZero = texts.some(
      (t) => (t.includes('0 / 100') || t.includes('0/100') || t.includes('0 HP')) || (t.includes('패배') || t.toUpperCase().includes('DEFEAT') || t.toUpperCase().includes('GAME OVER'))
    );
    expect(hasDefeatOrZero).toBe(true);
  });

  it('13. 화면 해상도 변화(모바일 360x640, 데스크톱 1920x1080)에서도 에러 없이 반응형 렌더링되어야 한다', () => {
    const hud = new AssaultHUD();
    const snapshot: AssaultHUDSnapshot = {
      playerHp: 50,
      playerMaxHp: 100,
      completedQuestions: 1,
      targetRounds: 2,
    };

    const ctxMobile = createMockContext();
    expect(() => hud.render(ctxMobile, 360, 640, snapshot)).not.toThrow();

    const ctxDesktop = createMockContext();
    expect(() => hud.render(ctxDesktop, 1920, 1080, snapshot)).not.toThrow();
  });

  it('14. setSnapshot 및 유연한 인자 호출 형태를 지원해야 한다', () => {
    const hud = new AssaultHUD();
    const ctx = createMockContext();
    const snapshot: AssaultHUDSnapshot = {
      playerHp: 90,
      completedQuestions: 1,
      targetRounds: 3,
    };

    // setSnapshot 후 render(ctx, width, height) 호출
    hud.setSnapshot(snapshot);
    expect(hud.getSnapshot()).toBe(snapshot);
    expect(() => hud.render(ctx, 1080, 720)).not.toThrow();

    // render(ctx, snapshot, width, height) 형태 호출도 에러 없이 처리
    expect(() => hud.render(ctx, snapshot, 1080, 720)).not.toThrow();
  });
});
