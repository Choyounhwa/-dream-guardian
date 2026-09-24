/**
 * PartIconRenderer - 손/머리/골반 신체 부위별 공통 아이콘 벡터 렌더러
 *
 * Issue #127 (Card #58): [ICON-001]
 * - 커서, 답안 버튼, 피트니스 존에서 동일한 형상과 색상의 부위별 벡터 아이콘 렌더링
 * - leftHand: 시안(#28E6FF) 좌향 손바닥 실루엣
 * - rightHand: 노랑(#FFCB4D) 우향 손바닥 실루엣 (미러)
 * - head: 보라(#C889FF) 원형 얼굴 + 2점 눈
 * - hip: 주황(#FF865E) 다이아몬드(마름모)
 * - 외곽선(stroke), 채움(fill), 투명도(alpha), 크기(size), 중심좌표(x, y) 지원
 */

import { CURSOR_COLORS, type CursorType } from '../../config/cursor.config.js';

export type BodyPartIconType = CursorType;

export interface ChoiceRequirement {
  requiredCursors: CursorType[];
  targetZoneIds: number[];
}

export interface DrawPartIconOptions {
  /** 렌더링 모드: 'stroke' (외곽선 전용, 기본값) | 'fill' (채움 전용) | 'both' (외곽선+채움) */
  mode?: 'stroke' | 'fill' | 'both';
  /** 불투명도 (0~1, 기본값: 1) */
  alpha?: number;
  /** 선 두께 (기본값: size * 0.1, 최소 1.5) */
  lineWidth?: number;
  /** 커스텀 색상 (미지정 시 CURSOR_COLORS 기본 색상 사용) */
  color?: string;
  /** 네온 글로우 효과 여부 (기본값: false) */
  glow?: boolean;
}

export class PartIconRenderer {
  /**
   * 답안 요구조건 부위 아이콘 및 묶음 기호(함께 ( ) / 각각 |) 시각화 (Issue #128 / UI-001)
   */
  static drawRequirementGroup(
    ctx: CanvasRenderingContext2D,
    recipe: ChoiceRequirement,
    centerX: number,
    centerY: number,
    iconSize = 18,
  ): void {
    if (!recipe.requiredCursors || recipe.requiredCursors.length === 0) return;

    // 타겟 존별로 요구 부위 그룹핑
    const groups: Array<{ zoneId: number; parts: CursorType[] }> = [];
    for (let i = 0; i < recipe.requiredCursors.length; i++) {
      const part = recipe.requiredCursors[i];
      const zId = recipe.targetZoneIds[i] ?? 0;
      let g = groups.find((item) => item.zoneId === zId);
      if (!g) {
        g = { zoneId: zId, parts: [] };
        groups.push(g);
      }
      g.parts.push(part);
    }

    // 드로잉 토큰 열 생성
    type Token =
      | { type: 'icon'; part: CursorType; w: number }
      | { type: 'text'; text: string; w: number };

    const tokens: Token[] = [];
    const charW = Math.round(iconSize * 0.55);
    const sepW = Math.round(iconSize * 0.7);

    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      if (gi > 0) {
        tokens.push({ type: 'text', text: '|', w: sepW });
      }

      const isMulti = g.parts.length > 1;
      if (isMulti) {
        tokens.push({ type: 'text', text: '(', w: charW });
      }

      for (let pi = 0; pi < g.parts.length; pi++) {
        tokens.push({ type: 'icon', part: g.parts[pi], w: iconSize + 4 });
      }

      if (isMulti) {
        tokens.push({ type: 'text', text: ')', w: charW });
      }
    }

    // 총 너비 산출 및 중앙 정렬 시작점
    const totalW = tokens.reduce((sum, t) => sum + t.w, 0);
    let curX = centerX - totalW / 2;

