import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QuestionSpeech } from '../../src/question/QuestionSpeech.js';

describe('[A11Y-004 / #265] 음성 피드백 강화 (TTS)', () => {
  let mockUtterances: any[] = [];
  let mockSpeechSynthesis: any;

  beforeEach(() => {
    mockUtterances = [];

    // Mock SpeechSynthesisUtterance
    class MockSpeechSynthesisUtterance {
      text: string;
      lang = '';
      rate = 1;
      pitch = 1;
      voice: any = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(text: string) {
        this.text = text;
        mockUtterances.push(this);
      }
    }

    const mockVoices = [
      { name: 'Google US English', lang: 'en-US' },
      { name: 'Google 한국의', lang: 'ko-KR' },
    ];

    mockSpeechSynthesis = {
      onvoiceschanged: null,
      speak: vi.fn((utt: any) => {
        // 비동기 완료 시뮬레이션
        setTimeout(() => {
          if (utt.onend) utt.onend();
        }, 10);
      }),
      cancel: vi.fn(),
      getVoices: vi.fn(() => mockVoices),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    vi.stubGlobal('SpeechSynthesisUtterance', MockSpeechSynthesisUtterance);
    vi.stubGlobal('speechSynthesis', mockSpeechSynthesis);
    vi.stubGlobal('window', {
      speechSynthesis: mockSpeechSynthesis,
      SpeechSynthesisUtterance: MockSpeechSynthesisUtterance,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('1. speakFeedback 발화 내용 및 타입별 한국어 매핑', () => {
    it('correct 및 wrong 타입 호출 시 음성을 발화하지 않는다 (효과음 SFX 전담)', () => {
      const speech = new QuestionSpeech();
      speech.speakFeedback('correct');
      speech.speakFeedback('wrong');

      expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled();
      expect(mockUtterances.length).toBe(0);
    });

    it('low_hp 타입 호출 시 간결한 "HP 주의"를 발화한다', () => {
      const speech = new QuestionSpeech();
      speech.speakFeedback('low_hp');

      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
      expect(mockUtterances[0].text).toBe('HP 주의');
      expect(mockUtterances[0].lang).toBe('ko-KR');
    });

    it('boss_enrage 타입 호출 시 간결한 "보스 광폭화"를 발화한다', () => {
      const speech = new QuestionSpeech();
      speech.speakFeedback('boss_enrage');

      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
      expect(mockUtterances[0].text).toBe('보스 광폭화');
      expect(mockUtterances[0].lang).toBe('ko-KR');
    });
  });

  describe('2. enabled 상태 제어 (사운드 음소거 시 발화 차단)', () => {
    it('enabled 기본값은 true이다', () => {
      const speech = new QuestionSpeech();
      expect(speech.enabled).toBe(true);
    });

    it('enabled=false 설정 시 speakFeedback 호출이 차단된다', () => {
      const speech = new QuestionSpeech();
      speech.enabled = false;

      speech.speakFeedback('correct');
      speech.speakFeedback('wrong');
      speech.speakFeedback('low_hp');
      speech.speakFeedback('boss_enrage');

      expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled();
      expect(mockUtterances.length).toBe(0);
    });

    it('enabled=false 설정 시 일반 speak() 호출도 차단된다', () => {
      const speech = new QuestionSpeech();
      speech.enabled = false;

      speech.speak('3 + 5 = ?');
      expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled();
    });

    it('enabled를 다시 true로 변경하면 정상 발화된다', () => {
      const speech = new QuestionSpeech();
      speech.enabled = false;
      speech.speakFeedback('correct');
      expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled();

      speech.enabled = true;
      speech.speakFeedback('boss_enrage');
      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
      expect(mockUtterances[0].text).toBe('보스 광폭화');
    });
  });

  describe('3. low_hp 중복 난사 방지 (쿨다운 / 플래그)', () => {
    it('연속으로 low_hp가 호출되면 쿨다운 동안 중복 발화를 차단한다', () => {
      const speech = new QuestionSpeech();

      speech.speakFeedback('low_hp');
      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);

      // 즉시 연속 호출 -> 차단
      speech.speakFeedback('low_hp');
      speech.speakFeedback('low_hp');
      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
    });

    it('resetFeedbackState() 호출 후에는 다시 low_hp를 발화할 수 있다', () => {
      const speech = new QuestionSpeech();

      speech.speakFeedback('low_hp');
      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);

      speech.resetFeedbackState();

      speech.speakFeedback('low_hp');
      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(2);
    });
  });

  describe('4. boss_enrage 1회 트리거', () => {
    it('boss_enrage는 게임 중 최초 1회만 트리거되고 이후 호출은 차단된다', () => {
      const speech = new QuestionSpeech();

      speech.speakFeedback('boss_enrage');
      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);

      // 반복 호출 -> 무시됨
      speech.speakFeedback('boss_enrage');
      speech.speakFeedback('boss_enrage');
      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
    });

    it('resetFeedbackState() 호출 후에는 다시 boss_enrage를 발화할 수 있다', () => {
      const speech = new QuestionSpeech();

      speech.speakFeedback('boss_enrage');
      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);

      speech.resetFeedbackState();

      speech.speakFeedback('boss_enrage');
      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(2);
    });
  });

  describe('5. [TTS-VOICE-001 / #500] 꼬마 수호신 밝은 보이스 톤(Pitch/Rate) 및 수식 간결 낭독', () => {
    it('발화 시 pitch=1.35, rate=1.15 및 한국어 음성이 적용된다', () => {
      const speech = new QuestionSpeech();
      speech.speakFeedback('boss_enrage');

      expect(mockUtterances.length).toBe(1);
      const utt = mockUtterances[0];
      expect(utt.pitch).toBe(1.35);
      expect(utt.rate).toBe(1.15);
      expect(utt.voice).toEqual({ name: 'Google 한국의', lang: 'ko-KR' });
    });

    it('수학 문제 speak("3 + 5 = ?") 시 끝맺음 없이 "3 더하기 5"로 pitch/rate와 함께 발화된다', () => {
      const speech = new QuestionSpeech();
      speech.speak('3 + 5 = ?');

      expect(mockUtterances.length).toBe(1);
      const utt = mockUtterances[0];
      expect(utt.text).toBe('3 더하기 5');
      expect(utt.pitch).toBe(1.35);
      expect(utt.rate).toBe(1.15);
      expect(utt.voice?.lang).toBe('ko-KR');
    });
  });

  describe('6. [TTS-VOICE-002 / #501] 실브라우저 비동기 getVoices 및 피치 지원 보이스 우선 매칭', () => {
    it('Online Natural 음성이 앞에 있어도 피치 조절을 지원하는 로컬/데스크톱 음성을 우선 선택한다', () => {
      const edgeVoices = [
        { name: 'Microsoft SunHi Online (Natural) - Korean (Korea)', lang: 'ko-KR', localService: false },
        { name: 'Microsoft InJoon Online (Natural) - Korean (Korea)', lang: 'ko-KR', localService: false },
        { name: 'Microsoft Heami Desktop - Korean', lang: 'ko-KR', localService: true },
      ];
      mockSpeechSynthesis.getVoices = vi.fn(() => edgeVoices);

      const speech = new QuestionSpeech();
      speech.speakFeedback('boss_enrage');

      expect(mockUtterances.length).toBe(1);
      const utt = mockUtterances[0];
      expect(utt.pitch).toBe(1.35);
      expect(utt.rate).toBe(1.15);
      expect(utt.voice.name).toBe('Microsoft Heami Desktop - Korean');
    });

    it('초기 getVoices()가 빈 배열이어도 onvoiceschanged 이벤트 발생 시 음성이 갱신된다', () => {
      let currentVoices: any[] = [];
      mockSpeechSynthesis.getVoices = vi.fn(() => currentVoices);

      const speech = new QuestionSpeech();

      // 음성 로드 완료 시뮬레이션
      currentVoices = [
        { name: 'Google 한국의', lang: 'ko-KR', localService: true },
      ];
      if (typeof mockSpeechSynthesis.onvoiceschanged === 'function') {
        mockSpeechSynthesis.onvoiceschanged();
      }

      speech.speak('3 + 5 = ?');
      expect(mockUtterances.length).toBe(1);
      expect(mockUtterances[0].voice?.name).toBe('Google 한국의');
    });

    it('destroy() 호출 시 onvoiceschanged 리스너가 정리된다', () => {
      const speech = new QuestionSpeech();
      expect(mockSpeechSynthesis.onvoiceschanged).not.toBeNull();
      speech.destroy();
      expect(mockSpeechSynthesis.onvoiceschanged).toBeNull();
    });
  });

  describe('7. [TTS-VOICE-003 / #540] 러닝페이즈 "달려!" 발화 후 수식 순차 낭독 (speakRunPhase)', () => {
    it('speakRunPhase 호출 시 먼저 "달려!"가 발화되고, 완료(onend) 시 수식이 순차 발화된다', () => {
      const speech = new QuestionSpeech();
      speech.speakRunPhase('3 + 5 = ?');

      // 1단계: "달려!" 발화 시작
      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
      expect(mockUtterances.length).toBe(1);
      expect(mockUtterances[0].text).toBe('달려!');
      expect(mockUtterances[0].pitch).toBe(1.35);

      // 첫 번째 발화 완료 시뮬레이션
      if (mockUtterances[0].onend) {
        mockUtterances[0].onend();
      }

      // 2단계: 수식 "3 더하기 5" 순차 발화
      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(2);
      expect(mockUtterances.length).toBe(2);
      expect(mockUtterances[1].text).toBe('3 더하기 5');
      expect(mockUtterances[1].pitch).toBe(1.35);
    });

    it('enabled=false 시 speakRunPhase 가 차단된다', () => {
      const speech = new QuestionSpeech();
      speech.enabled = false;
      speech.speakRunPhase('3 + 5 = ?');
      expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled();
    });
  });
});
