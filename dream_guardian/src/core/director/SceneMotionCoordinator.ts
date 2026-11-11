/**
 * SceneMotionCoordinator - 모션 인식 파이프라인 및 신체 프레이밍 처리기
 *
 * [REFACTOR-SRP-004] (Issue #635)
 * - SceneDirector에서 비대해진 모션 인식 파이프라인(_processMotionPipeline) 및 프레이밍/제스처 로직을 분리
 * - 웹캠 포즈 추출, 스켈레톤 애니메이션 갱신, 4색 커서 트래킹
 * - 랜드마크 정규화(0~1 변환), 무릎 프레이밍 유효성 판정, 발 키노트 감지 및 라우팅
 * - X자 교차 제스처 평가(뒤로가기/일시정지) 및 신체 캘리브레이션 갱신
 */

import { toNormalizedLandmarks } from '../../utils/index.js';
import type { NormalizedLandmark } from '../../types/index.js';
import type { MainSceneContext } from '../SceneDirector.js';

export interface SceneMotionCoordinatorProcessOptions {
  isAssaultMode?: boolean;
  assaultHandler?: {
    handlePose?(landmarks: any[], ctx: MainSceneContext, dt?: number): void;
    handleStep?(stepped: boolean, ctx: MainSceneContext, dt?: number): void;
    isAssaultMode?(ctx?: MainSceneContext): boolean;
  };
}

export interface SceneMotionCoordinatorResult {
  sourceLandmarks: any[];
  normalizedLandmarks: NormalizedLandmark[] | null;
  kneeFraming: any;
  frameHoverTarget: { x: number; y: number } | null;
  xGestureResult?: any;
}

export class SceneMotionCoordinator {
  private _currentKneeFraming: any = null;
  private _normalizedLandmarks: NormalizedLandmark[] | null = null;
  private _sourceLandmarks: any[] = [];
  private _frameHoverTarget: { x: number; y: number } | null = null;
  private _lastXGestureResult: any = null;

  /** 현재 프레임의 무릎 프레이밍 상태 조회 */
  public get currentKneeFraming(): any {
    return this._currentKneeFraming;
  }

  public setCurrentKneeFraming(value: any): void {
    this._currentKneeFraming = value;
  }

  /** 현재 프레임의 0~1 정규화 랜드마크 좌표계 조회 */
  public get normalizedLandmarks(): NormalizedLandmark[] | null {
    return this._normalizedLandmarks;
  }

  /** 가상 해상도 원본 랜드마크 좌표 조회 */
  public get sourceLandmarks(): any[] {
    return this._sourceLandmarks;
  }

  /** 현재 프레임의 호버 타겟 좌표 조회 (합장 링 또는 최상단 손) */
  public get frameHoverTarget(): { x: number; y: number } | null {
    return this._frameHoverTarget;
  }

  public setFrameHoverTarget(target: { x: number; y: number } | null): void {
    this._frameHoverTarget = target;
  }

  /** 최근 X자 제스처 판정 결과 조회 */
  public get lastXGestureResult(): any {
    return this._lastXGestureResult;
  }

