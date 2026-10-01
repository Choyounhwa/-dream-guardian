/**
 * LocomotionModal - 운동 모드(이동 방식 4종) 선택 UI 모달 (Issue #154 / FEAT-UI-006)
 *
 * 뛸 수 없는 환경(층간소음, 부상, 좁은 공간) 대응을 위한 4종 이동 방식 선택 모달:
 * - 🏃 제자리 달리기 (기본)
 * - 🦘 골반 바운스 (무소음 점프)
 * - 💃 골반 스웨이 (트월킹/코어 셰이크)
 * - 🚗 양손 교차 (드라이빙/휠 펌핑, 착석 가능)
 *
 * 2x2 대화면 카드 그리드, 4색 커서 0.8초 체류(Dwell) 및 클릭 지원, localStorage 영속화.
 */

import type { LocomotionMode } from '../motion/LocomotionDetector.js';
import { UIText } from '../utils/UIText.js';

export interface ModalButtonSlot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LocomotionModeInfo {
  mode: LocomotionMode;
  label: string;
  subLabel: string;
  icon: string;
  targetPart: string;
  noiseLevel: string;
  description: string;
  color: string;
}

export const LOCOMOTION_MODES: LocomotionModeInfo[] = [
  {
    mode: 'run',
    label: '제자리 달리기',
    subLabel: '기본 모드',
    icon: '🏃',
    targetPart: '다리 / 전신',
    noiseLevel: '소음: 보통 🔊',
    description: '어깨/전신을 상하로 바운스하며 달리는 전신 유산소',
    color: '#28E6FF',
  },
  {
    mode: 'hip_bounce',
    label: '골반 바운스',
    subLabel: '무소음 점프',
    icon: '🦘',
    targetPart: '무릎 / 골반',
    noiseLevel: '소음: 0% 🔇',
    description: '발을 떼지 않고 무릎 탄성으로 골반 상하 바운스',
    color: '#4DFFAA',
  },
  {
    mode: 'hip_sway',
    label: '골반 스웨이',
    subLabel: '코어 셰이크',
    icon: '💃',
    targetPart: '골반 / 복부',
    noiseLevel: '소음: 0% 🔇',
    description: '골반을 좌우로 흔들거나 회전시키는 무소음 코어 운동',
    color: '#FFCB4D',
  },
  {
    mode: 'arm_cross',
    label: '양손 교차',
    subLabel: '휠 펌핑 / 드라이빙',
    icon: '🚗',
    targetPart: '양팔 / 상체',
    noiseLevel: '소음: 0% 🔇 (착석 가능)',
    description: '하체 대신 양손을 상하로 교차하며 펌핑하는 상체 운동',
    color: '#C889FF',
  },
];

export const STORAGE_KEY_LOCOMOTION_MODE = 'dg_locomotion_mode';
export const LOCOMOTION_DWELL_TIME = 0.8;

export class LocomotionModal {
  private _isOpen = false;
  private _selectedMode: LocomotionMode = 'run';
  private _hoveredCard: LocomotionMode | null = null;
  private _hoverTime = 0;

  // 1080x2160 가상 해상도 기준 모달 영역
  private readonly MODAL_VIRTUAL = {
    x: 80,
    y: 380,
    w: 920,
    h: 1400,
  };

  constructor() {
    this._selectedMode = this.loadMode();
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  get selectedMode(): LocomotionMode {
    return this._selectedMode;
  }

  get hoveredCard(): LocomotionMode | null {
    return this._hoveredCard;
  }

  get hoverProgress(): number {
    return Math.min(1, this._hoverTime / LOCOMOTION_DWELL_TIME);
  }

  open(): void {
    this._isOpen = true;
    this._hoveredCard = null;
    this._hoverTime = 0;
  }

  close(): void {
    this._isOpen = false;
    this._hoveredCard = null;
    this._hoverTime = 0;
  }

  toggle(): void {
    if (this._isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  selectMode(mode: LocomotionMode): void {
    this._selectedMode = mode;
    this.saveMode(mode);
  }

  /**
   * localStorage에서 선택 모드 복원
   */
  loadMode(): LocomotionMode {
    try {
      if (typeof localStorage === 'undefined') return 'run';
      const saved = localStorage.getItem(STORAGE_KEY_LOCOMOTION_MODE);
      if (saved && (saved === 'run' || saved === 'hip_bounce' || saved === 'hip_sway' || saved === 'arm_cross')) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'run';
  }

  /**
   * localStorage에 모드 영속 저장
   */
  saveMode(mode: LocomotionMode): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_LOCOMOTION_MODE, mode);
      }
    } catch {
      // ignore
    }
  }

  /**
   * 닫기 버튼 레이아웃
   */
  getCloseButtonLayout(w: number, h: number): ModalButtonSlot {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const mx = this.MODAL_VIRTUAL.x * scaleX;
    const my = this.MODAL_VIRTUAL.y * scaleY;
    const mw = this.MODAL_VIRTUAL.w * scaleX;

    return {
      x: mx + mw - 85 * scaleX,
      y: my + 35 * scaleY,
      w: 60 * scaleX,
      h: 60 * scaleY,
    };
  }

