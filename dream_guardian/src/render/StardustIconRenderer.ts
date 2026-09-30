/**
 * StardustIconRenderer - 프로시저럴 별가루(Stardust) 아이콘 및 UI 카운터 렌더러
 *
 * Canvas 2D 기반으로 고품질 4각/8각 반짝임 별가루 형상을 실시간 렌더링한다.
 * 외부 이미지 에셋 없이도 60fps로 자유로운 크기, 회전, 발광 효과를 지원한다.
 */

export interface StardustIconOptions {
  points?: 4 | 8;
  color?: string;
  innerColor?: string;
  glowColor?: string;
  glowBlur?: number;
  rotation?: number;
  alpha?: number;
}

export interface StardustCounterOptions {
  fontSize?: number;
  textColor?: string;
  fontFamily?: string;
  badgeBgColor?: string;
  borderColor?: string;
  iconSize?: number;
  paddingX?: number;
  paddingY?: number;
}

/**
 * 4각 또는 8각 프로시저럴 별가루 반짝임 아이콘 드로잉
 */
export function drawStardustIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  options: StardustIconOptions = {},
): void {
  const points = options.points ?? 4;
  const color = options.color ?? '#FFCB4D';
  const innerColor = options.innerColor ?? '#FFFFFF';
  const glowColor = options.glowColor ?? color;
  const glowBlur = options.glowBlur ?? 8;
  const rotation = options.rotation ?? 0;
  const alpha = options.alpha ?? 1.0;

  if (alpha <= 0.001 || size <= 0) return;

  ctx.save();
  ctx.globalAlpha = (ctx.globalAlpha ?? 1) * alpha;
  ctx.translate(x, y);

  if (rotation !== 0) {
    ctx.rotate(rotation);
  }

  const rOuter = size * 0.5;
  const rInner = points === 8 ? size * 0.16 : size * 0.22;

  // 외곽 글로우 설정
  if (glowBlur > 0 && glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = glowBlur;
  }

  // 1. 주 본체(4각 또는 8각 별가루 다이아몬드/곡선 빔)
  ctx.beginPath();
  if (points === 8) {
    const totalPoints = 16;
    for (let i = 0; i < totalPoints; i++) {
      const angle = (Math.PI * 2 * i) / totalPoints - Math.PI / 2;
      let r = rInner;
      if (i % 4 === 0) {
        r = rOuter; // 주 4방향 (상/하/좌/우)
      } else if (i % 2 === 0) {
        r = rOuter * 0.55; // 보조 대각 4방향
      }
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
  } else {
    // 4각 샤프 다이아몬드 곡선 스타
    const numPoints = 8;
    for (let i = 0; i < numPoints; i++) {
      const angle = (Math.PI * 2 * i) / numPoints - Math.PI / 2;
      const r = i % 2 === 0 ? rOuter : rInner;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
  }
  ctx.closePath();

  ctx.fillStyle = color;
  ctx.fill();

  // 2. 중심부 하이라이트 코어 (눈부신 백색 빛)
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(0, 0, rInner * 0.7, 0, Math.PI * 2);
  ctx.fillStyle = innerColor;
  ctx.fill();

  ctx.restore();
}

/**
 * 인게임 HUD 및 결과창용 별가루 카운터 뱃지 렌더링
 */
export function drawStardustCounter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  count: number,
  options: StardustCounterOptions = {},
): { width: number; height: number } {
  const fontSize = options.fontSize ?? 22;
  const textColor = options.textColor ?? '#FFCB4D';
  const fontFamily = options.fontFamily ?? 'NanumSquareRound, sans-serif';
  const badgeBgColor = options.badgeBgColor ?? 'rgba(15, 23, 42, 0.75)';
  const borderColor = options.borderColor ?? 'rgba(255, 203, 77, 0.4)';
  const iconSize = options.iconSize ?? fontSize * 1.1;
  const paddingX = options.paddingX ?? 14;
  const paddingY = options.paddingY ?? 6;

  ctx.save();
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  const text = count.toLocaleString();
  const textMetrics = ctx.measureText(text);

  const contentW = iconSize + 8 + textMetrics.width;
  const badgeW = contentW + paddingX * 2;
  const badgeH = Math.max(fontSize, iconSize) + paddingY * 2;

  // 배경 뱃지 필
  ctx.fillStyle = badgeBgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, badgeW, badgeH, badgeH / 2);
  } else {
    ctx.rect(x, y, badgeW, badgeH);
  }
  ctx.fill();
  ctx.stroke();

  // 별가루 아이콘
  const iconCenterX = x + paddingX + iconSize * 0.5;
  const iconCenterY = y + badgeH * 0.5;
  drawStardustIcon(ctx, iconCenterX, iconCenterY, iconSize, {
    points: 4,
    color: textColor,
    innerColor: '#FFFFFF',
    glowColor: textColor,
    glowBlur: 6,
  });

  // 텍스트 출력
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + paddingX + iconSize + 8, iconCenterY);

  ctx.restore();

  return { width: badgeW, height: badgeH };
}

export class StardustIconRenderer {
  drawIcon(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    options?: StardustIconOptions,
  ): void {
    drawStardustIcon(ctx, x, y, size, options);
  }

  drawCounter(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    count: number,
    options?: StardustCounterOptions,
  ): { width: number; height: number } {
    return drawStardustCounter(ctx, x, y, count, options);
  }
}
