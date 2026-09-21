/**
 * MathRenderer - Canvas 2D 기반 직관적 수학 수식 렌더러
 *
 * 가로 분수선(Horizontal Fraction Bar), 거듭제곱(지수), 근호(루트 상단선),
 * [ ? ] 빈칸/비교 박스를 교과서 표준 형태로 Canvas 2D에 렌더링.
 *
 * @see Issue #114 (Card #44)
 */

import type { MathToken, MathRenderOptions } from '../types/index.js';

const SUPERSCRIPT_MAP: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-',
};

const SUBSCRIPT_MAP: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
};

/**
 * 수식 문자열을 구조화된 MathToken 스트림으로 파싱
 */
export function parseMath(rawText: string): MathToken[] {
  if (!rawText) return [];

  const tokens: MathToken[] = [];
  let text = rawText.trim();

  // 토큰 파싱 정규식 패턴들
  // 1. [ ? ] 또는 [?]
  const placeholderRegex = /^\[\s*(\?|[A-Za-z0-9가-힣]*)\s*\]/;

  // 2. 루트 기호: √16, √{A}, √(A+B)
  const sqrtRegex = /^√\s*(\d+|\([^\)]+\)|[a-zA-Z]+)/;

  // 3. 2진수 아래첨자: 1101₍₂₎ 또는 101_2
  const binaryRegex = /^([0-9]+)\s*₍([₀₁₂₃₄₅₆₇₈₉0-9]+)₎/;

  // 4. 대분수: 1 1/2 또는 2과 3/4
  const mixedFracRegex = /^(\d+)\s*(?:과\s+)?(\d+)\s*\/\s*(\d+)/;

  // 5. 일반 분수: 3/4, (A+B)/C, 1/2
  const fracRegex = /^(\d+|\([^\)]+\))\s*\/\s*(\d+|\([^\)]+\))/;

  // 6. 거듭제곱: 5², 2³, x^2, {A}{sup(B)}, 10^3
  const powerSupCharRegex = /^([a-zA-Z0-9]+|[^\s]+)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/;
  const powerCaretRegex = /^([a-zA-Z0-9]+|\([^\)]+\))\^([a-zA-Z0-9]+|\([^\)]+\))/;

  // 7. 연산자: +, -, ×, ÷, =, ≠, >, <, ≤, ≥
  const opRegex = /^(\s*)([+\-×÷=≠><≤≥])(\s*)/;

  while (text.length > 0) {
    // 1. 빈칸 박스 [ ? ]
    const phMatch = text.match(placeholderRegex);
    if (phMatch) {
      tokens.push({ type: 'placeholder', label: phMatch[1] || '?' });
      text = text.slice(phMatch[0].length);
      continue;
    }

    // 2. 루트
    const sqrtMatch = text.match(sqrtRegex);
    if (sqrtMatch) {
      let rad = sqrtMatch[1];
      if (rad.startsWith('(') && rad.endsWith(')')) rad = rad.slice(1, -1);
      tokens.push({ type: 'sqrt', radicand: rad });
      text = text.slice(sqrtMatch[0].length);
      continue;
    }

    // 3. 2진수 아래첨자
    const binMatch = text.match(binaryRegex);
    if (binMatch) {
      const subVal = binMatch[2].split('').map((c) => SUBSCRIPT_MAP[c] || c).join('');
      tokens.push({ type: 'subscript', base: binMatch[1], sub: subVal });
      text = text.slice(binMatch[0].length);
      continue;
    }

    // 4. 대분수
    const mixedMatch = text.match(mixedFracRegex);
    if (mixedMatch) {
      tokens.push({
        type: 'fraction',
        whole: mixedMatch[1],
        num: mixedMatch[2],
        den: mixedMatch[3],
      });
      text = text.slice(mixedMatch[0].length);
      continue;
    }

    // 5. 일반 분수
    const fracMatch = text.match(fracRegex);
    if (fracMatch) {
      let num = fracMatch[1];
      let den = fracMatch[2];
      if (num.startsWith('(') && num.endsWith(')')) num = num.slice(1, -1);
      if (den.startsWith('(') && den.endsWith(')')) den = den.slice(1, -1);
      tokens.push({ type: 'fraction', num, den });
      text = text.slice(fracMatch[0].length);
      continue;
    }

    // 6. 거듭제곱 (유니코드 위첨자)
    const powSupMatch = text.match(powerSupCharRegex);
    if (powSupMatch) {
      const expVal = powSupMatch[2].split('').map((c) => SUPERSCRIPT_MAP[c] || c).join('');
      tokens.push({ type: 'power', base: powSupMatch[1], exp: expVal });
      text = text.slice(powSupMatch[0].length);
      continue;
    }

    // 거듭제곱 (A^B)
    const powCaretMatch = text.match(powerCaretRegex);
    if (powCaretMatch) {
      tokens.push({ type: 'power', base: powCaretMatch[1], exp: powCaretMatch[2] });
      text = text.slice(powCaretMatch[0].length);
      continue;
    }

    // 7. 연산자
    const opMatch = text.match(opRegex);
    if (opMatch) {
      if (opMatch[1]) tokens.push({ type: 'text', text: opMatch[1] });
      tokens.push({ type: 'operator', op: opMatch[2] });
      if (opMatch[3]) tokens.push({ type: 'text', text: opMatch[3] });
      text = text.slice(opMatch[0].length);
      continue;
    }

    // 8. 일반 텍스트 문자열 (다음 특수 패턴 시작 전까지 소비)
    let nextSpecialIdx = -1;
    const specialChars = ['[', '√', '₍', '^', '+', '-', '×', '÷', '=', '≠', '>', '<', '≤', '≥', '⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
    
    // 특수문자나 숫자/슬래시 분수 패턴 탐색
    for (let i = 1; i < text.length; i++) {
      const char = text[i];
      if (specialChars.includes(char) || (char === '/' && /\d/.test(text[i - 1]))) {
        // 분수일 가능성 체크
        if (char === '/') {
          // 이전 단어의 시작 찾기
          let numStart = i - 1;
          while (numStart > 0 && /\d/.test(text[numStart - 1])) numStart--;
          nextSpecialIdx = numStart;
        } else {
          nextSpecialIdx = i;
        }
        break;
      }
    }

    if (nextSpecialIdx > 0) {
      tokens.push({ type: 'text', text: text.slice(0, nextSpecialIdx) });
      text = text.slice(nextSpecialIdx);
    } else {
      tokens.push({ type: 'text', text });
      text = '';
    }
  }

  // 인접한 text 토큰 병합
  const merged: MathToken[] = [];
  for (const token of tokens) {
    if (token.type === 'text' && merged.length > 0 && merged[merged.length - 1].type === 'text') {
      (merged[merged.length - 1] as { type: 'text'; text: string }).text += token.text;
    } else {
      merged.push(token);
    }
  }

  return merged;
}

