/**
 * TutorialOverlay - 최초 플레이어 대상 4색 신체 커서 & 피트니스 존 매칭 튜토리얼 (Issue #137 / TUT-001)
 */

import { PartIconRenderer } from '../render/PartIconRenderer.js';
import { CURSOR_COLORS } from '../../config/cursor.config.js';

const STORAGE_KEY = 'dream_guardian_tutorial_done';

export class TutorialOverlay {
  private _visible = false;
  private _step = 1; // 1: 커서 소개, 2: 피트니스 존 매칭, 3: 준비 완료
  private _timer = 0;

  constructor() {
    this._checkFirstTime();
  }

  private _checkFirstTime(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) {
        // 첫 방문 시 활성화 플래그 준비
      }
    } catch {}
  }

  get isVisible(): boolean {
    return this._visible;
  }

  get currentStep(): number {
    return this._step;
  }

  show(): void {
    this._visible = true;
    this._step = 1;
    this._timer = 0;
  }

  dismiss(): void {
    this._visible = false;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, 'true');
      } catch {}
    }
  }

  nextStep(): boolean {
    if (this._step < 3) {
      this._step++;
      this._timer = 0;
      return true;
    }
    this.dismiss();
    return false;
  }

  update(dt: number): void {
    if (!this._visible) return;
    this._timer += dt;
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this._visible) return;

    ctx.save();
    // 딤 배경
    ctx.fillStyle = 'rgba(5, 5, 20, 0.88)';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h * 0.46;
    const cardW = Math.min(840, w * 0.86);
    const cardH = Math.min(720, h * 0.58);

    // 가이드 카드
    ctx.fillStyle = 'rgba(15, 20, 40, 0.95)';
    ctx.strokeStyle = '#28E6FF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 20);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this._step === 1) {
      // 1단계: 4색 신체 커서 소개
      ctx.fillStyle = '#28E6FF';
      ctx.font = `bold ${Math.min(36, w * 0.036)}px sans-serif`;
      ctx.fillText('✨ [1단계] 4색 신체 커서 안내', cx, cy - cardH * 0.38);

      ctx.fillStyle = '#EAEAEA';
      ctx.font = `bold ${Math.min(22, w * 0.022)}px sans-serif`;
      ctx.fillText('카메라가 당신의 몸을 인식해 4색 커서를 비춥니다', cx, cy - cardH * 0.26);

      const items = [
        { part: 'leftHand' as const, label: '왼손 (시안)', color: CURSOR_COLORS.leftHand, x: cx - cardW * 0.3 },
        { part: 'head' as const, label: '머리 (보라)', color: CURSOR_COLORS.head, x: cx - cardW * 0.1 },
        { part: 'hip' as const, label: '골반 (주황)', color: CURSOR_COLORS.hip, x: cx + cardW * 0.1 },
        { part: 'rightHand' as const, label: '오른손 (노랑)', color: CURSOR_COLORS.rightHand, x: cx + cardW * 0.3 },
      ];

      const iconY = cy - 20;
      for (const item of items) {
        PartIconRenderer.drawIcon(ctx, item.part, item.x, iconY, 44, {
          mode: 'stroke',
          color: item.color,
          lineWidth: 3.5,
          glow: true,
        });

        ctx.fillStyle = item.color;
        ctx.font = `bold ${Math.min(18, w * 0.018)}px sans-serif`;
        ctx.fillText(item.label, item.x, iconY + 54);
      }

      ctx.fillStyle = '#AAAAAA';
      ctx.font = `${Math.min(17, w * 0.016)}px sans-serif`;
      ctx.fillText('몸을 움직이면 네온 커서가 실시간으로 따라옵니다', cx, cy + cardH * 0.22);
    } else if (this._step === 2) {
      // 2단계: 피트니스 존 매칭 원리
      ctx.fillStyle = '#FFCB4D';
      ctx.font = `bold ${Math.min(36, w * 0.036)}px sans-serif`;
      ctx.fillText('🎯 [2단계] 피트니스 존 정답 선택', cx, cy - cardH * 0.38);

      ctx.fillStyle = '#EAEAEA';
      ctx.font = `bold ${Math.min(22, w * 0.022)}px sans-serif`;
      ctx.fillText('정답 카드 아래에 표시된 부위를 목표 구역에 올리세요!', cx, cy - cardH * 0.24);

      // 예시 존과 커서 매칭 일러스트
      const zoneW = 200;
      const zoneH = 100;
      const zx = cx - zoneW / 2;
      const zy = cy - 30;

      ctx.fillStyle = 'rgba(40, 230, 255, 0.08)';
      ctx.strokeStyle = '#4DFFAA';
      ctx.lineWidth = 3;
      ctx.strokeRect(zx, zy, zoneW, zoneH);
      ctx.fillRect(zx, zy, zoneW, zoneH);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('목표 구역 (존)', cx, zy + 24);

      // 손 커서 매칭
      PartIconRenderer.drawIcon(ctx, 'leftHand', cx, zy + 65, 36, {
        mode: 'stroke',
        color: CURSOR_COLORS.leftHand,
        lineWidth: 3,
        glow: true,
      });

      // 1초 유지 충전 아크
      ctx.strokeStyle = '#4DFFAA';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, zy + 65, 30, -Math.PI / 2, Math.PI);
      ctx.stroke();

      ctx.fillStyle = '#4DFFAA';
      ctx.font = `bold ${Math.min(18, w * 0.017)}px sans-serif`;
      ctx.fillText('1초 동안 자세를 유지하면 정답이 확정됩니다!', cx, cy + cardH * 0.22);
    } else {
      // 3단계: 준비 완료
      ctx.fillStyle = '#4DFFAA';
      ctx.font = `bold ${Math.min(38, w * 0.038)}px sans-serif`;
      ctx.fillText('🌟 준비 완료! 모험을 떠나볼까요?', cx, cy - cardH * 0.32);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${Math.min(24, w * 0.022)}px sans-serif`;
      ctx.fillText('1. 제자리에서 달려 에너지를 모으세요', cx, cy - cardH * 0.12);
      ctx.fillText('2. 문제가 나오면 정답 자세를 취하세요', cx, cy + cardH * 0.06);
      ctx.fillText('3. 꼬마 수호신에게 마나를 전달해 보스를 무찌르세요!', cx, cy + cardH * 0.22);
    }

    // 하단 버튼
    const btnW = 260;
    const btnH = 50;
    const btnY = cy + cardH * 0.38;

    ctx.fillStyle = 'rgba(40, 230, 255, 0.2)';
    ctx.strokeStyle = '#28E6FF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(this._step === 3 ? '게임 시작! (TAP)' : '다음 (TAP)', cx, btnY);

    // 스킵 힌트
    ctx.fillStyle = '#888888';
    ctx.font = '14px sans-serif';
    ctx.fillText('Space 키 또는 화면 클릭 시 건너뜁니다', cx, cy + cardH * 0.48);

    ctx.restore();
  }
}
