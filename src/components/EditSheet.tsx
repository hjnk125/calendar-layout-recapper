import { useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { loadUploadedPhoto } from "../lib/photos";
import { getCellAspect } from "../lib/calendar";
import { formatMonthDay, formatWeekday } from "../lib/date";
import { useDragPhoto } from "../lib/useDragPhoto";
import { CARD_THEMES } from "../lib/theme";
import { useDialog } from "../lib/dialog";
import { DEFAULT_POSITION, type Position } from "../types";
import { ModalShell } from "./ModalShell";
import { TextAction } from "./TextAction";

type EditSheetProps = {
  date: string;
  onClose: () => void;
};

// 사진 한 장의 위치를 조정하는 출력 교정쇄 바텀시트. 컨테이너는 직각
// (radius 0)이고 액션 버튼만 pill이다. 큰 프리뷰를 드래그해 위치를 맞추고,
// Replace / Center, 또는 아래의 Remove로 처리한다.
export function EditSheet({ date, onClose }: EditSheetProps) {
  const entry = useStore((s) => s.entries[date]);
  const photo = useStore((s) =>
    entry ? s.uploadedPhotos[entry.photoId] : undefined,
  );
  const weekStart = useStore((s) => s.weekStart);
  const month = useStore((s) => s.month);
  const year = useStore((s) => s.year);
  const ratio = useStore((s) => s.ratio);
  const calendarTheme = useStore((s) => s.calendarTheme);
  const updatePosition = useStore((s) => s.updatePosition);
  const clearEntry = useStore((s) => s.clearEntry);
  const addPhotoAndAssign = useStore((s) => s.addPhotoAndAssign);

  // 드래프트 위치: 시트가 열려 있는 동안 변경은 여기에만 쌓이고, 실제 달력
  // (스토어)에는 Done(시트 닫기) 시점에 한 번만 커밋한다.
  const [draftPos, setDraftPos] = useState<Position>(
    entry?.position ?? DEFAULT_POSITION,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const cellAspect = useMemo(
    () => getCellAspect(year, month, ratio, weekStart),
    [ratio, month, year, weekStart],
  );

  const { livePos, draggable, resetLocal, bind } = useDragPhoto({
    photo,
    cellAspect,
    basePosition: draftPos,
    // 드래그를 놓으면 스토어가 아니라 드래프트에만 반영한다(프리뷰용).
    onCommit: (next) => setDraftPos(next),
  });

  if (!entry || !photo) {
    // 시트가 열려 있는 동안 entry가 비워졌다 — 그냥 닫는다.
    return null;
  }

  const onReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const next = await loadUploadedPhoto(file);
      addPhotoAndAssign(date, next);
      resetLocal();
      setDraftPos(DEFAULT_POSITION);
    } catch {
      useDialog.getState().alert("Couldn't load that photo.");
    }
  };

  const onCenter = () => {
    resetLocal();
    setDraftPos(DEFAULT_POSITION);
  };

  const onDelete = () => {
    clearEntry(date);
    onClose();
  };

  // 닫기(Done·바깥 탭) 시점에 드래프트 위치를 실제 달력에 한 번 커밋.
  // 실제 언마운트는 ModalShell이 종료 애니메이션 후 호출한다.
  const commitAndClose = () => {
    updatePosition(date, draftPos);
    onClose();
  };

  const preview = CARD_THEMES[calendarTheme];

  return (
    <ModalShell
      onClose={commitAndClose}
      panelClassName="w-full max-w-[460px] border border-ink bg-paper px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-4"
    >
      {(close) => (
        <>
          {/* 날짜 헤더 */}
          <div className="text-[15px] font-extrabold uppercase tracking-[0.03em] text-ink">
            {formatMonthDay(date)}{" "}
            <span className="text-xs font-semibold text-muted">
              {formatWeekday(date)}
            </span>
          </div>

          {/* 큰 드래그 프리뷰 — 시트 폭 가득(높이는 50vh로 캡, 칸 비율 유지) */}
          <div
            className="relative mx-auto mt-4 w-full select-none overflow-hidden"
            style={{
              aspectRatio: cellAspect,
              maxWidth: `calc(360px * ${cellAspect})`,
              background: preview.paper,
              border: `1px solid ${preview.line}`,
              touchAction: "none",
              cursor: draggable === "none" ? "default" : "grab",
            }}
            {...bind}
          >
            <img
              src={photo.blobUrl}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: `${livePos.x}% ${livePos.y}%` }}
            />
            {draggable !== "none" && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]">
                Drag to reposition
              </div>
            )}
          </div>

          {/* 보조 액션 — 앱 전역 보조 버튼과 동일 스타일(TextAction). */}
          <div className="mt-4 flex items-center justify-center gap-6">
            <TextAction onClick={() => fileInputRef.current?.click()}>
              Replace
            </TextAction>
            <TextAction onClick={onCenter}>Center</TextAction>
            <TextAction onClick={onDelete}>Remove</TextAction>
          </div>

          {/* 하단 Done — 다른 모달과 동일하게 풀폭 pill */}
          <button
            type="button"
            onClick={close}
            className="mt-5 w-full rounded-pill bg-ink py-3.5 text-sm font-extrabold uppercase tracking-[0.08em] text-white active:opacity-80"
          >
            Done
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onReplaceFile}
          />
        </>
      )}
    </ModalShell>
  );
}

