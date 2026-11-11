/**
 * AssaultImpactWireHelper.ts - 보스 접근전 답안 타격 시각 효과(정답 폭죽/팝핑, 오답 디졸브) 라우팅 헬퍼
 *
 * [ASSAULT-FX-003] (Issue #692)
 * - SRP 및 파일 1,000줄 이하 원칙 준수를 위한 타격 이펙트 전담 라우터
 * - 정답 무효화(boss_negate / correct) 및 오답 피격(player_damage / wrong) 발생 시
 *   좌/우 타깃 좌표(NoteAnchorResolver) 및 선택지 텍스트를 산출하여 AssaultImpactVFX로 트리거.
 */

import type { AssaultImpactVFX } from '../../render/assault/AssaultImpactVFX.js';
import { resolveAnchor } from '../../render/NoteAnchorResolver.js';
import type { QuestionCandidate } from '../../question/AssaultQuestionEligibility.js';
import type { AssaultSessionWireHost } from './AssaultSessionWireHelper.js';

export class AssaultImpactWireHelper {
  private readonly _triggeredImpactKeys = new Set<string>();

  public clear(): void {
    this._triggeredImpactKeys.clear();
  }

  /**
   * 정산 커맨드 수신 시 타격 이펙트 트리거
   */
  public handleAssaultSettlementImpact(
    cmd: any,
    host: AssaultSessionWireHost,
    session?: any,
    vfxOverride?: AssaultImpactVFX,
  ): void {
    const vfx =
      vfxOverride ??
      host.assaultImpactVFX ??
      (host.mainSceneContext as any)?.assaultImpactVFX ??
      (host as any).sceneDirector?.assaultHandler?.assaultImpactVFX ??
      (host as any).sceneDirector?.renderOrchestrator?.assaultHandler?.assaultImpactVFX ??
      (host as any).assaultSceneHandler?.assaultImpactVFX;

    if (!vfx || !cmd) return;

    const effectType = cmd.effectType;
    if (
      effectType !== 'boss_negate' &&
      effectType !== 'player_damage' &&
      effectType !== 'correct' &&
      effectType !== 'wrong'
    ) {
      return;
    }

    // 중복 연출 방지 멱등성 키 검사
    const idempotencyKey =
      cmd.idempotencyKey ??
      `${cmd.sessionId ?? 'assault'}:${cmd.attackId ?? 'hit'}:${effectType}`;
    if (this._triggeredImpactKeys.has(idempotencyKey)) {
      return;
    }
    this._triggeredImpactKeys.add(idempotencyKey);

    const vw = host.mainSceneContext?.canvasManager?.virtualWidth || 1280;
    const vh = host.mainSceneContext?.canvasManager?.virtualHeight || 720;
    const viewport = { width: vw, height: vh };

    const leftTarget = resolveAnchor({ part: 'leftHand', zoneId: 4 }, viewport);
    const rightTarget = resolveAnchor({ part: 'rightHand', zoneId: 5 }, viewport);

    const s = session;
    const presentation =
      s?.presentation ??
      s?.getPresentationSnapshot?.() ??
      (host.mainSceneContext as any)?.assaultPresentationSnapshot;
    const activeRound = s?.activeRoundController;

    // 타깃 측 판별: cmd.side / hand 또는 lockedChoice / correctSide 또는 기본 left
    let side: 'left' | 'right' = 'left';
    if (cmd.side === 'left' || cmd.side === 'right') {
      side = cmd.side;
    } else if (cmd.hand === 'left' || cmd.hand === 'right') {
      side = cmd.hand;
    } else if (activeRound?.encounters) {
      const matchEnc = activeRound.encounters.find(
        (e: any) => e.id === cmd.attackId || e.attackId === cmd.attackId,
      );
      if (matchEnc?.pairJudge?.state?.lockedChoice) {
        side = matchEnc.pairJudge.state.lockedChoice;
      } else if (matchEnc?.correctSide) {
        side = matchEnc.correctSide;
      }
    }

    const targetPos = side === 'right' ? rightTarget : leftTarget;
    const choiceText =
      side === 'right'
        ? (presentation?.rightChoiceText ?? '')
        : (presentation?.leftChoiceText ?? '');

    if (effectType === 'boss_negate' || effectType === 'correct') {
      vfx.triggerCorrect(targetPos.x, targetPos.y, choiceText, { side, balloonPulse: true });
    } else if (effectType === 'player_damage' || effectType === 'wrong') {
      vfx.triggerWrong(targetPos.x, targetPos.y, choiceText, { side, balloonPulse: true });
    }
  }

