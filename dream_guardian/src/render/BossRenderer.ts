/**
 * BossRenderer - 5종 보스 Canvas 2D 프로시저럴 드로잉 렌더러
 *
 * Issue #25: 순수 Canvas 2D 코드로 구현된 5종 보스 고유 비주얼 및 모션
 * - Ch.1 포겟 (안개 구름 + ? 부유)
 * - Ch.2 후다닥 (번개 구체 + 방전 스파크)
 * - Ch.3 뒤죽박죽 (회전 만화경 육각형)
 * - Ch.4 에라 (그림자 거인 + 어둠의 오라 + "포기해...")
 * - Ch.5 나이트메어 (검은 다각형 파편 + 붉은 눈)
 */

export interface BossRenderOptions {
  x: number;
  y: number;
  radius?: number;
  chapter: number;
  phase?: 'idle' | 'warning' | 'attacking' | 'defeated';
}

export class BossRenderer {
  private _animTime = 0;
  private _hitTimer = 0;
  private _attackAnimTimer = 0;
  private _defeatedTimer = 0;

  /**
   * 매 프레임 애니메이션 시간 갱신
   */
  update(dt: number, isHit = false): void {
    this._animTime += dt;

    if (isHit) {
      this._hitTimer = 0.3; // 피격 플래시/흔들림 0.3초
    } else if (this._hitTimer > 0) {
      this._hitTimer = Math.max(0, this._hitTimer - dt);
    }
  }

  /** 피격 연출 트리거 */
  triggerHit(): void {
    this._hitTimer = 0.35;
  }

  /** 공격 연출 트리거 */
  triggerAttack(): void {
    this._attackAnimTimer = 0.5;
  }