/**
 * 개별 토큰 치수 계측
 */
export function measureToken(
  ctx: CanvasRenderingContext2D,
  token: MathToken,
  options: MathRenderOptions,
): { width: number; height: number } {
  const fs = options.fontSize;
  const family = options.fontFamily || 'sans-serif';

  switch (token.type) {
    case 'text': {
      ctx.font = `bold ${fs}px ${family}`;
      return { width: ctx.measureText(token.text).width, height: fs };
    }
    case 'operator': {
      ctx.font = `bold ${fs}px ${family}`;
      return { width: ctx.measureText(token.op).width + Math.round(fs * 0.2), height: fs };
    }
    case 'fraction': {
      const subFs = Math.max(12, Math.round(fs * 0.68));
      ctx.font = `bold ${subFs}px ${family}`;
      const numW = ctx.measureText(token.num).width;
      const denW = ctx.measureText(token.den).width;
      let fracW = Math.max(numW, denW) + Math.round(fs * 0.3);

      if (token.whole) {
        ctx.font = `bold ${fs}px ${family}`;
        const wholeW = ctx.measureText(token.whole).width;
        fracW += wholeW + Math.round(fs * 0.15);
      }
      return { width: fracW, height: Math.round(fs * 1.6) };
    }
    case 'power': {
      ctx.font = `bold ${fs}px ${family}`;
      const baseW = ctx.measureText(token.base).width;
      const expFs = Math.max(10, Math.round(fs * 0.6));
      ctx.font = `bold ${expFs}px ${family}`;
      const expW = ctx.measureText(token.exp).width;
      return { width: baseW + expW + Math.round(fs * 0.08), height: fs * 1.2 };
    }
    case 'sqrt': {
      ctx.font = `bold ${fs}px ${family}`;
      const radW = ctx.measureText(token.radicand).width;
      const sqrtSymbolW = Math.round(fs * 0.55);
      return { width: sqrtSymbolW + radW + Math.round(fs * 0.2), height: fs * 1.2 };
    }
    case 'subscript': {
      ctx.font = `bold ${fs}px ${family}`;
      const baseW = ctx.measureText(token.base).width;
      const subFs = Math.max(10, Math.round(fs * 0.6));
      ctx.font = `bold ${subFs}px ${family}`;
      const subW = ctx.measureText(token.sub).width;
      return { width: baseW + subW + Math.round(fs * 0.08), height: fs * 1.2 };
    }
    case 'placeholder': {
      const boxW = Math.max(Math.round(fs * 1.3), 36);
      const boxH = Math.round(fs * 1.1);
      return { width: boxW + Math.round(fs * 0.15), height: boxH };
    }
  }
}

/**
 * 전체 수식 치수 계측
 */
export function measureMath(
  ctx: CanvasRenderingContext2D,
  tokens: MathToken[],
  options: MathRenderOptions,
): { width: number; height: number } {
  let totalW = 0;
  let maxH = options.fontSize;

  for (const token of tokens) {
    const dim = measureToken(ctx, token, options);
    totalW += dim.width;
    if (dim.height > maxH) maxH = dim.height;
  }

  return { width: totalW, height: maxH };
}

