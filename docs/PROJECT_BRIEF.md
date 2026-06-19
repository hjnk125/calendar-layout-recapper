# 📷 Calendar Layout Recapper — 지난달의 사진을, 한 장으로

> **이 문서는 현재 구현 상태(AS-IS)를 그대로 기술한 브리프입니다.**
> "원래 기획"이 아니라 "지금 코드가 실제로 하는 일"을 기준으로 작성했습니다.

---

## 1. 한 줄 정의

지난 한 달간 찍은 사진들을 여러 장 업로드하면 → EXIF 날짜로 자동 분류 → **캘린더 그리드 위에 날짜별로 배치** → 비율/테마 골라 **JPG 한 장으로 추출**하는 웹 도구.

- **이름**: Calendar Layout Recapper (줄여서 **Recapper**)
- **태그라인**: Last month, in one frame. (지난달의 사진을, 한 장으로)
- **핵심 정체성**: "캘린더 레이아웃 = 사진 배치 틀". 날짜가 곧 레이아웃이 되는 게 차별점.
- **무드**: 모노톤 "출력 교정쇄(print-proof)" — 무채색 회색 종이 + 잉크 블랙, 색은 사진에만. 캔버스 둘레에 등록/크롭 마크.
- **플랫폼**: 모바일 우선 (데스크탑은 콘텐츠 폭 `max-w-[460px]` 중앙 정렬).
- **로그인 없음 / 완전 로컬**: 사진은 서버로 안 올라감. 브라우저 메모리에서만 처리.

> ⚠️ **영속성 없음**: 상태는 Zustand 인메모리 + `URL.createObjectURL` blob URL이라, **새로고침하면 업로드한 사진/배치가 전부 사라짐.** (localStorage/IndexedDB 저장 미구현) — 사진이 있을 때 `beforeunload` 가드로 실수 이탈만 경고(브라우저 기본 문구, 커스텀 불가).

> 📝 **UI 카피는 영어, 코드 주석/문서는 한국어** 가 이 저장소 규칙.

---

## 2. 기술 스택 (실제)

- **Vite 8 + React 19 + TypeScript**
- **Tailwind CSS 3.4** (모바일 우선)
- **Zustand 5** (상태관리, `src/store.ts`)
- **exifr** (EXIF 날짜 추출)
- **html-to-image** (`toJpeg`, quality 0.92로 JPG 추출)
- **date-fns** (월 그리드 계산, 요일, 날짜 포맷)
- **커스텀 폰트 "Akt"** — 자체 호스팅 **가변폰트**(`public/fonts/akt.woff2` + `.woff`, Latin 서브셋, weight 100–900). 외부 폰트 의존 없음(완전 로컬). 폴백은 시스템 산세리프.
- 바텀시트/모달은 **UI 라이브러리 안 씀** — 전부 손으로 만든 fixed 오버레이. 정렬·트랜지션은 **공용 `ModalShell`**(EditSheet·ConflictModal·WheelPicker·HowItWorksSheet 공유)로 통일: 모바일 하단 고정(`items-end`)·데스크탑 중앙(`sm:items-center`), 하단일 땐 slide-up / 중앙일 땐 fade, 백드롭 fade. 진입 rAF·종료 200ms 후 언마운트.

---

## 3. 화면 & 플로우 (실제 동작)

전부 단일 `App.tsx` 안에서 분기한다. 별도 라우팅/랜딩 화면 없음.

### 3-0. 진입 분기 (`App.tsx`)

```ts
const hasPhotos = Object.keys(uploadedPhotos).length > 0;
const inEditor  = hasPhotos || manualMode;   // manualMode = "직접 하나씩" 진입 플래그
```

- `inEditor === false` → **온보딩 화면**: 흐리게(opacity 0.42) 깔린 **SAMPLE 캘린더** 위에 오버레이.
- `inEditor === true` → **에디터 화면**: 실제 캘린더 + 월 네비게이션 + 컨트롤 + 하단 저장 바.
- 사진을 한 장이라도 올리거나(`hasPhotos`), "Or add them one by one"을 누르면(`manualMode`) 에디터로 전환. 이후 되돌아가는 경로는 없음(Clear All 해도 풀만 비고 에디터 유지).

