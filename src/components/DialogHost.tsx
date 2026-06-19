import { useDialog } from "../lib/dialog";
import { ModalShell } from "./ModalShell";

// 인앱 alert/confirm 렌더러 — App 루트에 한 번 마운트. useDialog.current가
// 있을 때만 ModalShell로 띄운다. 버튼은 결과를 먼저 resolve하고 닫기
// 애니메이션을 시작한다(동작은 즉시, 시트는 부드럽게 사라짐).
export function DialogHost() {
  const current = useDialog((s) => s.current);
  const resolve = useDialog((s) => s.resolve);
  const clear = useDialog((s) => s.clear);

  if (!current) return null;
  const hasCancel = current.cancelLabel !== null;

  return (
    <ModalShell
      // 백드롭/Esc로 닫으면 취소(false)로 통지(알림은 인자 무시).
      onClose={() => {
        resolve(false);
        clear();
      }}
      panelClassName="w-full max-w-[340px] border border-ink bg-paper p-5"
    >
      {(close) => (
        <>
          <p className="text-[13px] font-semibold leading-relaxed text-ink">
            {current.message}
          </p>
          <div className="mt-5 flex gap-2.5">
            {hasCancel && (
              <button
                type="button"
                onClick={() => {
                  resolve(false);
                  close();
                }}
                className="flex-1 rounded-pill border border-ink py-2.5 text-xs font-bold uppercase tracking-[0.04em] text-ink active:opacity-70"
              >
                {current.cancelLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                resolve(true);
                close();
              }}
              className={`flex-1 rounded-pill py-2.5 text-xs font-extrabold uppercase tracking-[0.04em] text-white active:opacity-80 ${
                current.danger ? "bg-red-600" : "bg-ink"
              }`}
            >
              {current.confirmLabel}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
