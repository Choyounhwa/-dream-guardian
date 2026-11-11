import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssaultResultView, type AssaultResultSnapshot } from '../../src/ui/AssaultResultView.js';
import type { AssaultStoredSessionResult, AssaultResultSaveResult, AssaultResultLoadResult } from '../../src/storage/AssaultResultStore.js';
import type { AssaultRoundSummaryData } from '../../src/game/assault/AssaultRoundSummary.js';
import { planAssaultRoundReward, requestAssaultRoundReward } from '../../src/game/assault/AssaultRewardPolicy.js';
import { DEFAULT_ASSAULT_REWARD_CONFIG } from '../../config/assault-reward.config.js';
import { deepFreeze } from '../../src/utils/deepFreeze.js';
import { UIText } from '../../src/utils/UIText.js';

function fixture(): AssaultResultSnapshot {
  const round: AssaultRoundSummaryData = {
    sessionId: 'session-fixture', roundId: 'round-fixture', completedQuestions: 1,
    isAborted: false, isDefeated: false, correctCount: 1, wrongCount: 1, timeoutCount: 1,
    evadeSuccessCount: 2, squatFailCount: 1, totalEncounters: 6, attemptedAnswerHits: 3,
    ratingCounts: { Perfect: 1, Good: 1, Late: 0, Miss: 1 }, maxCombo: 1, endCombo: 0,
    totalPlayerDamage: 7, totalBossDamage: 0, totalActualDamage: 7, actualDamage: 7,
    totalRequestedDamage: 7, activeDurationSeconds: 12.375,
    processedAttackIds: ['a', 'b', 'c', 'd', 'e', 'f'], processedReceiptIds: ['receipt-a'],
  };
  const plan = planAssaultRoundReward(round, DEFAULT_ASSAULT_REWARD_CONFIG);
  const result: AssaultStoredSessionResult = {
    sessionId: round.sessionId,
    identity: {
      mode: 'boss_assault', rulesVersion: 'fixture-rules-v1', profileId: 'fixture-profile',
      difficultyId: 'fixture-difficulty', tempoBpm: 103, plannedAnswerOpportunities: 3,
      inputProfileId: 'fixture-keyboard', accessibilityProfileId: 'low-impact-guard',
      questionFormat: 'numeric', roundSourceKind: 'numeric_repeat',
      challengeFamilies: [], challengeRulesVersion: null,
    },
    rounds: [round], rewardEvaluations: [{ plan, evaluation: requestAssaultRoundReward(plan, []) }],
  };
  return deepFreeze({
    result, outcome: 'completed', playerHp: 43,
    stats: {
      totalCompletedQuestions: 1, totalCorrectHits: 1, totalWrongHits: 1, totalTimeoutHits: 1,
      totalEvadeSuccessCount: 2, totalSquatFailCount: 1, totalEncounters: 6,
      totalAttemptedAnswerHits: 3, ratingCounts: round.ratingCounts, maxCombo: 1,
      totalPlayerDamage: 7, totalBossDamage: 0, totalActualDamage: 7,
      totalRequestedDamage: 7, totalActiveDurationSeconds: 12.375, processedRoundIds: [round.roundId],
    },
    progress: { completedRounds: 1, targetRounds: 4, progress: 0.25 },
    finale: { phase: 'ready', playerHp: 43, bossHp: 17, activeSeconds: 0 },
    exercise: {
      leftPunchCount: 2, rightPunchCount: 1, totalPunchCount: 3, squatCount: 2,
      guardCount: 1, alternativeCount: 1, activeDurationSeconds: 13.125,
      kcalSupported: false, estimatedKcal: null, partialSquatKcal: 0.7,
      kcalDetails: { supported: false, reason: 'fixture-unsupported', partialSquatKcal: 0.7 },
      processedInputIds: ['i1', 'i2', 'i3', 'i4', 'i5', 'i6'],
    },
  } as const);
}

type Draw = { text: string; x: number; y: number; width: number; fontSize: number };
// Node environment, no window/devicePixelRatio assumptions. Model text width by current font.
function canvas() {
  const draws: Draw[] = [];
  const context = {
    font: 'normal 20px sans-serif', fillStyle: '', strokeStyle: '', lineWidth: 1,
    textAlign: 'left', textBaseline: 'top',
    save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    measureText(text: string) {
      const size = Number(this.font.match(/([\d.]+)px/)?.[1] ?? 20);
      return { width: Array.from(text).length * size };
    },
    fillText(text: string, x: number, y: number) {
      draws.push({ text, x, y, width: this.measureText(text).width,
        fontSize: Number(this.font.match(/([\d.]+)px/)?.[1]) });
    },
  };
  return { ctx: context as unknown as CanvasRenderingContext2D, draws };
}

