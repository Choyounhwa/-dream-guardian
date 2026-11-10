/**
 * AssaultHUD.ts - 보스 접근전(Boss Assault) MVP 읽기 전용 HUD 및 진입 오류 표시
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§6.2, 6.3, 11.2, A02, A11, A19)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-20 / Issue #522)
 *
 * 절대 규칙:
 * 1. UI 단일 책임: 순수 읽기 전용 스냅샷을 캔버스에 표시하며 게임 로직(HP/점수/정답/시간 계산) 실행 0회.
 * 2. 멱등성: 동일 스냅샷에 대해 render()를 다수 호출해도 스냅샷 및 외부 상태 불변.
 * 3. [A02, A11] 분리 표시: 완료 문제 수(completedQuestions)와 타격 수(strikeCount)를 명확히 구분하여 혼동 방지.
 * 4. [A02, A19] 안전/상태 표시: isPaused, trackingLost, needsMotionReprep, validationError(사유 배너) 표시.
 * 5. [DEC-A7] MVP 미지원 요소 숨김: 마나 게이지, 별가루, 수호신 스펠, 보스 HP바 표시 0회 (임의 0 위조 금지).
 */

export interface AssaultValidationErrorObj {
  readonly reason: string;
  readonly code?: string;
}

export interface AssaultHUDSnapshot {
  readonly sessionId?: string;
  readonly roundId?: string;
  readonly playerHp: number;
  readonly playerMaxHp?: number;
  readonly completedQuestions: number;
  readonly targetRounds: number;
  readonly strikeCount?: number;
  readonly strikes?: number;
  readonly combo?: number;
  readonly comboCount?: number;
  readonly judgmentRating?: string;
  readonly judgmentText?: string;
  readonly judgment?: string | { readonly rating?: string; readonly text?: string };
  readonly isPaused?: boolean;
  readonly trackingLost?: boolean;
  readonly needsMotionReprep?: boolean;
  readonly validationError?: string | AssaultValidationErrorObj;
  readonly isAborted?: boolean;
  readonly isDefeated?: boolean;
}

export class AssaultHUD {
  private _snapshot: AssaultHUDSnapshot | null = null;

  constructor(snapshot?: AssaultHUDSnapshot) {
    if (snapshot) {
      this._snapshot = snapshot;
    }
  }

  public setSnapshot(snapshot: AssaultHUDSnapshot): void {
    this._snapshot = snapshot;
  }

  public getSnapshot(): AssaultHUDSnapshot | null {
    return this._snapshot;
  }

  /**
   * HUD를 Canvas에 렌더링한다.
   * 유연한 인자 패턴을 지원:
   * - render(ctx, width, height, snapshot?)
   * - render(ctx, snapshot, width, height)
   * - render(ctx, snapshot, { width, height })
   */
  public render(ctx: CanvasRenderingContext2D, width: number, height: number, snapshot?: AssaultHUDSnapshot): void;
  public render(ctx: CanvasRenderingContext2D, snapshot: AssaultHUDSnapshot, width?: number, height?: number): void;
  public render(ctx: CanvasRenderingContext2D, snapshot: AssaultHUDSnapshot, viewport: { width: number; height: number }): void;
  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void;
  public render(
    ctx: CanvasRenderingContext2D,
    arg2?: number | AssaultHUDSnapshot,
    arg3?: number | { width: number; height: number } | AssaultHUDSnapshot,
    arg4?: number | AssaultHUDSnapshot
  ): void {
    let width = 1080;
    let height = 720;
    let snapshot: AssaultHUDSnapshot | null = this._snapshot;

    // 인자 역직렬화
    if (typeof arg2 === 'number') {
      width = arg2;
      if (typeof arg3 === 'number') {
        height = arg3;
      }
      if (arg4 && typeof arg4 === 'object') {
        snapshot = arg4;
      } else if (arg3 && typeof arg3 === 'object' && !('width' in arg3)) {
        snapshot = arg3 as AssaultHUDSnapshot;
      }
    } else if (arg2 && typeof arg2 === 'object') {
      snapshot = arg2;
      if (typeof arg3 === 'number') {
        width = arg3;
        if (typeof arg4 === 'number') {
          height = arg4;
        }
      } else if (arg3 && typeof arg3 === 'object' && 'width' in arg3) {
        width = arg3.width;
        height = arg3.height;
      }
    }

    if (!snapshot) {
      return;
    }

    ctx.save();
    try {
      const scale = Math.min(width / 1080, height / 720);

      // 1. 플레이어 HP 바 및 수치 표시
      this._renderPlayerHp(ctx, snapshot, width, scale);

      // 2. 접근전 진행도 (문제 수) 및 타격 수 분리 표시 (A02, A11)
      this._renderProgressAndStrikes(ctx, snapshot, width, scale);

      // 3. 콤보 및 리듬 판정 피드백
      this._renderComboAndJudgment(ctx, snapshot, width, height, scale);

      // 4. 안전 및 상태 표시기 (일시정지, 추적 상실, 재준비, 진입 오류)
      this._renderStatusAndWarnings(ctx, snapshot, width, height, scale);
    } finally {
      ctx.restore();
    }
  }

