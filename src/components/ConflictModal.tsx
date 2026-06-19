import { useStore } from "../store";
import { formatMonthDay } from "../lib/date";
import { ModalShell } from "./ModalShell";

export function ConflictModal() {
  const uploadedPhotos = useStore((s) => s.uploadedPhotos);
  const pendingConflicts = useStore((s) => s.pendingConflicts);
  const resolveConflict = useStore((s) => s.resolveConflict);

  // 한 번에 한 충돌씩 해소한다 — 사용자가 한 날짜에 대해 고르면, 다음 대기
  // 중인 충돌(있다면)이 그 자리를 차지한다.
  const date = Object.keys(pendingConflicts)[0];
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
      <div className="grid max-h-[70dvh] grid-cols-3 gap-2 overflow-y-auto p-3">
        {photoIds.map((id) => {
          const photo = uploadedPhotos[id];
          if (!photo) return null;
          return (
            <button
              key={id}
              type="button"
              onClick={() => resolveConflict(date, id)}
              // iOS Safari는 grid item의 aspect-ratio를 무시하는 버그가 있어,
              // padding-bottom 100% 트릭으로 정사각을 강제한다.
              className="relative w-full overflow-hidden border border-ink pb-[100%] active:opacity-80"
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
