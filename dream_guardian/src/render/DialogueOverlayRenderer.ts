/**
 * DialogueOverlayRenderer.ts - 인게임 캐릭터 대사창 오버레이 및 발화 시각화 렌더러
 *
 * 주요 기능:
 * 1. 화자별 시각 테마:
 *    - 깨비(kkebi): 따스한 네온 옐로우/오렌지 라운드 패널 + 도깨비뿔 아이콘 + "깨비"
 *    - 보스(boss): 차가운 네온 퍼플/에메랄드 엣지 패널 + 보스 위엄 폰트/외곽선 + 보스 이름
 *    - 나레이터(narrator): 차분한 실버/청백색 패널 + 별빛 아이콘 + "안내"
 * 2. 안전 영역 배치: 상단 HUD 하단(y: 약 150~220px 영역)에 위치하여 중앙 수식 및 하단 피트니스 존 100% 개방
 * 3. 타이프라이터 효과: 글자 순차 노출 (약 30자/초)
 * 4. 체류 및 부드러운 페이드아웃: 대사 완성 후 기본 3초 체류 -> 0.5초 페이드아웃
 * 5. 새 대사 유입 시 즉시 교체 및 리셋
 *
 * @see Issue #219 (STORY-RENDER-001)
 * @see docs/04_STORY_SOURCE.md (제7장, 제9장)
 */

import type { DialogueLine, Speaker } from '../types/story.js';
import { UIText } from '../utils/UIText.js';
import { imageLoader } from '../utils/UIImageLoader.js';

export interface DialogueOverlayOptions {
  /** 1080p 가상 좌표 기준 기본 Y 위치 (기본값: 160) */
  y?: number;
  /** 1080p 가상 좌표 기준 기본 너비 (기본값: 960) */
  width?: number;
  /** 1080p 가상 좌표 기준 기본 높이 (기본값: 136) */
  height?: number;
  /** 타이핑 속도 (초당 글자 수, 기본값: 30) */
  typingSpeed?: number;
  /** 대사 완료 후 기본 체류 시간 (초, 기본값: 3.0) */
  defaultDuration?: number;
  /** 페이드아웃 시간 (초, 기본값: 0.5) */
  fadeOutDuration?: number;
}

export interface ShowDialogueOptions {
  subtext?: string;
  duration?: number;
  bossName?: string;
}

export type DialogueState = 'idle' | 'typing' | 'dwelling' | 'fading';

interface SpeakerTheme {
  borderColor: string;
  glowColor: string;
  nameColor: string;
  badgeBg: string;
  defaultName: string;
  cornerRadius: number;
}

const SPEAKER_THEMES: Record<Speaker, SpeakerTheme> = {
  kkebi: {
    borderColor: '#FFCB4D',
    glowColor: 'rgba(255, 203, 77, 0.45)',
    nameColor: '#FFD768',
    badgeBg: 'rgba(255, 203, 77, 0.2)',
    defaultName: '깨비',
    cornerRadius: 18,
  },
  boss: {
    borderColor: '#C889FF',
    glowColor: 'rgba(200, 137, 255, 0.45)',
    nameColor: '#E2B8FF',
    badgeBg: 'rgba(168, 85, 247, 0.2)',
    defaultName: '보스',
    cornerRadius: 12,
  },
  narrator: {
    borderColor: '#94A3B8',
    glowColor: 'rgba(148, 163, 184, 0.35)',
    nameColor: '#E2E8F0',
    badgeBg: 'rgba(148, 163, 184, 0.2)',
    defaultName: '안내',
    cornerRadius: 14,
  },
};

export class DialogueOverlayRenderer {
  private _y: number;
  private _width: number;
  private _height: number;
  private _typingSpeed: number;
  private _defaultDuration: number;
  private _fadeOutDuration: number;

  private _speaker: Speaker = 'kkebi';
  private _speakerName: string = '깨비';
  private _fullText: string = '';
  private _subtext: string = '';
  private _displayedText: string = '';

  private _state: DialogueState = 'idle';
  private _active: boolean = false;
  private _alpha: number = 0;