  /**
   * 1. 플레이어 HP (수치 및 게이지 바) 렌더링
   */
  private _renderPlayerHp(
    ctx: CanvasRenderingContext2D,
    snapshot: AssaultHUDSnapshot,
    _width: number,
    scale: number
  ): void {
    const maxHp = snapshot.playerMaxHp ?? 100;
    const currentHp = Math.max(0, snapshot.playerHp);
    const hpRatio = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;
    const isDefeated = snapshot.isDefeated || currentHp <= 0;

    const x = 30 * scale;
    const y = 30 * scale;
    const barWidth = 320 * scale;
    const barHeight = 26 * scale;

    // HP 라벨 및 수치 텍스트
    ctx.save();
    ctx.font = `bold ${Math.round(18 * scale)}px 'Pretendard', sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    
    const hpText = isDefeated
      ? `0 / ${maxHp} HP (패배)`
      : `${currentHp} / ${maxHp} HP`;
    ctx.fillText(`PLAYER: ${hpText}`, x, y - 6 * scale);

    // HP 바 배경
    ctx.fillStyle = 'rgba(20, 24, 36, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = Math.max(1, 2 * scale);
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.strokeRect(x, y, barWidth, barHeight);

    // HP 게이지 채우기
    if (hpRatio > 0) {
      let fillStyle = '#00FFCC'; // 기본 청록색
      if (hpRatio <= 0.25 || isDefeated) {
        fillStyle = '#FF3366'; // 위기/사망 빨간색
      } else if (hpRatio <= 0.5) {
        fillStyle = '#FFAA00'; // 경고 주황색
      }
      ctx.fillStyle = fillStyle;
      ctx.fillRect(x + 2 * scale, y + 2 * scale, (barWidth - 4 * scale) * hpRatio, barHeight - 4 * scale);
    }

    ctx.restore();
  }

  /**
   * 2. 접근전 진행도(completedQuestions / targetRounds)와 타격 수(strikeCount) 분리 표시 (A02, A11)
   */
  private _renderProgressAndStrikes(
    ctx: CanvasRenderingContext2D,
    snapshot: AssaultHUDSnapshot,
    width: number,
    scale: number
  ): void {
    ctx.save();

    const centerX = width / 2;
    const topY = 32 * scale;

    // 문제 진행도: 완료 문제 / 목표 문제
    const completed = snapshot.completedQuestions ?? 0;
    const target = snapshot.targetRounds ?? 1;
    const progressText = `문제 진행: ${completed} / ${target}`;

    ctx.font = `bold ${Math.round(20 * scale)}px 'Pretendard', sans-serif`;
    ctx.fillStyle = '#FFE600';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(progressText, centerX, topY);

    // 미니 진행 바
    const pBarW = 180 * scale;
    const pBarH = 8 * scale;
    const pBarX = centerX - pBarW / 2;
    const pBarY = topY + 28 * scale;
    const progressRatio = target > 0 ? Math.max(0, Math.min(1, completed / target)) : 0;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(pBarX, pBarY, pBarW, pBarH);
    if (progressRatio > 0) {
      ctx.fillStyle = '#FFE600';
      ctx.fillRect(pBarX, pBarY, pBarW * progressRatio, pBarH);
    }

    // 타격 수 (A11: 문제 수와 타격 수를 혼동하지 않고 별도 우측 상단 또는 하단에 명시)
    const strikes = snapshot.strikeCount ?? snapshot.strikes;
    if (strikes !== undefined && strikes !== null) {
      const strikeX = width - 40 * scale;
      const strikeY = 32 * scale;
      ctx.textAlign = 'right';
      ctx.font = `bold ${Math.round(18 * scale)}px 'Pretendard', sans-serif`;
      ctx.fillStyle = '#00E5FF';
      ctx.fillText(`타격 수: ${strikes}회`, strikeX, strikeY);
    }

    ctx.restore();
  }

  /**
   * 3. 콤보 카운터 및 리듬 판정 피드백 표시
   */
  private _renderComboAndJudgment(
    ctx: CanvasRenderingContext2D,
    snapshot: AssaultHUDSnapshot,
    width: number,
    height: number,
    scale: number
  ): void {
    const combo = snapshot.comboCount ?? snapshot.combo ?? 0;
    const rating = snapshot.judgmentRating ?? 
      (typeof snapshot.judgment === 'string' ? snapshot.judgment : snapshot.judgment?.rating);

    ctx.save();

    // 콤보 표시 (1 이상일 때만 표시)
    if (combo > 0) {
      const comboX = width - 40 * scale;
      const comboY = 80 * scale;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.font = `italic 900 ${Math.round(28 * scale)}px 'Impact', sans-serif`;
      ctx.fillStyle = '#FF9900';
      ctx.fillText(`${combo} COMBO`, comboX, comboY);
    }

    // 판정 피드백 (PERFECT / GOOD / LATE / MISS)
    if (rating) {
      const ratingUpper = rating.toUpperCase();
      let color = '#00FFCC';
      if (ratingUpper === 'PERFECT') {
        color = '#FFE600';
      } else if (ratingUpper === 'GOOD') {
        color = '#00FF88';
      } else if (ratingUpper === 'LATE') {
        color = '#FFAA00';
      } else if (ratingUpper === 'MISS') {
        color = '#FF3366';
      }

      const ratingX = width / 2;
      const ratingY = height * 0.38;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold 900 ${Math.round(36 * scale)}px 'Pretendard', sans-serif`;
      ctx.fillStyle = color;
      ctx.fillText(ratingUpper, ratingX, ratingY);
    }