  /**
   * 모션 및 카메라 파이프라인 전체 처리
   * - 포즈 캡처 및 전송
   * - 스켈레톤 애니메이션/이펙트 및 4색 커서 갱신
   * - X자 제스처 및 캘리브레이션 갱신
   * - 로코모션(스텝/점프) 판정 및 피드백
   * - 무릎 프레이밍 및 발 키노트 감지
   */
  public process(
    dt: number,
    ctx: MainSceneContext,
    options?: SceneMotionCoordinatorProcessOptions,
  ): SceneMotionCoordinatorResult {
    const vw = ctx.canvasManager.virtualWidth;
    const vh = ctx.canvasManager.virtualHeight;

    if (ctx.cameraLayer?.isActive && ctx.cameraLayer?.videoElement) {
      ctx.poseManager?.send(ctx.cameraLayer.videoElement, performance.now()).catch(() => {});
    }

    let sourceLandmarks: any[] = [];

    if (ctx.poseManager?.hasPose) {
      ctx.skeletonAnimation?.update(dt, ctx.poseManager.virtualLandmarks);
      sourceLandmarks =
        ctx.skeletonAnimation?.smoothedLandmarks && ctx.skeletonAnimation.smoothedLandmarks.length >= 25
          ? ctx.skeletonAnimation.smoothedLandmarks
          : (ctx.poseManager.virtualLandmarks ?? []);

      const isRunning = ctx.state?.screenMode === 'game' && ctx.state?.gamePhase === 'running' && !ctx.pauseModal?.isOpen;
      ctx.stickmanRenderer?.update(
        dt,
        sourceLandmarks,
        ctx.skeletonAnimation?.breathScale ?? 1.0,
        { virtualWidth: vw, virtualHeight: vh, isRunning },
      );

      // Issue #140: 모든 장면(메뉴·달리기·문제·결과)에서 4색 커서가 상시 유지되도록 매 프레임 커서 트래커 갱신
      if (sourceLandmarks.length >= 25) {
        const jointMap: Record<number, { x: number; y: number }> = {};
        for (let i = 0; i < sourceLandmarks.length; i++) {
          const lm = sourceLandmarks[i];
          if ((lm.visibility ?? 0) >= 0.3) {
            jointMap[i] = { x: lm.x, y: lm.y };
          }
        }
        ctx.skeletonEffect?.recordJointPositions(jointMap);

        const tracker = ctx.answerSelector?.cursorTracker ?? ctx.cursorTracker;
        tracker?.update(
          sourceLandmarks,
          undefined,
          false,
          { isVirtual: true, virtualWidth: vw, virtualHeight: vh },
        );
      }

      // Issue #171 & #172: X자 교차 제스처 갱신 (서브메뉴 뒤로가기 & 인게임 일시정지 - DEC-B4: assault 모드 억제)
      if (sourceLandmarks.length >= 17 && ctx.xGestureDetector) {
        const xResult = ctx.xGestureDetector.update(sourceLandmarks, dt);
        this._lastXGestureResult = xResult;
        if (xResult.triggered) {
          if (ctx.state?.screenMode === 'menu' && ctx.state?.menuMode === 'sub') {
            ctx.actions?.selectSubLevel?.(-1);
          } else if (ctx.state?.screenMode === 'game' && !options?.isAssaultMode) {
            ctx.pauseModal?.toggle();
            ctx.sfx?.play('hover');
          }
        }
      }

      // 사용자 신체 기준선 자동 보정 (Issue #238 / BUG-JUMP-BASELINE-001)
      if (sourceLandmarks.length >= 25 && !ctx.calibrationHelper?.isDone) {
        ctx.calibrationHelper?.update(dt, sourceLandmarks);
      }

      const userBaselineY = ctx.calibrationHelper?.isDone
        ? ctx.calibrationHelper.baselineShoulderY
        : vh * 0.28;

      const isSafetyGuarded = ctx.menuInput?.isActive || ctx.pauseModal?.isOpen;
      const activeDetector = ctx.getActiveLocomotionDetector
        ? ctx.getActiveLocomotionDetector()
        : (ctx.locomotionDetectors?.[ctx.locomotionModal?.selectedMode] ?? ctx.runDetector);

      const time = performance.now() / 1000;
      const stepped = activeDetector?.update(
        sourceLandmarks,
        userBaselineY,
        time,
        vh,
      );
      const jumped = ctx.jumpDetector?.update(
        sourceLandmarks,
        userBaselineY,
        vh,
        dt,
        {
          isPaused: ctx.pauseModal?.isOpen ?? false,
          isSafetyGuarded,
          isCalibrated: ctx.calibrationHelper?.isDone ?? false,
        },
      );

      ctx.motionIntentBus?.processLandmarks(sourceLandmarks, dt, time, {
        baselineY: userBaselineY,
        virtualHeight: vh,
        isPaused: ctx.pauseModal?.isOpen ?? false,
      });

      // 어설트 모드 확인: 옵션 플래그, 핸들러 확인, 세션 컨텍스트, 활성 어설트 세션
      const isAssault = Boolean(
        options?.isAssaultMode ||
        options?.assaultHandler?.isAssaultMode?.(ctx) ||
        (ctx as any)?.assaultHandler?.isAssaultMode?.(ctx) ||
        (ctx as any)?.sessionContext?.sessionMode === 'boss_assault' ||
        ((ctx as any)?.assaultSession && !(ctx as any).assaultSession.isDisposed)
      );

      // 공통 포즈 및 러닝 스텝 입력을 assault 세션 어댑터에 라우팅
      if (isAssault) {
        const assaultHandler = options?.assaultHandler ?? (ctx as any).assaultHandler;
        if (assaultHandler?.handlePose) {
          assaultHandler.handlePose(sourceLandmarks, ctx, dt);
        }
        if (stepped && assaultHandler?.handleStep) {
          assaultHandler.handleStep(stepped, ctx, dt);
        }
      }

      if (
        stepped &&
        !isAssault &&
        !options?.isAssaultMode &&
        ctx.state?.screenMode === 'game' &&
        ctx.state?.gamePhase === 'running' &&
        !ctx.pauseModal?.isOpen
      ) {
        ctx.state.totalSteps++;
        ctx.beatCoordinator?.recordStep();
        ctx.runningMatRenderer?.triggerMotionHit?.();
        ctx.effectManager?.playBurst({
          x: vw * 0.5,
          y: vh * 0.65,
          count: 8,
          colors: ['#28E6FF', '#4DFFAA'],
          duration: 0.3,
        });
      }

      if (jumped && !options?.isAssaultMode && ctx.state?.screenMode === 'game' && !ctx.pauseModal?.isOpen) {
        ctx.state.totalJumps++;
        if (ctx.stateMachine?.currentState === 'HAZARD_EVADE') {
          if (ctx.phaseAHazardController?.activePattern === 'jump') {
            ctx.phaseAHazardController.recordAction('jump');
            ctx.sfx?.play('jump_whoosh');
          }
        } else if (ctx.stateMachine?.currentState === 'BOSS_CLIMAX' && ctx.bossHazardController) {
          if (ctx.bossHazardController.recordAction('jump')) {
            ctx.sfx?.play('jump_whoosh');
          }
        }
        ctx.effectManager?.playBurst({
          x: vw * 0.5,
          y: vh * 0.65,
          count: 10,
          colors: ['#28E6FF', '#FFFFFF'],
          duration: 0.3,
        });
      }
    } else {
      // 포즈 미인식 시 안전 초기화
      ctx.skeletonAnimation?.reset();
      const isRunning = ctx.state?.screenMode === 'game' && ctx.state?.gamePhase === 'running' && !ctx.pauseModal?.isOpen;
      ctx.stickmanRenderer?.updateFallback(dt, isRunning);
      ctx.motionIntentBus?.reset();
      if (ctx.locomotionDetectors) {
        Object.values(ctx.locomotionDetectors).forEach((d: any) => d?.reset?.());
      } else {
        ctx.runDetector?.reset();
      }
      ctx.jumpDetector?.reset();
      ctx.menuInput?.reset();
      ctx.xGestureDetector?.reset();
      if (ctx.state) {
        ctx.state.menuHoverItem = null;
        ctx.state.menuHoverTimer = 0;
      }
    }

    this._sourceLandmarks = sourceLandmarks;

    // 커서 및 합장 제스처 처리
    const tracker = ctx.answerSelector?.cursorTracker ?? ctx.cursorTracker;
    const leftHand = tracker?.getCursor('leftHand');
    const rightHand = tracker?.getCursor('rightHand');

    // Issue #169 & #172: 전 화면 공통 매 프레임 양손 합장 제스처 갱신 및 문제선택/모달 일시정지 동기화
    if (leftHand && rightHand) {
      ctx.menuInput?.update(leftHand.x, leftHand.y, rightHand.x, rightHand.y, dt);
    } else {
      ctx.menuInput?.reset();
    }
    if (ctx.answerSelector) {
      ctx.answerSelector.paused = (ctx.menuInput?.isActive || ctx.pauseModal?.isOpen) ?? false;
    }

    let hoverTarget: { x: number; y: number } | null = null;
    if (ctx.menuInput?.isActive) {
      hoverTarget = { x: ctx.menuInput.cursorX * vw, y: ctx.menuInput.cursorY * vh };
    } else if (leftHand || rightHand) {
      if (leftHand && rightHand) {
        hoverTarget =
          leftHand.y > rightHand.y
            ? { x: leftHand.x, y: leftHand.y }
            : { x: rightHand.x, y: rightHand.y };
      } else {
        const h = (leftHand || rightHand)!;
        hoverTarget = { x: h.x, y: h.y };
      }
    }
    this._frameHoverTarget = hoverTarget;

    // 무릎 프레이밍 및 발 키노트 감지는 updateGameScene에서 게임별 주기로 정밀 처리하거나 독립 호출 가능
    if (ctx.state?.screenMode === 'game') {
      this.processFramingAndFootKeynotes(dt, ctx);
    }

    return {
      sourceLandmarks: this._sourceLandmarks,
      normalizedLandmarks: this._normalizedLandmarks,
      kneeFraming: this._currentKneeFraming,
      frameHoverTarget: this._frameHoverTarget,
      xGestureResult: this._lastXGestureResult,
    };
  }

