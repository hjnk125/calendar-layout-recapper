import { create } from "zustand";

type ToastStore = {
  text: string | null; // 마지막 메시지(페이드 아웃 동안 유지하려고 visible과 분리)
  visible: boolean;
  show: (message: string) => void;
  hide: () => void;
};

let timer: number | undefined;

// 비차단 일시 토스트(상단 중앙). 자동 월 전환 같은 "조용한" 동작을 알린다.
// show 후 ~2.8초 뒤 visible=false로 페이드 아웃(text는 남겨 부드럽게). ToastHost가 렌더.
export const useToast = create<ToastStore>((set) => ({
  text: null,
  visible: false,
  show: (message) => {
    set({ text: message, visible: true });
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => set({ visible: false }), 2800);
  },
  hide: () => set({ visible: false }),
}));
