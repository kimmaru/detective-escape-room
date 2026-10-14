import { ReviewData } from "./pins";

export const SEED_REVIEWS: Array<ReviewData & { pin: string }> = [
  {
    pin: "2YVNFT",
    name: "전탐정",
    content: "웹 사이트 만들 수 있는 선생님이 있어 아주 감사해욬ㅋㅋㅋㅋㅋ",
    photo: null,
    createdAt: 1791953890000,
  },
  {
    pin: "FAST_TEST",
    name: "50KB 테스트",
    content: "50KB 사진 압축 테스트입니다.",
    photo: "https://lh3.googleusercontent.com/d/1758tlCte1zJDd_vrokeSifI3p2spdAXp",
    createdAt: 1791899008000,
  },
  {
    pin: "BIG_IMG",
    name: "큰 사진 테스트",
    content: "300KB 사진 테스트입니다.",
    photo: "https://lh3.googleusercontent.com/d/1V_SjsNRj_5CyMhHXW2akzt9px3feSh51",
    createdAt: 1791898973000,
  },
  {
    pin: "IMG_TEST",
    name: "사진 테스트",
    content: "작은 사진 테스트입니다.",
    photo: "https://lh3.googleusercontent.com/d/1ZG7zXe5uye4wVhS75L2MMGZK1GOLRt1-",
    createdAt: 1791898948000,
  },
  {
    pin: "TEST12",
    name: "노드 테스트",
    content: "구글 시트 연동 테스트입니다.",
    photo: null,
    createdAt: 1791898053000,
  },
  {
    pin: "TEST_PIN",
    name: "시스템 연동 테스트",
    content: "구글 스프레드시트 및 드라이브 연동이 정상 작동합니다!",
    photo: null,
    createdAt: 1791898040000,
  },
];