  /**
   * 무릎 프레이밍 유효성 판독, 정렬 가이드 및 발 키노트 감지 처리
   */
  public processFramingAndFootKeynotes(
    dt: number,
    ctx: MainSceneContext,
    customLandmarks?: any[],
  ): { kneeFraming: any; normalizedLandmarks: NormalizedLandmark[] | null } {
    const vw = ctx.canvasManager.virtualWidth;
    const vh = ctx.canvasManager.virtualHeight;
    const sourceLandmarks =
      customLandmarks ??
      (ctx.skeletonAnimation?.smoothedLandmarks && ctx.skeletonAnimation.smoothedLandmarks.length >= 25
        ? ctx.skeletonAnimation.smoothedLandmarks
        : (ctx.poseManager?.virtualLandmarks && ctx.poseManager.virtualLandmarks.length > 0
            ? ctx.poseManager.virtualLandmarks
            : this._sourceLandmarks));

    // Issue #206 & #246: 무릎 프레이밍 유효성 검사 및 정렬 가이드 시각화
    let currentKneeFraming: any = { isFootKeynotePoseInputAllowed: true, status: 'ready' as const };
    if (ctx.kneeFramingValidator) {
      currentKneeFraming = ctx.kneeFramingValidator.update(
        dt,
        sourceLandmarks,
        vw,
        vh,
      );
    } else if (ctx.kneeFraming) {
      currentKneeFraming = ctx.kneeFraming.update(sourceLandmarks, vh);
    }
    this._currentKneeFraming = currentKneeFraming;

    if (ctx.kneeFramingGuideRenderer) {
      ctx.kneeFramingGuideRenderer.update(dt);
    }

    if (ctx.stateMachine?.currentState === 'READY_POSITION') {
      ctx.readyPositionController?.setPaused(ctx.pauseModal?.isOpen ?? false);
      const isAligned =
        currentKneeFraming?.status === 'ready' ||
        (ctx.readyPositionController?.checkAlignment
          ? ctx.readyPositionController.checkAlignment(sourceLandmarks, vw, vh)
          : false);
      ctx.readyPositionController?.setAligned(isAligned);
      ctx.readyPositionController?.update(dt);
    }

    // Issue #205 & #237: 가상 픽셀 좌표(0~1080 / 0~2160)를 정규화 좌표계(0~1)로 비파괴 변환하여 전달
    const normalizedLandmarks =
      sourceLandmarks.length >= 25
        ? (ctx.toNormalizedLandmarks
            ? ctx.toNormalizedLandmarks(sourceLandmarks, vw, vh)
            : toNormalizedLandmarks(sourceLandmarks, vw, vh))
        : null;
    this._normalizedLandmarks = normalizedLandmarks;

    // 발 키노트 감지 (Issue #197, #206, #237: 정규화 좌표 전달, 프레이밍/합장/pause 안전 가드 및 공통 라우터 경유)
    if (ctx.footKeynoteDetector && ctx.footKeynoteInput) {
      const isSafetyGuarded = ctx.menuInput?.isActive || ctx.pauseModal?.isOpen;
      ctx.footKeynoteInput.setSafetyGuarded(isSafetyGuarded);
      const footEvents = ctx.footKeynoteDetector.update(
        dt,
        normalizedLandmarks,
        ctx.engine?.elapsedTime ?? 0,
        {
          isSafetyGuarded,
          isPoseInputAllowed: currentKneeFraming?.isFootKeynotePoseInputAllowed ?? true,
          virtualHeight: 1,
        },
      );
      if (footEvents && Array.isArray(footEvents)) {
        for (const event of footEvents) {
          ctx.footKeynoteInput.routeEvent(event);
        }
      }
    }

    return {
      kneeFraming: this._currentKneeFraming,
      normalizedLandmarks: this._normalizedLandmarks,
    };
  }
}
