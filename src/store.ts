import { create } from "zustand";
import {
  DEFAULT_POSITION,
  type PhotoEntry,
  type Position,
  type Ratio,
  type UploadedPhoto,
  type WeekStart,
} from "./types";
import type { CalendarTheme } from "./lib/theme";

type CalendarStore = {
  month: number;
  year: number;
  weekStart: WeekStart;
  // 현재 달의 단일 사진 엔트리(자동 배치 + 수동 핀).
  entries: Record<string, PhotoEntry>;
  // 업로드된 모든 사진의 영속 풀. 달을 바꿔도 사진이 여기 남아 있어, 재업로드
  // 없이 캘린더가 자동 재배치할 수 있다.
  uploadedPhotos: Record<string, UploadedPhoto>;
  // 매칭되는 사진이 여러 장이라 사용자 선택을 기다리는 날짜들.
  pendingConflicts: Record<string, string[]>;
  // 출력 비율(캔버스 아래 칩). 테마와 독립적이다.
  ratio: Ratio;
  // 캘린더 종이 테마 — White 또는 Black. 남은 유일한 색 축.
  calendarTheme: CalendarTheme;
  setMonth: (year: number, month: number) => void;
  setWeekStart: (weekStart: WeekStart) => void;
  setRatio: (ratio: Ratio) => void;
  setCalendarTheme: (theme: CalendarTheme) => void;
  // 새 사진을 풀에 추가한 뒤 현재 달 기준으로 재배치한다. UI가 "0장 매칭"
  // 피드백을 보여줄 수 있도록 개수를 반환한다.
  addPhotos: (photos: UploadedPhoto[]) => {
    placedCount: number;
    conflictCount: number;
    droppedCount: number;
  };
  resolveConflict: (date: string, photoId: string) => void;
  addPhotoAndAssign: (date: string, photo: UploadedPhoto) => void;
  updatePosition: (date: string, position: Position) => void;
  clearEntry: (date: string) => void;
  clearAllPhotos: () => void;
};

const today = new Date();
// 기본 표시 달은 "지난달" — 첫 화면(샘플)과 새 세션이 저번 달을 보여준다.
// (Recapper는 한 달을 돌아보는 앱이라 갓 시작한 이번 달이 아니라 지난달이 기본.)
const defaultMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

