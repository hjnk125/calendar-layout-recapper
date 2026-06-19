import { format } from "date-fns";

// ISO "YYYY-MM-DD" 키를 로컬 Date로 파싱한다(`new Date(iso)`가 일으키는
// UTC 시차 어긋남을 피한다).
function parseIsoKey(iso: string): Date {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}

// "May 14" — 충돌 모달 + 편집 시트 헤더에 쓰인다.
export function formatMonthDay(iso: string): string {
  return format(parseIsoKey(iso), "MMM d");
}

// "Thu" — 편집 시트에서 날짜 옆에 옅게 표시되는 짧은 요일.
export function formatWeekday(iso: string): string {
  return format(parseIsoKey(iso), "EEE");
}
