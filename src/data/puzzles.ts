export interface Puzzle {
  roomNumber: number;
  title: string;
  image: string;
  dialogue: string;
  question: string;
  formatGuide: string;
  answer: string;
  hints: string[];
}

export const PUZZLES: Puzzle[] = [
  {
    roomNumber: 1,
    title: "사건의 발단",
    image: "/images/q1.png",
    dialogue: "이봐, 한가한 소리를 할 때가 아니야.\n살인사건이 나버렸다고!\n지금 당장 도움이 필요해.\n와줄 수 있지?",
    question: "시공간 어플리케이션의 암호는?",
    formatGuide: "영어 대문자 6자리",
    answer: "LETSGO",
    hints: [
      "선이 그려지지 않은 빈 공간들을 따라 선을 연결해 보면 어떤 문자가 나타날거야.",
      "첫 번째 문자는 L, 두 번째 문자는 E야.",
      "💡 암호 형식: 영어 대문자 6자리",
      "🔑 정답 공개: LETSGO"
    ]
  },
  {
    roomNumber: 2,
    title: "탐정의 시험",
    image: "/images/q2.png",
    dialogue: "오늘은 친히 내가 탐정을 해주지.\n너는 탐정 조수로서 날 도와야해.\n탐정 조수도 어려운 직업이라고?\n이정도 문제는 기본이겠지?",
    question: "탐정이 내민 문제의 답은?",
    formatGuide: "숫자 4자리",
    answer: "0402",
    hints: [
      "편지 본문의 글자들 중에 숫자를 나타내는 한국어 발음이 숨겨져 있어.",
      "'공정성'의 '공', '사건'의 '사' 등 숫자를 읽는 소리에 주목해서 순서대로 조합해봐.",
      "💡 암호 형식: 숫자 4자리",
      "🔑 정답 공개: 0402"
    ]
  },
  {
    roomNumber: 3,
    title: "첫 번째 사건 현장",
    image: "/images/q3.png",
    dialogue: "뭐, 이정도는 풀 줄 알았어.\n여긴 첫번째 사건 현장이야.\n누군가 증거인멸을 해놓은 것 같군.\n그러나 힌트가 있을 거야.",
    question: "자세히 보면 무언가 보이는 것 같다. 무엇일까?",
    formatGuide: "영어 대문자 6자리",
    answer: "CEREAL",
    hints: [
      "적힌 숫자들은 알파벳 순서 번호(A=1, B=2, ...)와 관련이 있어.",
      "26보다 큰 숫자는 알파벳 Z(26)를 지나서 다시 A(27)부터 한 바퀴 돌려 세어봐. (예: 31 = 26 + 5 = E)",
      "💡 암호 형식: 영어 대문자 6자리",
      "🔑 정답 공개: CEREAL"
    ]
  },
  {
    roomNumber: 4,
    title: "들판의 목격자",
    image: "/images/q4.png",
    dialogue: "시리얼? 웬 시리얼이 있지?\n흠, 사건이 미궁으로 흐르는군.\n두번째 현장은 이 들판이야.\n근데 누군가 소리치고 있잖아?",
    question: "소리치는 사람이 누구인가?",
    formatGuide: "영어 대문자 4자리",
    answer: "LAND",
    hints: [
      "외치는 말풍선 안의 기호들은 위쪽 우물 정(井) 모양 격자의 특정 칸 테두리 모양과 일치해.",
      "테두리 선의 모양이랑 점(•)의 유무를 확인해서 격자 속 알파벳과 하나씩 매칭해봐.",
      "💡 암호 형식: 영어 대문자 4자리",
      "🔑 정답 공개: LAND"
    ]
  },
  {
    roomNumber: 5,
    title: "범행 동기",
    image: "/images/q5.png",
    dialogue: "랜드씨의 증언으로 용의자를 추렸어.\n이 근처 영농후계자 녀석이군.\n하지만, 왜 그랬는지가 문제란 말이야.\n추리의 기본은 'Why Done it' 아니겠어?",
    question: "왜 그런 짓을 벌인걸까?",
    formatGuide: "영어 대문자 4자리",
    answer: "ENVY",
    hints: [
      "각 칸에 흩어져 있는 '동일한 색상의 선'들을 한곳에 모아서 겹쳐봐.",
      "아래쪽 색상 힌트 순서(파랑 -> 주황 -> 초록 -> 보라)대로 만들어진 알파벳을 조합해봐.",
      "💡 암호 형식: 영어 대문자 4자리",
      "🔑 정답 공개: ENVY"
    ]
  },
  {
    roomNumber: 6,
    title: "잊어버린 본분",
    image: "/images/q6.png",
    dialogue: "이봐, 질투 때문이라고?\n질투가 형제를 죽일 정도란 말이야?\n너에겐 원래의 역할이 있었잖아!\n왜 그걸 잊어버린 거지?",
    question: "원래 그의 역할은 무엇이었을까?",
    formatGuide: "영어 대문자 6자리",
    answer: "KEEPER",
    hints: [
      "화살표(>)의 개수는 알파벳을 알파벳 순서상 몇 칸 이전으로 되돌릴지를 나타내.",
      "D에서 2칸 앞으로 가면 B(D>>B), S에서 1칸 앞으로 가면 R(S>R)이 돼. NHHSHU는 3칸씩 되돌려봐.",
      "💡 암호 형식: 영어 대문자 6자리",
      "🔑 정답 공개: KEEPER"
    ]
  },
  {
    roomNumber: 7,
    title: "처벌 수위",
    image: "/images/q7.png",
    dialogue: "잡았어. 범인의 이름은 가인.\n원래 그 동생을 지켜야하는 자(Keeper)야.\n응? 처벌을 해야하는 거 아니냐고? 물론 그렇지.\n근데 원래 이런 건, 잡는 것보다\n처벌 수위가 문제란 말이야.",
    question: "그의 처벌 수위는 무엇일까?",
    formatGuide: "숫자 6자리",
    answer: "201657",
    hints: [
      "같은 색깔의 화살표들을 묶어봐. 각 색상마다 화살표의 크기가 서로 다를 거야.",
      "같은 색 화살표를 '가장 큰 것부터 작은 것 순서'로 방향대로 선을 이어 그리면 숫자가 나타날 거야.",
      "💡 암호 형식: 숫자 6자리",
      "🔑 정답 공개: 201657"
    ]
  },
  {
    roomNumber: 8,
    title: "주머니 속 단서",
    image: "/images/q8.png",
    dialogue: "징역 201657년 급의 저주로군!\n이거 봐. 피의자가 벌써 두려워하는군.\n어쩔 수 없지. 이걸 가져다 주라고.",
    question: "탐정이 가져다 주라고 한 물건은?",
    formatGuide: "영어 대문자 4자리",
    answer: "MARK",
    hints: [
      "주머니 속 동물들의 영어 이름(원숭이=MONKEY, 고양이=CAT, 호랑이=TIGER, 상어=SHARK)을 적어봐.",
      "동물 얼굴 중 색이 칠해진 것이 몇 개인지 세어보고, 영어 단어의 해당 위치 알파벳을 찾아봐.",
      "💡 암호 형식: 영어 대문자 4자리",
      "🔑 정답 공개: MARK"
    ]
  },
  {
    roomNumber: 9,
    title: "살인자를 지켜주는 표",
    image: "/images/q9.png",
    dialogue: "이게 뭐냐고? 아, '표(mark)'라는 거야.\n이게 있으면 가인을 아무도 죽일 수 없지.\n응? 왜 살인자를 봐주냐고?\n...아, 엄밀히 말하면 봐주는 건 아니지만.",
    question: "왜 살인자를 봐주는 걸까?",
    formatGuide: "숫자 4자리",
    answer: "1224",
    hints: [
      "파란 점을 피해서 선을 연결해봐.",
      "선은 대각선으로 그어야 하고, 파란 점이 없는 칸은 선을 그을 수 없어.",
      "💡 암호 형식: 숫자 4자리",
      "🔑 정답 공개: 1224"
    ]
  },
  {
    roomNumber: 10,
    title: "탐정의 정체",
    image: "/images/q10.png",
    dialogue: "그래. 히브리서 12장 24절.\n아벨의 피는 '고소하는 피'이지만,\n어떤 피는 '더 나은 일'을 하기도 하거든.\n지금처럼 죄를 '덮어주는 피' 말이야.\n올해도 수고했어. 탐정 조수.\n아, '내 이름'이 뭔지는 이미 눈치챘지?",
    question: "탐정의 진짜 이름은?",
    formatGuide: "영어 대문자 5자리",
    answer: "JESUS",
    hints: [
      "탐정의 마지막 멘트('내 이름이 뭔지는 이미 눈치챘지?')와 히브리서 말씀을 주목해봐.",
      "숫자 1은 지나갈 수 없는 벽이야. 0으로만 이루어진 길을 따라 선을 그어봐.",
      "💡 암호 형식: 영어 대문자 5자리",
      "🔑 정답 공개: JESUS"
    ]
  }
];