### 3-1. 온보딩 화면 (`inEditor === false`)

```
   RECAPPER
   Last month,
   in one frame.            ← 마스트헤드 헤드라인

   ┌─[ 크롭마크 프레임 ]─┐
   │   SAMPLE 캘린더    │   ← 흐리게(0.42) + 필름톤 그라데이션 채움
   │  ┌──────────────┐ │
   │  │ + Drop your  │ │   ← 벌크 업로드 CTA (검은 pill)
   │  │   photos     │ │
   │  │ Or add one   │ │   ← 수동 진입 (밑줄 텍스트 버튼)
   │  └──────────────┘ │
   └────────────────────┘

   HOW IT WORKS
   1. Dump your photos — 날짜 자동 인식 후 해당 날에 배치
   2. Tap any empty day — 직접 사진 올리기(촬영일 무관)
   3. Nothing uploaded — 사진은 이 기기에만
```

- 오버레이는 `data-export-skip="true"` (저장 이미지엔 미포함).
- SAMPLE 캘린더는 `Calendar`에 `sample` prop을 줘서 칸을 필름톤 그라데이션으로 채운 것(클릭 불가).

### 3-2. 에디터 화면 (`inEditor === true`)

```
   RECAPPER        ‹  JUN 2026  ›   ← 마스트헤드: 좌 로고 / 우 월 네비
   ┌─[ 크롭마크 프레임 ]─┐
   │   실제 캘린더      │           ← #calendar-canvas = 저장될 JPG 미리보기
   └────────────────────┘
   RATIO  [4:5][1:1][9:16][3:4]
   THEME  [White][Black]
   WEEK   [Sun][Mon]
   [ Clear all ]
   ┌──────────────────────────┐
   │      Save · Share        │   ← 뷰포트 하단 고정 바(종이색 페이드)
   └──────────────────────────┘
```

- **월 네비**: `‹` / `›` 화살표(인라인 SVG, 다음 달은 `-scale-x-100` 미러) + 가운데 `JUN 2026` 탭 → **WheelPicker**.
- **사진 있는 칸** 탭 → **EditSheet**. **빈 칸** 탭 → 개별 파일 선택 다이얼로그(`openSinglePickerFor`).
- 하단 **Save · Share** 바: 저장 중엔 disabled. (`data-export-skip` 불필요 — 캔버스 밖 요소).

### 3-3. 벌크 업로드 + 자동 배치 (`usePhotoUpload.ts` + `store.ts`)

1. 여러 장 선택 → `loadAllSettled`(`Promise.allSettled`, 일부 실패해도 진행). 로딩 중엔 **진행 카운트**("Reading photos 12 / 40")가 오버레이에 표시되고, 실패 수는 인앱 다이얼로그로 알림.
2. EXIF에서 촬영일 추출. **EXIF 없으면 `file.lastModified`로 폴백**(스크린샷/다운로드 사진도 참여). 그래도 날짜가 없으면 **드롭**(`droppedCount`).
3. 사진은 **영속 풀(`uploadedPhotos`)** 에 쌓이고, `buildAssignment`가 현재 연/월 사진만 `entries`로 배치.
4. **한 날짜에 여러 장** 매칭 → `pendingConflicts`로 모아 **ConflictModal**에서 한 장 선택.
5. 현재 달에 매칭이 0이면 → `suggestMostRecentMonth`로 **풀에서 사진이 있는 가장 최근 달을 찾아, 묻지 않고 그 달로 자동 전환** + **토스트**("Showing May 2026 — your latest photos")로 전환 사실을 알림. (전환할 달도 없고 사진은 있으면 "사용 가능한 날짜 없음" 인앱 다이얼로그.)

> 풀이 영속이라 **월을 바꿔도 사진은 안 사라지고** `buildAssignment`가 그 달 기준으로 재배치함. 수동으로 핀한 칸은 같은 달 안에선 유지되고, 달을 바꾸면 날짜가 안 맞아 자연히 빠짐.