    ctx.restore();
  }

  /**
   * 4. 안전 및 상태 표시기 (일시정지, 추적 상실, 재준비, 진입 오류)
   */
  private _renderStatusAndWarnings(
    ctx: CanvasRenderingContext2D,
    snapshot: AssaultHUDSnapshot,
    width: number,
    height: number,
    scale: number
  ): void {
    ctx.save();

    const centerX = width / 2;
    let bannerY = 85 * scale;

    // 4.1 진입 유효성 검증 실패(validationError) 배너 (A02)
    const validationError = snapshot.validationError;
    if (validationError) {
      const reasonText = typeof validationError === 'string'
        ? validationError
        : validationError.reason || validationError.code || '유효성 검증 실패';

      const bannerWidth = Math.min(width * 0.9, 700 * scale);
      const bannerHeight = 44 * scale;
      const bannerX = centerX - bannerWidth / 2;

      ctx.fillStyle = 'rgba(230, 30, 50, 0.92)';
      ctx.fillRect(bannerX, bannerY, bannerWidth, bannerHeight);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(1, 2 * scale);
      ctx.strokeRect(bannerX, bannerY, bannerWidth, bannerHeight);

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.round(18 * scale)}px 'Pretendard', sans-serif`;
      ctx.fillText(`[진입 오류] ${reasonText}`, centerX, bannerY + bannerHeight / 2);

      bannerY += bannerHeight + 12 * scale;
    }

    // 4.2 카메라 추적 상실(trackingLost) 경고 배너 (A19)
    if (snapshot.trackingLost) {
      const bannerWidth = Math.min(width * 0.85, 600 * scale);
      const bannerHeight = 40 * scale;
      const bannerX = centerX - bannerWidth / 2;

      ctx.fillStyle = 'rgba(255, 68, 68, 0.9)';
      ctx.fillRect(bannerX, bannerY, bannerWidth, bannerHeight);
      ctx.strokeStyle = '#FFE600';
      ctx.lineWidth = Math.max(1, 2 * scale);
      ctx.strokeRect(bannerX, bannerY, bannerWidth, bannerHeight);

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.round(18 * scale)}px 'Pretendard', sans-serif`;
      ctx.fillText(`⚠️ [경고] 카메라 추적 상실 (TRACKING LOST) - 카메라 앞으로 이동하세요`, centerX, bannerY + bannerHeight / 2);

      bannerY += bannerHeight + 12 * scale;
    }

    // 4.3 모션 재준비(needsMotionReprep) 안내 (A19)
    if (snapshot.needsMotionReprep) {
      const bannerWidth = Math.min(width * 0.85, 540 * scale);
      const bannerHeight = 36 * scale;
      const bannerX = centerX - bannerWidth / 2;

      ctx.fillStyle = 'rgba(0, 150, 255, 0.88)';
      ctx.fillRect(bannerX, bannerY, bannerWidth, bannerHeight);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(1, 2 * scale);
      ctx.strokeRect(bannerX, bannerY, bannerWidth, bannerHeight);

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.round(16 * scale)}px 'Pretendard', sans-serif`;
      ctx.fillText(`[안내] 자세 재준비 필요 (RE-PREP) - 기본 자세로 정렬하세요`, centerX, bannerY + bannerHeight / 2);

      bannerY += bannerHeight + 12 * scale;
    }

    // 4.4 일시정지(isPaused) 오버레이 표시
    if (snapshot.isPaused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.round(42 * scale)}px 'Pretendard', sans-serif`;
      ctx.fillText(`일시정지 (PAUSED)`, centerX, height / 2);
    }

    // 4.5 라운드 중단(isAborted) 상태 표시
    if (snapshot.isAborted && !snapshot.isPaused) {
      ctx.fillStyle = '#FF9900';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.round(24 * scale)}px 'Pretendard', sans-serif`;
      ctx.fillText(`라운드 중단됨 (ABORTED)`, centerX, height * 0.25);
    }

    ctx.restore();
  }
}