  /**
   * 2x2 카드 개별 슬롯 레이아웃 계산
   * - Row 0: run (Col 0), hip_bounce (Col 1)
   * - Row 1: hip_sway (Col 0), arm_cross (Col 1)
   */
  getCardLayout(mode: LocomotionMode, w: number, h: number): ModalButtonSlot {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const mx = this.MODAL_VIRTUAL.x * scaleX;
    const my = this.MODAL_VIRTUAL.y * scaleY;

    const startX = mx + 30 * scaleX;
    const startY = my + 180 * scaleY;
    const cardW = 415 * scaleX;
    const cardH = 560 * scaleY;
    const gapX = 30 * scaleX;
    const gapY = 30 * scaleY;

    let col = 0;
    let row = 0;

    switch (mode) {
      case 'run':
        col = 0;
        row = 0;
        break;
      case 'hip_bounce':
        col = 1;
        row = 0;
        break;
      case 'hip_sway':
        col = 0;
        row = 1;
        break;
      case 'arm_cross':
        col = 1;
        row = 1;
        break;
    }

    return {
      x: startX + col * (cardW + gapX),
      y: startY + row * (cardH + gapY),
      w: cardW,
      h: cardH,
    };
  }

  /**
   * 마우스 / 터치 클릭 처리
   */
  handleClick(
    x: number,
    y: number,
    w: number,
    h: number,
  ): { action: 'select' | 'close' | 'backdrop-close'; mode?: LocomotionMode } | null {
    if (!this._isOpen) return null;

    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const mx = this.MODAL_VIRTUAL.x * scaleX;
    const my = this.MODAL_VIRTUAL.y * scaleY;
    const mw = this.MODAL_VIRTUAL.w * scaleX;
    const mh = this.MODAL_VIRTUAL.h * scaleY;

    // 1. 모달 바깥 영역 클릭
    if (x < mx || x > mx + mw || y < my || y > my + mh) {
      return { action: 'backdrop-close' };
    }

    // 2. 닫기 버튼 클릭
    const closeBtn = this.getCloseButtonLayout(w, h);
    if (x >= closeBtn.x && x <= closeBtn.x + closeBtn.w && y >= closeBtn.y && y <= closeBtn.y + closeBtn.h) {
      this.close();
      return { action: 'close' };
    }

    // 3. 2x2 카드 클릭
    for (const info of LOCOMOTION_MODES) {
      const card = this.getCardLayout(info.mode, w, h);
      if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
        this.selectMode(info.mode);
        return { action: 'select', mode: info.mode };
      }
    }