const view = new AssaultResultView();
function rows(snapshot: AssaultResultSnapshot) { return view.createViewModel(snapshot).rows; }
function value(snapshot: AssaultResultSnapshot, label: string) {
  return rows(snapshot).find(row => row.label === label)?.value;
}

// Deliberately select body by the renderer's public geometry, never join headers/footers.
function renderAll(snapshot: AssaultResultSnapshot, width: number, height: number) {
  const pages: Draw[][] = [];
  let pageCount = 1;
  for (let index = 0; index < pageCount; index++) {
    const { ctx, draws } = canvas();
    const page = view.render(ctx, width, height, snapshot, index);
    pageCount = page.pageCount;
    expect(page.pageIndex).toBe(index);
    expect(pageCount).toBeLessThan(1000);
    const { x, y, w, h } = page.bodyBounds;
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x + w).toBeLessThanOrEqual(width);
    expect(y + h).toBeLessThanOrEqual(height);
    const body = draws.filter(draw => draw.y >= y && draw.y < y + h);
    expect(body.length).toBeGreaterThan(0);
    for (const draw of draws) {
      expect(draw.fontSize).toBeGreaterThanOrEqual(16);
      expect(draw.x).toBeGreaterThanOrEqual(0);
      expect(draw.x + draw.width).toBeLessThanOrEqual(width + 0.001);
      expect(draw.y).toBeGreaterThanOrEqual(0);
      expect(draw.y + draw.fontSize).toBeLessThanOrEqual(height + 0.001);
    }
    for (let i = 0; i < body.length; i++) {
      expect(body[i].x).toBeGreaterThanOrEqual(x);
      expect(body[i].x + body[i].width).toBeLessThanOrEqual(x + w + 0.001);
      expect(body[i].y + body[i].fontSize).toBeLessThanOrEqual(y + h + 0.001);
      if (i > 0) expect(body[i].y).toBeGreaterThanOrEqual(body[i - 1].y + body[i - 1].fontSize);
    }
    pages.push(body);
  }
  return pages;
}

afterEach(() => { UIText.resetAccessibility(); vi.restoreAllMocks(); });