> **Dump more 재배치(rebuild 모드)**: 에디터에서 "Dump more"로 사진을 더 올리면, `buildAssignment`가 `"rebuild"` 모드로 현재 달을 다시 평가한다 — 기존 엔트리를 보존하지 않고 **그 칸에 있던 사진(촬영일 무관: 자동 배치·이전 충돌 선택·직접 올린 off-date 핀 모두)을 그 칸 후보로 합류**시켜, 한 날짜에 2장 이상이면 **ConflictModal을 다시 띄운다**(이전 1장 + 새로 올린 N장이 함께 표시). 후보가 1장뿐이면 자동 배치(같은 사진이면 위치 보존). 같은 사진이 "핀 날짜"와 "촬영일 칸"에 중복 배치되는 건 막는다. (월 이동 시엔 `"keep"` 모드라 재충돌 없음.)

#### Dump more 재충돌 — 기준 플로우 2가지

이 동작은 아래 두 시나리오를 만족해야 한다(회귀 방지용 기준).

**플로우 A — 같은 날짜 재충돌**
1. 첫 dump에서 5월 1일 사진 **3장** 올림.
2. 첫 ConflictModal에서 **1장 선택** → 나머지 2장은 풀에서 제거(각 날짜엔 사진 **1장만** 저장).
3. **Dump more**로 5월 1일 사진 **2장 더** 올림.
4. 두 번째 ConflictModal에 **먼저 고른 1장 + 새 2장 = 총 3장** 표시.

**플로우 B — off-date 핀 + 재충돌**
1. 빈 5월 1일 칸에 사진 **1장 직접** 올림(그 사진의 EXIF 날짜는 5월 1일이 **아님**).
2. **Dump more**로 5월 1일 사진 **3장 더** 올림(EXIF = 5월 1일).
3. ConflictModal에 **직접 올린 1장(EXIF 다름) + 새 3장 = 총 4장** 표시.
   (그 칸에 있던 사진은 촬영일과 무관하게 그 칸 후보로 합류하기 때문. 동시에 그 사진은 자기 EXIF 날짜 칸에는 중복으로 안 뜬다.)

### 3-4. 충돌 해소 (`ConflictModal.tsx`)

- 한 번에 한 날짜씩(`pendingConflicts`의 첫 키). "{Mon d} — pick one" + **3열 정사각 썸네일 그리드**.
- 한 장 탭 → 확정. 안 고른 후보는 다른 엔트리가 안 쓰면 풀에서 제거(blob revoke).

### 3-5. 칸 편집 (`EditSheet.tsx`)

- 바텀시트(`ModalShell`). 위→아래 구성: **날짜 헤더** → **큰 프리뷰** → **보조 액션 3개** → **하단 Done**(풀폭 pill).
- **큰 프리뷰**: 실제 칸 비율(`getCellAspect`)대로, 시트 폭 가득(높이는 `360px`로 캡, `maxWidth: calc(360px * cellAspect)`로 비율 유지). 테마 종이색 배경.
- **드래그로 위치 조정**(`useDragPhoto`, Pointer Events → `object-position`). 이미지/칸 비율에 따라 드래그 축(x/y/none) 자동 결정. 드래그 가능할 때만 "Drag to reposition" 힌트 오버레이.
- 위치는 **드래프트**(`draftPos`)에만 쌓이고, **Done/바깥 탭으로 닫을 때 한 번** `updatePosition`으로 커밋.
- 보조 액션(작고 동일 위계 텍스트): **Replace**(파일 교체, 날짜 무관) / **Center**(position 50,50 리셋) / **Remove**(칸 비우기, 누를 때 red). 위계 = Done(주, 하단 큰 pill) > 트리오(보조).

### 3-6. 컨트롤 패널 (`StyleControls.tsx`) — 캔버스 아래

- **Ratio / Theme / Week** 세 줄을 "라벨 + 라디오탭 pill" 형태로 통일. (스타일 토글만 — 보조 액션은 분리.)
  - Ratio: `RATIO_ORDER = 4:5 · 1:1 · 9:16 · 3:4 · 4:3`(마지막이 유일한 가로형)
  - Theme: White / Black (종이색 반전)
  - Week: Sun / Mon (주 시작 요일)
