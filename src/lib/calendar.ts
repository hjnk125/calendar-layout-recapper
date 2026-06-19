import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  startOfMonth,
} from "date-fns";
import { RATIO_VALUES, type Ratio, type WeekStart } from "../types";

// EditSheet의 프리뷰 타일 비율(getCellAspect)을 캔버스의 실제 칸 비율과
// 맞추기 위한 레이아웃 상수 — 캔버스 레이아웃을 손본다면 함께 갱신할 것.
export const CANVAS_PAD_FRAC = 0.04; // 캔버스 양쪽의 p-[4%]
export const HEADER_VERTICAL_FRAC = 0.08 + 0.015 + 0.05 + 0.005; // 헤더 + 좁은 간격들 + 요일 행

export type CalendarCell = {
  date: Date | null;
  dayNumber: number | null;
  iso: string | null;
};

export function getMonthGrid(
  year: number,
  month: number,
  weekStart: WeekStart,
): CalendarCell[][] {
  const firstOfMonth = startOfMonth(new Date(year, month, 1));
  const lastOfMonth = endOfMonth(firstOfMonth);
  const days = eachDayOfInterval({ start: firstOfMonth, end: lastOfMonth });

  const firstDow = getDay(firstOfMonth);
  const leading =
    weekStart === "sun" ? firstDow : (firstDow + 6) % 7;

  const cells: CalendarCell[] = [];

  for (let i = 0; i < leading; i += 1) {
    cells.push({ date: null, dayNumber: null, iso: null });
  }

  for (const day of days) {
    cells.push({
      date: day,
      dayNumber: day.getDate(),
      iso: format(day, "yyyy-MM-dd"),
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, dayNumber: null, iso: null });
  }

  const rows: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  return rows;
}

export const WEEKDAY_LABELS_SUN = ["S", "M", "T", "W", "T", "F", "S"];
export const WEEKDAY_LABELS_MON = ["M", "T", "W", "T", "F", "S", "S"];

export function getWeekdayLabels(weekStart: WeekStart): string[] {
  return weekStart === "sun" ? WEEKDAY_LABELS_SUN : WEEKDAY_LABELS_MON;
}

export function getMonthRowCount(
  year: number,
  month: number,
  weekStart: WeekStart,
): number {
  const firstDow = new Date(year, month, 1).getDay();
  const leading = weekStart === "sun" ? firstDow : (firstDow + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Math.ceil((leading + daysInMonth) / 7);
}

/**
 * 캔버스 비율, 월 레이아웃, 주 시작이 주어졌을 때 캘린더 칸 한 개의 렌더링
 * 비율(width / height)을 계산한다. 칸 너비/높이는 실제 캔버스 레이아웃에서
 * 나온다: 캔버스 - 사방 4% 패딩, 헤더 + 요일 세로 비중을 뺀 뒤, 7열과 N행으로
 * 나눈다.
 *
 * EditSheet.tsx가 편집 프리뷰 타일을 실제 칸과 같은 비율로 그릴 때 쓴다.
 */
export function getCellAspect(
  year: number,
  month: number,
  ratio: Ratio,
  weekStart: WeekStart,
): number {
  const canvasW = 1;
  const canvasH = 1 / RATIO_VALUES[ratio];
  const padX = canvasW * CANVAS_PAD_FRAC * 2;
  const padY = canvasH * CANVAS_PAD_FRAC * 2;
  const gridW = canvasW - padX;
  const rows = getMonthRowCount(year, month, weekStart);
  const gridH = canvasH - padY - canvasH * HEADER_VERTICAL_FRAC;
  const cellW = gridW / 7;
  const cellH = gridH / rows;
  return cellW / cellH;
}