describe('#536 AssaultResultView — DTO 표시만 수행', () => {
  it('완료 문제1과 답 공격3/정답/오답/미선택을 구분한다', () => {
    const snapshot = fixture();
    expect(value(snapshot, '완료 문제')).toBe('1');
    expect(value(snapshot, '시도한 답 공격')).toBe('3');
    expect(value(snapshot, '정답 타격')).toBe('1');
    expect(value(snapshot, '오답 타격')).toBe('1');
    expect(value(snapshot, '미선택')).toBe('1');
  });

  it('콤보/회피/리듬 등급을 원본 수치로 표시하고 정확도를 계산하지 않는다', () => {
    const snapshot = fixture();
    expect(value(snapshot, '최대 타격 콤보')).toBe('1');
    expect(value(snapshot, '회피 성공')).toBe('2');
    expect(value(snapshot, '회피 실패')).toBe('1');
    expect(value(snapshot, '리듬 등급 횟수')).toBe('Perfect 1 / Good 1 / Late 0 / Miss 1');
    expect(value(snapshot, '리듬 정확도')).toBe('미지원');
  });

  it('활성 시간/HP/접근 실측값을 반올림·비율 계산 없이 표시한다', () => {
    const snapshot = fixture();
    expect(value(snapshot, '활성 시간 (초)')).toBe('12.375');
    expect(value(snapshot, '남은 HP')).toBe('43');
    expect(value(snapshot, '접근 완료 / 목표')).toBe('1 / 4');
    expect(value(snapshot, '도달 진행도 (0~1)')).toBe('0.25');
  });

  it('상위 집계값을 rounds에서 다시 계산하거나 HP에서 추론하지 않는다', () => {
    const snapshot = fixture();
    const changed = { ...snapshot, playerHp: 0, stats: { ...snapshot.stats!, totalCompletedQuestions: 9,
      totalAttemptedAnswerHits: 27, totalActiveDurationSeconds: 0.007, maxCombo: 19 },
      progress: { completedRounds: 8, targetRounds: 11, progress: 0.618 } };
    expect(value(changed, '완료 문제')).toBe('9');
    expect(value(changed, '시도한 답 공격')).toBe('27');
    expect(value(changed, '최대 타격 콤보')).toBe('19');
    expect(value(changed, '활성 시간 (초)')).toBe('0.007');
    expect(value(changed, '도달 진행도 (0~1)')).toBe('0.618');
    expect(value(changed, '종료 상태')).toBe('완료 (completed)');
  });

  it.each(['completed', 'aborted', 'defeated'] as const)('세션 종료 상태 %s를 직접 표시한다', outcome => {
    expect(value({ ...fixture(), outcome }, '종료 상태')).toContain(`(${outcome})`);
  });

  it('중단 문제0과 진행 도중 타격3을 혼동하지 않고 라운드 중단을 표시한다', () => {
    const base = fixture();
    const snapshot = { ...base, outcome: 'aborted' as const,
      stats: { ...base.stats!, totalCompletedQuestions: 0 },
      result: { ...base.result!, rounds: [{ ...base.result!.rounds[0], completedQuestions: 0, isAborted: true }] } };
    expect(value(snapshot, '완료 문제')).toBe('0');
    expect(value(snapshot, '시도한 답 공격')).toBe('3');
    expect(value(snapshot, '라운드 상태')).toBe('중단 (aborted)');
  });

  it.each(['ready', 'active', 'encounter', 'victory', 'defeat'] as const)('결전 %s를 upstream phase 그대로 구분한다', phase => {
    const base = fixture();
    expect(value({ ...base, finale: { ...base.finale!, phase } }, '결전 상태')).toContain(phase);
  });

  it('결전 사망과 동시 HP0은 전달된 defeat로 표시하며 승리를 발명하지 않는다', () => {
    const base = fixture();
    const snapshot = { ...base, outcome: 'defeated' as const, playerHp: 0,
      finale: { phase: 'defeat' as const, playerHp: 0, bossHp: 0, activeSeconds: 9.875 } };
    expect(value(snapshot, '결전 상태')).toBe('패배 (defeat)');
    expect(value(snapshot, '결전 플레이어 HP')).toBe('0');
    expect(value(snapshot, '결전 보스 HP')).toBe('0');
    expect(value(snapshot, '결전 활성 시간 (초)')).toBe('9.875');
  });

  it('입력/저충격/규칙 및 모든 비교 식별자를 생략 없이 표시한다', () => {
    const snapshot = fixture();
    for (const field of ['mode', 'rulesVersion', 'profileId', 'difficultyId', 'tempoBpm',
      'plannedAnswerOpportunities', 'inputProfileId', 'accessibilityProfileId', 'questionFormat', 'roundSourceKind'] as const) {
      expect(rows(snapshot).some(row => row.value.includes(String(snapshot.result!.identity[field])))).toBe(true);
    }
    expect(value(snapshot, '챌린지 계열')).toBe('미사용');
    expect(value(snapshot, '챌린지 규칙')).toBe('미지원');
  });

  it('실측 운동과 부분 kcal은 구분하고 전체 kcal/걸음 미지원에 0을 채우지 않는다', () => {
    const snapshot = fixture();
    expect(value(snapshot, '실측 펀치')).toBe('3');
    expect(value(snapshot, '실측 스쿼트')).toBe('2');
    expect(value(snapshot, '실측 가드')).toBe('1');
    expect(value(snapshot, '운동 활성 시간 (초)')).toBe('13.125');
    expect(value(snapshot, '전체 칼로리 (kcal)')).toBe('미지원');
    expect(value(snapshot, '스쿼트 부분 칼로리 (kcal)')).toBe('0.7');
    expect(value(snapshot, '걸음')).toBe('미지원');
  });

  it('누락 DTO/집계/HP/시간을 rounds 합계나 기존 상수로 채우지 않는다', () => {
    const snapshot: AssaultResultSnapshot = { result: null, outcome: 'aborted' };
    for (const label of ['완료 문제', '시도한 답 공격', '남은 HP', '활성 시간 (초)', '도달 진행도 (0~1)', '결전 상태', '실측 펀치']) {
      expect(value(snapshot, label)).toBe('미지원');
    }
    expect(value(snapshot, '결과 데이터')).toBe('누락');
    expect(value(snapshot, '저장 상태')).toBe('미확인');
    expect(value({ ...fixture(), stats: undefined }, '완료 문제')).toBe('미지원');
  });

  const storageCases: [AssaultResultSaveResult | AssaultResultLoadResult | undefined, string][] = [
    [undefined, '미확인'], [{ status: 'missing' }, '기록 없음'],
    [{ status: 'skipped', reason: 'test-session' }, '저장 안 함: 테스트 세션'],
    [{ status: 'skipped', reason: 'recording-disabled' }, '저장 안 함: 기록 비활성'],
    ...(['invalid-result', 'corrupt-data', 'unsupported-schema', 'storage-read-failed', 'storage-write-failed', 'conflict'] as const)
      .map(code => [{ status: 'error', code }, `저장 오류: ${code}`] as [AssaultResultSaveResult, string]),
  ];
  it.each(storageCases)('저장 응답 %j를 거짓 성공 없이 설명한다', (storage, expected) => {
    const snapshot = { ...fixture(), storage };
    expect(value(snapshot, '저장 상태')).toBe(expected);
    expect(rows(snapshot).map(row => row.value).join(' ')).not.toMatch(/지급 성공|저장 성공/);
  });

  it.each(['stored', 'found'] as const)('%s 영수증은 저장 확인이며 지급 성공이 아니다', status => {
    const base = fixture();
    const snapshot = { ...base, storage: { status, receipt: { schemaVersion: 1 as const,
      status: 'stored' as const, result: base.result! } } };
    expect(value(snapshot, '저장 상태')).toBe('저장 확인 (지급 영수증 아님)');
    expect(value(snapshot, '저장 스키마')).toBe('1');
  });

  it('무보상/중복 평가를 구별하고 5개 unused 보상을 활성 수치로 표시하지 않는다', () => {
    const base = fixture();
    expect(value(base, '보상 평가')).toBe('무보상 (no-reward)');
    const entry = base.result!.rewardEvaluations[0];
    const snapshot = { ...base, result: { ...base.result!, rewardEvaluations: [{ ...entry,
      evaluation: { ...entry.evaluation, status: 'duplicate' as const } }] } };
    expect(value(snapshot, '보상 평가')).toBe('중복 요청 (duplicate), 추가 지급 없음');
    expect(value(snapshot, '보상 기능')).toBe('미사용 — 지급 평가 내역이며 지급 영수증 아님');
    expect(rows(snapshot).map(row => row.label).join(' ')).not.toMatch(/마나|별가루|미니언|성장|스펠|랭킹/);
    expect(value({ ...base, result: { ...base.result!, rewardEvaluations: [] } }, '보상 평가')).toBe('내역 없음');
  });

  it.each([[320, 568], [390, 844], [844, 390], [1280, 720], [1920, 1080]])(
    '%ix%i 모든 페이지는 본문 전체를 순서대로 누락 없이 경계 안에 표시한다', (width, height) => {
      const snapshot = fixture();
      const pages = renderAll(snapshot, width, height);
      expect(pages.flat().map(draw => draw.text).join('')).toBe(rows(snapshot).map(row => `${row.label}: ${row.value}`).join(''));
    });

  it('페이지 경계를 넘는 긴 식별자/공백/유니코드 문자도 본문만으로 완전히 복원한다', () => {
    const base = fixture();
    const longId = 'long-profile-🛡️-한글  '.repeat(32);
    const snapshot = deepFreeze({ ...base, result: { ...base.result!, identity: { ...base.result!.identity, profileId: longId } } });
    const pages = renderAll(snapshot, 320, 568);
    expect(pages.length).toBeGreaterThan(2);
    const actualBody = pages.flat().map(draw => draw.text).join('');
    const expectedBody = rows(snapshot).map(row => `${row.label}: ${row.value}`).join('');
    expect(actualBody).toBe(expectedBody);
    expect(actualBody).toContain(longId);
    expect(actualBody).not.toContain('…');
  });

  it('전역 접근성 확대에도 폰트를 줄이지 않고 페이지로 분할한다', () => {
    UIText.setFontScale(1.5);
    const snapshot = fixture();
    const pages = renderAll(snapshot, 320, 568);
    expect(pages.flat().map(draw => draw.text).join('')).toBe(rows(snapshot).map(row => `${row.label}: ${row.value}`).join(''));
  });

  it('페이지 인덱스는 안전하게 보정하고 동일 동결 DTO 반복 표시가 불변이다', () => {
    const snapshot = fixture();
    const before = JSON.stringify(snapshot);
    const first = canvas();
    const page = view.render(first.ctx, 390, 844, snapshot, 0);
    const again = canvas();
    expect(view.render(again.ctx, 390, 844, snapshot, 0)).toEqual(page);
    expect(again.draws).toEqual(first.draws);
    for (const index of [-10, NaN, Infinity]) {
      expect(view.render(canvas().ctx, 390, 844, snapshot, index).pageIndex).toBe(0);
    }
    expect(view.render(canvas().ctx, 390, 844, snapshot, 1e6).pageIndex).toBe(page.pageCount - 1);
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(first.ctx.save).toHaveBeenCalledTimes(1);
    expect(first.ctx.restore).toHaveBeenCalledTimes(1);
  });
});