    ctx.save();
    ctx.font = `bold ${Math.round(iconSize * 0.9)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const token of tokens) {
      if (token.type === 'text') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
        ctx.shadowBlur = 4;
        ctx.fillText(token.text, curX + token.w / 2, centerY);
      } else {
        this.drawIcon(ctx, token.part, curX + token.w / 2, centerY, iconSize, {
          mode: 'stroke',
          glow: true,
          lineWidth: 2,
        });
      }
      curX += token.w;
    }

    ctx.restore();
  }

  /**
   * 요구 부위 구성 색상 기반 답안 카드 테두리 그라데이션 생성 (Issue #128 / UI-001 / 호환 유지)
   */
  static getRequirementGradient(
    ctx: CanvasRenderingContext2D,
    recipe: ChoiceRequirement,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): CanvasGradient | string {
    const parts = recipe.requiredCursors;
    if (!parts || parts.length === 0) return '#FFCB4D';
    if (parts.length === 1) return CURSOR_COLORS[parts[0]] ?? '#FFCB4D';

    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    for (let i = 0; i < parts.length; i++) {
      const stop = i / (parts.length - 1);
      grad.addColorStop(stop, CURSOR_COLORS[parts[i]] ?? '#FFCB4D');
    }
    return grad;
  }

  /**
   * 답안 버튼(둥근 사각형) 방사형(Radial) 색상 분할 렌더러 (Issue #148 / FEAT-UI-005)
   *
   * ANSWER_SELECTION_DESIGN.md 준수:
   * - 1개 색상: 전체 단일 색상 테두리 및 은은한 채움
   * - 2개 색상: 중심점 기준 1/2(180도) 방사형 부채꼴 분할
   * - 3개 색상: 중심점 기준 1/3(120도) 방사형 부채꼴 분할
   * - 둥근 사각형 클리핑 영역 내에서 방사형 부채꼴 섹터를 드로잉하여 경계선 밖 넘침 원천 차단
   */
  static drawRadialAnswerButton(
    ctx: CanvasRenderingContext2D,
    recipe: ChoiceRequirement | null | undefined,
    x: number,
    y: number,
    width: number,
    height: number,
    radius = 16,
    lineWidth = 7.0,
  ): void {
    const rawParts = recipe?.requiredCursors;
    const parts = (rawParts && rawParts.length > 0) ? rawParts : null;

    const colors = parts
      ? parts.map((p) => CURSOR_COLORS[p] ?? '#FFCB4D')
      : ['#FFCB4D'];
    const count = colors.length;

    const cx = x + width / 2;
    const cy = y + height / 2;
    const R = Math.hypot(width, height);

    const hexToRgba = (hex: string, alpha: number): string => {
      const clean = hex.replace('#', '');
      if (clean.length === 6) {
        const r = parseInt(clean.substring(0, 2), 16);
        const g = parseInt(clean.substring(2, 4), 16);
        const b = parseInt(clean.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
      return hex;
    };

    if (count <= 1) {
      // 1개 색상 (단일 색상 채움 및 테두리)
      const color = colors[0];
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, radius);
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.stroke();

      ctx.fillStyle = hexToRgba(color, 0.10);
      ctx.fill();
      ctx.restore();
      return;
    }

    // 2개 또는 3개 색상: 중심점 기점 방사형(Radial) 부채꼴 분할
    // 12시 방향(-Math.PI / 2)부터 시계방향으로 섹터 분할
    const delta = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
      const startAngle = -Math.PI / 2 + i * delta;
      const endAngle = startAngle + delta;
      const color = colors[i];

      ctx.save();
      // 섹터 i 영역으로 클리핑
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, startAngle, endAngle);
      ctx.closePath();
      ctx.clip();

      // 섹터 내부 둥근 사각형 배경 채움
      ctx.fillStyle = hexToRgba(color, 0.12);
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, radius);
      ctx.fill();

      // 섹터 테두리 스트로크 (Issue #163: 2배 두께 및 선명한 네온 글로우)
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, radius);
      ctx.stroke();

      // 섹터 경계 분할선 (중심에서 외곽으로, Issue #163: 두께 3.0 상향)
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(startAngle) * R, cy + Math.sin(startAngle) * R);
      ctx.lineWidth = 3.0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.shadowBlur = 0;
      ctx.stroke();

      ctx.restore();
    }
  }
  /**
   * 신체 부위별 아이콘 단독 렌더링
   */
  static drawIcon(
    ctx: CanvasRenderingContext2D,
    part: BodyPartIconType,
    cx: number,
    cy: number,
    size: number,
    options?: DrawPartIconOptions,
  ): void {
    const color = options?.color ?? CURSOR_COLORS[part] ?? '#FFFFFF';
    const mode = options?.mode ?? 'stroke';
    const alpha = options?.alpha ?? 1.0;
    const lineWidth = options?.lineWidth ?? Math.max(1.5, size * 0.1);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (options?.glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = size * 0.4;
    }

    switch (part) {
      case 'leftHand':
        this.drawHand(ctx, cx, cy, size, true, mode);
        break;
      case 'rightHand':
        this.drawHand(ctx, cx, cy, size, false, mode);
        break;
      case 'head':
        this.drawHead(ctx, cx, cy, size, mode);
        break;
      case 'hip':
        this.drawHip(ctx, cx, cy, size, mode);
        break;
      case 'shoulder':
        this.drawShoulder(ctx, cx, cy, size, mode);
        break;
    }

    ctx.restore();
  }

  /**
   * 손바닥 실루엣 벡터 드로잉
   * @param isLeft true면 왼손(엄지가 왼쪽), false면 오른손(엄지가 오른쪽)
   */
  static drawHand(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    isLeft: boolean,
    mode: 'stroke' | 'fill' | 'both',
  ): void {
    const s = size * 0.5;
    const dir = isLeft ? 1 : -1; // 엄지 방향

    ctx.beginPath();
    // 손목 기저부에서 시작
    ctx.moveTo(cx - s * 0.35 * dir, cy + s * 0.7);
    ctx.lineTo(cx + s * 0.35 * dir, cy + s * 0.7);

    // 새끼손가락 외곽 라인
    ctx.lineTo(cx + s * 0.5 * dir, cy - s * 0.1);
    ctx.arcTo(cx + s * 0.5 * dir, cy - s * 0.7, cx + s * 0.3 * dir, cy - s * 0.7, s * 0.15);
    ctx.lineTo(cx + s * 0.25 * dir, cy - s * 0.7);

    // 중지/검지 상단
    ctx.arcTo(cx + s * 0.15 * dir, cy - s * 0.85, cx - s * 0.05 * dir, cy - s * 0.85, s * 0.15);
    ctx.lineTo(cx - s * 0.1 * dir, cy - s * 0.75);

    // 엄지손가락
    ctx.lineTo(cx - s * 0.35 * dir, cy - s * 0.2);
    ctx.lineTo(cx - s * 0.65 * dir, cy + s * 0.05); // 엄지 돌출부
    ctx.arcTo(cx - s * 0.75 * dir, cy + s * 0.25, cx - s * 0.45 * dir, cy + s * 0.35, s * 0.15);
    ctx.lineTo(cx - s * 0.4 * dir, cy + s * 0.35);

    ctx.closePath();

    if (mode === 'fill' || mode === 'both') {
      ctx.fill();
    }
    if (mode === 'stroke' || mode === 'both') {
      ctx.stroke();
    }
  }

  /**
   * 원형 얼굴 + 2점 눈 드로잉
   */
  static drawHead(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    mode: 'stroke' | 'fill' | 'both',
  ): void {
    const r = size * 0.45;

    // 1. 얼굴 원형 윤곽
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (mode === 'fill' || mode === 'both') {
      ctx.fill();
    }
    if (mode === 'stroke' || mode === 'both') {
      ctx.stroke();
    }

    // 2. 눈 (두 점)
    const eyeR = Math.max(1.5, r * 0.16);
    const eyeOffsetX = r * 0.38;
    const eyeOffsetY = -r * 0.12;

    const eyeFill = mode === 'fill' ? '#050308' : ctx.strokeStyle;
    ctx.fillStyle = eyeFill;

    ctx.beginPath();
    ctx.arc(cx - eyeOffsetX, cy + eyeOffsetY, eyeR, 0, Math.PI * 2);
    ctx.arc(cx + eyeOffsetX, cy + eyeOffsetY, eyeR, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * 골반 라운드 납작 다이아몬드(마름모) 드로잉 (Issue #145)
   */
  static drawHip(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    mode: 'stroke' | 'fill' | 'both',
  ): void {
    const hw = size * 0.58;
    const hh = size * 0.32;
    const radius = Math.min(4, Math.round(hh * 0.35));

    ctx.beginPath();
    ctx.lineJoin = 'round';
    if (typeof ctx.arcTo === 'function') {
      ctx.moveTo((cx - hw + cx) / 2, (cy + cy - hh) / 2);
      ctx.arcTo(cx, cy - hh, cx + hw, cy, radius);
      ctx.arcTo(cx + hw, cy, cx, cy + hh, radius);
      ctx.arcTo(cx, cy + hh, cx - hw, cy, radius);
      ctx.arcTo(cx - hw, cy, cx, cy - hh, radius);
      ctx.closePath();
    } else {
      ctx.moveTo(cx, cy - hh);
      ctx.lineTo(cx + hw, cy);
      ctx.lineTo(cx, cy + hh);
      ctx.lineTo(cx - hw, cy);
      ctx.closePath();
    }

    if (mode === 'fill' || mode === 'both') {
      ctx.fill();
    }
    if (mode === 'stroke' || mode === 'both') {
      ctx.stroke();
    }
  }

  /**
   * 어깨 라운드 사각형 (호환성)
   */
  static drawShoulder(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    mode: 'stroke' | 'fill' | 'both',
  ): void {
    const half = size * 0.42;
    ctx.beginPath();
    ctx.roundRect(cx - half, cy - half, half * 2, half * 2, Math.max(2, size * 0.12));
    if (mode === 'fill' || mode === 'both') {
      ctx.fill();
    }
    if (mode === 'stroke' || mode === 'both') {
      ctx.stroke();
    }
  }
}

/** 함수형 인터페이스 간편 호출 래퍼 */
export function drawPartIcon(
  ctx: CanvasRenderingContext2D,
  part: BodyPartIconType,
  x: number,
  y: number,
  size: number,
  color?: string,
  options?: Omit<DrawPartIconOptions, 'color'>,
): void {
  PartIconRenderer.drawIcon(ctx, part, x, y, size, { ...options, color });
}
