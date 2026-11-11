/** #536 — Read-only assault results. No aggregation, resource calls or storage IO.
 * The caller owns terminal outcome, cumulative stats, paging input and canvas DPR.
 * Round summaries are shown separately, never summed to fill missing session data.
 */
import type {
  AssaultStoredSessionResult, AssaultResultSaveResult, AssaultResultLoadResult,
} from '../storage/AssaultResultStore.js';
import type { AssaultCumulativeStats, AssaultProgressEvaluation } from '../game/assault/AssaultProgressController.js';
import type { AssaultFinaleSnapshot } from '../game/assault/AssaultFinaleController.js';
import type { AssaultExerciseSummary } from '../game/assault/AssaultExerciseTally.js';
import type { AssaultRoundSummaryData } from '../game/assault/AssaultRoundSummary.js';
import { deepFreeze } from '../utils/deepFreeze.js';
import { UIText } from '../utils/UIText.js';
import { UI_LAYOUT } from '../../config/ui.config.js';

export interface AssaultResultSnapshot {
  readonly result: AssaultStoredSessionResult | null;
  /** Authority supplied by the engine; UI never infers a win from HP or progress. */
  readonly outcome: 'completed' | 'aborted' | 'defeated';
  readonly playerHp?: number;
  readonly stats?: AssaultCumulativeStats;
  readonly progress?: Pick<AssaultProgressEvaluation, 'completedRounds' | 'targetRounds' | 'progress'>;
  readonly finale?: Pick<AssaultFinaleSnapshot, 'phase' | 'playerHp' | 'bossHp' | 'activeSeconds'>;
  readonly exercise?: AssaultExerciseSummary;
  readonly storage?: AssaultResultSaveResult | AssaultResultLoadResult;
}

export interface AssaultResultRow {
  readonly label: string;
  readonly value: string;
}

export interface AssaultResultViewModel {
  readonly title: string;
  readonly rows: readonly AssaultResultRow[];
}

