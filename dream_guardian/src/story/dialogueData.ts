/**
 * dialogueData.ts - 5대 보스 및 깨비 스토리 대사 & ADHD 심리 치유 스크립트 데이터
 *
 * 절대 원칙:
 * 1. 오답 시 보스는 직접 대사 없이 침묵/미소 유지 (보스 오답 대사 원천 등록 금지)
 * 2. 깨비는 언제나 친근하고 다정한 "우리" 어조로 즉각 지지
 * 3. ADHD 아동 5대 방어 기제(화냄, 버팀, 성급한 찍기, 반발, 딴청) 대응 치유 스크립트 외부화
 *
 * @see Issue #218 (STORY-DATA-001)
 * @see docs/04_STORY_SOURCE.md (제7장 5대 보스별 대사, 제9장 9.1~9.2절)
 */

import type {
  StoryDialogueData,
  BossDialogueConfig,
  KkebiDialogueConfig,
  ADHDDefenseType,
} from '../types/story.js';

export const BOSS_DIALOGUE_DATA: Readonly<Record<number, BossDialogueConfig>> = Object.freeze({
  1: Object.freeze({
    bossId: 'haeyesini',
    bossName: '하얘시니',
    chapter: 1,
    battleStart: Object.freeze([
      '어서 오거라. 이 깊은 안개 속에서는 애써 기억하려 애쓰지 않아도 되느니라.',
    ]),
    answerCorrect: Object.freeze([
      '오... 제법이구나. 허나 한 번 맞혔다 하여 이 안개가 다 걷힐 것 같으냐?',
    ]),
    consecutiveCorrect: Object.freeze([
      '어째서 망설이지 않는 게냐... 틀릴 수도 있다는 생각이 들지 않는 것이냐?',
      '실수란 언제든 다시 발을 걸어오는 법이니라. 그때도 그리 덤덤할 수 있겠느냐?',
    ]),
    bossCollapseSoon: Object.freeze([
      '틀리는 것이... 부끄러운 일이 아니란 말이냐... 가슴의 고동이 안개를 찢고 있구나...',
    ]),
    bossPurified: Object.freeze([
      '두려움을 털어내 주어... 참으로 고맙구나...',
    ]),
  }),
  2: Object.freeze({
    bossId: 'jaechoksae',
    bossName: '재촉새',
    chapter: 2,
    battleStart: Object.freeze([
      '째깍, 째깍. 시간은 결코 머뭇거리는 자를 기다려주지 않는 법이니라.',
    ]),
    answerCorrect: Object.freeze([
      '맞히긴 하였구나. 허나 그 속도로 세상의 흐름을 따라잡을 수 있겠느냐?',
    ]),
    consecutiveCorrect: Object.freeze([
      '어째서 조급해하지 않는 게냐... 느긋한 걸음으로 끝까지 가겠다는 것이냐?',
      '서두르지 않는 자는 도태된다 일렀거늘... 어찌 네 박자는 흐트러짐이 없느냐...',
    ]),
    bossCollapseSoon: Object.freeze([
      '째깍... 째깍...... 시계가... 멈추는구나... 나만의 박자가 따로 있었단 말인가...',
    ]),
    bossPurified: Object.freeze([
      '숨 가쁜 굴레에서 날 쉬게 해 주어... 고맙구나...',
    ]),
  }),
  3: Object.freeze({
    bossId: 'ttadolsini',
    bossName: '따돌시니',
    chapter: 3,
    battleStart: Object.freeze([
      '어찌하여 들어왔느냐. 이곳은 모난 곳 없이 꼭 들어맞는 조각들만의 성역이니라.',
    ]),
    answerCorrect: Object.freeze([
      '답을 내긴 하였구나. 허나 네 방식이 다른 누군가와 같다고 생각하느냐?',
    ]),
    consecutiveCorrect: Object.freeze([
      '홀로 맞힌다 하여 어울릴 수 있다 믿느냐... 어째서 그 소리가 외롭지 않은 것이냐?',
      '모난 조각들이 모였을 뿐인데... 어찌하여 저리도 웅장한 화음이 울려 퍼진단 말이냐...',
    ]),
    bossCollapseSoon: Object.freeze([
      '다름은... 틀린 것이 아니었구나... 서로 다른 조각이 모여 비로소 하나가 되는 것을...',
    ]),
    bossPurified: Object.freeze([
      '어울리지 못하던 내 슬픔을 안아주어... 참으로 고맙구나...',
    ]),
  }),
  4: Object.freeze({
    bossId: 'puljuksae',
    bossName: '풀죽새',
    chapter: 4,
    battleStart: Object.freeze([
      '애쓰지 말거라. 날개를 접고 바닥에 엎드리면 모든 것이 편안해지느니라.',
    ]),
    answerCorrect: Object.freeze([
      '한 번 해냈다 하여 달라질 것이 있겠느냐. 작은 숫자 하나 맞힌 것뿐이니라.',
    ]),
    consecutiveCorrect: Object.freeze([
      '하찮은 날갯짓이라 여겼거늘... 어찌하여 저 발걸음은 멈추지 않는 것이냐?',
      '0.1의 작은 조각들이 모여... 어찌 이 거대한 어둠을 떠받칠 수 있단 말이냐...',
    ]),
    bossCollapseSoon: Object.freeze([
      '온몸이... 들썩이는구나... 주저앉았던 마음에 다시 박동이 차오르다니...',
    ]),
    bossPurified: Object.freeze([
      '가라앉아 있던 날개를 다시 띄워주어... 고맙구나...',
    ]),
  }),
  5: Object.freeze({
    bossId: 'kamkamdaewang',
    bossName: '캄캄대왕',
    chapter: 5,
    battleStart: Object.freeze([
      '마침내 이곳까지 왔구나. 허나 이 적막 속에서는 모든 소리가 흩어지느니라. 고요 속에서 홀로 남아 보거라.',
    ]),
    answerCorrect: Object.freeze([
      '벽을 하나 허물었구나. 허나 그 곁의 작은 온기가 언제까지 네 곁에 머물 것 같으냐?',
    ]),
    consecutiveCorrect: Object.freeze([
      '아침이 오면 모두 흩어질 인연이라 여겼거늘... 어찌하여 저리도 서로를 굳게 붙들고 있느냐?',
      '이 완전한 고요의 궁전에... 어찌하여 저토록 찬란한 합주가 메아리친단 말이냐!',
    ]),
    bossCollapseSoon: Object.freeze([
      '외로움이란... 홀로 있어서가 아니라, 내 안의 고동을 잊었기 때문이었구나...',
    ]),
    bossPurified: Object.freeze([
      '오랜 시간 잊고 있던 내 안의 소리를 들려주어... 참으로 고맙구나...',
    ]),
  }),
});