  private _typingProgress: number = 0;
  private _dwellTimer: number = 0;
  private _dwellDuration: number = 3.0;
  private _fadeTimer: number = 0;

  constructor(options?: DialogueOverlayOptions) {
    this._y = options?.y ?? 160;
    this._width = options?.width ?? 960;
    this._height = options?.height ?? 136;
    this._typingSpeed = options?.typingSpeed ?? 30;
    this._defaultDuration = options?.defaultDuration ?? 3.0;
    this._fadeOutDuration = options?.fadeOutDuration ?? 0.5;
  }

  // ─── Getters for State & Test Inspection ───
  get speaker(): Speaker { return this._speaker; }
  get speakerName(): string { return this._speakerName; }
  get fullText(): string { return this._fullText; }
  get displayedText(): string { return this._displayedText; }
  get subtext(): string { return this._subtext; }
  get alpha(): number { return this._alpha; }
  get state(): DialogueState { return this._state; }

  /**
   * 대사창 활성 여부 (알파가 0 초과이고 비활성화되지 않은 상태)
   */
  isActive(): boolean {
    return this._active && this._alpha > 0;
  }

  /**
   * DialogueLine 객체를 통한 대사 표시
   */
  show(line: DialogueLine, bossName?: string): void {
    const speaker = line.speaker ?? 'kkebi';
    const resolvedName = (speaker === 'boss' && bossName)
      ? bossName
      : (line.speakerName || SPEAKER_THEMES[speaker]?.defaultName || '깨비');

    let durationSec = this._defaultDuration;
    if (line.durationMs && line.durationMs > 0) {
      durationSec = line.durationMs / 1000;
    }

    this.showDialogue(speaker, line.text, {
      subtext: line.subText,
      duration: durationSec,
      bossName: resolvedName,
    });
  }

  /**
   * 화자, 텍스트 및 옵션을 직접 지정하여 대사 표시
   */
  showDialogue(
    speaker: Speaker,
    text: string,
    options?: ShowDialogueOptions,
  ): void {
    this._speaker = speaker;
    const theme = SPEAKER_THEMES[speaker] ?? SPEAKER_THEMES.kkebi;

    if (speaker === 'boss' && options?.bossName) {
      this._speakerName = options.bossName;
    } else if (speaker === 'boss') {
      this._speakerName = options?.bossName ?? theme.defaultName;
    } else if (speaker === 'kkebi') {
      this._speakerName = '깨비';
    } else {
      this._speakerName = options?.bossName ?? theme.defaultName;
    }

    this._fullText = text ?? '';
    this._subtext = options?.subtext ?? '';
    this._displayedText = '';

    let durationSec = this._defaultDuration;
    if (typeof options?.duration === 'number' && options.duration > 0) {
      // 50보다 크면 밀리초로 판단하여 변환
      durationSec = options.duration > 50 ? options.duration / 1000 : options.duration;
    }
    this._dwellDuration = durationSec;

    // 타이머 및 상태 리셋
    this._typingProgress = 0;
    this._dwellTimer = 0;
    this._fadeTimer = 0;
    this._alpha = 1.0;
    this._active = true;

    if (this._fullText.length === 0) {
      this._state = 'dwelling';
    } else {
      this._state = 'typing';
    }
  }

  /**
   * 프레임별 타이프라이터 및 페이드아웃 상태 갱신
   * @param dt 경과 시간 (초)
   */
  update(dt: number): void {
    if (!this._active) return;

    if (this._state === 'typing') {
      this._typingProgress += dt * this._typingSpeed;
      const charsToShow = Math.min(this._fullText.length, Math.floor(this._typingProgress));
      this._displayedText = this._fullText.slice(0, charsToShow);

      if (charsToShow >= this._fullText.length) {
        this._displayedText = this._fullText;
        this._state = 'dwelling';
        this._dwellTimer = 0;
      }
    } else if (this._state === 'dwelling') {
      this._dwellTimer += dt;
      this._alpha = 1.0;

      if (this._dwellTimer >= this._dwellDuration) {
        const leftover = this._dwellTimer - this._dwellDuration;
        this._state = 'fading';
        this._fadeTimer = leftover;
        const progress = Math.min(1.0, this._fadeTimer / this._fadeOutDuration);
        this._alpha = Math.max(0, 1.0 - progress);

        if (progress >= 1.0) {
          this._active = false;
          this._state = 'idle';
          this._alpha = 0;
        }
      }
    } else if (this._state === 'fading') {
      this._fadeTimer += dt;
      const progress = Math.min(1.0, this._fadeTimer / this._fadeOutDuration);
      this._alpha = Math.max(0, 1.0 - progress);

      if (progress >= 1.0) {
        this._active = false;
        this._state = 'idle';
        this._alpha = 0;
      }
    }
  }