  /**
   * 보스 렌더링 진입점
   */
  render(
    ctx: CanvasRenderingContext2D,
    chapter: number,
    x: number,
    y: number,
    radius = 90,
    phase: 'idle' | 'warning' | 'attacking' | 'defeated' = 'idle',
  ): void {
    ctx.save();

    // 피격 흔들림 오프셋
    let offsetX = 0;
    let offsetY = 0;
    let hitFlash = 0;

    if (this._hitTimer > 0) {
      const shakeAmp = (this._hitTimer / 0.35) * 12;
      offsetX = Math.sin(this._animTime * 50) * shakeAmp;
      offsetY = Math.cos(this._animTime * 40) * (shakeAmp * 0.5);
      hitFlash = this._hitTimer / 0.35;
    }

    // 공격 시 앞으로 돌진 및 확대
    let scale = 1.0;
    if (phase === 'attacking' || this._attackAnimTimer > 0) {
      scale = 1.25 + Math.sin(this._animTime * 20) * 0.08;
    } else if (phase === 'warning') {
      scale = 1.0 + Math.sin(this._animTime * 12) * 0.1; // 빠른 맥동
    } else if (phase === 'defeated') {
      scale = Math.max(0.2, 1.0 - (this._defeatedTimer += 0.02));
      ctx.globalAlpha = Math.max(0, 1.0 - this._defeatedTimer * 0.5);
    }

    ctx.translate(x + offsetX, y + offsetY);
    ctx.scale(scale, scale);

    // 경고 시 붉은 경고 오라
    if (phase === 'warning') {
      this._renderWarningAura(ctx, radius);
    }

    // 챕터별 프로시저럴 렌더러 호출
    switch (chapter) {
      case 1:
        this._renderForget(ctx, radius);
        break;
      case 2:
        this._renderHurry(ctx, radius);
        break;
      case 3:
        this._renderJumble(ctx, radius);
        break;
      case 4:
        this._renderGiveup(ctx, radius);
        break;
      case 5:
      default:
        this._renderNightmare(ctx, radius);
        break;
    }

    // 피격 플래시 오버레이
    if (hitFlash > 0.05) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(255, 255, 255, ${hitFlash * 0.7})`;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ─── 경고 오라 ───
  private _renderWarningAura(ctx: CanvasRenderingContext2D, radius: number): void {
    const pulse = Math.sin(this._animTime * 10) * 0.2 + 0.5;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 50, 50, ${pulse})`;
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.35, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 30, 30, ${pulse * 0.25})`;
    ctx.fill();
    ctx.restore();
  }

  // ─── Ch.1 포겟 (안개 구름 + ? 부유) ───
  private _renderForget(ctx: CanvasRenderingContext2D, radius: number): void {
    const t = this._animTime;

    // 여러 층의 안개 덩어리
    const cloudCount = 7;
    for (let i = 0; i < cloudCount; i++) {
      const angle = (Math.PI * 2 * i) / cloudCount + t * 0.4;
      const dist = radius * 0.4 + Math.sin(t * 1.8 + i) * (radius * 0.15);
      const cx = Math.cos(angle) * dist;
      const cy = Math.sin(angle) * dist;
      const r = radius * 0.55 + Math.sin(t * 2.2 + i * 1.5) * 8;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, 'rgba(200, 137, 255, 0.7)');
      grad.addColorStop(0.6, 'rgba(138, 85, 255, 0.4)');
      grad.addColorStop(1, 'rgba(60, 20, 120, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 중심 코어
    const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.5);
    coreGrad.addColorStop(0, 'rgba(230, 180, 255, 0.9)');
    coreGrad.addColorStop(1, 'rgba(100, 40, 180, 0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // 신비로운 보랏빛 눈 두 개
    ctx.fillStyle = '#FFE57F';
    ctx.shadowColor = '#FFE57F';
    ctx.shadowBlur = 10;
    const eyeBlink = Math.sin(t * 1.5) > 0.95 ? 1 : 4;
    ctx.beginPath();
    ctx.ellipse(-radius * 0.2, -radius * 0.08, 6, eyeBlink, 0, 0, Math.PI * 2);
    ctx.ellipse(radius * 0.2, -radius * 0.08, 6, eyeBlink, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 부유하는 "?" 기호들
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    for (let i = 0; i < 3; i++) {
      const qPhase = (t * 0.8 + i * 0.7) % 2;
      const qAlpha = Math.sin(qPhase * Math.PI * 0.5);
      const qY = -radius * 0.4 - qPhase * 40;
      const qX = Math.sin(i * 2 + t) * (radius * 0.6);
      ctx.save();
      ctx.globalAlpha = Math.max(0, qAlpha);
      ctx.fillText('?', qX, qY);
      ctx.restore();
    }
  }

  // ─── Ch.2 후다닥 (번개 구체 + 방전 스파크) ───
  private _renderHurry(ctx: CanvasRenderingContext2D, radius: number): void {
    const t = this._animTime;

    // 고속 진동
    const jitterX = (Math.random() - 0.5) * 3;
    const jitterY = (Math.random() - 0.5) * 3;

    // 플라즈마 코어
    const grad = ctx.createRadialGradient(jitterX, jitterY, 0, jitterX, jitterY, radius * 0.85);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.3, '#FFCB4D');
    grad.addColorStop(0.7, '#FF4444');
    grad.addColorStop(1, 'rgba(255, 68, 68, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(jitterX, jitterY, radius * 0.85, 0, Math.PI * 2);
    ctx.fill();

    // 불규칙 번개 방전 가지 (8방향)
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#FFCB4D';
    ctx.shadowBlur = 12;

    const boltCount = 6;
    for (let i = 0; i < boltCount; i++) {
      const baseAngle = (Math.PI * 2 * i) / boltCount + t * 5;
      let curX = Math.cos(baseAngle) * (radius * 0.4);
      let curY = Math.sin(baseAngle) * (radius * 0.4);

      ctx.beginPath();
      ctx.moveTo(curX, curY);

      const segments = 4;
      for (let s = 1; s <= segments; s++) {
        const segDist = (radius * 0.4) + (radius * 0.7 * (s / segments));
        const segAngle = baseAngle + (Math.sin(t * 20 + i * 3 + s) * 0.4);
        curX = Math.cos(segAngle) * segDist;
        curY = Math.sin(segAngle) * segDist;
        ctx.lineTo(curX, curY);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // 날카로운 번개 눈
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-radius * 0.25, -radius * 0.1);
    ctx.lineTo(-radius * 0.1, -radius * 0.2);
    ctx.lineTo(-radius * 0.15, -radius * 0.05);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(radius * 0.25, -radius * 0.1);
    ctx.lineTo(radius * 0.1, -radius * 0.2);
    ctx.lineTo(radius * 0.15, -radius * 0.05);
    ctx.closePath();
    ctx.fill();
  }

  // ─── Ch.3 뒤죽박죽 (회전 만화경 육각형) ───
  private _renderJumble(ctx: CanvasRenderingContext2D, radius: number): void {
    const t = this._animTime;

    const rings = [
      { r: radius * 0.95, speed: 0.8, color: '#28E6FF', sides: 6 },
      { r: radius * 0.7, speed: -1.2, color: '#FF66CC', sides: 6 },
      { r: radius * 0.45, speed: 1.6, color: '#4DFFAA', sides: 6 },
      { r: radius * 0.25, speed: -2.0, color: '#FFFFFF', sides: 3 },
    ];

    for (const ring of rings) {
      ctx.save();
      ctx.rotate(t * ring.speed);
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = ring.color;
      ctx.shadowBlur = 8;

      ctx.beginPath();
      const step = (Math.PI * 2) / ring.sides;
      for (let i = 0; i <= ring.sides; i++) {
        const angle = i * step;
        const vx = Math.cos(angle) * ring.r;
        const vy = Math.sin(angle) * ring.r;
        if (i === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // 부유하는 왜곡 수학 기호들 (÷, ×, ½, %)
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    const symbols = ['÷', '×', '½', '%'];
    for (let i = 0; i < symbols.length; i++) {
      const angle = (Math.PI * 2 * i) / symbols.length - t * 0.9;
      const dist = radius * 0.58;
      const sx = Math.cos(angle) * dist;
      const sy = Math.sin(angle) * dist;
      ctx.fillText(symbols[i], sx - 6, sy + 5);
    }
  }

  // ─── Ch.4 에라 (그림자 거인 + 어둠 오라 + "포기해...") ───
  private _renderGiveup(ctx: CanvasRenderingContext2D, radius: number): void {
    const t = this._animTime;

    // 솟구치는 그림자 텐타클 / 연기
    const tentacleCount = 8;
    ctx.fillStyle = 'rgba(25, 10, 45, 0.75)';
    for (let i = 0; i < tentacleCount; i++) {
      const angle = (Math.PI * 2 * i) / tentacleCount;
      const height = radius * 0.8 + Math.sin(t * 3 + i * 2) * (radius * 0.3);
      const tipX = Math.cos(angle) * height;
      const tipY = Math.sin(angle) * height - 10;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(
        Math.cos(angle + 0.3) * (height * 0.5),
        Math.sin(angle + 0.3) * (height * 0.5),
        tipX,
        tipY,
      );
      ctx.quadraticCurveTo(
        Math.cos(angle - 0.3) * (height * 0.5),
        Math.sin(angle - 0.3) * (height * 0.5),
        0,
        0,
      );
      ctx.fill();
    }

    // 본체 (어두운 실루엣 타원)
    const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.75);
    bodyGrad.addColorStop(0, '#0E071A');
    bodyGrad.addColorStop(0.8, '#26113F');
    bodyGrad.addColorStop(1, 'rgba(38, 17, 63, 0)');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.7, radius * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    // 공허하고 서늘한 보랏빛 눈빛
    ctx.fillStyle = '#C889FF';
    ctx.shadowColor = '#C889FF';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.ellipse(-radius * 0.22, -radius * 0.12, 8, 4, -0.2, 0, Math.PI * 2);
    ctx.ellipse(radius * 0.22, -radius * 0.12, 8, 4, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 속삭이는 "포기해..." 텍스트 부유
    const whisperCycle = (t * 0.5) % 2;
    const whisperAlpha = Math.sin(whisperCycle * Math.PI * 0.5);
    const whisperY = radius * 0.65 + Math.sin(t * 2) * 5;
    ctx.save();
    ctx.globalAlpha = Math.max(0, whisperAlpha * 0.8);
    ctx.font = 'italic 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#C889FF';
    ctx.fillText('포기해...', 0, whisperY);
    ctx.restore();
  }

  // ─── Ch.5 나이트메어 (검은 다각형 파편 + 붉은 눈) ───
  private _renderNightmare(ctx: CanvasRenderingContext2D, radius: number): void {
    const t = this._animTime;

    // 공허의 중심 블랙홀
    const voidGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.9);
    voidGrad.addColorStop(0, '#000000');
    voidGrad.addColorStop(0.5, '#1A000A');
    voidGrad.addColorStop(0.85, '#400010');
    voidGrad.addColorStop(1, 'rgba(64, 0, 16, 0)');
    ctx.fillStyle = voidGrad;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.9, 0, Math.PI * 2);
    ctx.fill();

    // 궤도를 도는 날카로운 흑요석 다각형 파편들
    const shardCount = 8;
    for (let i = 0; i < shardCount; i++) {
      const angle = (Math.PI * 2 * i) / shardCount + t * (i % 2 === 0 ? 1.0 : -0.7);
      const dist = radius * 0.75 + Math.sin(t * 3 + i) * (radius * 0.15);
      const sx = Math.cos(angle) * dist;
      const sy = Math.sin(angle) * dist;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(angle + t * 2);

      ctx.fillStyle = '#110508';
      ctx.strokeStyle = '#FF2244';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-12, -8);
      ctx.lineTo(16, 0);
      ctx.lineTo(-8, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 악몽의 붉은 눈 2쌍 (강렬하게 번뜩임)
    const eyeGlow = 15 + Math.sin(t * 6) * 8;
    ctx.shadowColor = '#FF0033';
    ctx.shadowBlur = eyeGlow;
    ctx.fillStyle = '#FF0033';

    // 메인 눈
    ctx.beginPath();
    ctx.ellipse(-radius * 0.22, -radius * 0.1, 10, 5, -0.3, 0, Math.PI * 2);
    ctx.ellipse(radius * 0.22, -radius * 0.1, 10, 5, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // 상단 보조 눈
    ctx.beginPath();
    ctx.ellipse(-radius * 0.32, -radius * 0.25, 6, 3, -0.4, 0, Math.PI * 2);
    ctx.ellipse(radius * 0.32, -radius * 0.25, 6, 3, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 불안정한 붉은 균열 아크
    if (Math.sin(t * 15) > 0.3) {
      ctx.strokeStyle = '#FF3355';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.3, radius * 0.2);
      ctx.lineTo(-radius * 0.05, radius * 0.35);
      ctx.lineTo(radius * 0.15, radius * 0.18);
      ctx.lineTo(radius * 0.35, radius * 0.32);
      ctx.stroke();
    }
  }
}
