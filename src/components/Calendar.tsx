import { format } from "date-fns";
import { RATIO_VALUES } from "../types";
import type { PhotoEntry, Ratio, UploadedPhoto, WeekStart } from "../types";
import { getMonthGrid, getWeekdayLabels } from "../lib/calendar";
import {
  CARD_THEMES,
  SAMPLE_FILM,
  SAMPLE_PHOTO_MAP,
  type CalendarTheme,
} from "../lib/theme";

type CalendarProps = {
  year: number;
  month: number;
  ratio: Ratio;
  weekStart: WeekStart;
  entries: Record<string, PhotoEntry>;
  uploadedPhotos: Record<string, UploadedPhoto>;
  theme: CalendarTheme;
  // 온보딩 "SAMPLE" recap: 그리드를 플레이스홀더 필름톤으로 채워, 처음 온
  // 사용자가 결과물을 상상할 수 있게 한다. 칸은 클릭 불가.
  sample?: boolean;
  onCellClick?: (iso: string, hasEntry: boolean) => void;
};

// RecapCard: 출력 교정쇄 캘린더 카드 한 장 — 헤더 밴드(월 이름 + 2자리 숫자),
// 요일 행, 헤어라인 그리드, 풋터 밴드(RECAP + 연도). 사이즈는 컨테이너
// 쿼리(`cqw`)로 구동돼, 작은 프리뷰부터 전체 캔버스까지 비율이 동일하게
// 유지되도록 글자가 카드에 비례해 커진다.
export function Calendar({
  year,
  month,
  ratio,
  weekStart,
  entries,
  uploadedPhotos,
  theme,
  sample = false,
  onCellClick,
}: CalendarProps) {
  const t = CARD_THEMES[theme];
  const rows = getMonthGrid(year, month, weekStart);
  const weekdayLabels = getWeekdayLabels(weekStart);
  const aspect = RATIO_VALUES[ratio];

  const monthName = format(new Date(year, month, 1), "MMM").toUpperCase();
  const monthNum = String(month + 1).padStart(2, "0");

  // 가로형(4:3 등, aspect > 1)은 세로 높이가 빠듯하다. 풋터 밴드를 빼고,
  // 헤더·요일 밴드도 더 납작하게(패딩·폰트 축소) 해서 그리드 높이를 확보한다.
  const landscape = aspect > 1;
  const showFooter = !landscape;
  const headerPad = landscape ? "2.8cqw 5cqw 2.2cqw" : "4.2cqw 5cqw 3.2cqw";
  const headerFont = landscape ? "5.4cqw" : "7.2cqw";
  const weekdayPad = landscape ? "1.1cqw 0 0.9cqw" : "1.7cqw 0 1.5cqw";
  const weekdayFont = landscape ? "2.4cqw" : "2.9cqw";

  const bandStyle = {
    flex: "none" as const,
    background: t.paper,
  };

  return (
    <div
      id="calendar-canvas"
      className="flex w-full flex-col overflow-hidden"
      style={{
        aspectRatio: aspect,
        background: t.paper,
        border: `1px solid ${t.line}`,
        // `cqw` 폰트 스케일링은 카드가 쿼리 컨테이너여야 동작한다.
        containerType: "inline-size",
        fontFamily: "Akt, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* 헤더 밴드 — 월 이름 + 2자리 숫자 */}
      <div
        className="flex items-end justify-between"
        style={{
          ...bandStyle,
          padding: headerPad,
          borderBottom: `1px solid ${t.line}`,
          color: t.headerInk,
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: headerFont,
            lineHeight: 0.9,
            letterSpacing: "-0.02em",
          }}
        >
          {monthName}
        </span>
        <span
          style={{
            fontWeight: 600,
            fontSize: headerFont,
            lineHeight: 0.9,
            letterSpacing: "-0.03em",
          }}
        >
          {monthNum}
        </span>
      </div>

      {/* 요일 행 */}
      <div
        className="grid grid-cols-7"
        style={{
          ...bandStyle,
          // 위 패딩을 조금 늘리고 아래를 그만큼 줄여, 밴드 높이는 그대로 두되
          // 요일 글자를 살짝 아래로 내린다(대문자가 위로 떠 보이는 보정).
          // 가로형은 더 납작하게.
          padding: weekdayPad,
          borderBottom: `1px solid ${t.line}`,
        }}
      >
        {weekdayLabels.map((label, idx) => (
          <span
            key={`${label}-${idx}`}
            className="text-center"
            style={{
              fontWeight: 600,
              fontSize: weekdayFont,
              letterSpacing: "0.04em",
              color: t.headerInk,
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* 그리드 */}
      <div
        className="grid grid-cols-7"
        style={{ flex: 1, gridAutoRows: "1fr" }}
      >
        {rows.flat().map((cell, idx) => {
          const day = cell.dayNumber;
          // 마지막 열/행의 셀 border는 그린다면 컨테이너 외곽선·풋터
          // 상단선과 겹쳐 2겹으로 두꺼워진다 — 그래서 생략한다.
          const isLastCol = idx % 7 === 6;
          const isLastRow = Math.floor(idx / 7) === rows.length - 1;

          // 칸의 사진을 결정한다 — 실제 entry이거나 샘플 필름톤.
          let photoBg: string | undefined;
          let realPhoto: UploadedPhoto | undefined;
          let position = { x: 50, y: 50 };
          if (sample) {
            const filmIdx = day != null ? SAMPLE_PHOTO_MAP[day] : undefined;
            if (filmIdx != null)
              photoBg = SAMPLE_FILM[filmIdx % SAMPLE_FILM.length];
          } else if (cell.iso) {
            const entry = entries[cell.iso];
            const p = entry ? uploadedPhotos[entry.photoId] : undefined;
            if (entry && p) {
              realPhoto = p;
              position = entry.position;
            }
          }

          const hasPhoto = Boolean(photoBg || realPhoto);
          // 날짜 숫자색은 사진 유무·주말 구분 없이 모두 동일(dayInk).
          // 사진 위 칸만 반대색 외곽선을 더해 가독성을 확보한다.
          const numColor = t.dayInk;
          const isInteractive = !sample && cell.iso != null;
          const handleClick =
            isInteractive && onCellClick
              ? () => onCellClick(cell.iso as string, Boolean(realPhoto))
              : undefined;

          return (
            <div
              key={idx}
              className="relative overflow-hidden"
              style={{
                borderRight: isLastCol ? "none" : `1px solid ${t.line}`,
                borderBottom: isLastRow ? "none" : `1px solid ${t.line}`,
                backgroundImage: photoBg,
                backgroundSize: "cover",
                backgroundPosition: "center",
                cursor: isInteractive ? "pointer" : "default",
              }}
              onClick={handleClick}
              role={isInteractive ? "button" : undefined}
            >
              {realPhoto && (
                <img
                  src={realPhoto.blobUrl}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                  style={{ objectPosition: `${position.x}% ${position.y}%` }}
                />
              )}
              {day != null && (
                <span
                  className="pointer-events-none absolute"
                  style={{
                    top: "1.4cqw",
                    left: "1.4cqw",
                    fontWeight: 600,
                    fontSize: "3.2cqw",
                    lineHeight: 1,
                    color: numColor,
                    // 사진 위 숫자는 반대색 외곽선으로 가독성 확보. paintOrder로
                    // 채움을 외곽선 위에 그려 글자가 두꺼워 보이지 않게 한다.
                    WebkitTextStroke: hasPhoto ? t.photoInkStroke : undefined,
                    paintOrder: hasPhoto ? "stroke" : undefined,
                  }}
                >
                  {day}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 풋터 밴드 — RECAP + 연도 (가로형에선 높이 확보 위해 생략) */}
      {showFooter && (
        <div
          className="flex items-center justify-between"
          style={{
            ...bandStyle,
            padding: "2.6cqw 5cqw",
            borderTop: `1px solid ${t.line}`,
            color: t.headerInk,
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: "3.4cqw",
              letterSpacing: "0.14em",
            }}
          >
            RECAPPER
          </span>
          <span
            style={{
              fontWeight: 600,
              fontSize: "3.4cqw",
              letterSpacing: "0.04em",
            }}
          >
            {year}
          </span>
        </div>
      )}
    </div>
  );
}