  /**
   * 대사 오버레이 즉시 닫기 및 초기화
   */
  clear(): void {
    this._active = false;
    this._state = 'idle';
    this._alpha = 0;
    this._fullText = '';
    this._displayedText = '';
    this._subtext = '';
    this._typingProgress = 0;
    this._dwellTimer = 0;
    this._fadeTimer = 0;
  }

  /**
   * Canvas 2D 대사창 렌더링
   * @param ctx 캔버스 2D 컨텍스트
   * @param vw 가상 해상도 너비 (기본 1080)
   * @param vh 가상 해상도 높이 (기본 2160)
   */
  render(ctx: CanvasRenderingContext2D, vw: number, vh: number): void {
    if (!this._active || this._alpha <= 0) return;

    const scaleX = vw / 1080;
    const scaleY = vh / 2160;

    const panelW = Math.min(this._width * scaleX, vw - 40 * scaleX);
    const panelH = this._height * scaleY;
    const panelX = (vw - panelW) / 2;
    const panelY = this._y * scaleY;

    const theme = SPEAKER_THEMES[this._speaker] ?? SPEAKER_THEMES.kkebi;
    const cornerRadius = theme.cornerRadius * scaleX;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, this._alpha));

    // 1. 고대비 다크 배경 패널 드로잉 (비트맵 우선 렌더링 및 절차적 폴백)
    const panelBgImg = imageLoader.get('dialogue', 'boxBg');
    if (panelBgImg) {
      ctx.drawImage(panelBgImg, panelX, panelY, panelW, panelH);
    } else {
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(panelX, panelY, panelW, panelH, cornerRadius);
      } else {
        ctx.rect(panelX, panelY, panelW, panelH);
      }
      ctx.fillStyle = 'rgba(10, 15, 30, 0.90)';
      ctx.fill();

      // 2. 네온 테두리 및 글로우 이펙트
      ctx.shadowColor = theme.glowColor;
      ctx.shadowBlur = 12 * scaleX;
      ctx.strokeStyle = theme.borderColor;
      ctx.lineWidth = 2.5 * scaleX;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 3. 좌측 화자 아바타 / 아이콘 영역 드로잉
    const avatarW = 60 * scaleX;
    const avatarH = 60 * scaleY;
    const avatarX = panelX + 20 * scaleX;
    const avatarY = panelY + (panelH - avatarH) / 2;

    this._renderSpeakerIcon(ctx, this._speaker, avatarX, avatarY, avatarW, avatarH, scaleX);

    // 4. 화자명 태그 및 보조 텍스트 드로잉
    const textStartX = avatarX + avatarW + 18 * scaleX;
    const nameY = panelY + 36 * scaleY;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = UIText.getFont('badge', scaleX, 'bold', 'sans-serif', 18);
    ctx.fillStyle = theme.nameColor;
    ctx.fillText(this._speakerName, textStartX, nameY);

    if (this._subtext) {
      const nameWidth = ctx.measureText ? ctx.measureText(this._speakerName).width : this._speakerName.length * 16 * scaleX;
      const badgeX = textStartX + nameWidth + 12 * scaleX;
      ctx.font = UIText.getFont('caption', scaleX, 'normal', 'sans-serif', 14);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.fillText(`• ${this._subtext}`, badgeX, nameY);
    }

    // 5. 대사 본문 텍스트 드로잉 (줄바꿈 자동 계산)
    const bodyY = panelY + 74 * scaleY;
    const maxTextWidth = panelW - (textStartX - panelX) - 24 * scaleX;
    ctx.font = UIText.getFont('body', scaleX, 'normal', 'sans-serif', 22);
    ctx.fillStyle = '#FFFFFF';

    this._renderWrappedText(ctx, this._displayedText, textStartX, bodyY, maxTextWidth, 30 * scaleY);

    ctx.restore();
  }

  /**
   * 화자별 아이콘 드로잉
   */
  private _renderSpeakerIcon(
    ctx: CanvasRenderingContext2D,
    speaker: Speaker,
    x: number,
    y: number,
    w: number,
    h: number,
    scaleX: number,
  ): void {
    // 화자 엠블럼 비트맵 우선 렌더링
    const badgeKey = speaker === 'kkebi' ? 'badgeKkebi' : speaker === 'boss' ? 'badgeBoss' : null;
    const badgeImg = badgeKey ? imageLoader.get('dialogue', badgeKey) : null;
    if (badgeImg) {
      ctx.drawImage(badgeImg, x, y, w, h);
      return;
    }

    // 절차적 드로잉 폴백: 배경 원형 뱃지
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h) / 2;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
    ctx.strokeStyle = SPEAKER_THEMES[speaker]?.borderColor ?? '#FFFFFF';
    ctx.lineWidth = 1.5 * scaleX;
    ctx.stroke();

    if (speaker === 'kkebi') {
      // 깨비: 황금빛 도깨비 뿔 2개
      ctx.fillStyle = '#FFCB4D';
      // 좌측 뿔
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.45, cy + r * 0.35);
      ctx.lineTo(cx - r * 0.55, cy - r * 0.55);
      ctx.lineTo(cx - r * 0.1, cy - r * 0.05);
      ctx.closePath();
      ctx.fill();

      // 우측 뿔
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.45, cy + r * 0.35);
      ctx.lineTo(cx + r * 0.55, cy - r * 0.55);
      ctx.lineTo(cx + r * 0.1, cy - r * 0.05);
      ctx.closePath();
      ctx.fill();

      // 도깨비 방울/얼굴 중앙 원
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.2, r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = '#FFA726';
      ctx.fill();
    } else if (speaker === 'boss') {
      // 보스: 퍼플/에메랄드 위엄의 왕관 및 가시 문양
      ctx.fillStyle = '#C889FF';
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.6, cy + r * 0.4);
      ctx.lineTo(cx - r * 0.6, cy - r * 0.25);
      ctx.lineTo(cx - r * 0.25, cy + r * 0.05);
      ctx.lineTo(cx, cy - r * 0.6);
      ctx.lineTo(cx + r * 0.25, cy + r * 0.05);
      ctx.lineTo(cx + r * 0.6, cy - r * 0.25);
      ctx.lineTo(cx + r * 0.6, cy + r * 0.4);
      ctx.closePath();
      ctx.fill();

      // 하단 에메랄드 코어
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.15, r * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = '#28E6FF';
      ctx.fill();
    } else {
      // 나레이터: 청백색 4점 별빛(✦)
      ctx.fillStyle = '#E2E8F0';
      const rOuter = r * 0.65;
      const rInner = r * 0.22;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const rad = i % 2 === 0 ? rOuter : rInner;
        const angle = (i * Math.PI) / 4 - Math.PI / 2;
        const px = cx + Math.cos(angle) * rad;
        const py = cy + Math.sin(angle) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  /**
   * 너비 제한에 맞춘 줄바꿈 텍스트 렌더링
   */
  private _renderWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
  ): void {
    if (!text) return;

    if (!ctx.measureText) {
      ctx.fillText(text, x, y);
      return;
    }

    const words = text.split(' ');
    let currentLine = '';
    let currentY = y;
    let lineCount = 0;

    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine.length > 0) {
        ctx.fillText(currentLine, x, currentY);
        currentLine = words[i];
        currentY += lineHeight;
        lineCount++;
        if (lineCount >= 2) {
          // 최대 2줄 표시 후 말줄임 처리
          currentLine = `${currentLine}...`;
          break;
        }
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      ctx.fillText(currentLine, x, currentY);
    }
  }
}
