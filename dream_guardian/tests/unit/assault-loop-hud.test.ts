/**
 * assault-loop-hud.test.ts - 보스 접근전 루프 구간·기회·러닝 폴백 안내 HUD 단위 테스트
 *
 * @see docs/19_BOSS_ASSAULT_LOOP_CARDS.md (DOC-19 §§1~4)
 * @see docs/assault-loop/LOOP-15.md (ASSAULT-LOOP-15 / Issue #708)
 *
 * 검증 목표:
 * 1. 구간명(달리기, 답안 선택, 휴식, 스쿼트 회피) 및 잔여 박(remaining beats) 표시.
 * 2. 문제당 선택 기회(기회 n / 4)와 완료 문제 진행도(10개 목표)의 명확한 분리 표시.
 * 3. 구간별 행동 및 폴백 안내 텍스트 표시:
 *    - run_question: "러닝 중 (키보드 A/D, 좌/우 방향키 또는 터치로도 발걸음 가능)"
 *    - answer: "좌/우 펀치로 정답 선택!"
 *    - squat: "스쿼트로 공격 회피!" (stand 시 직립 안내)
 *    - rest: "잠시 휴식 및 바른 자세 준비"
 * 4. 우선순위 배너 보존: isPaused, trackingLost, needsMotionReprep, validationError.
 * 5. 하위 호환성: loop 정보 없는 기존 render 호출 fixture 100% 동등 보존.
 * 6. 멱등성 및 순수 UI 단일 책임: Object.freeze 불변, 시간 계산/랜덤 0회.
 * 7. 다양한 루프 스냅샷 전달 포트(snapshot.loop, setLoopSnapshot, render 인자) 지원.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  AssaultHUD,
  type AssaultHUDSnapshot,
} from '../../src/ui/AssaultHUD.js';
import type {
  AssaultLoopPresentation,
} from '../../src/types/assault-loop.js';

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

function createMockLoopPresentation(overrides: Partial<AssaultLoopPresentation> = {}): AssaultLoopPresentation {
  return {
    currentSegmentIndex: 0,
    currentSegmentKind: 'run_question',
    segmentElapsedBeats: 0,
    segmentRemainingBeats: 8,
    segmentElapsedSeconds: 0,
    segmentRemainingSeconds: 4,
    currentOpportunity: 1,
    totalOpportunities: 4,
    canSelectAnswer: false,
    isResting: false,
    isSquatActive: false,
    ...overrides,
  };
}

describe('[ASSAULT-LOOP-15 / #708] AssaultHUD - 루프 구간·기회·러닝 폴백 안내 HUD 읽기 전용 표시', () => {
  it('1. run_question 구간에서 달리기 구간명, 잔여 박, 기회, 러닝 폴백 안내가 렌더링되어야 한다', () => {
    const hud = new AssaultHUD();
    const ctx = createMockContext();
    const snapshot: AssaultHUDSnapshot = {
      playerHp: 100,
      completedQuestions: 0,
      targetRounds: 10,
    };
    const loopSnapshot = createMockLoopPresentation({
      currentSegmentIndex: 0,
      currentSegmentKind: 'run_question',
      segmentRemainingBeats: 8,
      currentOpportunity: 1,
    });

    hud.render(ctx, snapshot, { width: 1080, height: 720 }, undefined, loopSnapshot);

    const texts = getAllRenderedTexts(ctx);

    // 구간명 달리기 및 잔여 8박 확인
    const hasSegmentAndBeats = texts.some(
      (t) => t.includes('달리기') && t.includes('8박')
    );
    expect(hasSegmentAndBeats).toBe(true);

    // 선택 기회 1 / 4 확인
    const hasOpportunity = texts.some((t) => t.includes('기회') && t.includes('1 / 4'));
    expect(hasOpportunity).toBe(true);

    // 러닝 폴백 안내 문구 확인
    const hasFallbackText = texts.some((t) =>
      t.includes('러닝 중 (키보드 A/D, 좌/우 방향키 또는 터치로도 발걸음 가능)')
    );
    expect(hasFallbackText).toBe(true);
  });

  it('2. answer 구간에서 답안 선택 구간명, 잔여 4박, 기회 2/4, 펀치 선택 안내가 렌더링되어야 한다', () => {
    const hud = new AssaultHUD();
    const ctx = createMockContext();
    const snapshot: AssaultHUDSnapshot = {
      playerHp: 100,
      completedQuestions: 1,
      targetRounds: 10,
    };
    const loopSnapshot = createMockLoopPresentation({
      currentSegmentIndex: 1,
      currentSegmentKind: 'answer',
      segmentRemainingBeats: 4,
      currentOpportunity: 2,
    });

    hud.render(ctx, snapshot, { width: 1080, height: 720 }, undefined, loopSnapshot);

    const texts = getAllRenderedTexts(ctx);

    expect(texts.some((t) => t.includes('답안 선택') && t.includes('4박'))).toBe(true);
    expect(texts.some((t) => t.includes('기회') && t.includes('2 / 4'))).toBe(true);
    expect(texts.some((t) => t.includes('좌/우 펀치로 정답 선택!'))).toBe(true);
  });

  it('3. rest 구간에서 휴식 구간명, 잔여 2박, 바른 자세 안내가 렌더링되어야 한다', () => {
    const hud = new AssaultHUD();
    const ctx = createMockContext();
    const snapshot: AssaultHUDSnapshot = {
      playerHp: 90,
      completedQuestions: 2,
      targetRounds: 10,
    };
    const loopSnapshot = createMockLoopPresentation({
      currentSegmentIndex: 2,
      currentSegmentKind: 'rest',
      segmentRemainingBeats: 2,
      currentOpportunity: 2,
    });

    hud.render(ctx, snapshot, { width: 1080, height: 720 }, undefined, loopSnapshot);

    const texts = getAllRenderedTexts(ctx);

    expect(texts.some((t) => t.includes('휴식') && t.includes('2박'))).toBe(true);
    expect(texts.some((t) => t.includes('기회') && t.includes('2 / 4'))).toBe(true);
    expect(texts.some((t) => t.includes('잠시 휴식 및 바른 자세 준비'))).toBe(true);
  });

  it('4. squat 구간에서 스쿼트 회피 구간명, 회피 안내 및 직립 복귀 안내가 렌더링되어야 한다', () => {
    const hud = new AssaultHUD();
    const ctx = createMockContext();
    const snapshot: AssaultHUDSnapshot = {
      playerHp: 80,
      completedQuestions: 3,
      targetRounds: 10,
    };
    const loopDodge = createMockLoopPresentation({
      currentSegmentIndex: 3,
      currentSegmentKind: 'squat',
      segmentRemainingBeats: 2,
      currentOpportunity: 2,
      currentSquatSubSegment: 'dodge',
    });

    hud.render(ctx, snapshot, { width: 1080, height: 720 }, undefined, loopDodge);

    let texts = getAllRenderedTexts(ctx);
    expect(texts.some((t) => t.includes('스쿼트 회피') && t.includes('2박'))).toBe(true);
    expect(texts.some((t) => t.includes('스쿼트로 공격 회피!'))).toBe(true);

    // 직립(stand) 서브 구간 테스트
    const ctxStand = createMockContext();
    const loopStand = createMockLoopPresentation({
      ...loopDodge,
      currentSquatSubSegment: 'stand',
      segmentRemainingBeats: 1,
    });
    hud.render(ctxStand, snapshot, { width: 1080, height: 720 }, undefined, loopStand);

    texts = getAllRenderedTexts(ctxStand);
    expect(texts.some((t) => t.includes('직립'))).toBe(true);
  });

  it('5. 완료 문제 진행도(10개 목표)와 문제당 선택 기회(4개)가 명확히 분리되어 표시되어야 한다', () => {
    const hud = new AssaultHUD();
    const ctx = createMockContext();
    const snapshot: AssaultHUDSnapshot = {
      playerHp: 100,
      completedQuestions: 3,
      targetRounds: 10,
    };
    const loopSnapshot = createMockLoopPresentation({
      currentSegmentIndex: 4,
      currentSegmentKind: 'answer',
      segmentRemainingBeats: 3,
      currentOpportunity: 3,
    });

    hud.render(ctx, snapshot, { width: 1080, height: 720 }, undefined, loopSnapshot);

    const texts = getAllRenderedTexts(ctx);

    // 완료 문제 진행도: 3 / 10
    const hasQuestionProgress = texts.some(
      (t) => t.includes('3 / 10') && (t.includes('문제') || t.includes('진행'))
    );
    expect(hasQuestionProgress).toBe(true);

    // 선택 기회: 3 / 4
    const hasOpportunity = texts.some((t) => t.includes('기회') && t.includes('3 / 4'));
    expect(hasOpportunity).toBe(true);

    // 두 표시가 동일한 텍스트로 오염되지 않음
    expect(texts.some((t) => t.includes('문제 진행: 3 / 4'))).toBe(false);
    expect(texts.some((t) => t.includes('기회 3 / 10'))).toBe(false);
  });

  it('6. 우선순위 배너(isPaused, trackingLost, needsMotionReprep, validationError)가 정상 보존되어야 한다', () => {
    const hud = new AssaultHUD();
    const loopSnapshot = createMockLoopPresentation({
      currentSegmentIndex: 0,
      currentSegmentKind: 'run_question',
      segmentRemainingBeats: 8,
    });

    // 6.1 trackingLost 배너
    const ctxTracking = createMockContext();
    hud.render(
      ctxTracking,
      { playerHp: 100, completedQuestions: 0, targetRounds: 10, trackingLost: true },
      { width: 1080, height: 720 },
      undefined,
      loopSnapshot
    );
    expect(getAllRenderedTexts(ctxTracking).some((t) => t.includes('카메라 추적 상실'))).toBe(true);

    // 6.2 needsMotionReprep 배너
    const ctxReprep = createMockContext();
    hud.render(
      ctxReprep,
      { playerHp: 100, completedQuestions: 0, targetRounds: 10, needsMotionReprep: true },
      { width: 1080, height: 720 },
      undefined,
      loopSnapshot
    );
    expect(getAllRenderedTexts(ctxReprep).some((t) => t.includes('자세 재준비'))).toBe(true);

    // 6.3 validationError 배너
    const ctxError = createMockContext();
    hud.render(
      ctxError,
      { playerHp: 100, completedQuestions: 0, targetRounds: 10, validationError: '프로필 불일치' },
      { width: 1080, height: 720 },
      undefined,
      loopSnapshot
    );
    expect(getAllRenderedTexts(ctxError).some((t) => t.includes('[진입 오류]') && t.includes('프로필 불일치'))).toBe(true);

    // 6.4 isPaused 오버레이
    const ctxPause = createMockContext();
    hud.render(
      ctxPause,
      { playerHp: 100, completedQuestions: 0, targetRounds: 10, isPaused: true },
      { width: 1080, height: 720 },
      undefined,
      loopSnapshot
    );
    expect(getAllRenderedTexts(ctxPause).some((t) => t.includes('일시정지 (PAUSED)'))).toBe(true);
  });

  it('7. loop 정보가 없는 기존 render 호출 fixture는 하위 호환성을 100% 보존해야 한다', () => {
    const hud = new AssaultHUD();
    const ctx = createMockContext();
    const snapshot: AssaultHUDSnapshot = {
      playerHp: 100,
      completedQuestions: 2,
      targetRounds: 5,
      strikeCount: 4,
    };

    // 기존 시그니처 호출 (loopSnapshot 없음)
    hud.render(ctx, 1080, 720, snapshot);

    const texts = getAllRenderedTexts(ctx);

    // 기존 항목 정상 렌더링
    expect(texts.some((t) => t.includes('100') && t.includes('HP'))).toBe(true);
    expect(texts.some((t) => t.includes('2 / 5'))).toBe(true);
    expect(texts.some((t) => t.includes('타격 수: 4회'))).toBe(true);

    // 루프 안내 항목은 렌더링되지 않아야 함
    expect(texts.some((t) => t.includes('달리기') || t.includes('답안 선택') || t.includes('휴식') || t.includes('스쿼트 회피'))).toBe(false);
    expect(texts.some((t) => t.includes('기회'))).toBe(false);
    expect(texts.some((t) => t.includes('러닝 중'))).toBe(false);
  });

  it('8. 동결된 스냅샷에 대해 반복 render 호출 시 멱등성을 보장하고 내부 상태를 변경하지 않아야 한다', () => {
    const hud = new AssaultHUD();
    const ctx = createMockContext();
    const snapshot: AssaultHUDSnapshot = Object.freeze({
      playerHp: 100,
      completedQuestions: 1,
      targetRounds: 10,
    });
    const loopSnapshot = Object.freeze(
      createMockLoopPresentation({
        currentSegmentIndex: 0,
        currentSegmentKind: 'run_question',
        segmentRemainingBeats: 8,
      })
    );

    const mathRandomSpy = vi.spyOn(Math, 'random');

    // 1회차 렌더링
    hud.render(ctx, snapshot, { width: 1080, height: 720 }, undefined, loopSnapshot);
    const count1 = (ctx.fillText as any).mock.calls.length;

    // 2회차 렌더링
    const ctx2 = createMockContext();
    hud.render(ctx2, snapshot, { width: 1080, height: 720 }, undefined, loopSnapshot);
    const count2 = (ctx2.fillText as any).mock.calls.length;

    expect(count1).toBe(count2);
    expect(mathRandomSpy).not.toHaveBeenCalled();

    mathRandomSpy.mockRestore();
  });

  it('9. 다양한 루프 스냅샷 전달 포트(snapshot.loop, setLoopSnapshot, render 인자)를 지원해야 한다', () => {
    const loopSnapshot = createMockLoopPresentation({
      currentSegmentIndex: 0,
      currentSegmentKind: 'run_question',
      segmentRemainingBeats: 8,
      currentOpportunity: 1,
    });

    // 9.1 snapshot.loop 속성으로 전달
    const hud1 = new AssaultHUD();
    const ctx1 = createMockContext();
    const snapshotWithLoop: AssaultHUDSnapshot = {
      playerHp: 100,
      completedQuestions: 0,
      targetRounds: 10,
      loop: loopSnapshot,
    };
    hud1.render(ctx1, snapshotWithLoop, { width: 1080, height: 720 });
    expect(getAllRenderedTexts(ctx1).some((t) => t.includes('달리기'))).toBe(true);

    // 9.2 hud.setLoopSnapshot 포트로 전달
    const hud2 = new AssaultHUD();
    const ctx2 = createMockContext();
    hud2.setSnapshot({ playerHp: 100, completedQuestions: 0, targetRounds: 10 });
    hud2.setLoopSnapshot(loopSnapshot);
    hud2.render(ctx2, 1080, 720);
    expect(getAllRenderedTexts(ctx2).some((t) => t.includes('달리기'))).toBe(true);

    // 9.3 생성자 인자로 전달
    const hud3 = new AssaultHUD({ playerHp: 100, completedQuestions: 0, targetRounds: 10 }, loopSnapshot);
    const ctx3 = createMockContext();
    hud3.render(ctx3, 1080, 720);
    expect(getAllRenderedTexts(ctx3).some((t) => t.includes('달리기'))).toBe(true);
  });
});