- 그 아래 **보조 액션 줄**(App이 렌더, 스타일 그룹과 분리):
  - 좌: **"How it works"** → 온보딩과 동일한 3단계 안내를 오버레이(`HowItWorksSheet`)로 다시 봄. 카피는 `HowItWorks.tsx` 한곳에서 정의(온보딩 인라인 리스트와 공유).
  - 우: **"Dump more"** → 벌크 업로더 재진입(`openDumpMore`). **현재 보고 있는 달 고정**(자동 월 전환 안 함), 풀에 사진을 추가하고 현재 달을 **재배치**(§3-3 rebuild).
  - 우: **"Clear all"**(파괴적) → 인앱 확인 다이얼로그 후 전체 풀 삭제(`clearAllPhotos`, 사진 없으면 비활성). 누를 때 red로 위험 신호. 업로드로 들어온 경우 삭제 후 온보딩으로 복귀.

### 3-7. 연/월 선택 (`WheelPicker.tsx`)

- iOS풍 스크롤 스냅 휠 2열 — **월(좌, Jan~Dec) · 연도(우, ±5년)** 순(`MAY 2026` 읽기 순서와 일치). "Month & Year" + Cancel/Confirm.
- 스크롤이 멈추면(80ms 디바운스) 가장 가까운 항목으로 스냅하고 `onChange`로 인덱스 통지.
- **WITH PHOTOS 점프 목록**(휠 위): 사진이 **2개 이상 달**에 걸쳐 있으면, `listPhotoMonths`로 모은 "사진 있는 달 + 장수"를 최신→과거 세로 리스트로 노출. 행 탭 → 그 달로 **즉시 점프 + 피커 닫힘**. 현재 달은 굵게 + 잉크 점(●)으로 표시. 멀티월 덤프 후 다른 달 사진을 발견·점프하고, 잘못 올라간 이상치(예: `Jan 1970 · 1`)도 바로 눈에 띄게 하는 용도.

### 3-8. 추출 (`export.ts`) — "Save · Share"

- `html-to-image`의 `toJpeg`로 `#calendar-canvas` 캡처. 목표 픽셀(`EXPORT_SIZES`) 대비 `pixelRatio` 계산해 고해상도로.
- `data-export-skip="true"` 노드(크롭/등록 마크, 온보딩 CTA)는 **제외**. 배경은 테마 종이색으로 레터박스 채움.
- 파일명: **`recap-YYYY-MM.jpg`**.
- **Web Share API 우선**(모바일 → 인스타 등 공유) → 미지원/데스크탑은 `<a download>` 폴백. 공유 취소(AbortError)는 조용히 무시.

---

## 4. 캘린더 캔버스 구조 (`Calendar.tsx`)

`#calendar-canvas` 한 박스(`aspectRatio = RATIO_VALUES[ratio]`) 안에 세로 플렉스로 4개 밴드가 쌓인다:

| 영역 | 내용 |
| --- | --- |
| 헤더 밴드 | 좌: **영문 월 이름**(`MMM`, 예 `JUN`), 우: **2자리 월 숫자**(`06`) |
| 요일 행 | S M T W T F S (또는 월 시작) |
| 그리드 | 7열 × N행(4~6주 동적), `gridAutoRows: 1fr` |
| 풋터 밴드 | 좌: **RECAPPER**(브랜드 서명), 우: **연도** |

- **컨테이너 쿼리**(`container-type: inline-size`) + `cqw` 단위로 폰트가 카드 크기에 비례 → 작은 프리뷰부터 전체 캔버스까지 비율 유지.
- 칸: 사진은 `<img>` `object-cover` + `objectPosition`(드래그 위치). 빈 칸/주말은 테마별 날짜 숫자색, 사진 위 숫자엔 `textShadow`.
- 마지막 열/행의 칸 border는 외곽선·풋터선과 겹쳐 두꺼워지므로 생략.
- `sample` 모드: 실제 사진 대신 `SAMPLE_PHOTO_MAP`(일→인덱스) + `SAMPLE_FILM`(필름톤 그라데이션)으로 칸을 채움.

### 출력 프레임 (`PrintFrame.tsx`)

- 캔버스를 감싸는 "인쇄 교정쇄" 프레임. 바깥 네 모서리에 **등록 마크**(원+십자), 트림 코너에 **크롭마크**(L자 헤어라인). 전부 `data-export-skip="true"`라 저장 이미지엔 안 나옴.

