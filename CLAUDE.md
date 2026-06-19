# Calendar Layout Recapper (Recapper)

지난 한 달 사진을 EXIF 날짜로 캘린더 그리드에 자동 배치하고 **JPG 한 장으로 추출**하는 모바일-우선 웹앱. 완전 로컬(서버 업로드 없음), **영속성 없음**(새로고침 시 데이터 소실).

전체 구현(화면/플로우/토큰/데이터모델)은 **`docs/PROJECT_BRIEF.md`** 참고(AS-IS 기준).

## 명령어

- `npm run dev` — 개발 서버
- `npm run build` — `tsc -b && vite build`(타입체크 포함)
- `npm run lint` — ESLint
- **변경 후 반드시** `npx tsc -b`(또는 `npm run build`)와 `npm run lint`로 검증.

## 규칙 (중요)

- **코드 주석·설명·문서는 한국어, UI 문구만 영어.**
- 모노톤 **"print-proof"** 무드: 무채색 회색 종이 + 잉크 블랙, 색은 사진에만. 컨테이너는 직각, 눌리는 요소만 `rounded-pill`. 화면 색/라운드 토큰은 `tailwind.config.js`(`paper`/`ink`/`muted`/`pill`), 캘린더 카드 토큰은 `src/lib/theme.ts`(`CARD_THEMES`).
- 에러/확인 UI는 `window.alert`/`confirm` **금지** — 인앱 `useDialog`/`useToast` 사용.
- 오버레이(모달/시트)는 **`ModalShell`** 로 — 정렬(모바일 하단 slide-up / 데스크탑 중앙 fade)·Esc·포커스 통일.
- 기능/UX 변경은 곧장 구현하지 말고 먼저 트레이드오프를 정리해 제안·합의 후 진행(단순 수정·버그픽스·리팩토링은 바로 진행 OK).

## 핵심 동작

- 기본 표시 달 = **"지난달"**(오늘 − 1개월).
- **한 날짜엔 사진 1장만 저장.** 한 날짜에 후보가 여럿 → `ConflictModal`에서 선택, 안 고른 건 풀에서 제거(blob revoke).
- **Dump more(에디터 재업로드)**: 현재 달 **고정**(자동 월 전환 안 함) + `buildAssignment("rebuild")`로 **재충돌**. 그 칸에 있던 사진(촬영일 무관)을 그 칸 후보로 합류시켜, 2장 이상이면 ConflictModal을 다시 띄운다. **기준 플로우 2가지는 `docs/PROJECT_BRIEF.md` §3-3 참고**(회귀 방지 기준).
- 4:3(가로형) 캔버스: 풋터(RECAPPER+연도) 생략 + 헤더·요일 밴드 압축.

## 주요 파일

- `src/App.tsx` — 진입 분기(`inEditor`) + 화면 조립 + upload/export 연결
- `src/store.ts` — Zustand + `buildAssignment`(keep/rebuild) + `suggestMostRecentMonth`/`listPhotoMonths`
- `src/components/Calendar.tsx` — 캔버스(헤더/요일/그리드/풋터)
- `src/lib/` — `photos`(EXIF+lastModified 폴백), `export`(toJpeg+Web Share), `useDragPhoto`, `usePhotoUpload`, `dialog`, `toast`, `theme`, `calendar`, `date`
