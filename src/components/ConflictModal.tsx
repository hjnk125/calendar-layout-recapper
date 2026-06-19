import { useLayoutEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { formatMonthDay } from "../lib/date";
import { ModalShell } from "./ModalShell";

export function ConflictModal() {
  const uploadedPhotos = useStore((s) => s.uploadedPhotos);
  const pendingConflicts = useStore((s) => s.pendingConflicts);
  const resolveConflict = useStore((s) => s.resolveConflict);

  const gridRef = useRef<HTMLDivElement>(null);
  // 정사각 칸 크기(px). iOS Safari가 aspect-ratio/padding-% 정사각을 첫 페인트에
  // 제대로 못 잡는 버그가 있어, 칼럼 폭을 직접 재서 칸 높이를 px로 고정한다.
  const [cell, setCell] = useState(0);

  // 과거 날짜부터 차례로 — ISO("YYYY-MM-DD") 문자열 정렬은 곧 시간순.
  // 한 날짜를 고르면 그 다음으로 이른 날짜가 자동으로 올라온다.
  const date = Object.keys(pendingConflicts).sort()[0];

  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const padX =
        parseFloat(cs.paddingLeft || "0") + parseFloat(cs.paddingRight || "0");
      const gap = parseFloat(cs.columnGap || "0");
      const inner = el.clientWidth - padX;
      const size = (inner - gap * 2) / 3; // 3열
      if (size > 0) setCell(size);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [date]);

  // 한 번에 한 충돌씩 해소한다 — 사용자가 한 날짜에 대해 고르면, 다음 대기
  // 중인 충돌(있다면)이 그 자리를 차지한다.
  if (!date) return null;
  const photoIds = pendingConflicts[date];

  return (
    // 한 장을 반드시 골라야 하므로 백드롭 탭 닫기는 막는다(dismissable=false).
    // 언마운트는 마지막 충돌이 해소되면 위 early-return이 처리한다.
    <ModalShell
      onClose={() => {}}
      dismissable={false}
      panelClassName="flex max-h-[90vh] w-full max-w-[460px] flex-col border border-ink bg-paper"
    >
      <div className="border-b border-ink px-5 py-4">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.03em] text-ink">
          {formatMonthDay(date)} — pick one
        </h2>
      </div>
      <div
        ref={gridRef}
        className="grid max-h-[70dvh] grid-cols-3 gap-2 overflow-y-auto p-3"
      >
        {photoIds.map((id) => {
          const photo = uploadedPhotos[id];
          if (!photo) return null;
          return (
            <button
              key={id}
              type="button"
              onClick={() => resolveConflict(date, id)}
              style={{ height: cell || undefined }}
              className="relative overflow-hidden border border-ink active:opacity-80"
            >
              <img
                src={photo.blobUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            </button>
          );
        })}
      </div>
    </ModalShell>
  );
}
