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
      speak: vi.fn((utt: any) => {
        // 비동기 완료 시뮬레이션
        setTimeout(() => {
          if (utt.onend) utt.onend();
        }, 10);
      }),
      cancel: vi.fn(),
      getVoices: vi.fn(() => mockVoices),
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
    it('correct 타입 호출 시 "정답입니다!"를 발화한다', () => {
      const speech = new QuestionSpeech();
      speech.speakFeedback('correct');

      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
      expect(mockUtterances[0].text).toBe('정답입니다!');
      expect(mockUtterances[0].lang).toBe('ko-KR');
    });

    it('wrong 타입 호출 시 "틀렸습니다!"를 발화한다', () => {
      const speech = new QuestionSpeech();
      speech.speakFeedback('wrong');

      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
      expect(mockUtterances[0].text).toBe('틀렸습니다!');
      expect(mockUtterances[0].lang).toBe('ko-KR');
    });

    it('low_hp 타입 호출 시 "주의! 체력이 절반입니다!"를 발화한다', () => {
      const speech = new QuestionSpeech();
      speech.speakFeedback('low_hp');

      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
      expect(mockUtterances[0].text).toBe('주의! 체력이 절반입니다!');
      expect(mockUtterances[0].lang).toBe('ko-KR');
    });

    it('boss_enrage 타입 호출 시 "보스가 광폭화했습니다!"를 발화한다', () => {
      const speech = new QuestionSpeech();
      speech.speakFeedback('boss_enrage');

      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
      expect(mockUtterances[0].text).toBe('보스가 광폭화했습니다!');
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
      speech.speakFeedback('correct');
      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
      expect(mockUtterances[0].text).toBe('정답입니다!');
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
    it('발화 시 pitch=1.3, rate=1.15 및 한국어 음성이 적용된다', () => {
      const speech = new QuestionSpeech();
      speech.speakFeedback('correct');

      expect(mockUtterances.length).toBe(1);
      const utt = mockUtterances[0];
      expect(utt.pitch).toBe(1.3);
      expect(utt.rate).toBe(1.15);
      expect(utt.voice).toEqual({ name: 'Google 한국의', lang: 'ko-KR' });
    });

    it('수학 문제 speak("3 + 5 = ?") 시 끝맺음 없이 "3 더하기 5"로 pitch/rate와 함께 발화된다', () => {
      const speech = new QuestionSpeech();
      speech.speak('3 + 5 = ?');

      expect(mockUtterances.length).toBe(1);
      const utt = mockUtterances[0];
      expect(utt.text).toBe('3 더하기 5');
      expect(utt.pitch).toBe(1.3);
      expect(utt.rate).toBe(1.15);
      expect(utt.voice?.lang).toBe('ko-KR');
    });
  });
});
