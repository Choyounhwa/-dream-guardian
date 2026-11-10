/**
 * ReadyPositionRenderer.ts - 카메라 신체 프레임 정렬 가이드 및 3초 카운트다운 렌더러
 *
 * @see Issue #202 [FEAT-READY-001]
 * - 화면 중앙 반투명 가이드 실루엣 및 정렬 박스 ("카메라 앞에 서서 준비하세요!")
 * - 관절 정렬 성공(isAligned) 시 청록색(#4DFFAA) 네온 점등 효과
 * - 3... 2... 1... START! 대형 네온 카운트다운 애니메이션
 * - 하단 "Space 키 또는 화면 터치로 건너뛰기" 안내
 *
 * @see Issue #444 [UI-VIS-014]
 * - 선택적 표시 컨텍스트(ReadyPositionPresentationContext) 주입/조회/해제 지원
 * - bounds 조회 메서드 (getAlignmentFrameBounds, getHeaderMessageBounds, getCountdownBounds, getSkipNoticeBounds)
 * - 신체 정렬 안전 영역 보호 (Protected Motion Zone Guard): 모션 인식 판정 영역의 geometry 변조 원자적 차단
 * - UIPresentationDocument.play_ready 페이지 연동 (fromPresentationDocument)
 * - 무부작용 결정론적 Fixture DTO 렌더 진입점 (renderFixture, 정적/인스턴스)
 */

import type { ReadyPositionRenderState } from '../game/ReadyPositionController.js';
import type { UIPresentationDocument, UIPresentationPageId } from '../data/UIPresentation.js';
import { UI_LAYOUT } from '../../config/ui.config.js';

function clampTextScale(scale: number | undefined): number {
  if (scale === undefined || Number.isNaN(scale)) return 1.0;
  return Math.max(0.5, Math.min(3.0, scale));
}

export interface ReadyPositionRenderOptions {
  time?: number;
}

export interface ReadyPositionBounds {
  x: number;
  y: number;
  w: number;
  h: number;
  width: number;
  height: number;
  isProtected?: boolean;
}

export interface ReadyPositionSlotOverride {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  text?: string;
  unalignedText?: string;
  alignedText?: string;
  fontSize?: number;
  color?: string;
  shadowColor?: string;
  shadowBlur?: number;
  visible?: boolean;
}

export interface ReadyPositionPresentationContext {
  presentationDocument?: UIPresentationDocument;
  pageId?: UIPresentationPageId | string;
  headerMessage?: ReadyPositionSlotOverride;
  countdown?: ReadyPositionSlotOverride;
  skipNotice?: ReadyPositionSlotOverride;
  alignmentFrame?: ReadyPositionSlotOverride;
  background?: {
    color?: string;
    visible?: boolean;
  };
}

export interface ReadyPositionFixtureDTO {
  state?: Partial<ReadyPositionRenderState>;
  isAligned?: boolean;
  currentCount?: number;
  countText?: string;
  readyTimer?: number;
  remainingTime?: number;
  timeInState?: number;
  animTime?: number;
  presentationContext?: ReadyPositionPresentationContext;
}

export const READY_POSITION_SLOT_IDS = [
  'alignmentFrame',
  'headerMessage',
  'countdown',
  'skipNotice',
] as const;

export const PROTECTED_READY_SLOT_IDS = [
  'alignmentFrame',
  'body_alignment_area',
  'silhouette',
] as const;

export const DEFAULT_READY_POSITION_FIXTURE_STATE: ReadyPositionRenderState = Object.freeze({
  isActive: true,
  isFinished: false,
  isInputLocked: true,
  readyTimer: 3.0,
  remainingTime: 3.0,
  currentCount: 3,
  countText: '3',
  isAligned: false,
  progress: 0,
});

export class ReadyPositionRenderer {
  private _animTime = 0;
  private _presentationContext?: ReadyPositionPresentationContext;

  constructor(presentationContext?: ReadyPositionPresentationContext) {
    if (presentationContext) {
      this.setPresentationContext(presentationContext);
    }
  }

  update(dt: number): void {
    this._animTime += Math.max(0, dt);
  }

  /**
   * 선택적 표시 컨텍스트 주입
   */
  setPresentationContext(context?: ReadyPositionPresentationContext): void {
    this._presentationContext = context;
  }

