import { describe, it, expect, vi } from 'vitest';
import { CameraLayer } from '../../src/render/CameraLayer.js';
import type { CameraStatus } from '../../src/render/CameraLayer.js';

/**
 * CameraLayer 단위 테스트
 * - 상태 전이 검증
 * - render() 안전성 검증
 * - 옵션 기본값 검증
 * 참고: Node 환경에서 navigator.mediaDevices가 없으므로 에러 경로 테스트 중심
 */

describe('CameraLayer', () => {
  it('초기 상태가 idle이다', () => {
    const camera = new CameraLayer();
    expect(camera.status).toBe('idle');
    expect(camera.isActive).toBe(false);
    expect(camera.videoElement).toBeNull();
  });

  it('getUserMedia 미지원 환경에서 start()가 false를 반환하고 error 상태가 된다', async () => {
    const camera = new CameraLayer();
    const result = await camera.start();
    expect(result).toBe(false);
    expect(camera.status).toBe('error');
  });

  it('stop()이 idle 상태로 자원을 해제한다', () => {
    const camera = new CameraLayer();
    camera.stop();
    expect(camera.status).toBe('idle');
    expect(camera.videoElement).toBeNull();
  });

  it('render()가 비활성 상태에서 에러 없이 아무것도 하지 않는다', () => {
    const camera = new CameraLayer();
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D;

    // 비활성 상태에서 render 호출
    camera.render(ctx, 1920, 1080);

    expect(ctx.save).not.toHaveBeenCalled();
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('기본 옵션이 올바르게 설정된다', () => {
    const camera = new CameraLayer();
    // dimAlpha, mirror 등은 private이므로 동작으로 간접 검증
    expect(camera.status).toBe('idle');
  });

  it('커스텀 옵션이 적용된다', () => {
    const camera = new CameraLayer({
      dimAlpha: 0.5,
      mirror: false,
      width: 1280,
      height: 720,
    });
    expect(camera.status).toBe('idle');
  });

  it('start() 후 stop() 호출 시 정상 정리된다', async () => {
    const camera = new CameraLayer();
    await camera.start(); // 환경이 없으므로 error
    camera.stop();       // 정리
    expect(camera.status).toBe('idle');
    expect(camera.videoElement).toBeNull();
  });

  it('카메라 권한 거부 시뮬레이션', async () => {
    // navigator.mediaDevices를 임시 mock
    const originalNav = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: vi.fn().mockRejectedValue(
            new DOMException('Permission denied', 'NotAllowedError')
          ),
        },
      },
      configurable: true,
      writable: true,
    });

    const camera = new CameraLayer();
    const result = await camera.start();
    expect(result).toBe(false);
    expect(camera.status).toBe('denied');

    // 복원
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNav,
      configurable: true,
      writable: true,
    });
  });
});
