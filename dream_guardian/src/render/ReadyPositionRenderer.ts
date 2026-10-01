/**
 * ReadyPositionRenderer.ts - 카메라 신체 프레임 정렬 가이드 및 3초 카운트다운 렌더러
 *
 * @see Issue #202 [FEAT-READY-001]
 * - 화면 중앙 반투명 가이드 실루엣 및 정렬 박스 ("카메라 앞에 서서 준비하세요!")
 * - 관절 정렬 성공(isAligned) 시 청록색(#4DFFAA) 네온 점등 효과
 * - 3... 2... 1... START! 대형 네온 카운트다운 애니메이션
 * - 하단 "Space 키 또는 화면 터치로 건너뛰기" 안내
 */

import type { ReadyPositionRenderState } from '../game/ReadyPositionController.js';

export interface ReadyPositionRenderOptions {
  time?: number;
}

export class ReadyPositionRenderer {
  private _animTime = 0;

  update(dt: number): void {
    this._animTime += Math.max(0, dt);
  }

  render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: ReadyPositionRenderState,
    _options?: ReadyPositionRenderOptions,
  ): void {
    if (width <= 0 || height <= 0) return;

    ctx.save();

    // 1. 전체 화면 어두운 반투명 딤 처리 (게임 배경과 구분감)
    ctx.fillStyle = 'rgba(10, 14, 28, 0.65)';
    ctx.fillRect(0, 0, width, height);

    // 2. 신체 정렬 가이드 프레임 및 실루엣
    this._renderAlignmentFrame(ctx, width, height, state.isAligned);

    // 3. 안내 헤더 메시지
    this._renderHeaderMessage(ctx, width, height, state.isAligned);

    // 4. 대형 네온 카운트다운 숫자 / START!
    this._renderCountdown(ctx, width, height, state);

    // 5. 하단 건너뛰기 안내 텍스트
    this._renderSkipNotice(ctx, width, height);

    ctx.restore();
  }

  private _renderAlignmentFrame(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    isAligned: boolean,
  ): void {
    const boxW = width * 0.54;
    const boxH = height * 0.62;
    const boxX = (width - boxW) / 2;
    const boxY = height * 0.18;

    const cornerLen = Math.max(24, width * 0.04);
    const borderColor = isAligned ? '#4DFFAA' : '#28E6FF';
    const glowBlur = isAligned ? 24 : 12;

    ctx.save();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = isAligned ? 4 : 2.5;
    ctx.shadowColor = borderColor;
    ctx.shadowBlur = glowBlur;

    // 코너 4곳 브라켓 스타일 프레임
    // 좌상단
    ctx.beginPath();
    ctx.moveTo(boxX, boxY + cornerLen);
    ctx.lineTo(boxX, boxY);
    ctx.lineTo(boxX + cornerLen, boxY);
    ctx.stroke();

    // 우상단
    ctx.beginPath();
    ctx.moveTo(boxX + boxW - cornerLen, boxY);
    ctx.lineTo(boxX + boxW, boxY);
    ctx.lineTo(boxX + boxW, boxY + cornerLen);
    ctx.stroke();

    // 우하단
    ctx.beginPath();
    ctx.moveTo(boxX + boxW, boxY + boxH - cornerLen);
    ctx.lineTo(boxX + boxW, boxY + boxH);
    ctx.lineTo(boxX + boxW - cornerLen, boxY + boxH);
    ctx.stroke();

    // 좌하단
    ctx.beginPath();
    ctx.moveTo(boxX + cornerLen, boxY + boxH);
    ctx.lineTo(boxX, boxY + boxH);
    ctx.lineTo(boxX, boxY + boxH - cornerLen);
    ctx.stroke();

    // 점선 연결선 (중앙 부분)
    ctx.setLineDash([8, 8]);
    ctx.globalAlpha = isAligned ? 0.65 : 0.35;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.setLineDash([]);
    ctx.restore();

    // 내부 인간 실루엣 가이드 라인 (머리, 어깨, 몸통)
    const cx = width * 0.5;
    const headY = boxY + boxH * 0.16;
    const headRadius = Math.max(24, width * 0.035);

    ctx.save();
    ctx.strokeStyle = isAligned ? '#4DFFAA' : '#64E8FF';
    ctx.fillStyle = isAligned ? 'rgba(77, 255, 170, 0.08)' : 'rgba(40, 230, 255, 0.04)';
    ctx.lineWidth = 2;
    ctx.globalAlpha = isAligned ? 0.6 : 0.35;

    // 머리 원
    ctx.beginPath();
    ctx.arc(cx, headY, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 어깨 ~ 몸통 라인
    const shoulderY = headY + headRadius + height * 0.04;
    const shoulderW = boxW * 0.55;
    const hipY = boxY + boxH * 0.65;
    const hipW = boxW * 0.38;

    ctx.beginPath();
    // 목
    ctx.moveTo(cx, headY + headRadius);
    ctx.lineTo(cx, shoulderY);
    // 어깨 가로
    ctx.moveTo(cx - shoulderW / 2, shoulderY);
    ctx.lineTo(cx + shoulderW / 2, shoulderY);
    // 몸통 양옆
    ctx.lineTo(cx + hipW / 2, hipY);
    ctx.lineTo(cx - hipW / 2, hipY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private _renderHeaderMessage(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    isAligned: boolean,
  ): void {
    const cx = width * 0.5;
    const y = height * 0.12;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.max(24, width * 0.032)}px sans-serif`;

    if (isAligned) {
      ctx.fillStyle = '#4DFFAA';
      ctx.shadowColor = '#4DFFAA';
      ctx.shadowBlur = 14;
      ctx.fillText('정렬 완료! 자세를 유지하세요', cx, y);
    } else {
      ctx.fillStyle = '#28E6FF';
      ctx.shadowColor = '#28E6FF';
      ctx.shadowBlur = 10;
      ctx.fillText('카메라 앞에 서서 준비하세요!', cx, y);
    }
    ctx.restore();
  }

  private _renderCountdown(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: ReadyPositionRenderState,
  ): void {
    const cx = width * 0.5;
    const cy = height * 0.46;
    const isStart = state.currentCount <= 0;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (isStart) {
      // START! 애니메이션
      const fontSize = Math.max(64, width * 0.09);
      ctx.font = `900 ${fontSize}px sans-serif`;
      ctx.fillStyle = '#4DFFAA';
      ctx.shadowColor = '#4DFFAA';
      ctx.shadowBlur = 32;

      ctx.fillText('START!', cx, cy);

      // 외곽 펄스 링
      const ringRadius = Math.max(70, width * 0.12);
      ctx.strokeStyle = '#4DFFAA';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // 3, 2, 1 대형 네온 카운트다운
      const timerVal = state.readyTimer ?? state.remainingTime ?? 3.0;
      const frac = timerVal - Math.floor(timerVal);
      const pulseScale = 1.0 + Math.sin(frac * Math.PI) * 0.12;
      const fontSize = Math.max(90, width * 0.13) * pulseScale;

      ctx.font = `900 ${fontSize}px sans-serif`;
      ctx.fillStyle = '#FFCB4D';
      ctx.shadowColor = '#FFCB4D';
      ctx.shadowBlur = 28;

      ctx.fillText(state.countText, cx, cy);

      // 카운트다운 원형 타이머 링
      const ringRadius = Math.max(65, width * 0.08);
      ctx.strokeStyle = 'rgba(255, 203, 77, 0.25)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      // 진행도 호 (Arc)
      const currentSlotProgress = 1 - frac;
      ctx.strokeStyle = '#FFCB4D';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        ringRadius,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * currentSlotProgress,
      );
      ctx.stroke();
    }

    ctx.restore();
  }

  private _renderSkipNotice(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    const cx = width * 0.5;
    const y = height * 0.88;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `500 ${Math.max(18, width * 0.024)}px sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.shadowColor = '#28E6FF';
    ctx.shadowBlur = 6;
    ctx.fillText('Space 키 또는 화면 터치로 건너뛰기', cx, y);
    ctx.restore();
  }
}
