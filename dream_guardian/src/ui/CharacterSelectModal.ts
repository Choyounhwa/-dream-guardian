/**
 * CharacterSelectModal - 캐릭터 선택 UI 모달
 *
 * Issue #689 / FEAT-CHAR-001:
 * - 등록된 캐릭터 목록 카드 렌더링 및 선택 상태 시각화
 * - UI 규칙 준수: 순수 상태 표시 전용 렌더러 (게임 로직 계산 일체 없음)
 * - 닫기 버튼 및 캐릭터 카드 터치/클릭 hitTest 지원
 */

import type { CharacterDefinition } from '../types/character-definition.js';

export interface ModalBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CharacterCardLayoutSlot extends ModalBounds {
  character: CharacterDefinition;
}

export type CharacterSelectAction =
  | { type: 'select'; id: string }
  | { type: 'close' }
  | null;

export class CharacterSelectModal {
  private _isOpen = false;

  // 1080 x 2160 가상 해상도 기준 모달 영역
  public readonly MODAL_VIRTUAL = {
    x: 100,
    y: 360,
    w: 880,
    h: 1440,
  };

  get isOpen(): boolean {
    return this._isOpen;
  }

  public open(): void {
    this._isOpen = true;
  }

  public close(): void {
    this._isOpen = false;
  }

  public toggle(): void {
    this._isOpen = !this._isOpen;
  }

  public getModalBounds(w: number, h: number): ModalBounds {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    return {
      x: this.MODAL_VIRTUAL.x * scaleX,
      y: this.MODAL_VIRTUAL.y * scaleY,
      w: this.MODAL_VIRTUAL.w * scaleX,
      h: this.MODAL_VIRTUAL.h * scaleY,
    };
  }

  public getCloseButtonBounds(w: number, h: number): ModalBounds {
    const modal = this.getModalBounds(w, h);
    const btnSize = Math.max(36, Math.min(modal.w, modal.h) * 0.08);
    const margin = 16 * (w / 1080);
    return {
      x: modal.x + modal.w - btnSize - margin,
      y: modal.y + margin,
      w: btnSize,
      h: btnSize,
    };
  }

  public getCardLayout(w: number, h: number, characters: CharacterDefinition[]): CharacterCardLayoutSlot[] {
    const modal = this.getModalBounds(w, h);
    if (!characters || characters.length === 0) return [];

    const scaleY = h / 2160;
    const headerHeight = 120 * scaleY;
    const padding = 24 * (w / 1080);
    const contentY = modal.y + headerHeight;
    const availableHeight = modal.h - headerHeight - padding * 2;
    const availableWidth = modal.w - padding * 2;

    const count = characters.length;
    const cardGap = 16 * scaleY;
    const cardHeight = Math.min(180 * scaleY, (availableHeight - (count - 1) * cardGap) / Math.max(1, count));

    return characters.map((char, index) => {
      const cardY = contentY + padding + index * (cardHeight + cardGap);
      return {
        x: modal.x + padding,
        y: cardY,
        w: availableWidth,
        h: cardHeight,
        character: char,
      };
    });
  }

  public hitTest(
    x: number,
    y: number,
    w: number,
    h: number,
    characters: CharacterDefinition[]
  ): CharacterSelectAction {
    if (!this._isOpen) return null;

    // 1. 닫기 버튼 히트 테스트
    const closeBtn = this.getCloseButtonBounds(w, h);
    if (
      x >= closeBtn.x &&
      x <= closeBtn.x + closeBtn.w &&
      y >= closeBtn.y &&
      y <= closeBtn.y + closeBtn.h
    ) {
      return { type: 'close' };
    }

    // 2. 캐릭터 카드 히트 테스트
    const cards = this.getCardLayout(w, h, characters);
    for (const card of cards) {
      if (
        x >= card.x &&
        x <= card.x + card.w &&
        y >= card.y &&
        y <= card.y + card.h
      ) {
        return { type: 'select', id: card.character.id };
      }
    }

    return null;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    characters: CharacterDefinition[] = [],
    selectedId = ''
  ): void {
    if (!this._isOpen) return;

    ctx.save();

    // 1. 반투명 배경 딤(Dim)
    ctx.fillStyle = 'rgba(10, 12, 24, 0.78)';
    ctx.fillRect(0, 0, w, h);

    const modal = this.getModalBounds(w, h);

    // 2. 모달 컨테이너 패널
    ctx.fillStyle = 'rgba(16, 20, 38, 0.95)';
    ctx.strokeStyle = '#28E6FF';
    ctx.lineWidth = 2;
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(modal.x, modal.y, modal.w, modal.h, 16);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(modal.x, modal.y, modal.w, modal.h);
      ctx.strokeRect(modal.x, modal.y, modal.w, modal.h);
    }

    // 3. 타이틀
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(28 * (w / 1080))}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('캐릭터 선택 (GUARDIAN)', modal.x + 32 * (w / 1080), modal.y + 48 * (h / 2160));

    // 4. 닫기 버튼
    const closeBtn = this.getCloseButtonBounds(w, h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 8);
      ctx.fill();
    } else {
      ctx.fillRect(closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h);
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(closeBtn.h * 0.6)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✕', closeBtn.x + closeBtn.w / 2, closeBtn.y + closeBtn.h / 2);

    // 5. 캐릭터 카드 목록 렌더링
    const cards = this.getCardLayout(w, h, characters);
    for (const card of cards) {
      const isSelected = card.character.id === selectedId;

      // 카드 배경 및 테두리
      ctx.fillStyle = isSelected ? 'rgba(40, 230, 255, 0.16)' : 'rgba(255, 255, 255, 0.05)';
      ctx.strokeStyle = isSelected ? '#28E6FF' : 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = isSelected ? 3 : 1;

      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(card.x, card.y, card.w, card.h, 12);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(card.x, card.y, card.w, card.h);
        ctx.strokeRect(card.x, card.y, card.w, card.h);
      }

      // 카드 텍스트
      const paddingX = 20 * (w / 1080);
      const nameY = card.y + card.h * 0.35;
      const descY = card.y + card.h * 0.7;

      ctx.fillStyle = isSelected ? '#28E6FF' : '#FFFFFF';
      ctx.font = `bold ${Math.round(22 * (w / 1080))}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(card.character.name, card.x + paddingX, nameY);

      if (card.character.description) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = `${Math.round(15 * (w / 1080))}px sans-serif`;
        ctx.fillText(card.character.description, card.x + paddingX, descY);
      }

      // 선택 상태 뱃지
      if (isSelected) {
        const badgeText = '선택됨';
        ctx.font = `bold ${Math.round(16 * (w / 1080))}px sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillStyle = '#28E6FF';
        ctx.fillText(badgeText, card.x + card.w - paddingX, card.y + card.h / 2);
      }
    }

    ctx.restore();
  }
}