  /**
   * 현재 주입된 표시 컨텍스트 조회
   */
  getPresentationContext(): ReadyPositionPresentationContext | undefined {
    return this._presentationContext;
  }

  /**
   * 주입된 표시 컨텍스트 초기화
   */
  clearPresentationContext(): void {
    this._presentationContext = undefined;
  }

  private _resolveContext(overrideCtx?: ReadyPositionPresentationContext): ReadyPositionPresentationContext | undefined {
    const ctx = overrideCtx ?? this._presentationContext;
    if (!ctx) return undefined;
    if (!ctx.presentationDocument) return ctx;

    const docCtx = ReadyPositionRenderer.fromPresentationDocument(ctx.presentationDocument, ctx.pageId);
    return {
      ...docCtx,
      ...ctx,
      headerMessage: { ...docCtx.headerMessage, ...ctx.headerMessage },
      countdown: { ...docCtx.countdown, ...ctx.countdown },
      skipNotice: { ...docCtx.skipNotice, ...ctx.skipNotice },
      alignmentFrame: { ...docCtx.alignmentFrame, ...ctx.alignmentFrame },
      background: { ...docCtx.background, ...ctx.background },
    };
  }

  /**
   * 지정 슬롯이 모션 인식 보호 구역인지 여부 반환
   */
  isSlotLocked(slotId: string): boolean {
    return (PROTECTED_READY_SLOT_IDS as readonly string[]).includes(slotId);
  }

  /**
   * 잠긴 슬롯의 보호 사유 반환 (미잠금 슬롯은 null)
   */
  getSlotLockReason(slotId: string): string | null {
    if (this.isSlotLocked(slotId)) {
      return '신체 정렬 가이드 프레임 및 실루엣은 웹캠 모션 인식 핵심 보호 영역(body_alignment_area)으로 위치 및 크기 변경이 원자적으로 잠겨 있습니다.';
    }
    return null;
  }

