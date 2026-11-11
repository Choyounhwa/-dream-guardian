import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AssaultFallbackAdapter,
  type FallbackKeyboardInput,
  type FallbackTouchPointInput,
  type FallbackTouchInput,
} from '../../src/input/AssaultFallbackAdapter.js';

describe('[BOSS-ASSAULT-11 / #513] 동작형 키보드·터치 폴백 어댑터 (AssaultFallbackAdapter)', () => {
  let adapter: AssaultFallbackAdapter;

  beforeEach(() => {
    adapter = new AssaultFallbackAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. 순수 어댑터 제약 및 기본 설정 검증', () => {
    it('requestAnimationFrame, setInterval, window/document DOM 리스너를 일체 등록하지 않아야 한다', () => {
      const g = globalThis as Record<string, unknown>;
      const originalRaf = g.requestAnimationFrame;
      const originalAddEventListener = g.addEventListener;

      const rafMock = vi.fn();
      const addEventListenerMock = vi.fn();
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

      g.requestAnimationFrame = rafMock;
      g.addEventListener = addEventListenerMock;

      try {
        const testAdapter = new AssaultFallbackAdapter();
        testAdapter.handleKeyDown({ key: 'ArrowLeft' });
        testAdapter.handleKeyUp({ key: 'ArrowLeft' });
        testAdapter.handleTouchStart({ x: 0.2, y: 0.3 });
        testAdapter.handleTouchEnd({ x: 0.2, y: 0.3 });
        testAdapter.reset();

        expect(rafMock).not.toHaveBeenCalled();
        expect(setIntervalSpy).not.toHaveBeenCalled();
        expect(addEventListenerMock).not.toHaveBeenCalled();
      } finally {
        if (originalRaf === undefined) {
          delete g.requestAnimationFrame;
        } else {
          g.requestAnimationFrame = originalRaf;
        }
        if (originalAddEventListener === undefined) {
          delete g.addEventListener;
        } else {
          g.addEventListener = originalAddEventListener;
        }
      }
    });

    it('기본 설정값이 올바르게 지정되어야 한다', () => {
      expect(adapter.config.squatZoneYThreshold).toBe(0.7);
      expect(adapter.config.leftRightBoundaryX).toBe(0.5);
      expect(adapter.config.idPrefix).toBe('fallback');
    });

    it('입력으로 전달된 키 및 터치 원본 객체를 일체 변형하지 않아야 한다 (불변성 보장)', () => {
      const keyInput: FallbackKeyboardInput = Object.freeze({
        key: 'ArrowLeft',
        code: 'ArrowLeft',
        timestampMs: 1000,
        sessionId: 'session-1',
        pairId: 'pair-1',
      });
      const touchInput: FallbackTouchPointInput = Object.freeze({
        identifier: 1,
        x: 0.2,
        y: 0.3,
        timestampMs: 1000,
        sessionId: 'session-1',
      });

      expect(() => adapter.handleKeyDown(keyInput)).not.toThrow();
      expect(() => adapter.handleTouchStart(touchInput)).not.toThrow();
      expect(keyInput.key).toBe('ArrowLeft');
      expect(touchInput.x).toBe(0.2);
    });
  });

  describe('2. 키보드 신호 정규화 및 동작 변환', () => {
    it('왼쪽 펀치 키(ArrowLeft, KeyA, a, A, 1, Digit1, Numpad1)를 left_punch 동작으로 변환한다', () => {
      const keys = ['ArrowLeft', 'KeyA', 'a', 'A', '1', 'Digit1', 'Numpad1'];
      for (const k of keys) {
        adapter.reset();
        const event = adapter.handleKeyDown({ key: k, timestampMs: 1234, sessionId: 's1', pairId: 'p1' });
        expect(event).not.toBeNull();
        expect(event?.action).toBe('left_punch');
        expect(event?.source).toBe('keyboard');
        expect(event?.timestampMs).toBe(1234);
        expect(event?.sessionId).toBe('s1');
        expect(event?.pairId).toBe('p1');
        expect(event?.inputId).toMatch(/^fallback-/);
      }
    });

    it('오른쪽 펀치 키(ArrowRight, KeyD, d, D, 2, Digit2, Numpad2)를 right_punch 동작으로 변환한다', () => {
      const keys = ['ArrowRight', 'KeyD', 'd', 'D', '2', 'Digit2', 'Numpad2'];
      for (const k of keys) {
        adapter.reset();
        const event = adapter.handleKeyDown({ key: k, timestampMs: 2000 });
        expect(event).not.toBeNull();
        expect(event?.action).toBe('right_punch');
        expect(event?.source).toBe('keyboard');
      }
    });

    it('스쿼트 키(ArrowDown, KeyS, s, S)를 squat 동작으로 변환한다', () => {
      const keys = ['ArrowDown', 'KeyS', 's', 'S'];
      for (const k of keys) {
        adapter.reset();
        const event = adapter.handleKeyDown({ key: k, timestampMs: 3000 });
        expect(event).not.toBeNull();
        expect(event?.action).toBe('squat');
        expect(event?.source).toBe('keyboard');
      }
    });

    it('점프 키(ArrowUp, KeyW, w, W, Space, " ")를 jump 동작으로 변환한다', () => {
      const keys = ['ArrowUp', 'KeyW', 'w', 'W', 'Space', ' '];
      for (const k of keys) {
        adapter.reset();
        const event = adapter.handleKeyDown({ key: k, timestampMs: 4000 });
        expect(event).not.toBeNull();
        expect(event?.action).toBe('jump');
      }
    });

    it('매핑되지 않은 키(Enter, Escape, KeyZ 등)는 이벤트를 발화하지 않고 null을 반환한다', () => {
      expect(adapter.handleKeyDown({ key: 'Enter' })).toBeNull();
      expect(adapter.handleKeyDown({ key: 'Escape' })).toBeNull();
      expect(adapter.handleKeyDown({ key: 'KeyZ' })).toBeNull();
    });

    it('code 속성으로 키를 판별할 수 있다', () => {
      const event = adapter.handleKeyDown({ key: 'Unidentified', code: 'KeyA' });
      expect(event?.action).toBe('left_punch');
    });
  });

  describe('3. 반복(repeat) 및 키 누름 유지(holding) 재입력 차단 (A18)', () => {
    it('repeat: true인 이벤트는 무시하고 발화하지 않는다', () => {
      const listener = vi.fn();
      adapter.onAction(listener);

      const firstEvent = adapter.handleKeyDown({ key: 'ArrowLeft' });
      expect(firstEvent).not.toBeNull();
      expect(listener).toHaveBeenCalledTimes(1);

      const repeatEvent = adapter.handleKeyDown({ key: 'ArrowLeft', repeat: true });
      expect(repeatEvent).toBeNull();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('키를 누른 채(holding) 유지하는 동안 중복 keydown이 오면 발화하지 않는다', () => {
      const listener = vi.fn();
      adapter.onAction(listener);

      adapter.handleKeyDown({ key: 'ArrowDown' });
      expect(listener).toHaveBeenCalledTimes(1);

      // keyup 없이 다시 누름 신호
      const second = adapter.handleKeyDown({ key: 'ArrowDown' });
      expect(second).toBeNull();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('키를 뗐다(keyup)가 다시 누르면 새로운 inputId로 재발화한다', () => {
      const ev1 = adapter.handleKeyDown({ key: 'ArrowRight' });
      expect(ev1).not.toBeNull();

      adapter.handleKeyUp({ key: 'ArrowRight' });

      const ev2 = adapter.handleKeyDown({ key: 'ArrowRight' });
      expect(ev2).not.toBeNull();
      expect(ev2?.inputId).not.toBe(ev1?.inputId);
    });

    it('서로 다른 동작 키는 각각 독립적으로 발화할 수 있다', () => {
      const evLeft = adapter.handleKeyDown({ key: 'ArrowLeft' });
      expect(evLeft?.action).toBe('left_punch');

      // ArrowLeft를 떼지 않은 상태에서 ArrowDown 입력
      const evSquat = adapter.handleKeyDown({ key: 'ArrowDown' });
      expect(evSquat?.action).toBe('squat');
      expect(evSquat?.inputId).not.toBe(evLeft?.inputId);
    });
  });

  describe('4. 터치 신호 정규화 및 영역 매핑', () => {
    it('화면 좌측(x < 0.5, y < 0.7) 터치 시 left_punch를 발화한다', () => {
      const ev = adapter.handleTouchStart({ identifier: 1, x: 0.2, y: 0.4 });
      expect(ev).not.toBeNull();
      expect(ev?.action).toBe('left_punch');
      expect(ev?.source).toBe('touch');
      expect(ev?.touchIdentifier).toBe(1);
      expect(ev?.normalizedCoords).toEqual({ x: 0.2, y: 0.4 });
    });

    it('화면 우측(x >= 0.5, y < 0.7) 터치 시 right_punch를 발화한다', () => {
      const ev = adapter.handleTouchStart({ identifier: 2, x: 0.8, y: 0.4 });
      expect(ev?.action).toBe('right_punch');
      expect(ev?.source).toBe('touch');
    });

    it('화면 하단(y >= 0.7) 터치 시 squat를 발화한다', () => {
      const ev = adapter.handleTouchStart({ identifier: 3, x: 0.3, y: 0.85 });
      expect(ev?.action).toBe('squat');
      expect(ev?.source).toBe('touch');
    });

    it('픽셀 좌표 입력 시 screenWidth/screenHeight를 기반으로 자동 정규화한다', () => {
      const ev = adapter.handleTouchStart({
        identifier: 4,
        x: 800,
        y: 200,
        screenWidth: 1000,
        screenHeight: 1000,
      });
      expect(ev?.action).toBe('right_punch');
      expect(ev?.normalizedCoords?.x).toBeCloseTo(0.8);
      expect(ev?.normalizedCoords?.y).toBeCloseTo(0.2);
    });

    it('명시적 zone 속성이 지정되면 좌표와 무관하게 해당 동작을 발화한다', () => {
      const ev1 = adapter.handleTouchStart({ identifier: 5, x: 0.1, y: 0.1, zone: 'squat' });
      expect(ev1?.action).toBe('squat');

      const ev2 = adapter.handleTouchStart({ identifier: 6, x: 0.9, y: 0.9, zone: 'left_punch' });
      expect(ev2?.action).toBe('left_punch');
    });

    it('FallbackTouchInput 형태의 복수 터치 배치 입력을 지원한다', () => {
      const touchInput: FallbackTouchInput = {
        touches: [
          { identifier: 10, x: 0.1, y: 0.3 },
          { identifier: 11, x: 0.9, y: 0.3 },
        ],
        timestampMs: 5000,
      };
      const events = adapter.handleTouches(touchInput);
      expect(events).toHaveLength(2);
      expect(events[0].action).toBe('left_punch');
      expect(events[1].action).toBe('right_punch');
    });
  });

  describe('5. 터치 중복 및 취소(touchcancel) 처리', () => {
    it('동일 identifier로 중복 touchstart가 오면 2번째는 무시한다', () => {
      const ev1 = adapter.handleTouchStart({ identifier: 100, x: 0.2, y: 0.3 });
      expect(ev1).not.toBeNull();

      const ev2 = adapter.handleTouchStart({ identifier: 100, x: 0.2, y: 0.3 });
      expect(ev2).toBeNull();
    });

    it('touchend 후 동일 identifier로 다시 터치하면 새 inputId로 발화한다', () => {
      const ev1 = adapter.handleTouchStart({ identifier: 101, x: 0.2, y: 0.3 });
      expect(ev1).not.toBeNull();

      adapter.handleTouchEnd({ identifier: 101, x: 0.2, y: 0.3 });

      const ev2 = adapter.handleTouchStart({ identifier: 101, x: 0.2, y: 0.3 });
      expect(ev2).not.toBeNull();
      expect(ev2?.inputId).not.toBe(ev1?.inputId);
    });

    it('touchcancel 수신 시 이벤트를 발화하지 않고(0회), 활성 터치를 해제하여 재터치를 허용한다', () => {
      const listener = vi.fn();
      adapter.onAction(listener);

      adapter.handleTouchStart({ identifier: 102, x: 0.2, y: 0.3 });
      expect(listener).toHaveBeenCalledTimes(1);

      // cancel 이벤트는 발화 0회
      adapter.handleTouchCancel({ identifier: 102, x: 0.2, y: 0.3 });
      expect(listener).toHaveBeenCalledTimes(1);

      // cancel 이후 동일 identifier 재터치 정상 허용
      adapter.handleTouchStart({ identifier: 102, x: 0.2, y: 0.3 });
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe('6. 일시정지(pause) 중 입력 폐기 및 재개 (A04)', () => {
    it('pause 상태에서는 키보드 및 터치 입력이 일체 발화되지 않고 폐기된다', () => {
      adapter.pause();
      expect(adapter.isPaused).toBe(true);

      const evKey = adapter.handleKeyDown({ key: 'ArrowLeft' });
      expect(evKey).toBeNull();

      const evTouch = adapter.handleTouchStart({ x: 0.8, y: 0.4 });
      expect(evTouch).toBeNull();
    });

    it('resume 호출 후에는 정상적으로 입력이 처리된다', () => {
      adapter.pause();
      adapter.resume();
      expect(adapter.isPaused).toBe(false);

      const ev = adapter.handleKeyDown({ key: 'ArrowLeft' });
      expect(ev).not.toBeNull();
      expect(ev?.action).toBe('left_punch');
    });

    it('pause 시 기존 유지되던 키 및 터치가 초기화되어 resume 후 고착되지 않는다', () => {
      adapter.handleKeyDown({ key: 'ArrowDown' });
      adapter.pause();
      adapter.resume();

      // pause 전 누르고 있던 키를 뗐다는 신호 없이 다시 눌러도 정상 동작
      const ev = adapter.handleKeyDown({ key: 'ArrowDown' });
      expect(ev).not.toBeNull();
    });
  });

  describe('7. 세션 식별자 관리 및 이전 세션 입력 거부 (A16)', () => {
    it('현재 세션과 불일치하는 sessionId를 가진 입력은 거부하고 발화하지 않는다', () => {
      adapter.setSessionId('session-current');

      const evWrong = adapter.handleKeyDown({ key: 'ArrowLeft', sessionId: 'session-old' });
      expect(evWrong).toBeNull();

      const evRight = adapter.handleKeyDown({ key: 'ArrowLeft', sessionId: 'session-current' });
      expect(evRight).not.toBeNull();
      expect(evRight?.sessionId).toBe('session-current');
    });

    it('reset 호출 시 활성 키/터치가 정리되고 새 세션 ID가 적용된다', () => {
      adapter.handleKeyDown({ key: 'ArrowRight' });
      adapter.reset('session-next');

      expect(adapter.sessionId).toBe('session-next');

      // reset 덕분에 keyup 없이도 ArrowRight를 새 세션에서 즉시 누를 수 있음
      const ev = adapter.handleKeyDown({ key: 'ArrowRight', sessionId: 'session-next' });
      expect(ev).not.toBeNull();
      expect(ev?.sessionId).toBe('session-next');
    });

    it('세션 변경 후에도 inputId는 단조 증가하여 이전 세션 ID와 충돌하지 않는다', () => {
      const ev1 = adapter.handleKeyDown({ key: 'ArrowLeft' });
      adapter.reset('session-2');
      const ev2 = adapter.handleKeyDown({ key: 'ArrowLeft', sessionId: 'session-2' });

      expect(ev1?.inputId).not.toBe(ev2?.inputId);
    });
  });

  describe('8. 리스너 구독 및 해제 (onAction)', () => {
    it('onAction으로 등록된 리스너에 이벤트가 전달되고, 해제 시 중단된다', () => {
      const listener = vi.fn();
      const unsubscribe = adapter.onAction(listener);

      adapter.handleKeyDown({ key: 'ArrowLeft' });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      adapter.handleKeyUp({ key: 'ArrowLeft' });
      adapter.handleKeyDown({ key: 'ArrowLeft' });
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('9. 순수 어댑터 경계 무결성', () => {
    it('정답 판정, HP 차감, 피해 계산, UI 렌더링 프로퍼티를 전혀 포함하지 않는다', () => {
      const proto = Object.getPrototypeOf(adapter);
      const propertyNames = Object.getOwnPropertyNames(proto);

      expect(propertyNames).not.toContain('calculateDamage');
      expect(propertyNames).not.toContain('deductHP');
      expect(propertyNames).not.toContain('checkAnswer');
      expect(propertyNames).not.toContain('render');
    });
  });
});