    return null;
  }

  /**
   * 신체 커서 호버 체류(0.8s) 업데이트
   */
  updateHover(
    x: number,
    y: number,
    w: number,
    h: number,
    dt: number,
  ): { modeSelected?: LocomotionMode; hoveredMode?: LocomotionMode; progress: number } {
    if (!this._isOpen) {
      this._hoveredCard = null;
      this._hoverTime = 0;
      return { progress: 0 };
    }

    let foundCard: LocomotionMode | null = null;

    for (const info of LOCOMOTION_MODES) {
      const card = this.getCardLayout(info.mode, w, h);
      if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
        foundCard = info.mode;
        break;
      }
    }

    if (foundCard) {
      if (this._hoveredCard === foundCard) {
        this._hoverTime += dt;
      } else {
        this._hoveredCard = foundCard;
        this._hoverTime = dt;
      }

      const progress = Math.min(1, this._hoverTime / LOCOMOTION_DWELL_TIME);

      if (this._hoverTime >= LOCOMOTION_DWELL_TIME) {
        this.selectMode(foundCard);
        return { modeSelected: foundCard, hoveredMode: foundCard, progress: 1 };
      }

      return { hoveredMode: foundCard, progress };
    } else {
      this._hoveredCard = null;
      this._hoverTime = 0;
      return { progress: 0 };
    }
  }

  /**
   * Canvas 렌더링
   */
  render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this._isOpen) return;

    const scaleX = w / 1080;
    const scaleY = h / 2160;

    ctx.save();

    // 1. 배경 어둡게 처리 (딤 오버레이)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.fillRect(0, 0, w, h);

    // 2. 모달 카드 배경
    const mx = this.MODAL_VIRTUAL.x * scaleX;
    const my = this.MODAL_VIRTUAL.y * scaleY;
    const mw = this.MODAL_VIRTUAL.w * scaleX;
    const mh = this.MODAL_VIRTUAL.h * scaleY;
    const radius = 28 * scaleX;

    ctx.fillStyle = 'rgba(15, 20, 36, 0.98)';
    ctx.strokeStyle = '#28E6FF';
    ctx.lineWidth = 3 * scaleX;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(mx, my, mw, mh, radius);
    } else {
      ctx.rect(mx, my, mw, mh);
    }
    ctx.fill();
    ctx.stroke();

    // 3. 헤더 타이틀 및 서브텍스트
    ctx.font = UIText.getFont('subheading', scaleX, 'bold');
    ctx.fillStyle = '#FFCB4D';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('🏃 운동 모드 (이동 방식) 선택', mx + 50 * scaleX, my + 45 * scaleY);

    ctx.font = UIText.getFont('badge', scaleX, 'normal');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('거주 환경과 신체 상태에 맞게 선택하세요 (0.8초 체류 또는 클릭)', mx + 50 * scaleX, my + 105 * scaleY);

    // 4. 닫기 버튼
    const closeBtn = this.getCloseButtonLayout(w, h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2 * scaleX;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 12 * scaleX);
    } else {
      ctx.rect(closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h);
    }
    ctx.fill();
    ctx.stroke();

    ctx.font = UIText.getFont('body', scaleX, 'bold');
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✕', closeBtn.x + closeBtn.w / 2, closeBtn.y + closeBtn.h / 2);

    // 5. 2x2 모드 카드 렌더링
    for (const info of LOCOMOTION_MODES) {
      const card = this.getCardLayout(info.mode, w, h);
      const isSelected = this._selectedMode === info.mode;
      const isHovered = this._hoveredCard === info.mode;
      const cardRadius = 20 * scaleX;

      // 카드 배경
      ctx.fillStyle = isSelected
        ? 'rgba(40, 230, 255, 0.16)'
        : isHovered
        ? 'rgba(255, 255, 255, 0.08)'
        : 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = isSelected ? info.color : isHovered ? '#FFFFFF' : 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = isSelected ? 4 * scaleX : 2 * scaleX;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(card.x, card.y, card.w, card.h, cardRadius);
      } else {
        ctx.rect(card.x, card.y, card.w, card.h);
      }
      ctx.fill();
      ctx.stroke();

      // 아이콘 (대형)
      ctx.font = UIText.getFont('title', scaleX, 'normal');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(info.icon, card.x + card.w / 2, card.y + 90 * scaleY);

      // 모드 이름
      ctx.font = UIText.getFont('body', scaleX, 'bold');
      ctx.fillStyle = isSelected ? info.color : '#FFFFFF';
      ctx.fillText(info.label, card.x + card.w / 2, card.y + 170 * scaleY);

      // 서브 라벨
      ctx.font = UIText.getFont('badge', scaleX, 'normal');
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.fillText(info.subLabel, card.x + card.w / 2, card.y + 215 * scaleY);

      // 배지 1: 대상 부위
      const badgeW = card.w - 60 * scaleX;
      const badgeH = 46 * scaleY;
      const badgeX = card.x + 30 * scaleX;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.strokeStyle = info.color;
      ctx.lineWidth = 1.5 * scaleX;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(badgeX, card.y + 260 * scaleY, badgeW, badgeH, 10 * scaleX);
      } else {
        ctx.rect(badgeX, card.y + 260 * scaleY, badgeW, badgeH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.font = UIText.getFont('caption', scaleX, 'bold');
      ctx.fillStyle = info.color;
      ctx.fillText(`부위: ${info.targetPart}`, card.x + card.w / 2, card.y + 283 * scaleY);

      // 배지 2: 소음 안내
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.strokeStyle = info.mode === 'run' ? '#FF865E' : '#4DFFAA';
      ctx.lineWidth = 1.5 * scaleX;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(badgeX, card.y + 320 * scaleY, badgeW, badgeH, 10 * scaleX);
      } else {
        ctx.rect(badgeX, card.y + 320 * scaleY, badgeW, badgeH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.font = UIText.getFont('caption', scaleX, 'bold');
      ctx.fillStyle = info.mode === 'run' ? '#FF865E' : '#4DFFAA';
      ctx.fillText(info.noiseLevel, card.x + card.w / 2, card.y + 343 * scaleY);

      // 설명 텍스트 (단어 자동 줄바꿈 또는 간결 안내)
      ctx.font = UIText.getFont('caption', scaleX, 'normal');
      this._renderWrappedText(
        ctx,
        info.description,
        card.x + card.w / 2,
        card.y + 395 * scaleY,
        card.w - 50 * scaleX,
        26 * scaleY,
      );

      // 선택 상태 안내 띠 또는 체크마크
      if (isSelected) {
        const checkY = card.y + card.h - 45 * scaleY;
        ctx.font = UIText.getFont('badge', scaleX, 'bold');
        ctx.fillStyle = '#4DFFAA';
        ctx.fillText('✓ 현재 사용 중', card.x + card.w / 2, checkY);
      }

      // 호버 진행도 아크 (신체 커서 체류 시)
      if (isHovered && this._hoverTime > 0) {
        const progress = Math.min(1, this._hoverTime / LOCOMOTION_DWELL_TIME);
        const arcRadius = 36 * scaleX;
        const arcX = card.x + card.w - 50 * scaleX;
        const arcY = card.y + 50 * scaleY;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 6 * scaleX;
        ctx.beginPath();
        ctx.arc(arcX, arcY, arcRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = info.color;
        ctx.lineWidth = 6 * scaleX;
        ctx.beginPath();
        ctx.arc(arcX, arcY, arcRadius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private _renderWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
  ): void {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, currentY);
  }
}