  /**
   * 펀치 직후 판정 상태 즉시 감지 및 이펙트 선반영
   */
  public checkAndTriggerPunchImpact(
    activeRound: any,
    hand: 'left' | 'right',
    host: AssaultSessionWireHost,
    session?: any,
    vfxOverride?: AssaultImpactVFX,
  ): void {
    if (!activeRound?.encounters) return;
    for (const enc of activeRound.encounters) {
      if (enc.def?.kind === 'answer_pair' && enc.pairJudge?.state) {
        const state = enc.pairJudge.state;
        const attackId = enc.id ?? enc.attackId ?? 'pair';
        if (state.status === 'correct') {
          const key = `${activeRound.roundId}:${attackId}:boss_negate`;
          if (!this._triggeredImpactKeys.has(key)) {
            this.handleAssaultSettlementImpact(
              {
                attackId,
                side: hand,
                effectType: 'boss_negate',
                idempotencyKey: key,
              },
              host,
              session,
              vfxOverride,
            );
          }
        } else if (state.status === 'wrong_locked') {
          const key = `${activeRound.roundId}:${attackId}:wrong_punch`;
          if (!this._triggeredImpactKeys.has(key)) {
            this.handleAssaultSettlementImpact(
              {
                attackId,
                side: hand,
                effectType: 'player_damage',
                idempotencyKey: key,
              },
              host,
              session,
              vfxOverride,
            );
          }
        }
      }
    }
  }
}

export function createFallbackHandover(sessionId: string, finalHp: number): any {
  return {
    sessionId,
    mode: 'boss_assault',
    rulesVersion: 'v0.3',
    finalHp,
    targetRounds: 10,
    completedRounds: 10,
    stats: {
      totalCompletedQuestions: 10,
      totalCorrectHits: 10,
      totalWrongHits: 0,
      totalTimeoutHits: 0,
      totalEvadeSuccessCount: 10,
      totalSquatFailCount: 0,
      totalEncounters: 20,
      totalAttemptedAnswerHits: 10,
      ratingCounts: { Perfect: 10, Good: 0, Late: 0, Miss: 0 },
      maxCombo: 0,
      totalPlayerDamage: 0,
      totalBossDamage: 0,
      totalActualDamage: 0,
      totalRequestedDamage: 0,
      totalActiveDurationSeconds: 0,
      processedRoundIds: [],
    },
    timestampMs: Date.now(),
  };
}

export function assembleQuestionPair(
  generated: {
    questionText: string;
    choices: readonly (number | string)[] | [number | string, number | string];
    correctAnswer: number | string;
    correctIndex: number;
    shapeCode?: string;
  },
  rec: {
    id?: string | number;
    level?: number;
    subLevel?: number;
    levelTitle?: string;
    subLevelTitle?: string;
    questionTemplate?: string;
    shapeCode?: string;
    answerEval?: string;
  },
): QuestionCandidate {
  const wrongChoice = generated.choices[1 - generated.correctIndex];
  const wrongAnswer =
    typeof wrongChoice === 'number' || typeof wrongChoice === 'string'
      ? wrongChoice
      : undefined;

  return {
    id: rec.id,
    level: rec.level,
    subLevel: rec.subLevel,
    levelTitle: rec.levelTitle,
    subLevelTitle: rec.subLevelTitle,
    questionTemplate: rec.questionTemplate,
    questionText: generated.questionText,
    correctAnswer: generated.correctAnswer,
    wrongAnswer,
    choices: generated.choices as any,
    shapeCode: rec.shapeCode || generated.shapeCode,
    answerEval: rec.answerEval,
  };
}