// 어떤 엔트리도 더 이상 photoId를 참조하지 않으면 풀에서 제거하고 blob을
// 해제한다(in-place). resolveConflict·addPhotoAndAssign·clearEntry가 공유하는
// "고아 사진 정리" 로직.
function revokeIfOrphaned(
  pool: Record<string, UploadedPhoto>,
  entries: Record<string, PhotoEntry>,
  photoId: string,
): void {
  const stillUsed = Object.values(entries).some((e) => e.photoId === photoId);
  if (stillUsed) return;
  const photo = pool[photoId];
  if (photo) {
    URL.revokeObjectURL(photo.blobUrl);
    delete pool[photoId];
  }
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthPrefix(year: number, month: number): string {
  return `${year}-${pad(month + 1)}-`;
}

// 주어진 달에 대해 사진 풀로부터 entries + pendingConflicts를 다시 만든다.
// mode에 따라 기존 엔트리를 보존(keep)하거나 다시 충돌로 되돌린다(rebuild).
// 달을 바꾸면 날짜가 안 맞는 엔트리는 자연히 빠진다.
function buildAssignment(
  year: number,
  month: number,
  pool: Record<string, UploadedPhoto>,
  prevEntries: Record<string, PhotoEntry>,
  // "keep"(월 이동): 기존 in-month 엔트리를 그대로 보존.
  // "rebuild"(re-dump): 기존 엔트리를 보존하지 않고 그 칸 날짜의 후보로 되돌려,
  //   한 날짜에 사진이 2장 이상이면 다시 충돌(ConflictModal)시킨다. 이때 그 칸에
  //   있던 사진은 촬영일과 무관하게 그 칸 후보로 합류한다(직접 올린 off-date 핀,
  //   이전 충돌 선택, 자동 배치 모두 포함) — "이전 1장 + 새 N장"이 함께 뜬다.
  mode: "keep" | "rebuild" = "keep",
): {
  entries: Record<string, PhotoEntry>;
  conflicts: Record<string, string[]>;
} {
  const prefix = monthPrefix(year, month);

  // 현재 달의 기존 엔트리(사진이 아직 풀에 있는 것만).
  const inMonth: Record<string, PhotoEntry> = {};
  for (const [date, entry] of Object.entries(prevEntries)) {
    if (date.startsWith(prefix) && pool[entry.photoId]) inMonth[date] = entry;
  }
  // 엔트리로 이미 어떤 칸에 배치된 사진들 — exif 후보에선 제외해서, 같은 사진이
  // "핀된 칸"과 "촬영일 칸" 양쪽에 중복 배치되는 걸 막는다.
  const placedPhotoIds = new Set(Object.values(inMonth).map((e) => e.photoId));

  // keep는 기존 엔트리 보존, rebuild는 아래 후보 단계에서 전부 재평가.
  const kept: Record<string, PhotoEntry> =
    mode === "keep" ? { ...inMonth } : {};

  const candidatesByDate: Record<string, string[]> = {};
  const addCandidate = (date: string, id: string) => {
    (candidatesByDate[date] ??= []).push(id);
  };

  // (a) 촬영일(exif) 기반 후보 — 이미 칸에 배치된 사진은 제외.
  for (const photo of Object.values(pool)) {
    if (!photo.exifDate) continue;
    const d = photo.exifDate;
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    if (placedPhotoIds.has(photo.id)) continue;
    const key = toDateKey(d);
    if (kept[key]) continue; // keep 모드에서 이미 채워진 칸은 건드리지 않음
    addCandidate(key, photo.id);
  }

  // (b) rebuild: 기존 엔트리의 사진을 그 칸 날짜 후보로 합류(촬영일 무관).
  if (mode === "rebuild") {
    for (const [date, entry] of Object.entries(inMonth)) {
      addCandidate(date, entry.photoId);
    }
  }

  const conflicts: Record<string, string[]> = {};
  for (const [date, idsRaw] of Object.entries(candidatesByDate)) {
    const ids = [...new Set(idsRaw)];
    if (ids.length === 1) {
      // 후보가 1장뿐이면 자동 배치. 기존에 같은 사진이 있었다면 위치를 보존.
      const prev = inMonth[date];
      kept[date] =
        prev && prev.photoId === ids[0]
          ? prev
          : { date, photoId: ids[0], position: { ...DEFAULT_POSITION } };
    } else {
      conflicts[date] = ids;
    }
  }

  return { entries: kept, conflicts };
}

export const useStore = create<CalendarStore>((set, get) => ({
  month: defaultMonth.getMonth(),
  year: defaultMonth.getFullYear(),
  weekStart: "sun",
  entries: {},
  uploadedPhotos: {},
  pendingConflicts: {},
  ratio: "4:5",
  calendarTheme: "white",

  setMonth: (year, month) => {
    const { uploadedPhotos, entries } = get();
    const { entries: nextEntries, conflicts } = buildAssignment(
      year,
      month,
      uploadedPhotos,
      entries,
    );
    set({
      year,
      month,
      entries: nextEntries,
      pendingConflicts: conflicts,
    });
  },

  setWeekStart: (weekStart) => set({ weekStart }),
  setRatio: (ratio) => set({ ratio }),
  setCalendarTheme: (calendarTheme) => set({ calendarTheme }),

  addPhotos: (photos) => {
    const { year, month, uploadedPhotos, entries } = get();
    const nextPool: Record<string, UploadedPhoto> = { ...uploadedPhotos };

    let droppedCount = 0;
    for (const photo of photos) {
      // 사용 가능한 날짜가 없는 사진은 자동 배치에 참여할 수 없다.
      // (loadUploadedPhoto가 이미 file.lastModified로 폴백하므로, 여기서
      // 진짜 누락되는 경우는 그것마저 없을 때뿐이다.)
      if (!photo.exifDate) {
        URL.revokeObjectURL(photo.blobUrl);
        droppedCount += 1;
        continue;
      }
      nextPool[photo.id] = photo;
    }

    // re-dump: 직접 손댄 칸만 보존하고 나머지는 다시 충돌시킨다.
    const { entries: nextEntries, conflicts } = buildAssignment(
      year,
      month,
      nextPool,
      entries,
      "rebuild",
    );

    set({
      uploadedPhotos: nextPool,
      entries: nextEntries,
      pendingConflicts: conflicts,
    });

    // 개수는 이번 배치에서 왔든 기존 풀에서 왔든 상관없이 *현재* 달에
    // 배치된 결과를 반영한다.
    return {
      placedCount: Object.keys(nextEntries).length,
      conflictCount: Object.keys(conflicts).length,
      droppedCount,
    };
  },

  resolveConflict: (date, photoId) => {
    const { uploadedPhotos, entries, pendingConflicts } = get();
    const nextEntries: Record<string, PhotoEntry> = {
      ...entries,
      [date]: {
        date,
        photoId,
        position: { ...DEFAULT_POSITION },
      },
    };

    const nextPool: Record<string, UploadedPhoto> = { ...uploadedPhotos };
    const candidates = pendingConflicts[date] ?? [];

    // 선택되지 않은 후보를 풀에서 제거한다(blob revoke) — 사용자가 한 장을
    // 명시적으로 골랐으니. 단, 다른 엔트리가 참조 중인 건 건너뛴다.
    for (const id of candidates) {
      if (id === photoId) continue;
      revokeIfOrphaned(nextPool, nextEntries, id);
    }

    const nextConflicts = { ...pendingConflicts };
    delete nextConflicts[date];

    set({
      uploadedPhotos: nextPool,
      entries: nextEntries,
      pendingConflicts: nextConflicts,
    });
  },

  addPhotoAndAssign: (date, photo) => {
    const { uploadedPhotos, entries } = get();
    const prevEntry = entries[date];
    const nextUploaded: Record<string, UploadedPhoto> = {
      ...uploadedPhotos,
      [photo.id]: photo,
    };
    const nextEntries: Record<string, PhotoEntry> = {
      ...entries,
      [date]: {
        date,
        photoId: photo.id,
        position: { ...DEFAULT_POSITION },
      },
    };

    // 이 칸이 쓰던 이전 사진이 더 이상 어디서도 안 쓰이면 정리.
    if (prevEntry) {
      revokeIfOrphaned(nextUploaded, nextEntries, prevEntry.photoId);
    }

    set({
      uploadedPhotos: nextUploaded,
      entries: nextEntries,
    });
  },

  updatePosition: (date, position) => {
    const { entries } = get();
    const existing = entries[date];
    if (!existing) return;
    set({
      entries: {
        ...entries,
        [date]: { ...existing, position },
      },
    });
  },

  clearEntry: (date) => {
    const { entries, uploadedPhotos } = get();
    const existing = entries[date];
    if (!existing) return;
    const nextEntries = { ...entries };
    delete nextEntries[date];

    const nextUploaded: Record<string, UploadedPhoto> = { ...uploadedPhotos };
    revokeIfOrphaned(nextUploaded, nextEntries, existing.photoId);
    set({ entries: nextEntries, uploadedPhotos: nextUploaded });
  },

  clearAllPhotos: () => {
    const { uploadedPhotos } = get();
    for (const photo of Object.values(uploadedPhotos)) {
      URL.revokeObjectURL(photo.blobUrl);
    }
    set({
      entries: {},
      uploadedPhotos: {},
      pendingConflicts: {},
    });
  },
}));

// 풀에 사진이 있는 모든 달을 {연,월,장수}로 모아 최신→과거 순으로 반환한다.
// WheelPicker의 "WITH PHOTOS" 점프 목록에 쓰인다. 장수까지 주므로 사용자가
// 규모를 파악하고, 잘못 올라간 이상치(예: 1970년 1장)도 바로 눈에 띈다.
export function listPhotoMonths(
  pool: Record<string, UploadedPhoto>,
): { year: number; month: number; count: number }[] {
  const counts: Record<string, number> = {};
  for (const photo of Object.values(pool)) {
    if (!photo.exifDate) continue;
    const key = `${photo.exifDate.getFullYear()}-${photo.exifDate.getMonth()}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([key, count]) => {
      const [year, month] = key.split("-").map(Number);
      return { year, month, count };
    })
    .sort((a, b) => b.year - a.year || b.month - a.month);
}

// 소비자에게 노출되는 헬퍼 — 풀이 주어졌을 때, 현재 달을 제외하고 사진이
// 있는 가장 최근 달은? 현재 달에 매칭이 없을 때 자동 전환 대상에 쓰인다.
export function suggestMostRecentMonth(
  pool: Record<string, UploadedPhoto>,
  excludeYear: number,
  excludeMonth: number,
): { year: number; month: number; count: number } | null {
  const counts: Record<string, number> = {};
  for (const photo of Object.values(pool)) {
    if (!photo.exifDate) continue;
    const y = photo.exifDate.getFullYear();
    const m = photo.exifDate.getMonth();
    if (y === excludeYear && m === excludeMonth) continue;
    const key = `${y}-${m}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  let bestY = -Infinity;
  let bestM = -Infinity;
  let found = false;
  for (const key of Object.keys(counts)) {
    const [y, m] = key.split("-").map(Number);
    // 연도가 더 크거나, 같은 연도면 달이 더 큰 쪽이 더 최근이다.
    if (y > bestY || (y === bestY && m > bestM)) {
      bestY = y;
      bestM = m;
      found = true;
    }
  }
  if (!found) return null;
  return { year: bestY, month: bestM, count: counts[`${bestY}-${bestM}`] };
}
