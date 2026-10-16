import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AssaultSessionFactory,
  AssaultSessionValidationError,
  isAssaultModeRequested,
} from '../../src/core/AssaultSessionFactory.js';
import { AppBootstrap } from '../../src/core/AppBootstrap.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { QuestionSpeech } from '../../src/question/QuestionSpeech.js';
import { DEFAULT_ASSAULT_CONFIG } from '../../config/assault.config.js';
import { DEFAULT_APPROACH_PATTERN } from '../../src/data/assault/approachPatterns.js';
import type { QuestionCandidate } from '../../src/question/AssaultQuestionEligibility.js';

/**
 * BOSS-ASSAULT-22 / #524
 * 내부 테스트 세션 조립과 배타 진입 단위 테스트 (assault-bootstrap.test.ts)
 *
 * 검증 항목:
 * 1. 기본 진입은 legacy, 명시 옵션(?mode=boss_assault)만 신규 조립 및 단일 HP 객체 유지 (A01)
 * 2. 원자적 유효성 검증 실패 시 부분 세션/중복 구독/레거시 피해·보상 0회 (A02)
 * 3. 신규 모드에서 BeatRun/별/오답 회피/기존 피버·포격·보상 콜백 배제
 * 4. TTS 실제 공개 API 대조 및 요청 포트 주입 검증
 * 5. AppBootstrap 세션 팩토리 연결 인터페이스 및 DEVUI 파라미터 병행 결합
 */
