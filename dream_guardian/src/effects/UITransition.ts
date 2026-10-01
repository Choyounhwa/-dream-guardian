/**
 * UITransition - UI 화면 전환 및 페이드/원형 와이프 트랜지션 시스템
 *
 * Issue #278 (VFX-006): UI 전환 애니메이션
 * - circleWipe: 중심에서 원이 확장되며 새 화면으로 전환 (0.6초)
 * - fadeToBlack: 어두워지며 화면 전환 (0.4초)
 * - fadeIn: 어두운 화면에서 서서히 밝아지며 화면 드러남 (0.3초)
 * - 중복 전환 방지 및 완료 콜백 지원
 */

export type TransitionType = 'circleWipe' | 'fadeToBlack' | 'fadeIn' | 'none';

export class TransitionManager {
  private _type: TransitionType = 'none';
  private _isActive = false;
  private _elapsed = 0;
  private _duration = 0;
  private _onComplete?: () => void;

  get type(): TransitionType {
    return this._type;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get progress(): number {
    if (!this._isActive || this._duration <= 0) return 0;
    return Math.min(1, Math.max(0, this._elapsed / this._duration));
  }

  /**
   * 트랜지션 시작
   * @param type 전환 효과 유형
   * @param duration 지속 시간 (초, 생략 시 기본 규격 적용)
   * @param onComplete 완료 시 호출될 콜백
   * @returns 시작 성공 여부 (이미 트랜지션 진행 중이면 false 반환하여 중복 방지)
   */
  start(type: TransitionType, duration?: number, onComplete?: () => void): boolean {
    if (this._isActive) {
      return false; // 중복 트랜지션 차단
    }

    if (type === 'none') {
      this._type = 'none';
      this._isActive = false;
      this._elapsed = 0;
      this._duration = 0;
      onComplete?.();
      return true;
    }

    this._type = type;
    this._isActive = true;
    this._elapsed = 0;
    this._onComplete = onComplete;

    if (duration !== undefined && duration > 0) {
      this._duration = duration;
    } else {
      switch (type) {
        case 'circleWipe':
          this._duration = 0.6;
          break;
        case 'fadeToBlack':
          this._duration = 0.4;
          break;
        case 'fadeIn':
          this._duration = 0.3;
          break;
        default:
          this._duration = 0.5;
          break;
      }
    }

    return true;
  }

  /**
   * 프레임 경과 시간 업데이트
   */
  update(dt: number): void {
    if (!this._isActive) return;

    this._elapsed += dt;
    if (this._elapsed >= this._duration) {
      this._isActive = false;
      const cb = this._onComplete;
      this._onComplete = undefined;
      cb?.();
    }
  }

  /**
   * 트랜지션 렌더링 (최상단 오버레이)
   */
  render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this._isActive) return;

    const p = this.progress;
    ctx.save();

    if (this._type === 'fadeToBlack') {
      // 0.4초 동안 검은색으로 페이드 (알파 0 -> 1)
      const alpha = Math.min(1, Math.max(0, p));
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha.toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    } else if (this._type === 'fadeIn') {
      // 0.3초 동안 투명해지며 화면 드러남 (알파 1 -> 0)
      const alpha = Math.max(0, 1 - p);
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha.toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    } else if (this._type === 'circleWipe') {
      // 원형 와이프: 중심에서 원이 확장되며 화면 드러남 (0.6초)
      const cx = w / 2;
      const cy = h / 2;
      const maxRadius = Math.hypot(cx, cy);
      const radius = Math.max(0, maxRadius * p);

      // 외곽을 검정으로 채우고 중앙 원형을 뚫어 새 화면 표시 (evenodd)
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
      ctx.fill();

      // 경계선 시안 글로우 링 연출
      if (radius > 0 && p < 1) {
        ctx.strokeStyle = '#28E6FF';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#28E6FF';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2, false);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * 진행 중인 트랜지션 즉시 취소
   */
  cancel(): void {
    this._isActive = false;
    this._onComplete = undefined;
    this._elapsed = 0;
    this._type = 'none';
  }
}