/**
 * 캔버스에 수식 토큰 렌더링
 */
export function renderMath(
  ctx: CanvasRenderingContext2D,
  input: string | MathToken[],
  x: number,
  y: number,
  options: MathRenderOptions,
): { width: number; height: number } {
  const tokens = typeof input === 'string' ? parseMath(input) : input;
  if (tokens.length === 0) return { width: 0, height: 0 };

  const fs = options.fontSize;
  const family = options.fontFamily || 'sans-serif';
  const color = options.color || '#FFFFFF';
  const fracLineColor = options.fractionLineColor || color;
  const phColor = options.placeholderColor || '#28E6FF';
  const phBg = options.placeholderBgColor || 'rgba(40,230,255,0.12)';
  const align = options.align || 'center';

  const totalDim = measureMath(ctx, tokens, options);

  let curX = x;
  if (align === 'center') {
    curX = x - totalDim.width / 2;
  } else if (align === 'right') {
    curX = x - totalDim.width;
  }

  ctx.save();

  for (const token of tokens) {
    const dim = measureToken(ctx, token, options);

    switch (token.type) {
      case 'text': {
        ctx.font = `bold ${fs}px ${family}`;
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(token.text, curX, y);
        break;
      }
      case 'operator': {
        ctx.font = `bold ${fs}px ${family}`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(token.op, curX + dim.width / 2, y);
        break;
      }
      case 'fraction': {
        let fracStartX = curX;
        if (token.whole) {
          ctx.font = `bold ${fs}px ${family}`;
          ctx.fillStyle = color;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(token.whole, curX, y);
          const wholeW = ctx.measureText(token.whole).width + Math.round(fs * 0.15);
          fracStartX += wholeW;
        }

        const subFs = Math.max(12, Math.round(fs * 0.68));
        ctx.font = `bold ${subFs}px ${family}`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';

        const fracActualW = dim.width - (fracStartX - curX);
        const fracCenterX = fracStartX + fracActualW / 2;

        // 분자 (위쪽)
        ctx.textBaseline = 'middle';
        ctx.fillText(token.num, fracCenterX, y - fs * 0.38);

        // 가로 분수선 (중앙선)
        const lineY = y;
        ctx.beginPath();
        ctx.moveTo(fracStartX + 2, lineY);
        ctx.lineTo(fracStartX + fracActualW - 2, lineY);
        ctx.lineWidth = Math.max(2, Math.round(fs * 0.08));
        ctx.strokeStyle = fracLineColor;
        ctx.stroke();

        // 분모 (아래쪽)
        ctx.fillText(token.den, fracCenterX, y + fs * 0.42);
        break;
      }
      case 'power': {
        ctx.font = `bold ${fs}px ${family}`;
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(token.base, curX, y);
        const baseW = ctx.measureText(token.base).width;

        const expFs = Math.max(10, Math.round(fs * 0.6));
        ctx.font = `bold ${expFs}px ${family}`;
        ctx.fillText(token.exp, curX + baseW + Math.round(fs * 0.04), y - fs * 0.35);
        break;
      }
      case 'sqrt': {
        const symbolW = Math.round(fs * 0.5);
        const topY = y - fs * 0.52;
        const bottomY = y + fs * 0.45;
        const hookY = y + fs * 0.1;

        // 루트 기호 및 상단 수평선 (Vinculum)
        ctx.beginPath();
        ctx.moveTo(curX, hookY);
        ctx.lineTo(curX + symbolW * 0.3, hookY + fs * 0.15);
        ctx.lineTo(curX + symbolW * 0.7, bottomY);
        ctx.lineTo(curX + symbolW, topY);
        ctx.lineTo(curX + dim.width - 2, topY);
        ctx.lineWidth = Math.max(2, Math.round(fs * 0.08));
        ctx.strokeStyle = color;
        ctx.lineJoin = 'miter';
        ctx.stroke();

        // 피개근수 (루트 내부)
        ctx.font = `bold ${fs}px ${family}`;
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(token.radicand, curX + symbolW + Math.round(fs * 0.1), y + fs * 0.02);
        break;
      }
      case 'subscript': {
        ctx.font = `bold ${fs}px ${family}`;
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(token.base, curX, y);
        const baseW = ctx.measureText(token.base).width;

        const subFs = Math.max(10, Math.round(fs * 0.6));
        ctx.font = `bold ${subFs}px ${family}`;
        ctx.fillText(token.sub, curX + baseW + Math.round(fs * 0.04), y + fs * 0.32);
        break;
      }
      case 'placeholder': {
        const boxW = dim.width - Math.round(fs * 0.15);
        const boxH = dim.height;
        const boxX = curX + Math.round(fs * 0.08);
        const boxY = y - boxH / 2;

        ctx.fillStyle = phBg;
        ctx.strokeStyle = phColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.font = `bold ${Math.round(fs * 0.85)}px ${family}`;
        ctx.fillStyle = phColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(token.label, boxX + boxW / 2, y);
        break;
      }
    }

    curX += dim.width;
  }

  ctx.restore();
  return totalDim;
}
