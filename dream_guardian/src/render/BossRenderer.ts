/**
 * BossRenderer - 5종 보스 Canvas 2D 프로시저럴 드로잉 렌더러
 *
 * Issue #25, #217: 순수 Canvas 2D 코드로 구현된 신규 5대 불안 보스 고유 비주얼 및 모션
 * - Ch.1 하얘시니 (망각의 요괴: 에메랄드 심해 안개 + ? 부유)
 * - Ch.2 재촉새 (성급의 요괴: 시간의 번개 구체 + 방전 스파크)
 * - Ch.3 따돌시니 (왜곡의 요괴: 회전 만화경 육각형 + 수학 기호)
 * - Ch.4 풀죽새 (무기력의 요괴: 그림자 거조 + 먹물 날개 안개 펄스)
 * - Ch.5 캄캄대왕 (영원한 고립의 지배자: 공허의 블랙홀 + 흑요석 다각형 파편 + 붉은 눈)
 */

import { imageLoader } from '../utils/UIImageLoader.js';
import type { UIPresentationDocument, UIPresentationPageId } from '../data/UIPresentation.js';

export const BOSS_SLOT_IDS = [
  'boss_visual',
  'boss_title',
  'boss_aura_style',
] as const;
export type BossSlotId = (typeof BOSS_SLOT_IDS)[number];

export const PROTECTED_BOSS_SLOT_IDS = [
  'boss_hp',
  'boss_max_hp',
  'damage_calculation',
  'attack_power',
  'boss_phase_logic',
] as const;
export type ProtectedBossSlotId = (typeof PROTECTED_BOSS_SLOT_IDS)[number];

export interface BossBounds {
  x: number;
  y: number;
  w: number;
  h: number;
  width: number;
  height: number;
  isProtected?: boolean;
}

export interface BossSlotOverride {
  text?: string;
  color?: string;
  textColor?: string;
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  glowColor?: string;
  fontSize?: number;
  visible?: boolean;
  opacity?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface BossPresentationContext {
  presentationDocument?: UIPresentationDocument;
  pageId?: UIPresentationPageId | string;
  bossVisual?: BossSlotOverride;
  bossTitle?: BossSlotOverride;
  bossAuraStyle?: BossSlotOverride;
}

export interface BossFixtureDTO {
  chapter: number;
  phase?: 'idle' | 'warning' | 'attacking' | 'defeated';
  isEnraged?: boolean;
  x?: number;
  y?: number;
  radius?: number;
}

export const DEFAULT_BOSS_FIXTURE: BossFixtureDTO = Object.freeze({
  chapter: 1,
  phase: 'idle',
  isEnraged: false,
});

export const ENRAGED_BOSS_FIXTURE: BossFixtureDTO = Object.freeze({
  chapter: 2,
  phase: 'idle',
  isEnraged: true,
});

export const ATTACKING_BOSS_FIXTURE: BossFixtureDTO = Object.freeze({
  chapter: 3,
  phase: 'attacking',
  isEnraged: false,
});

export const WARNING_BOSS_FIXTURE: BossFixtureDTO = Object.freeze({
  chapter: 4,
  phase: 'warning',
  isEnraged: false,
});

export const DEFEATED_BOSS_FIXTURE: BossFixtureDTO = Object.freeze({
  chapter: 5,
  phase: 'defeated',
  isEnraged: false,
});

export interface BossRenderOptions {
  x: number;
  y: number;
  radius?: number;
  chapter: number;
  phase?: 'idle' | 'warning' | 'attacking' | 'defeated';
  isEnraged?: boolean;
}

export class BossRenderer {
  private _animTime = 0;
  private _hitTimer = 0;
  private _attackAnimTimer = 0;
  private _defeatedTimer = 0;
  private _isEnraged = false;
  private _presentationContext?: BossPresentationContext;
  private _localSprites: Map<string, CanvasImageSource> = new Map();

  constructor(presentationContext?: BossPresentationContext) {
    if (presentationContext) {
      this._presentationContext = presentationContext;
    }
  }

  /** 선택적 표시 컨텍스트 설정 */
  setPresentationContext(context?: BossPresentationContext): void {
    this._presentationContext = context;
  }

  getPresentationContext(): BossPresentationContext | undefined {
    return this._presentationContext;
  }

  clearPresentationContext(): void {
    this._presentationContext = undefined;
  }

