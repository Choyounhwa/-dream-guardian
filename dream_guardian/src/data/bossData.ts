/**
 * bossData.ts - 5대 불안 보스 메타데이터 단일 소스
 *
 * 신규 스토리(04_STORY_SOURCE.md)의 5대 요괴 보스(하얘시니, 재촉새, 따돌시니, 풀죽새, 캄캄대왕)의
 * 메타데이터(수학 영역, 음악 장르, 악기 매핑, HP, 테마 색상, 불안 인용구)를 일원화 관리합니다.
 *
 * @see Issue #215 (DATA-BOSS-001)
 */

export interface BossMetadata {
  readonly id: string;
  readonly chapter: number;
  readonly name: string;
  readonly title: string;
  readonly anxiety: string;
  readonly anxietyQuote: string;
  readonly mathDomain: string;
  readonly musicGenre: string;
  readonly handInstrument: string;
  readonly footInstrument: string;
  readonly baseHp: number;
  readonly themeColor: string;
}

export const BOSS_REGISTRY: Readonly<Record<number, BossMetadata>> = Object.freeze({
  1: Object.freeze({
    id: 'haeyesini',
    chapter: 1,
    name: '하얘시니',
    title: '망각의 요괴',
    anxiety: '실수와 실망에 대한 두려움',
    anxietyQuote: '틀리면 어떡하지? 다들 실망할 텐데…',
    mathDomain: '덧셈과 뺄셈',
    musicGenre: '하드 록 / 팝 펑크',
    handInstrument: '일렉 기타',
    footInstrument: '록 드럼',
    baseHp: 10,
    themeColor: '#4DFFAA',
  }),
  2: Object.freeze({
    id: 'jaechoksae',
    chapter: 2,
    name: '재촉새',
    title: '성급의 요괴',
    anxiety: '시간 압박에 대한 두려움',
    anxietyQuote: '빨리 해야 해! 늦으면 뒤처질 거야!',
    mathDomain: '곱셈과 나눗셈',
    musicGenre: '업템포 EDM / 유로비트',
    handInstrument: '신스 리드',
    footInstrument: '808 전자 비트',
    baseHp: 10,
    themeColor: '#28E6FF',
  }),
  3: Object.freeze({
    id: 'ttadolsini',
    chapter: 3,
    name: '따돌시니',
    title: '왜곡의 요괴',
    anxiety: '친구의 거절에 대한 두려움',
    anxietyQuote: '나만 다른 조각일까 봐 두려워. 어울리지 못하면 어쩌지?',
    mathDomain: '분수',
    musicGenre: '네오 클래시컬 심포니',
    handInstrument: '그랜드 피아노',
    footInstrument: '오케스트라 팀파니',
    baseHp: 10,
    themeColor: '#FFCB4D',
  }),
  4: Object.freeze({
    id: 'puljuksae',
    chapter: 4,
    name: '풀죽새',
    title: '무기력의 요괴',
    anxiety: '무시당하기에 대한 두려움',
    anxietyQuote: '넌 왜 이것도 못하니? ...그냥 다 그만둘래.',
    mathDomain: '소수',
    musicGenre: '디스코 펑크',
    handInstrument: '슬랩 베이스',
    footInstrument: '펑크 찹 & 퍼커션',
    baseHp: 10,
    themeColor: '#C889FF',
  }),
  5: Object.freeze({
    id: 'kamkamdaewang',
    chapter: 5,
    name: '캄캄대왕',
    title: '영원한 고립의 지배자',
    anxiety: '고립과 결핍에 대한 두려움',
    anxietyQuote: '결국 아무도 내 곁에 없어. 난 영원히 혼자 남겨질 거야.',
    mathDomain: '전 영역 종합',
    musicGenre: '고딕 에픽 메탈',
    handInstrument: '파이프 오르간',
    footInstrument: '트윈 베이스 드럼',
    baseHp: 20,
    themeColor: '#FF4444',
  }),
});

const ALL_BOSSES: readonly BossMetadata[] = Object.freeze(
  [1, 2, 3, 4, 5].map((ch) => BOSS_REGISTRY[ch])
);

/**
 * 챕터 번호로 보스 메타데이터를 조회합니다.
 * @param chapter 1~5 정수
 * @throws 챕터가 1~5 범위를 벗어날 경우 Error
 */
export function getBossByChapter(chapter: number): BossMetadata {
  const boss = BOSS_REGISTRY[chapter];
  if (!boss) {
    throw new Error(`[BossData] 유효하지 않은 챕터 번호: ${chapter} (1~5 허용)`);
  }
  return boss;
}

/**
 * 챕터 번호로 보스 이름을 조회합니다. (1-indexed 배열 대체용 안전 접근자)
 * 범위를 벗어난 경우 빈 문자열('')을 반환합니다.
 */
export function getBossName(chapter: number): string {
  return BOSS_REGISTRY[chapter]?.name ?? '';
}

/**
 * 전체 5대 보스 메타데이터 목록을 챕터 순서대로 반환합니다.
 */
export function getAllBosses(): readonly BossMetadata[] {
  return ALL_BOSSES;
}