  /**
   * 프레젠테이션 컨텍스트의 보호 영역 위반 여부 검증
   */
  validatePresentationContext(
    context?: ReadyPositionPresentationContext,
  ): { valid: boolean; violations: string[]; lockedSlots: string[] } {
    const violations: string[] = [];
    const lockedSlots: string[] = [];

    if (!context) {
      return { valid: true, violations, lockedSlots };
    }

    if (context.alignmentFrame) {
      const { x, y, w, h } = context.alignmentFrame;
      if (x !== undefined || y !== undefined || w !== undefined || h !== undefined) {
        lockedSlots.push('alignmentFrame');
        violations.push(
          'alignmentFrame: 신체 정렬 실루엣 및 가이드 프레임의 판정 geometry는 모션 인식 보호 영역(body_alignment_area)으로 지정되어 임의 변경이 거부됩니다.',
        );
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      lockedSlots,
    };
  }

  /**
   * 신체 정렬 가이드 프레임 바운딩 박스 반환
   * (신체 정렬 안전 영역 보호: context의 임의 geometry 왜곡/이동은 거부되고 안전 비율로 잠김)
   */
  getAlignmentFrameBounds(
    width: number,
    height: number,
    _context?: ReadyPositionPresentationContext,
  ): ReadyPositionBounds {
    const boxW = width * 0.54;
    const boxH = height * 0.62;
    const boxX = (width - boxW) / 2;
    const boxY = height * 0.18;

    return {
      x: boxX,
      y: boxY,
      w: boxW,
      h: boxH,
      width: boxW,
      height: boxH,
      isProtected: true,
    };
  }

  /**
   * 상단 안내 헤더 메시지 바운딩 박스 반환
   */
  getHeaderMessageBounds(
    width: number,
    height: number,
    context?: ReadyPositionPresentationContext,
  ): ReadyPositionBounds {
    const scaleX = width / 1080;
    const scaleY = height / 2160;
    const ctx = this._resolveContext(context);
    const layout = UI_LAYOUT.ready?.headerMessage ?? { x: 140, y: 180, w: 800, h: 100, textScale: 1.0 };
    const baseW = layout.w * scaleX;
    const baseH = layout.h * scaleY;
    const baseX = layout.x * scaleX;
    const baseY = layout.y * scaleY;

    const x = ctx?.headerMessage?.x !== undefined ? ctx.headerMessage.x * scaleX : baseX;
    const y = ctx?.headerMessage?.y !== undefined ? ctx.headerMessage.y * scaleY : baseY;
    const w = ctx?.headerMessage?.w !== undefined ? ctx.headerMessage.w * scaleX : baseW;
    const h = ctx?.headerMessage?.h !== undefined ? ctx.headerMessage.h * scaleY : baseH;

    return { x, y, w, h, width: w, height: h };
  }

  /**
   * 중앙 카운트다운/START 바운딩 박스 반환
   */
  getCountdownBounds(
    width: number,
    height: number,
    context?: ReadyPositionPresentationContext,
  ): ReadyPositionBounds {
    const scaleX = width / 1080;
    const scaleY = height / 2160;
    const ctx = this._resolveContext(context);
    const layout = UI_LAYOUT.ready?.countdown ?? { x: 340, y: 794, w: 400, h: 400, textScale: 1.0 };
    const baseW = layout.w * scaleX;
    const baseH = layout.h * scaleY;
    const baseX = layout.x * scaleX;
    const baseY = layout.y * scaleY;

    const x = ctx?.countdown?.x !== undefined ? ctx.countdown.x * scaleX : baseX;
    const y = ctx?.countdown?.y !== undefined ? ctx.countdown.y * scaleY : baseY;
    const w = ctx?.countdown?.w !== undefined ? ctx.countdown.w * scaleX : baseW;
    const h = ctx?.countdown?.h !== undefined ? ctx.countdown.h * scaleY : baseH;

    return { x, y, w, h, width: w, height: h };
  }

  /**
   * 하단 건너뛰기 안내 바운딩 박스 반환
   */
  getSkipNoticeBounds(
    width: number,
    height: number,
    context?: ReadyPositionPresentationContext,
  ): ReadyPositionBounds {
    const scaleX = width / 1080;
    const scaleY = height / 2160;
    const ctx = this._resolveContext(context);
    const layout = UI_LAYOUT.ready?.skipNotice ?? { x: 140, y: 1861, w: 800, h: 80, textScale: 1.0 };
    const baseW = layout.w * scaleX;
    const baseH = layout.h * scaleY;
    const baseX = layout.x * scaleX;
    const baseY = layout.y * scaleY;

    const x = ctx?.skipNotice?.x !== undefined ? ctx.skipNotice.x * scaleX : baseX;
    const y = ctx?.skipNotice?.y !== undefined ? ctx.skipNotice.y * scaleY : baseY;
    const w = ctx?.skipNotice?.w !== undefined ? ctx.skipNotice.w * scaleX : baseW;
    const h = ctx?.skipNotice?.h !== undefined ? ctx.skipNotice.h * scaleY : baseH;

    return { x, y, w, h, width: w, height: h };
  }

  /**
   * UIPresentationDocument로부터 ReadyPositionPresentationContext 추출
   */
  static fromPresentationDocument(
    doc: UIPresentationDocument,
    pageId: UIPresentationPageId | string = 'play_ready',
  ): ReadyPositionPresentationContext {
    const result: ReadyPositionPresentationContext = {
      presentationDocument: doc,
      pageId,
    };
    if (!doc?.pages) return result;

    const targetPages =
      pageId && doc.pages[pageId as UIPresentationPageId]
        ? [doc.pages[pageId as UIPresentationPageId]]
        : Object.values(doc.pages);

    for (const page of targetPages) {
      if (!page?.elements) continue;
      for (const el of page.elements) {
        if (!el) continue;
        const b = el.bounds;
        const boundsObj: ReadyPositionSlotOverride = b
          ? {
              x: b.x,
              y: b.y,
              w: b.width ?? (b as any).w ?? 0,
              h: b.height ?? (b as any).h ?? 0,
            }
          : {};

        if (el.text) {
          boundsObj.text = el.text;
        }
        if ((el as any).fontSize) {
          boundsObj.fontSize = (el as any).fontSize;
        }
        if ((el as any).style?.fontSize) {
          boundsObj.fontSize = (el as any).style.fontSize;
        }
        if ((el as any).style?.color) {
          boundsObj.color = (el as any).style.color;
        }

        const id = el.id.toLowerCase();
        if (
          id === 'ready_guide_text' ||
          id === 'header_message' ||
          id === 'guide_text' ||
          id === 'ready_title' ||
          id === 'header'
        ) {
          result.headerMessage = {
            ...boundsObj,
            ...result.headerMessage,
          };
        } else if (
          id === 'ready_skip_notice' ||
          id === 'skip_notice' ||
          id === 'skip_text' ||
          id === 'skip_prompt' ||
          id === 'skip'
        ) {
          result.skipNotice = {
            ...boundsObj,
            ...result.skipNotice,
          };
        } else if (
          id === 'ready_countdown' ||
          id === 'countdown' ||
          id === 'timer'
        ) {
          result.countdown = {
            ...boundsObj,
            ...result.countdown,
          };
        } else if (
          id === 'body_alignment_area' ||
          id === 'alignment_frame' ||
          id === 'guide_frame' ||
          id === 'silhouette'
        ) {
          result.alignmentFrame = {
            ...boundsObj,
            ...result.alignmentFrame,
          };
        }
      }
    }
    return result;
  }

  /**
   * 결정론적 Fixture DTO 렌더 진입점 (인스턴스 기반, 무부작용 보장)
   */
  renderFixture(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dto?: ReadyPositionFixtureDTO,
  ): void {
    const prevAnim = this._animTime;
    const prevCtx = this._presentationContext;

    if (dto?.animTime !== undefined) {
      this._animTime = dto.animTime;
    }
    if (dto?.presentationContext) {
      this._presentationContext = dto.presentationContext;
    }

    const state: ReadyPositionRenderState = {
      ...DEFAULT_READY_POSITION_FIXTURE_STATE,
      ...(dto?.state ?? {}),
      ...(dto?.isAligned !== undefined ? { isAligned: dto.isAligned } : {}),
      ...(dto?.currentCount !== undefined ? { currentCount: dto.currentCount } : {}),
      ...(dto?.countText !== undefined ? { countText: dto.countText } : {}),
      ...(dto?.readyTimer !== undefined ? { readyTimer: dto.readyTimer } : {}),
      ...(dto?.remainingTime !== undefined ? { remainingTime: dto.remainingTime } : {}),
    };

    try {
      this.render(ctx, width, height, state);
    } finally {
      this._animTime = prevAnim;
      this._presentationContext = prevCtx;
    }
  }

  /**
   * 정적 Fixture DTO 렌더 진입점 (인스턴스 없이 순수 DTO 직접 렌더링)
   */
  static renderFixture(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dto?: ReadyPositionFixtureDTO,
  ): void {
    const renderer = new ReadyPositionRenderer(dto?.presentationContext);
    renderer.renderFixture(ctx, width, height, dto);
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
    const resolved = this._resolveContext();
    if (resolved?.background?.visible !== false) {
      ctx.fillStyle = resolved?.background?.color ?? 'rgba(10, 14, 28, 0.65)';
      ctx.fillRect(0, 0, width, height);
    }

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
    const resolved = this._resolveContext();
    const frameOverride = resolved?.alignmentFrame;
    if (frameOverride?.visible === false) return;

    // 모션 인식 보호 영역: 임의의 geometry 변조는 거부되고 보호된 프레임 위치/크기만 사용
    const bounds = this.getAlignmentFrameBounds(width, height, resolved);
    const boxW = bounds.w;
    const boxH = bounds.h;
    const boxX = bounds.x;
    const boxY = bounds.y;

    const cornerLen = Math.max(24, width * 0.04);
    const defaultColor = isAligned ? '#4DFFAA' : '#28E6FF';
    const borderColor = frameOverride?.color ?? defaultColor;
    const glowBlur = frameOverride?.shadowBlur ?? (isAligned ? 24 : 12);
    const shadowColor = frameOverride?.shadowColor ?? borderColor;

    ctx.save();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = isAligned ? 4 : 2.5;
    ctx.shadowColor = shadowColor;
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
    ctx.strokeStyle = isAligned ? '#4DFFAA' : (frameOverride?.color ?? '#64E8FF');
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
    const resolved = this._resolveContext();
    const override = resolved?.headerMessage;
    if (override?.visible === false) return;

    const bounds = this.getHeaderMessageBounds(width, height, resolved);
    const cx = bounds.x + bounds.w / 2;
    const y = bounds.y + bounds.h / 2;

    const textScale = clampTextScale(UI_LAYOUT.ready?.headerMessage?.textScale);
    const baseFontSize = override?.fontSize !== undefined
      ? override.fontSize * (width / 1080)
      : Math.max(24, width * 0.032);
    const fontSize = baseFontSize * textScale;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${fontSize}px sans-serif`;

    if (isAligned) {
      const text = override?.alignedText ?? override?.text ?? '정렬 완료! 자세를 유지하세요';
      ctx.fillStyle = override?.color ?? '#4DFFAA';
      ctx.shadowColor = override?.shadowColor ?? (override?.color ?? '#4DFFAA');
      ctx.shadowBlur = override?.shadowBlur ?? 14;
      ctx.fillText(text, cx, y);
    } else {
      const text = override?.unalignedText ?? override?.text ?? '카메라 앞에 서서 준비하세요!';
      ctx.fillStyle = override?.color ?? '#28E6FF';
      ctx.shadowColor = override?.shadowColor ?? (override?.color ?? '#28E6FF');
      ctx.shadowBlur = override?.shadowBlur ?? 10;
      ctx.fillText(text, cx, y);
    }
    ctx.restore();
  }

  private _renderCountdown(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: ReadyPositionRenderState,
  ): void {
    const resolved = this._resolveContext();
    const override = resolved?.countdown;
    if (override?.visible === false) return;

    const bounds = this.getCountdownBounds(width, height, resolved);
    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;
    const isStart = state.currentCount <= 0;
    const textScale = clampTextScale(UI_LAYOUT.ready?.countdown?.textScale);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (isStart) {
      // START! 애니메이션
      const baseFontSize = override?.fontSize !== undefined
        ? override.fontSize * (width / 1080)
        : Math.max(64, width * 0.09);
      const fontSize = baseFontSize * textScale;
      ctx.font = `900 ${fontSize}px sans-serif`;
      ctx.fillStyle = override?.color ?? '#4DFFAA';
      ctx.shadowColor = override?.shadowColor ?? (override?.color ?? '#4DFFAA');
      ctx.shadowBlur = override?.shadowBlur ?? 32;

      ctx.fillText('START!', cx, cy);

      // 외곽 펄스 링
      const ringRadius = Math.max(70, width * 0.12);
      ctx.strokeStyle = override?.color ?? '#4DFFAA';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // 3, 2, 1 대형 네온 카운트다운
      const timerVal = state.readyTimer ?? state.remainingTime ?? 3.0;
      const frac = timerVal - Math.floor(timerVal);
      const pulseScale = 1.0 + Math.sin(frac * Math.PI) * 0.12;
      const baseFontSize = override?.fontSize !== undefined
        ? override.fontSize * (width / 1080)
        : Math.max(90, width * 0.13);
      const fontSize = baseFontSize * pulseScale * textScale;

      ctx.font = `900 ${fontSize}px sans-serif`;
      ctx.fillStyle = override?.color ?? '#FFCB4D';
      ctx.shadowColor = override?.shadowColor ?? (override?.color ?? '#FFCB4D');
      ctx.shadowBlur = override?.shadowBlur ?? 28;

      ctx.fillText(state.countText, cx, cy);

      // 카운트다운 원형 타이머 링
      const ringRadius = Math.max(65, width * 0.08);
      ctx.strokeStyle = override?.color ? `${override.color}40` : 'rgba(255, 203, 77, 0.25)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      // 진행도 호 (Arc)
      const currentSlotProgress = 1 - frac;
      ctx.strokeStyle = override?.color ?? '#FFCB4D';
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
    const resolved = this._resolveContext();
    const override = resolved?.skipNotice;
    if (override?.visible === false) return;

    const bounds = this.getSkipNoticeBounds(width, height, resolved);
    const cx = bounds.x + bounds.w / 2;
    const y = bounds.y + bounds.h / 2;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const pulse = 0.7 + Math.sin(this._animTime * 3) * 0.3;
    const textScale = clampTextScale(UI_LAYOUT.ready?.skipNotice?.textScale);
    const baseFontSize = override?.fontSize !== undefined
      ? override.fontSize * (width / 1080)
      : Math.max(18, width * 0.024);
    const fontSize = baseFontSize * textScale;

    ctx.font = `500 ${fontSize}px sans-serif`;
    const defaultColor = `rgba(255, 255, 255, ${0.75 * pulse})`;
    ctx.fillStyle = override?.color ?? defaultColor;
    ctx.shadowColor = override?.shadowColor ?? '#28E6FF';
    ctx.shadowBlur = override?.shadowBlur ?? 6;

    const text = override?.text ?? 'Space 키 또는 화면 터치로 건너뛰기';
    ctx.fillText(text, cx, y);
    ctx.restore();
  }
}