export interface AssaultResultPage {
  readonly pageIndex: number;
  readonly pageCount: number;
  /** Body only, excludes the repeated title and page indicator. Canvas coordinates. */
  readonly bodyBounds: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

const unsupported = '미지원';
const outcomes = {
  completed: '완료 (completed)', aborted: '중단 (aborted)', defeated: '사망 (defeated)',
} as const;
const finalePhases = {
  ready: '준비 (ready)', active: '진행 (active)', encounter: '조우 (encounter)',
  victory: '승리 (victory)', defeat: '패배 (defeat)',
} as const;

function display(value: string | number | undefined | null): string {
  if (value === undefined || value === null || (typeof value === 'number' && !Number.isFinite(value))) return unsupported;
  return String(value);
}

function ratings(counts: AssaultCumulativeStats['ratingCounts'] | undefined): string {
  return counts ? `Perfect ${counts.Perfect} / Good ${counts.Good} / Late ${counts.Late} / Miss ${counts.Miss}` : unsupported;
}

/** Wrap without trimming, ellipsis, maxWidth text compression or code-point loss. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text);
  for (const { segment } of segments) {
    if (ctx.measureText(segment).width > width) throw new RangeError('Viewport too narrow for readable result text');
    if (line && ctx.measureText(line + segment).width > width) {
      lines.push(line);
      line = '';
    }
    line += segment;
  }
  if (line) lines.push(line);
  return lines;
}

export class AssaultResultView {
  createViewModel(snapshot: AssaultResultSnapshot): AssaultResultViewModel {
    const rows: AssaultResultRow[] = [];
    const add = (label: string, value: string | number | undefined | null): void => {
      rows.push({ label, value: display(value) });
    };
    const { result, stats, progress, finale, exercise, storage } = snapshot;
    add('종료 상태', outcomes[snapshot.outcome]);
    add('결과 데이터', result ? '수신' : '누락');
    add('완료 문제', stats?.totalCompletedQuestions);
    add('시도한 답 공격', stats?.totalAttemptedAnswerHits);
    add('정답 타격', stats?.totalCorrectHits);
    add('오답 타격', stats?.totalWrongHits);
    add('미선택', stats?.totalTimeoutHits);
    add('최대 타격 콤보', stats?.maxCombo);
    add('회피 성공', stats?.totalEvadeSuccessCount);
    add('회피 실패', stats?.totalSquatFailCount);
    add('리듬 등급 횟수', ratings(stats?.ratingCounts));
    add('리듬 정확도', unsupported);
    add('활성 시간 (초)', stats?.totalActiveDurationSeconds);
    add('남은 HP', snapshot.playerHp);
    add('접근 완료 / 목표', progress ? `${progress.completedRounds} / ${progress.targetRounds}` : unsupported);
    add('도달 진행도 (0~1)', progress?.progress);
    add('결전 상태', finale ? finalePhases[finale.phase] : unsupported);
    if (finale) {
      add('결전 플레이어 HP', finale.playerHp);
      add('결전 보스 HP', finale.bossHp);
      add('결전 활성 시간 (초)', finale.activeSeconds);
    }
    add('실측 펀치', exercise?.totalPunchCount);
    add('실측 왼손 펀치', exercise?.leftPunchCount);
    add('실측 오른손 펀치', exercise?.rightPunchCount);
    add('실측 스쿼트', exercise?.squatCount);
    add('실측 가드', exercise?.guardCount);
    add('실측 대체 동작', exercise?.alternativeCount);
    add('운동 활성 시간 (초)', exercise?.activeDurationSeconds);
    add('전체 칼로리 (kcal)', unsupported);
    add('스쿼트 부분 칼로리 (kcal)', exercise?.partialSquatKcal);
    add('걸음', unsupported);

    if (result) {
      add('세션', result.sessionId);
      const identity = result.identity;
      const identityLabels = {
        mode: '모드', rulesVersion: '규칙 버전', profileId: '프로필', difficultyId: '난이도',
        tempoBpm: '템포 (BPM)', plannedAnswerOpportunities: '계획된 답 공격 기회',
        inputProfileId: '입력 프로필', accessibilityProfileId: '접근성 프로필',
        questionFormat: '문제 형식', roundSourceKind: '라운드 출처',
      } as const;
      for (const key of Object.keys(identityLabels) as (keyof typeof identityLabels)[]) {
        add(identityLabels[key], identity[key]);
      }
      add('챌린지 계열', identity.challengeFamilies.length === 0 ? '미사용' : identity.challengeFamilies.join(', '));
      add('챌린지 규칙', identity.challengeRulesVersion);
      for (const round of result.rounds) this.addRound(round, add);
    }

    add('보상 기능', '미사용 — 지급 평가 내역이며 지급 영수증 아님');
    if (!result?.rewardEvaluations.length) add('보상 평가', '내역 없음');
    for (const entry of result?.rewardEvaluations ?? []) {
      add('보상 라운드', entry.plan.roundId);
      add('보상 프로필', entry.plan.rewardProfileId);
      add('보상 규칙 버전', entry.plan.rulesVersion);
      add('보상 계획 상태', entry.plan.status);
      add('보상 평가', entry.evaluation.status === 'no-reward'
        ? '무보상 (no-reward)' : '중복 요청 (duplicate), 추가 지급 없음');
    }

    if (!storage) add('저장 상태', '미확인');
    else if (storage.status === 'error') add('저장 상태', `저장 오류: ${storage.code}`);
    else if (storage.status === 'missing') add('저장 상태', '기록 없음');
    else if (storage.status === 'skipped') add('저장 상태', storage.reason === 'test-session'
      ? '저장 안 함: 테스트 세션' : '저장 안 함: 기록 비활성');
    else {
      add('저장 상태', '저장 확인 (지급 영수증 아님)');
      add('저장 스키마', storage.receipt.schemaVersion);
      add('저장 세션', storage.receipt.result.sessionId);
    }
    return deepFreeze({ title: '전투 결과', rows });
  }

  private addRound(round: AssaultRoundSummaryData, add: (label: string, value: string | number) => void): void {
    add('라운드', round.roundId);
    add('라운드 상태', round.isDefeated ? outcomes.defeated : round.isAborted ? outcomes.aborted : outcomes.completed);
    const labels = {
      completedQuestions: '라운드 완료 문제', attemptedAnswerHits: '라운드 답 공격',
      correctCount: '라운드 정답 타격', wrongCount: '라운드 오답 타격', timeoutCount: '라운드 미선택',
      maxCombo: '라운드 최대 콤보', endCombo: '라운드 종료 콤보',
      evadeSuccessCount: '라운드 회피 성공', squatFailCount: '라운드 회피 실패',
      totalPlayerDamage: '라운드 플레이어 실제 피해', totalBossDamage: '라운드 보스 실제 피해',
      activeDurationSeconds: '라운드 활성 시간 (초)',
    } as const;
    for (const key of Object.keys(labels) as (keyof typeof labels)[]) add(labels[key], display(round[key]));
    add('라운드 리듬 등급 횟수', ratings(round.ratingCounts));
  }

  /** All dimensions are the caller's visible canvas coordinate units (not backing pixels).
   * Call again with the returned pageIndex +/- 1 to navigate. No listeners/state retained.
   */
  render(ctx: CanvasRenderingContext2D, width: number, height: number,
    snapshot: AssaultResultSnapshot, pageIndex = 0): AssaultResultPage {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new RangeError('Result viewport must be finite and positive');
    }
    ctx.save();
    try {
      const vm = this.createViewModel(snapshot);
      const panel = UIText.getLayoutSlot('result', 'panel', width, height);
      const scale = Math.min(width / 1080, height / 2160);
      const fontSize = UIText.getFontSize('body', scale);
      const lineHeight = fontSize * 1.4;
      const inset = Math.max(fontSize, (UI_LAYOUT.result.stats.x - UI_LAYOUT.result.panel.x) * scale);
      const titleSize = UIText.getFontSize('title', scale);
      const footerSize = UIText.getFontSize('caption', scale);
      const bodyBounds = {
        x: panel.x + inset, y: panel.y + inset + titleSize * 1.5,
        w: panel.w - inset * 2,
        h: panel.h - inset * 2 - titleSize * 1.5 - footerSize * 2,
      };
      const capacity = Math.floor(bodyBounds.h / lineHeight);
      if (capacity < 1 || bodyBounds.w < fontSize) throw new RangeError('Result viewport cannot fit readable text');
      ctx.font = UIText.getFont('body', scale);
      const lines = vm.rows.flatMap(row => wrap(ctx, `${row.label}: ${row.value}`, bodyBounds.w));
      const pageCount = Math.max(1, Math.ceil(lines.length / capacity));
      const selected = Number.isFinite(pageIndex) ? Math.max(0, Math.min(pageCount - 1, Math.floor(pageIndex))) : 0;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = UIText.getColor('bgDim');
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = UIText.getColor('bgCard');
      ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
      ctx.strokeStyle = UIText.getColor('accent');
      ctx.lineWidth = Math.max(1, 2 * scale);
      ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);
      ctx.font = UIText.getFont('title', scale);
      ctx.fillStyle = UIText.getColor('textPrimary');
      ctx.fillText(vm.title, bodyBounds.x, panel.y + inset);
      ctx.font = UIText.getFont('body', scale);
      lines.slice(selected * capacity, (selected + 1) * capacity).forEach((line, index) => {
        ctx.fillText(line, bodyBounds.x, bodyBounds.y + index * lineHeight);
      });
      ctx.font = UIText.getFont('caption', scale);
      ctx.fillStyle = UIText.getColor('primary');
      ctx.fillText(`${selected + 1} / ${pageCount}`, bodyBounds.x, panel.y + panel.h - inset - footerSize);
      return deepFreeze({ pageIndex: selected, pageCount, bodyBounds });
    } finally {
      ctx.restore();
    }
  }
}
