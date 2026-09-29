import { describe, expect, it } from 'vitest';
import {
  BOSS_REGISTRY,
  getAllBosses,
  getBossByChapter,
  getBossName,
  type BossMetadata,
} from '../../src/data/bossData.js';
import * as DataIndex from '../../src/data/index.js';

describe('BossData (Issue #215 - DATA-BOSS-001)', () => {
  describe('BOSS_REGISTRY 상수 검증', () => {
    it('1부터 5까지 총 5개의 보스 데이터가 등록되어 있어야 한다', () => {
      const keys = Object.keys(BOSS_REGISTRY).map(Number);
      expect(keys.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    });

    it('Ch.1 망각의 요괴 하얘시니 메타데이터가 정확해야 한다', () => {
      const ch1 = BOSS_REGISTRY[1];
      expect(ch1).toBeDefined();
      expect(ch1.id).toBe('haeyesini');
      expect(ch1.chapter).toBe(1);
      expect(ch1.name).toBe('하얘시니');
      expect(ch1.title).toBe('망각의 요괴');
      expect(ch1.anxiety).toBe('실수와 실망에 대한 두려움');
      expect(ch1.anxietyQuote).toBe('틀리면 어떡하지? 다들 실망할 텐데…');
      expect(ch1.mathDomain).toBe('덧셈과 뺄셈');
      expect(ch1.musicGenre).toBe('하드 록 / 팝 펑크');
      expect(ch1.handInstrument).toBe('일렉 기타');
      expect(ch1.footInstrument).toBe('록 드럼');
      expect(ch1.baseHp).toBe(10);
      expect(ch1.themeColor).toBe('#4DFFAA');
    });

    it('Ch.2 성급의 요괴 재촉새 메타데이터가 정확해야 한다', () => {
      const ch2 = BOSS_REGISTRY[2];
      expect(ch2).toBeDefined();
      expect(ch2.id).toBe('jaechoksae');
      expect(ch2.chapter).toBe(2);
      expect(ch2.name).toBe('재촉새');
      expect(ch2.title).toBe('성급의 요괴');
      expect(ch2.anxiety).toBe('시간 압박에 대한 두려움');
      expect(ch2.anxietyQuote).toBe('빨리 해야 해! 늦으면 뒤처질 거야!');
      expect(ch2.mathDomain).toBe('곱셈과 나눗셈');
      expect(ch2.musicGenre).toBe('업템포 EDM / 유로비트');
      expect(ch2.handInstrument).toBe('신스 리드');
      expect(ch2.footInstrument).toBe('808 전자 비트');
      expect(ch2.baseHp).toBe(10);
      expect(ch2.themeColor).toBe('#28E6FF');
    });

    it('Ch.3 왜곡의 요괴 따돌시니 메타데이터가 정확해야 한다', () => {
      const ch3 = BOSS_REGISTRY[3];
      expect(ch3).toBeDefined();
      expect(ch3.id).toBe('ttadolsini');
      expect(ch3.chapter).toBe(3);
      expect(ch3.name).toBe('따돌시니');
      expect(ch3.title).toBe('왜곡의 요괴');
      expect(ch3.anxiety).toBe('친구의 거절에 대한 두려움');
      expect(ch3.anxietyQuote).toBe('나만 다른 조각일까 봐 두려워. 어울리지 못하면 어쩌지?');
      expect(ch3.mathDomain).toBe('분수');
      expect(ch3.musicGenre).toBe('네오 클래시컬 심포니');
      expect(ch3.handInstrument).toBe('그랜드 피아노');
      expect(ch3.footInstrument).toBe('오케스트라 팀파니');
      expect(ch3.baseHp).toBe(10);
      expect(ch3.themeColor).toBe('#FFCB4D');
    });

    it('Ch.4 무기력의 요괴 풀죽새 메타데이터가 정확해야 한다', () => {
      const ch4 = BOSS_REGISTRY[4];
      expect(ch4).toBeDefined();
      expect(ch4.id).toBe('puljuksae');
      expect(ch4.chapter).toBe(4);
      expect(ch4.name).toBe('풀죽새');
      expect(ch4.title).toBe('무기력의 요괴');
      expect(ch4.anxiety).toBe('무시당하기에 대한 두려움');
      expect(ch4.anxietyQuote).toBe('넌 왜 이것도 못하니? ...그냥 다 그만둘래.');
      expect(ch4.mathDomain).toBe('소수');
      expect(ch4.musicGenre).toBe('디스코 펑크');
      expect(ch4.handInstrument).toBe('슬랩 베이스');
      expect(ch4.footInstrument).toBe('펑크 찹 & 퍼커션');
      expect(ch4.baseHp).toBe(10);
      expect(ch4.themeColor).toBe('#C889FF');
    });

    it('Ch.5 영원한 고립의 지배자 캄캄대왕 메타데이터가 정확해야 한다', () => {
      const ch5 = BOSS_REGISTRY[5];
      expect(ch5).toBeDefined();
      expect(ch5.id).toBe('kamkamdaewang');
      expect(ch5.chapter).toBe(5);
      expect(ch5.name).toBe('캄캄대왕');
      expect(ch5.title).toBe('영원한 고립의 지배자');
      expect(ch5.anxiety).toBe('고립과 결핍에 대한 두려움');
      expect(ch5.anxietyQuote).toBe('결국 아무도 내 곁에 없어. 난 영원히 혼자 남겨질 거야.');
      expect(ch5.mathDomain).toBe('전 영역 종합');
      expect(ch5.musicGenre).toBe('고딕 에픽 메탈');
      expect(ch5.handInstrument).toBe('파이프 오르간');
      expect(ch5.footInstrument).toBe('트윈 베이스 드럼');
      expect(ch5.baseHp).toBe(20);
      expect(ch5.themeColor).toBe('#FF4444');
    });
  });

  describe('getBossByChapter 함수 검증', () => {
    it('1~5 챕터에 대해 해당하는 보스 메타데이터를 올바르게 반환해야 한다', () => {
      for (let ch = 1; ch <= 5; ch++) {
        const boss: BossMetadata = getBossByChapter(ch);
        expect(boss.chapter).toBe(ch);
        expect(boss.name).toBeTruthy();
        expect(boss.musicGenre).toBeTruthy();
        expect(boss.handInstrument).toBeTruthy();
        expect(boss.footInstrument).toBeTruthy();
        expect(boss.mathDomain).toBeTruthy();
        expect(boss.anxiety).toBeTruthy();
      }
    });

    it('범위를 벗어난 챕터 번호는 예외를 발생시켜야 한다', () => {
      expect(() => getBossByChapter(0)).toThrow();
      expect(() => getBossByChapter(6)).toThrow();
      expect(() => getBossByChapter(-1)).toThrow();
      expect(() => getBossByChapter(1.5)).toThrow();
    });
  });

  describe('getBossName 함수 검증', () => {
    it('1~5 챕터의 신규 정본 보스명을 정확히 반환해야 한다', () => {
      expect(getBossName(1)).toBe('하얘시니');
      expect(getBossName(2)).toBe('재촉새');
      expect(getBossName(3)).toBe('따돌시니');
      expect(getBossName(4)).toBe('풀죽새');
      expect(getBossName(5)).toBe('캄캄대왕');
    });

    it('범위를 벗어난 챕터에 대해서는 빈 문자열을 반환하여 안전하게 대체 가능해야 한다', () => {
      expect(getBossName(0)).toBe('');
      expect(getBossName(6)).toBe('');
      expect(getBossName(-1)).toBe('');
    });
  });

  describe('getAllBosses 함수 검증', () => {
    it('5개의 보스 데이터가 챕터 순으로 정렬된 배열로 반환되어야 한다', () => {
      const bosses = getAllBosses();
      expect(bosses).toHaveLength(5);
      expect(bosses.map((b) => b.chapter)).toEqual([1, 2, 3, 4, 5]);
      expect(bosses.map((b) => b.name)).toEqual([
        '하얘시니',
        '재촉새',
        '따돌시니',
        '풀죽새',
        '캄캄대왕',
      ]);
    });
  });

  describe('src/data/index.ts 배럴 재수출 검증', () => {
    it('src/data/index에서 모든 보스 관련 상수와 함수를 재수출해야 한다', () => {
      expect(DataIndex.BOSS_REGISTRY).toBeDefined();
      expect(typeof DataIndex.getBossByChapter).toBe('function');
      expect(typeof DataIndex.getBossName).toBe('function');
      expect(typeof DataIndex.getAllBosses).toBe('function');
    });
  });
});