  /**
   * 보스 중심점 및 반지름 기준 바운딩 박스 조회
   */
  getBossBounds(x: number, y: number, radius = 90): BossBounds {
    const w = radius * 2;
    const h = radius * 2;
    return {
      x: x - radius,
      y: y - radius,
      w,
      h,
      width: w,
      height: h,
      isProtected: false,
    };
  }

  /** 슬롯 보호 여부 검사 */
  isSlotLocked(slotId: string): boolean {
    return (PROTECTED_BOSS_SLOT_IDS as readonly string[]).includes(slotId as ProtectedBossSlotId);
  }

  /** 슬롯 잠금 사유 반환 */
  getSlotLockReason(slotId: string): string | null {
    if (this.isSlotLocked(slotId)) {
      return `보스 전투 수치 및 판정 로직(${slotId})은 게임플레이 무결성을 위해 보호됩니다.`;
    }
    return null;
  }

  /** 외부 컨텍스트 유효성 검사 (보호 수치 오버라이드 시도 탐지) */
  validatePresentationContext(context?: BossPresentationContext): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    if (!context) return { valid: true, issues };

    for (const key of Object.keys(context)) {
      if ((PROTECTED_BOSS_SLOT_IDS as readonly string[]).includes(key as ProtectedBossSlotId)) {
        issues.push(`보호된 보스 전투 필드(${key})는 수정할 수 없습니다.`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * 로컬 스프라이트 등록 (검증된 ID만 별도 context에 캐시, 전역 imageLoader 불변)
   */
  registerLocalSprite(key: string, image: CanvasImageSource): boolean {
    if (!key || typeof key !== 'string') return false;
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) return false;
    this._localSprites.set(key, image);
    return true;
  }

  clearLocalSprites(): void {
    this._localSprites.clear();
  }

  /**
   * 결정론적 Fixture DTO 렌더 진입점
   */
  renderFixture(ctx: CanvasRenderingContext2D, fixture: BossFixtureDTO): void {
    const x = fixture.x ?? 540;
    const y = fixture.y ?? 400;
    const radius = fixture.radius ?? 90;
    const phase = fixture.phase ?? 'idle';
    const isEnraged = fixture.isEnraged ?? false;
    this.render(ctx, fixture.chapter, x, y, radius, phase, isEnraged);
  }

  /**
   * UIPresentationDocument로부터 BossPresentationContext 생성
   */
  static fromPresentationDocument(
    doc: UIPresentationDocument,
    pageId: UIPresentationPageId | string = 'boss_battle',
  ): BossPresentationContext {
    const page = doc.pages[pageId as UIPresentationPageId];
    let bossTitle: BossSlotOverride | undefined;
    if (page?.elements) {
      for (const el of page.elements) {
        if (el.id === 'boss_title') {
          bossTitle = {
            text: el.text,
            fontSize: el.fontSize,
          };
        }
      }
    }
    return {
      presentationDocument: doc,
      pageId,
      bossTitle,
    };
  }

  /** 광폭화 상태 설정 */
  setEnraged(enraged: boolean): void {
    this._isEnraged = enraged;
  }

  get isEnraged(): boolean {
    return this._isEnraged;
  }

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

    if (this._attackAnimTimer > 0) {
      this._attackAnimTimer = Math.max(0, this._attackAnimTimer - dt);
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
    isEnraged = false,
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

    // [UI-ASSET-005 / #270] 비트맵 이미지 스프라이트 분기 또는 프로시저럴 드로잉 폴백
    const effectiveEnraged = isEnraged || this._isEnraged;
    let spriteType = 'idle';
    if (this._hitTimer > 0) {
      spriteType = 'hit';
    } else if (phase === 'attacking' || this._attackAnimTimer > 0 || effectiveEnraged) {
      spriteType = 'enrage';
    } else if (phase === 'defeated') {
      spriteType = chapter === 5 ? 'defeat' : 'idle';
    }

    const spriteKey = `ch${chapter}_${spriteType}`;
    const img = this._localSprites.get(spriteKey) ?? imageLoader.get('boss', spriteKey);

    if (img) {
      this._renderSprite(ctx, img, radius);
    } else {
      // 챕터별 프로시저럴 렌더러 호출 (신규 5대 보스명 체계 일원화)
      switch (chapter) {
        case 1:
          this._renderBoss1HayeSini(ctx, radius);
          break;
        case 2:
          this._renderBoss2JaechokSae(ctx, radius);
          break;
        case 3:
          this._renderBoss3TaddolSini(ctx, radius);
          break;
        case 4:
          this._renderBoss4PuljukSae(ctx, radius);
          break;
        case 5:
        default:
          this._renderBoss5KamkamDaewang(ctx, radius);
          break;
      }
    }

    // 피격 플래시 오버레이
    if (hitFlash > 0.05) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(255, 255, 255, ${hitFlash * 0.7})`;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this._presentationContext?.bossTitle?.text) {
      const title = this._presentationContext.bossTitle;
      ctx.save();
      ctx.fillStyle = title.color ?? title.textColor ?? '#28E6FF';
      ctx.font = `bold ${title.fontSize ?? 26}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.shadowColor = title.glowColor ?? 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 8;
      ctx.fillText(title.text!, 0, -radius - 12);
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * 비트맵 보스 스프라이트 중심 기준 종횡비 유지 렌더링
   */
  private _renderSprite(ctx: CanvasRenderingContext2D, img: CanvasImageSource, radius: number): void {
    const maxDim = radius * 2;
    const imgW = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width || 1;
    const imgH = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height || 1;

    let drawW = maxDim;
    let drawH = maxDim;

    if (imgW >= imgH) {
      drawH = maxDim * (imgH / imgW);
    } else {
      drawW = maxDim * (imgW / imgH);
    }

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  }

  // ─── 경고 오라 ───
  private _renderWarningAura(ctx: CanvasRenderingContext2D, radius: number): void {
    const pulse = Math.sin(this._animTime * 10) * 0.2 + 0.5;
    const aura = this._presentationContext?.bossAuraStyle;
    const strokeColor = aura?.borderColor ?? aura?.color ?? `rgba(255, 50, 50, ${pulse})`;
    const fillColor = aura?.fillColor ?? `rgba(255, 30, 30, ${pulse * 0.25})`;

    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = aura?.borderWidth ?? 4;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.35, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.restore();
  }

  // ─── Ch.1 하얘시니 (망각의 요괴: 에메랄드 심해 안개 + ? 부유) ───
  private _renderBoss1HayeSini(ctx: CanvasRenderingContext2D, radius: number): void {
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

    // 부유하는 "?" 기호들 (A11Y-001: 최소 24px 하한선)
    const qSize = Math.max(24, Math.round(radius * 0.25));
    ctx.font = `bold ${qSize}px sans-serif`;
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

  // ─── Ch.2 재촉새 (성급의 요괴: 시간의 번개 구체 + 방전 스파크) ───
  private _renderBoss2JaechokSae(ctx: CanvasRenderingContext2D, radius: number): void {
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

  // ─── Ch.3 따돌시니 (왜곡의 요괴: 회전 만화경 육각형 + 왜곡 기호) ───
  private _renderBoss3TaddolSini(ctx: CanvasRenderingContext2D, radius: number): void {
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

    // 부유하는 왜곡 수학 기호들 (÷, ×, ½, %) (A11Y-001: 최소 24px 하한선)
    const symbolSize = Math.max(24, Math.round(radius * 0.2));
    ctx.font = `bold ${symbolSize}px sans-serif`;
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

  // ─── Ch.4 풀죽새 (무기력의 요괴: 그림자 거조 + 먹물 날개 안개 펄스) ───
  private _renderBoss4PuljukSae(ctx: CanvasRenderingContext2D, radius: number): void {
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

    // 부드러운 먹물 날개 그림자 및 안개 펄스 시각 효과 (압박성 대사 완전 대체)
    const mistCycle = (t * 0.8) % (Math.PI * 2);
    const mistPulse = (Math.sin(mistCycle) + 1) * 0.5; // 0 ~ 1 부드러운 호흡
    const mistY = radius * 0.6 + Math.sin(t * 1.5) * (radius * 0.08);
    const mistGrad = ctx.createRadialGradient(0, mistY, 0, 0, mistY, radius * 0.55);
    mistGrad.addColorStop(0, `rgba(200, 137, 255, ${0.28 * mistPulse})`);
    mistGrad.addColorStop(0.5, `rgba(38, 17, 63, ${0.45 * mistPulse})`);
    mistGrad.addColorStop(1, 'rgba(14, 7, 26, 0)');

    ctx.save();
    ctx.fillStyle = mistGrad;
    ctx.beginPath();
    ctx.ellipse(0, mistY, radius * 0.6, radius * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ─── Ch.5 캄캄대왕 (영원한 고립의 지배자: 공허의 블랙홀 + 흑요석 다각형 파편 + 붉은 눈) ───
  private _renderBoss5KamkamDaewang(ctx: CanvasRenderingContext2D, radius: number): void {
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