export const KKEBI_DIALOGUE_DATA: Readonly<Record<number, KkebiDialogueConfig>> = Object.freeze({
  1: Object.freeze({
    chapter: 1,
    answerWrong: Object.freeze([
      '앗, 안개가 눈을 살짝 가렸나 봐! 괜찮아, 눈 한번 껌뻑이고 다시 보자!',
    ]),
    consecutiveWrong: Object.freeze([
      '에헤헤, 나도 도깨비불 켤 때 세 번이나 헛발질했는걸! 한 번 더!',
    ]),
  }),
  2: Object.freeze({
    chapter: 2,
    answerWrong: Object.freeze([
      '마음이 먼저 달려나갔지? 괜찮아! 한 박자만 후~ 쉬고 다시 보자.',
    ]),
    consecutiveWrong: Object.freeze([
      '저 시계 소리는 가짜야! 우리 박자는 우리 발이 정하는 거야, 주인아!',
    ]),
  }),
  3: Object.freeze({
    chapter: 3,
    answerWrong: Object.freeze([
      '에이, 모양이 조금 안 맞았을 뿐이야! 나랑 같이 다시 맞춰보자!',
    ]),
    consecutiveWrong: Object.freeze([
      '나도 뿔 달린 특별한 반려동물이잖아! 세상에 똑같은 건 없어, 다른 게 멋진 거야!',
    ]),
  }),
  4: Object.freeze({
    chapter: 4,
    answerWrong: Object.freeze([
      '못하는 게 아니야, 아직 길을 안 가본 것뿐이야! 한 걸음만 더 가보자!',
    ]),
    consecutiveWrong: Object.freeze([
      '내 뿔도 처음엔 작은 콩알이었어! 작은 것도 매일 자라면 커지는 거야, 주인아!',
    ]),
  }),
  5: Object.freeze({
    chapter: 5,
    answerWrong: Object.freeze([
      '주인아, 내가 바로 네 옆에 있어! 캄캄해도 내 뿔빛이 보이지? 딱 붙어 있을게!',
    ]),
    consecutiveWrong: Object.freeze([
      '네가 안 보고 있는 동안에도 나는 늘 네 곁에 있었어. 어디 안 가, 절대 안 가!',
      '내 불이 작아져도 네 심장은 힘차게 뛰고 있어! 그 소리가 들리는 한 난 영원히 네 편이야!',
    ]),
  }),
});

export const ADHD_DEFENSE_DATA: Readonly<Record<ADHDDefenseType, string>> = Object.freeze({
  anger: '화가 날 만큼 잘해내고 싶었던 거지? 그 멋진 마음, 내가 다 알아! 한 번 더 가보자!',
  give_up: '그래, 잠깐 숨 좀 돌리자! 내가 여기서 도깨비불 딱 지키고 있을 테니까 쉬다 와!',
  rush_guess: '잠깐만~ 한 박자만 후! 숨 쉬고 보자. 급하게 치면 기타줄 끊어지거든, 에헤헤.',
  defiance: '네 생각이 틀린 게 아니야! 그냥 다른 길을 먼저 걸어본 거지. 이번엔 이쪽 길도 같이 가볼래?',
  distraction: '우와, 저 녀석 덩치가 좀 커 보이네? 나도 조금 무섭다! 그러니까 우리 둘이 힘 합쳐서 쳐보자!',
});

export const STORY_DIALOGUE_DATA: Readonly<StoryDialogueData> = Object.freeze({
  bosses: BOSS_DIALOGUE_DATA,
  kkebi: KKEBI_DIALOGUE_DATA,
  adhdDefense: ADHD_DEFENSE_DATA,
});
