import { describe, it, expect, beforeEach } from 'vitest';
import {
  DialogueManager,
  dialogueManager,
  STORY_DIALOGUE_DATA,
} from '../../src/story/index.js';
import type {
  ADHDDefenseType,
} from '../../src/types/story.js';

describe('DialogueManager & dialogueData (Issue #218 / STORY-DATA-001)', () => {
  let manager: DialogueManager;

  beforeEach(() => {
    manager = new DialogueManager();
  });

  describe('1. 5대 보스별 상황 대사 쿼리 검증', () => {
    const bossExpectations = [
      {
        chapter: 1,
        name: '하얘시니',
        battleStart: '어서 오거라. 이 깊은 안개 속에서는 애써 기억하려 애쓰지 않아도 되느니라.',
        answerCorrect: '오... 제법이구나. 허나 한 번 맞혔다 하여 이 안개가 다 걷힐 것 같으냐?',
        collapseSoon: '틀리는 것이... 부끄러운 일이 아니란 말이냐... 가슴의 고동이 안개를 찢고 있구나...',
        purified: '두려움을 털어내 주어... 참으로 고맙구나...',
      },
      {
        chapter: 2,
        name: '재촉새',
        battleStart: '째깍, 째깍. 시간은 결코 머뭇거리는 자를 기다려주지 않는 법이니라.',
        answerCorrect: '맞히긴 하였구나. 허나 그 속도로 세상의 흐름을 따라잡을 수 있겠느냐?',
        collapseSoon: '째깍... 째깍...... 시계가... 멈추는구나... 나만의 박자가 따로 있었단 말인가...',
        purified: '숨 가쁜 굴레에서 날 쉬게 해 주어... 고맙구나...',
      },
      {
        chapter: 3,
        name: '따돌시니',
        battleStart: '어찌하여 들어왔느냐. 이곳은 모난 곳 없이 꼭 들어맞는 조각들만의 성역이니라.',
        answerCorrect: '답을 내긴 하였구나. 허나 네 방식이 다른 누군가와 같다고 생각하느냐?',
        collapseSoon: '다름은... 틀린 것이 아니었구나... 서로 다른 조각이 모여 비로소 하나가 되는 것을...',
        purified: '어울리지 못하던 내 슬픔을 안아주어... 참으로 고맙구나...',
      },
      {
        chapter: 4,
        name: '풀죽새',
        battleStart: '애쓰지 말거라. 날개를 접고 바닥에 엎드리면 모든 것이 편안해지느니라.',
        answerCorrect: '한 번 해냈다 하여 달라질 것이 있겠느냐. 작은 숫자 하나 맞힌 것뿐이니라.',
        collapseSoon: '온몸이... 들썩이는구나... 주저앉았던 마음에 다시 박동이 차오르다니...',
        purified: '가라앉아 있던 날개를 다시 띄워주어... 고맙구나...',
      },
      {
        chapter: 5,
        name: '캄캄대왕',
        battleStart: '마침내 이곳까지 왔구나. 허나 이 적막 속에서는 모든 소리가 흩어지느니라. 고요 속에서 홀로 남아 보거라.',
        answerCorrect: '벽을 하나 허물었구나. 허나 그 곁의 작은 온기가 언제까지 네 곁에 머물 것 같으냐?',
        collapseSoon: '외로움이란... 홀로 있어서가 아니라, 내 안의 고동을 잊었기 때문이었구나...',
        purified: '오랜 시간 잊고 있던 내 안의 소리를 들려주어... 참으로 고맙구나...',
      },
    ];

    bossExpectations.forEach(({ chapter, name, battleStart, answerCorrect, collapseSoon, purified }) => {
      it(`Ch.${chapter} ${name}: 전투 시작 대사가 정상 반환된다`, () => {
        manager.resetCooldown();
        const d = manager.getDialogue({ trigger: 'battle_start', chapter, force: true });
        expect(d).not.toBeNull();
        expect(d?.speaker).toBe('boss');
        expect(d?.speakerName).toBe(name);
        expect(d?.text).toBe(battleStart);
        expect(d?.chapter).toBe(chapter);
      });

      it(`Ch.${chapter} ${name}: 정답 시 보스의 흔들기 대사가 정상 반환된다`, () => {
        manager.resetCooldown();
        const d = manager.getDialogue({ trigger: 'answer_correct', chapter, force: true });
        expect(d).not.toBeNull();
        expect(d?.speaker).toBe('boss');
        expect(d?.speakerName).toBe(name);
        expect(d?.text).toBe(answerCorrect);
      });

      it(`Ch.${chapter} ${name}: 연속 정답 시 보스의 당황 대사가 정상 반환된다`, () => {
        manager.resetCooldown();
        const d = manager.getDialogue({ trigger: 'consecutive_correct', chapter, force: true });
        expect(d).not.toBeNull();
        expect(d?.speaker).toBe('boss');
        expect(d?.speakerName).toBe(name);
        expect(typeof d?.text).toBe('string');
        expect(d?.text.length).toBeGreaterThan(0);
      });

      it(`Ch.${chapter} ${name}: 붕괴 직전(boss_collapse_soon) 대사가 정상 반환된다`, () => {
        manager.resetCooldown();
        const d = manager.getDialogue({ trigger: 'boss_collapse_soon', chapter, force: true });
        expect(d).not.toBeNull();
        expect(d?.speaker).toBe('boss');
        expect(d?.speakerName).toBe(name);
        expect(d?.text).toBe(collapseSoon);
      });

      it(`Ch.${chapter} ${name}: 정화 피날레(boss_purified) 감사 대사가 정상 반환된다`, () => {
        manager.resetCooldown();
        const d = manager.getDialogue({ trigger: 'boss_purified', chapter, force: true });
        expect(d).not.toBeNull();
        expect(d?.speaker).toBe('boss');
        expect(d?.speakerName).toBe(name);
        expect(d?.text).toBe(purified);
        expect(d?.text).toContain('고맙구나');
      });
    });
  });

  describe('2. 오답 시 보스 발화 차단 및 깨비 위로 대사 반환 검증 (표시 전용 & 절대 원칙)', () => {
    it('Ch.1~5 전체에서 오답 시(answer_wrong) 보스 대사는 존재하지 않고 깨비 대사만 반환된다', () => {
      for (let ch = 1; ch <= 5; ch++) {
        const d = manager.getDialogue({ trigger: 'answer_wrong', chapter: ch, force: true });
        expect(d).not.toBeNull();
        expect(d?.speaker).toBe('kkebi');
        expect(d?.speakerName).toBe('깨비');
        expect(typeof d?.text).toBe('string');
        expect(d?.text.length).toBeGreaterThan(0);
      }
    });

    it('연속 오답 시(consecutive_wrong) 깨비의 특별 위로 대사가 반환된다', () => {
      for (let ch = 1; ch <= 5; ch++) {
        const d = manager.getDialogue({ trigger: 'consecutive_wrong', chapter: ch, force: true });
        expect(d).not.toBeNull();
        expect(d?.speaker).toBe('kkebi');
        expect(d?.speakerName).toBe('깨비');
        expect(typeof d?.text).toBe('string');
        expect(d?.text.length).toBeGreaterThan(0);
      }
    });

    it('오답 트리거에서 명시적으로 speaker: "boss"를 요구해도 보스 발화는 원천 차단(null)된다', () => {
      const wrongBoss = manager.getDialogue({ trigger: 'answer_wrong', chapter: 1, speaker: 'boss', force: true });
      expect(wrongBoss).toBeNull();

      const consecWrongBoss = manager.getDialogue({ trigger: 'consecutive_wrong', chapter: 2, speaker: 'boss', force: true });
      expect(consecWrongBoss).toBeNull();
    });

    it('STORY_DIALOGUE_DATA의 보스 데이터에는 오답 관련 대사가 등록되어 있지 않다', () => {
      for (let ch = 1; ch <= 5; ch++) {
        const bossCfg = STORY_DIALOGUE_DATA.bosses[ch];
        expect((bossCfg as any).answerWrong).toBeUndefined();
        expect((bossCfg as any).consecutiveWrong).toBeUndefined();
      }
    });

    it('answer_wrong 호출 시 consecutiveCount >= 2이면 consecutive_wrong 대사가 선택된다', () => {
      const d1 = manager.getDialogue({ trigger: 'answer_wrong', chapter: 1, consecutiveCount: 1, force: true });
      const d2 = manager.getDialogue({ trigger: 'answer_wrong', chapter: 1, consecutiveCount: 2, force: true });
      expect(d1?.text).toBe('앗, 안개가 눈을 살짝 가렸나 봐! 괜찮아, 눈 한번 껌뻑이고 다시 보자!');
      expect(d2?.text).toBe('에헤헤, 나도 도깨비불 켤 때 세 번이나 헛발질했는걸! 한 번 더!');
    });
  });

  describe('3. ADHD 5대 방어 기제별 치유 대사 반환 검증', () => {
    const defenseCases: { type: ADHDDefenseType; expected: string }[] = [
      {
        type: 'anger',
        expected: '화가 날 만큼 잘해내고 싶었던 거지? 그 멋진 마음, 내가 다 알아! 한 번 더 가보자!',
      },
      {
        type: 'give_up',
        expected: '그래, 잠깐 숨 좀 돌리자! 내가 여기서 도깨비불 딱 지키고 있을 테니까 쉬다 와!',
      },
      {
        type: 'rush_guess',
        expected: '잠깐만~ 한 박자만 후! 숨 쉬고 보자. 급하게 치면 기타줄 끊어지거든, 에헤헤.',
      },
      {
        type: 'defiance',
        expected: '네 생각이 틀린 게 아니야! 그냥 다른 길을 먼저 걸어본 거지. 이번엔 이쪽 길도 같이 가볼래?',
      },
      {
        type: 'distraction',
        expected: '우와, 저 녀석 덩치가 좀 커 보이네? 나도 조금 무섭다! 그러니까 우리 둘이 힘 합쳐서 쳐보자!',
      },
    ];

    defenseCases.forEach(({ type, expected }) => {
      it(`ADHD 방어 행동 [${type}] 치유 대사가 일치한다`, () => {
        const d = manager.getDialogue({ trigger: 'adhd_defense', defenseType: type, force: true });
        expect(d).not.toBeNull();
        expect(d?.speaker).toBe('kkebi');
        expect(d?.speakerName).toBe('깨비');
        expect(d?.defenseType).toBe(type);
        expect(d?.text).toBe(expected);
      });
    });
  });

  describe('4. 쿨다운 및 중복 방지 로직 검증', () => {
    it('기본 쿨다운(2500ms) 이내의 연속 호출 시 null을 반환한다', () => {
      const d1 = manager.getDialogue({ trigger: 'answer_correct', chapter: 1, nowMs: 1000 });
      expect(d1).not.toBeNull();

      // 1000ms 후 (2000ms 시점) -> 쿨다운 2500ms 미경과이므로 null
      const d2 = manager.getDialogue({ trigger: 'answer_correct', chapter: 1, nowMs: 2000 });
      expect(d2).toBeNull();

      // force: true 옵션 시 쿨다운 무시하고 발화
      const dForced = manager.getDialogue({ trigger: 'answer_correct', chapter: 1, force: true, nowMs: 2000 });
      expect(dForced).not.toBeNull();

      // 쿨다운 경과 (4600ms 시점) -> 발화 성공
      const d3 = manager.getDialogue({ trigger: 'answer_correct', chapter: 1, nowMs: 4600 });
      expect(d3).not.toBeNull();
    });

    it('resetCooldown() 호출 시 즉시 재발화가 가능하다', () => {
      manager.getDialogue({ trigger: 'answer_correct', chapter: 1, nowMs: 1000 });
      expect(manager.getDialogue({ trigger: 'answer_correct', chapter: 1, nowMs: 1500 })).toBeNull();

      manager.resetCooldown();
      expect(manager.getDialogue({ trigger: 'answer_correct', chapter: 1, nowMs: 1500 })).not.toBeNull();
    });

    it('setCooldownTime으로 쿨다운 길이를 조정할 수 있다', () => {
      manager.setCooldownTime(1000);
      expect(manager.getCooldownTime()).toBe(1000);

      manager.getDialogue({ trigger: 'answer_correct', chapter: 1, nowMs: 1000 });
      expect(manager.getDialogue({ trigger: 'answer_correct', chapter: 1, nowMs: 1500 })).toBeNull();
      expect(manager.getDialogue({ trigger: 'answer_correct', chapter: 1, nowMs: 2100 })).not.toBeNull();
    });

    it('여러 대사가 등록된 경우 순환(Rotation)을 통해 연속 중복을 방지한다', () => {
      const line1 = manager.getDialogue({ trigger: 'consecutive_correct', chapter: 1, force: true });
      const line2 = manager.getDialogue({ trigger: 'consecutive_correct', chapter: 1, force: true });
      const line3 = manager.getDialogue({ trigger: 'consecutive_correct', chapter: 1, force: true });

      expect(line1?.text).not.toBe(line2?.text);
      expect(line1?.text).toBe(line3?.text);
    });
  });

  describe('5. 싱글톤 및 export 무결성 검증', () => {
    it('dialogueManager 기본 싱글톤 인스턴스가 정상 제공된다', () => {
      expect(dialogueManager).toBeInstanceOf(DialogueManager);
      const line = dialogueManager.getDialogue({ trigger: 'battle_start', chapter: 1, force: true });
      expect(line).not.toBeNull();
    });

    it('boss_enrage 트리거는 boss_collapse_soon과 호환된다', () => {
      const d = manager.getDialogue({ trigger: 'boss_enrage' as any, chapter: 1, force: true });
      expect(d).not.toBeNull();
      expect(d?.speaker).toBe('boss');
      expect(d?.text).toContain('가슴의 고동이 안개를 찢고 있구나');
    });
  });
});