describe('[BOSS-ASSAULT-22 / #524] AssaultSessionFactory 및 내부 테스트 세션 조립', () => {
  const sampleEligibleQuestions: QuestionCandidate[] = [
    {
      level: 1,
      subLevel: 1,
      questionText: '3 + 4 = ?',
      correctAnswer: 7,
      wrongAnswer: 8,
      choices: [7, 8],
    },
    {
      level: 2,
      subLevel: 1,
      questionText: '10 - 4 = ?',
      correctAnswer: 6,
      wrongAnswer: 5,
      choices: [6, 5],
    },
  ];

  let battle: BattleState;
  let boss: BossController;
  let speech: QuestionSpeech;

  beforeEach(() => {
    battle = new BattleState(100);
    boss = new BossController(1);
    speech = new QuestionSpeech();
  });

  describe('1. 진입 판정 및 기본 Legacy 유지 (A01)', () => {
    it('파라미터나 명시 옵션이 없으면 기본 legacy 모드로 판정한다', () => {
      expect(isAssaultModeRequested(undefined, { DEV: true })).toBe(false);
      expect(isAssaultModeRequested({ search: '' }, { DEV: true })).toBe(false);
      expect(isAssaultModeRequested({ search: '?mode=normal' }, { DEV: true })).toBe(false);
    });

    it('?mode=boss_assault 와 DEV 환경일 때 접근전 모드로 판정한다', () => {
      expect(isAssaultModeRequested({ search: '?mode=boss_assault' }, { DEV: true })).toBe(true);
    });

    it('DEV 환경이 아니면 URL 파라미터 ?mode=boss_assault 만으로는 진입을 차단한다', () => {
      expect(isAssaultModeRequested({ search: '?mode=boss_assault' }, { DEV: false })).toBe(false);
    });

    it('명시적 mode 옵션("boss_assault")이 전달되면 DEV 여부와 무관하게 허용한다', () => {
      expect(isAssaultModeRequested(undefined, { DEV: false }, 'boss_assault')).toBe(true);
      expect(isAssaultModeRequested({ search: '' }, { DEV: false }, 'boss_assault')).toBe(true);
    });

    it('DEVUI 파라미터(?dev=ui&screen=hud)와 병행되어도 충돌 없이 둘 다 공존한다', () => {
      const search = '?dev=ui&screen=hud&mode=boss_assault';
      expect(isAssaultModeRequested({ search }, { DEV: true })).toBe(true);
      // dev=ui 도 정상 보존됨
      const params = new URLSearchParams(search);
      expect(params.get('dev')).toBe('ui');
      expect(params.get('screen')).toBe('hud');
      expect(params.get('mode')).toBe('boss_assault');
    });

    it('AppBootstrap 기본 생성 시 assaultSession은 null이며 legacy 모드를 유지한다', () => {
      const app = new AppBootstrap();
      expect(app.assaultSession).toBeNull();
      expect(app.isAssaultMode()).toBe(false);
    });
  });

  describe('2. 단일 권위 HP 객체 주입 및 참조 유지 (A01)', () => {
    it('조립된 세션의 settlement는 주입된 BattleState를 단일 권위로 직접 참조한다', () => {
      const session = AssaultSessionFactory.createSession({
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleEligibleQuestions,
      });

      expect(session.battleState).toBe(battle);
      expect(session.settlement).toBeDefined();

      // settlement를 통해 피해가 정산될 때 주입된 단일 BattleState의 HP가 차감된다
      session.settlement.settle({
        sessionId: session.sessionId,
        roundId: 'round_01',
        attackId: 'attack_01',
        target: 'player',
        effectType: 'player_damage',
        resultKind: 'miss',
        idempotencyKey: 'idem_01',
      });

      expect(battle.hp).toBe(100 - DEFAULT_ASSAULT_CONFIG.wrongDamage);
    });
  });

  describe('3. 검증 실패 시 원자적 거부 및 잔여물 배제 (A02)', () => {
    it('적격 문항이 0개이면 AssaultSessionValidationError를 발생시키고 세션을 남기지 않는다', () => {
      const ineligibleQuestions: QuestionCandidate[] = [
        {
          level: 9, // 범위 초과
          questionText: '1/3 + 1/3 = ?',
          shapeCode: 'TRIANGLE',
        },
      ];

      expect(() => {
        AssaultSessionFactory.createSession({
          battleState: battle,
          bossController: boss,
          speech,
          questions: ineligibleQuestions,
        });
      }).toThrow(AssaultSessionValidationError);
    });

    it('유효하지 않은 config(minRoundBeats < 8 또는 playerMaxHp !== 100) 주입 시 거부된다', () => {
      const invalidConfig = {
        ...DEFAULT_ASSAULT_CONFIG,
        minRoundBeats: 4, // 최소 8박 위반
      };

      expect(() => {
        AssaultSessionFactory.createSession({
          battleState: battle,
          bossController: boss,
          speech,
          questions: sampleEligibleQuestions,
          config: invalidConfig as any,
        });
      }).toThrow(AssaultSessionValidationError);
    });

    it('유효하지 않은 approach pattern(중복 attack ID 등) 주입 시 거부된다', () => {
      const invalidPattern = {
        ...DEFAULT_APPROACH_PATTERN,
        encounters: [
          DEFAULT_APPROACH_PATTERN.encounters[0],
          DEFAULT_APPROACH_PATTERN.encounters[0], // 중복 ID
        ],
      };

      expect(() => {
        AssaultSessionFactory.createSession({
          battleState: battle,
          bossController: boss,
          speech,
          questions: sampleEligibleQuestions,
          pattern: invalidPattern as any,
        });
      }).toThrow(AssaultSessionValidationError);
    });

    it('검증 실패 시 HP 차감, 정답/오답 보상, TTS 호출이 0회여야 한다', () => {
      const applyHazardSpy = vi.spyOn(battle, 'applyHazardDamage');
      const onCorrectSpy = vi.spyOn(battle, 'onCorrect');
      const onWrongSpy = vi.spyOn(battle, 'onWrong');
      const speakSpy = vi.spyOn(speech, 'speak');

      expect(() => {
        AssaultSessionFactory.createSession({
          battleState: battle,
          bossController: boss,
          speech,
          questions: [], // 0개 -> 실패
        });
      }).toThrow(AssaultSessionValidationError);

      expect(applyHazardSpy).toHaveBeenCalledTimes(0);
      expect(onCorrectSpy).toHaveBeenCalledTimes(0);
      expect(onWrongSpy).toHaveBeenCalledTimes(0);
      expect(speakSpy).toHaveBeenCalledTimes(0);
    });

    it('실패 후 유효한 옵션으로 재시도하면 정상 조립된다', () => {
      // 1회차 실패
      expect(() => {
        AssaultSessionFactory.createSession({
          battleState: battle,
          bossController: boss,
          speech,
          questions: [],
        });
      }).toThrow(AssaultSessionValidationError);

      // 2회차 유효 옵션으로 재시도 -> 성공
      const session = AssaultSessionFactory.createSession({
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleEligibleQuestions,
      });

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.mode).toBe('boss_assault');
    });
  });

  describe('4. 신규 모드 배타성 (기존 콜백 및 레거시 자원 변경 배제)', () => {
    it('세션 조립 및 라운드 컨트롤러 생성 시 BeatRun/별/피버/보상 콜백을 일체 연결하지 않는다', () => {
      const onCorrectSpy = vi.spyOn(battle, 'onCorrect');
      const onWrongSpy = vi.spyOn(battle, 'onWrong');
      const incrementFeverSpy = vi.spyOn(battle, 'incrementFeverCombo');

      const session = AssaultSessionFactory.createSession({
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleEligibleQuestions,
      });

      const round = session.createRoundController('round_01', '3 + 4 = ?');
      expect(round).toBeDefined();

      // 라운드 생성 및 진행 시 기존 배틀 상태 변경 함수(fever, onCorrect 등)가 호출되지 않음
      expect(onCorrectSpy).toHaveBeenCalledTimes(0);
      expect(onWrongSpy).toHaveBeenCalledTimes(0);
      expect(incrementFeverSpy).toHaveBeenCalledTimes(0);
    });
  });

  describe('5. TTS 실제 공개 API 대조 및 요청 포트 주입 검증', () => {
    it('QuestionSpeech 실제 공개 메서드(speak, status, cancel)와 연동되어 동작한다', () => {
      const speakSpy = vi.spyOn(speech, 'speak').mockImplementation(() => {});

      const session = AssaultSessionFactory.createSession({
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleEligibleQuestions,
      });

      session.ttsPort.speak('3 더하기 4는?');
      expect(speakSpy).toHaveBeenCalledWith('3 더하기 4는?');
      expect(session.ttsPort.status).toBe(speech.status);
    });

    it('함수 형태의 단순 TTS 요청 포트 주입도 지원한다', () => {
      const speakFn = vi.fn();

      const session = AssaultSessionFactory.createSession({
        battleState: battle,
        bossController: boss,
        speech: speakFn,
        questions: sampleEligibleQuestions,
      });

      session.ttsPort.speak('테스트 문항');
      expect(speakFn).toHaveBeenCalledWith('테스트 문항');
    });

    it('speak 능력이 없는 부적격 speech 객체 전달 시 오류가 발생한다', () => {
      expect(() => {
        AssaultSessionFactory.createSession({
          battleState: battle,
          bossController: boss,
          speech: {} as any, // speak 없음
          questions: sampleEligibleQuestions,
        });
      }).toThrow(AssaultSessionValidationError);
    });
  });

  describe('6. AppBootstrap 세션 팩토리 연결 인터페이스 검증', () => {
    it('assembleAssaultSession 호출 시 세션이 생성되어 app.assaultSession에 등록된다', () => {
      const app = new AppBootstrap({
        mode: 'boss_assault',
      });

      const session = app.assembleAssaultSession({
        questions: sampleEligibleQuestions,
      });

      expect(session).toBeDefined();
      expect(app.assaultSession).toBe(session);
      expect(app.isAssaultMode()).toBe(true);
    });

    it('assembleAssaultSession 실패 시 app.assaultSession은 null로 남는다', () => {
      const app = new AppBootstrap();

      expect(() => {
        app.assembleAssaultSession({
          questions: [], // 적격 문항 0개 -> 실패
        });
      }).toThrow(AssaultSessionValidationError);

      expect(app.assaultSession).toBeNull();
    });

    it('세션 dispose 호출 시 isDisposed가 true가 되며 추가 라운드 생성이 차단된다', () => {
      const session = AssaultSessionFactory.createSession({
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleEligibleQuestions,
      });

      expect(session.isDisposed).toBe(false);
      session.dispose();
      expect(session.isDisposed).toBe(true);

      expect(() => {
        session.createRoundController('round_disposed', '1 + 1 = ?');
      }).toThrow(/disposed/);
    });
  });
});