---

## 5. 디자인 토큰 (`lib/theme.ts` + `tailwind.config.js`)

### 5-1. 화면 팔레트 (Tailwind 토큰)

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `paper` | `#eaeaea` | 앱/폰 화면 배경 |
| `ink` | `#1a1a1a` | 기본 잉크 |
| `muted` | `#6b675d` | 보조/캡션 잉크(종이 질감 위 가독성 위해 진하게) |
| `rounded-pill` | `99px` | **눌리는 요소만** 적용(컨테이너는 직각) |
| `font-sans` | Akt(가변, 100–900) → system | 기본 폰트 |

> `lib/theme.ts`의 `INK` 상수는 PrintFrame의 **SVG `stroke`처럼 JS에서 직접 색 문자열이 필요한 곳**에만 노출(나머지는 Tailwind 토큰 사용).

### 5-2. 캘린더 카드 테마 (`CARD_THEMES`)

색 선택은 없고 **White / Black 종이 반전**만 남은 유일한 색 축. 인라인 스타일로 적용된다.

| 토큰 | White | Black |
| --- | --- | --- |
| `paper` | `#FFFFFF` | `#1A1A1A` |
| `headerInk` | `#1A1A1A` | `#F2EFE6` |
| `line` | `#2A2420` | `rgba(242,239,230,0.42)` |
| `emptyInk` / `emptyWeekendInk` | `#1A1A1A` / `#9A968B` | `#E8E5DD` / `#7A776E` |
| `photoInk` / `photoInkShadow` | `#FBF7EE` / 그림자 | 동일 |

### 5-3. 비율 (`RATIO_VALUES` in `types.ts`, `RATIO_ORDER` in `theme.ts`)

- UI 노출 순서: `RATIO_ORDER = ["4:5", "1:1", "9:16", "3:4", "4:3"]`. `4:3`은 유일한 가로형.

### 5-4. 샘플 채움 (`SAMPLE_FILM`, `SAMPLE_PHOTO_MAP`)

온보딩 SAMPLE 캘린더용 납작한 필름톤 그라데이션 12종 + 일(day)→인덱스 맵. 저장엔 절대 포함 안 됨.

---

## 6. 데이터 모델 (`types.ts` + `store.ts`)

```typescript
type Position = { x: number; y: number };               // 0–100 (object-position %)
type PhotoEntry = { date: string; photoId: string; position: Position };
type UploadedPhoto = {
  id: string; file: File; blobUrl: string;
  exifDate?: Date; naturalWidth: number; naturalHeight: number;
};

// Zustand store
type CalendarStore = {
  month: number;            // 0–11, 기본 = "지난달"(오늘 − 1개월)
  year: number;
  weekStart: "sun" | "mon"; // 기본 "sun"
  ratio: Ratio;             // 기본 "4:5"
  calendarTheme: "white" | "black"; // 기본 "white"
  entries: Record<string, PhotoEntry>;            // 현재 월 배치 (date → entry)
  uploadedPhotos: Record<string, UploadedPhoto>;  // 영속 풀
  pendingConflicts: Record<string, string[]>;     // date → 후보 photoId들
  // setMonth / setWeekStart / setRatio / setCalendarTheme /
  // addPhotos / resolveConflict / addPhotoAndAssign /
  // updatePosition / clearEntry / clearAllPhotos
};

const DEFAULT_POSITION = { x: 50, y: 50 };
```

- `month/year` 기본값은 **지난달** — Recapper는 한 달을 돌아보는 앱이라 갓 시작한 이번 달이 아니라 저번 달이 기본.
- `buildAssignment(year, month, pool, prevEntries)`: 그 달 + 풀에 남은 기존 엔트리는 보존, 단일 후보 날짜는 자동 배치, 다중 후보는 conflict로 모음.
- `suggestMostRecentMonth(pool, excludeY, excludeM)`: 현재 달 제외하고 풀에서 사진이 있는 **가장 최근** 달 반환(없으면 `null`).
- `listPhotoMonths(pool)`: 사진이 있는 모든 달을 `{year, month, count}`로 모아 최신→과거 정렬해 반환(WheelPicker의 WITH PHOTOS 목록용).

