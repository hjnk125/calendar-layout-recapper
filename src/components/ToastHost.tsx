import { useToast } from "../lib/toast";

// 상단 중앙 토스트 — App 루트에 한 번 마운트. 항상 마운트된 채 opacity로
// 페이드 인/아웃(text는 store가 유지하므로 사라질 때도 텍스트가 남아 부드럽다).
export function ToastHost() {
  const text = useToast((s) => s.text);
  const visible = useToast((s) => s.visible);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center px-5">
      <div
        className="max-w-[90%] whitespace-pre-line rounded-2xl bg-black/80 px-4 py-2.5 text-center text-[11px] font-semibold leading-snug text-white transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {text}
      </div>
    </div>
  );
}
