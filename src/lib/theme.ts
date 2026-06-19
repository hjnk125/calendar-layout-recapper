import type { Ratio } from "../types";

// ── 출력 교정쇄(print-proof) 팔레트 ─────────────────────────────────────────
// 모노톤 "출력 교정쇄" 무드(Direction A). 무채색 밝은 회색 종이 + 잉크 블랙만
// 쓰고, 색은 사진 그 자체에만 둔다. 화면 색·라운드(paper·ink·muted·rounded-pill)
// 는 Tailwind 토큰으로 관리하고, 여기서는 JS에서 직접 참조해야 하는 잉크색만
// 노출한다(PrintFrame의 SVG stroke).
export const INK = "#1A1A1A";

// ── 캘린더 테마 ──────────────────────────────────────────────────────────
// 색 선택은 사라졌다 — 남은 스타일 축은 비율과 White/Black 종이 뒤집기뿐.
// 사진은 그대로 두고, 종이만 반전된다.
export type CalendarTheme = "white" | "black";

export type CardTokens = {
  paper: string; // 카드 / 밴드 배경
  headerInk: string; // 월 이름·숫자·요일 라벨·RECAP/연도
  line: string; // 헤어라인 선 색
  dayInk: string; // 날짜 숫자색 — 사진 유무·주말 무관 공통
  photoInkStroke: string; // 사진 위 숫자의 외곽선(-webkit-text-stroke) — 글자색의 반대색
};

export const CARD_THEMES: Record<CalendarTheme, CardTokens> = {
  white: {
    paper: "#FFFFFF",
    headerInk: "#1A1A1A",
    line: "#2A2420",
    dayInk: "#1A1A1A", // 검정 글자
    photoInkStroke: "0.22cqw #FBF7EE", // 반대색(밝은) 외곽선
  },
  black: {
    paper: "#1A1A1A",
    headerInk: "#F2EFE6",
    line: "rgba(242,239,230,0.42)",
    dayInk: "#E8E5DD", // 밝은 글자
    photoInkStroke: "0.22cqw #1A1A1A", // 반대색(검정) 외곽선
  },
};

// ── 비율 메타데이터 ──────────────────────────────────────────────────────
// 비율은 독립 컨트롤(StyleControls의 칩 행)이다. 세로형 → 정사각 → 가로형
// 순으로 노출한다. 4:3은 유일한 가로형.
export const RATIO_ORDER: Ratio[] = ["4:5", "1:1", "9:16", "3:4", "4:3"];

// ── 샘플 채움 ────────────────────────────────────────────────────────────
// 온보딩 화면의 SAMPLE recap을 채우는 납작한 필름톤 그라데이션들. 처음 온
// 사용자가 0초에 결과물을 상상할 수 있게 실제 사진을 대신하며, 저장 시엔
// 절대 포함되지 않는다.
export const SAMPLE_FILM = [
  "linear-gradient(150deg,#C77F4E,#E3AE73)",
  "linear-gradient(150deg,#5E7E6B,#93AE90)",
  "linear-gradient(160deg,#3D5A74,#7C9DB6)",
  "linear-gradient(150deg,#CE7E6E,#E6B19E)",
  "linear-gradient(150deg,#A8612A,#D29A57)",
  "linear-gradient(150deg,#7C7A52,#A8A876)",
  "linear-gradient(150deg,#B5526A,#DD8C9E)",
  "linear-gradient(160deg,#475C6B,#8BA0AB)",
  "linear-gradient(150deg,#D69A4E,#EAC07E)",
  "linear-gradient(150deg,#6B5E7E,#9D90AE)",
  "linear-gradient(150deg,#BF6B4A,#E0997A)",
  "linear-gradient(160deg,#566F5A,#8FA886)",
];

// 일(day) → 샘플 필름 인덱스. 디자인의 pmMain 맵을 그대로 옮겨, 샘플 recap이
// 적당히 사진이 많은 달처럼 보이게 한다.
export const SAMPLE_PHOTO_MAP: Record<number, number> = {
  1: 2, 3: 5, 4: 0, 6: 8, 7: 3, 9: 1, 10: 4, 12: 9, 13: 6, 15: 2,
  16: 7, 18: 0, 20: 10, 21: 5, 23: 3, 24: 8, 26: 1, 28: 6, 29: 11, 31: 2,
};