---

## 7. 파일 구조

```
src/
  App.tsx                  진입 분기(inEditor) + 메인 화면 + upload/export 연결
  store.ts                 Zustand 스토어 + buildAssignment + suggestMostRecentMonth
  types.ts                 타입 + RATIO_VALUES + DEFAULT_POSITION
  main.tsx                 React 진입점
  index.css                Akt @font-face, body 기본 스타일
  components/
    Calendar.tsx           캔버스(헤더/요일/그리드/풋터) — 에디터 & 샘플 공용
    PrintFrame.tsx         크롭/등록 마크 출력 프레임
    StyleControls.tsx      Ratio/Theme/Week 라디오탭(스타일 토글만)
    WheelPicker.tsx        연/월 휠 피커
    ConflictModal.tsx      같은 날 다중 사진 선택
    EditSheet.tsx          칸 편집(드래그/교체/가운데/삭제)
    LoadingOverlay.tsx     로딩 오버레이(pill)
    HowItWorks.tsx         3단계 안내(온보딩 리스트 + 에디터 오버레이 공용)
    ModalShell.tsx         오버레이 공용 셸 — 정렬·트랜지션·Esc/a11y 통일
    TextAction.tsx         보조 텍스트 액션 공용 버튼(밑줄 muted 대문자, danger=red)
    DialogHost.tsx         인앱 alert/confirm 렌더러(App 루트)
    ToastHost.tsx          상단 토스트 렌더러(App 루트)
  lib/
    calendar.ts            월 그리드 계산 + getCellAspect(EditSheet 프리뷰용)
    theme.ts               INK + CalendarTheme/CARD_THEMES + RATIO_ORDER + 샘플 채움
    photos.ts              loadUploadedPhoto (EXIF + lastModified 폴백)
    usePhotoUpload.ts      벌크/개별 업로드 훅(진행 카운트·다이얼로그·토스트 연동)
    dialog.ts              인앱 alert/confirm 스토어(useDialog)
    toast.ts               일시 토스트 스토어(useToast)
    useDragPhoto.ts        Pointer Events 드래그 → object-position
    export.ts              toJpeg + Web Share/다운로드
    date.ts                날짜 포맷(Mon d / EEE)
public/
  fonts/akt.woff2 / .woff  Akt 가변폰트(Latin 서브셋, 100–900)
```

> 🧹 **미사용 레거시 에셋**: `public/orange-gradient.png`(이전 디자인의 그리드 배경, ~3.3MB), `public/chevron_left_…svg`(인라인 SVG 화살표로 대체됨)는 현재 코드 어디서도 참조하지 않음. 정리 후보.

---

## 8. UI 작업 시 알아둘 관찰점

> 무드/UX를 손볼 때 참고용(요구사항 아님).

1. **에디터 진입은 단방향**: 온보딩 → 에디터로 가면 돌아가는 UI 없음. Clear All은 풀만 비움.
2. **에러/피드백은 인앱 다이얼로그·토스트로 통일됨**(`window.alert`/`confirm` 제거 완료 — `useDialog`/`useToast`).
3. **영속성 없음** — 새로고침 시 데이터 소실(§1). (남은 가장 큰 개선 후보)
4. **현재 달 매칭 0 → 무confirm 자동 월 전환**(§3-3). 토스트로 알리긴 하지만 달이 바뀐다는 점은 동일.

---

## 9. 비율별 추출 픽셀 (`export.ts` EXPORT_SIZES)

긴 변을 **4096px**로 고정 — 모바일 Safari 캔버스 한계(한 변 ~4096px, 면적 ~16.7M px²)
안에서 뽑을 수 있는 최대치. 비율은 유지(아래 값은 해당 비율에 정확히 맞는 정수).

| 비율 | 픽셀 | 용도 |
| --- | --- | --- |
| 1:1 | 4096×4096 | 인스타 피드 |
| 4:5 | 3276×4095 | 인스타 피드(세로) |
| 9:16 | 2304×4096 | 스토리 |
| 3:4 | 3072×4096 | 모바일 세로 |
| 4:3 | 4096×3072 | 가로 |
