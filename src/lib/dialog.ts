import { create } from "zustand";

type DialogReq = {
  message: string;
  confirmLabel: string;
  cancelLabel: string | null; // null → 알림(단일 버튼)
  danger: boolean;
  resolve: (ok: boolean) => void;
};

type DialogStore = {
  current: DialogReq | null;
  // 알림: 확인 버튼 하나. (반환 Promise는 닫히면 resolve)
  alert: (message: string, confirmLabel?: string) => Promise<void>;
  // 확인: 확인/취소. true=확인.
  confirm: (
    message: string,
    opts?: { confirmLabel?: string; cancelLabel?: string; danger?: boolean },
  ) => Promise<boolean>;
  // 결과만 통지(닫기 애니메이션 시작 전 즉시 호출 가능). 언마운트는 clear가 한다.
  resolve: (ok: boolean) => void;
  clear: () => void;
};

// OS 기본 alert/confirm을 대체하는 인앱 다이얼로그. 컴포넌트 밖(훅 등)에서도
// useDialog.getState().alert(...) / .confirm(...)로 명령형 호출 가능.
// 한 번에 하나만 띄운다(current). DialogHost가 ModalShell로 렌더.
export const useDialog = create<DialogStore>((set, get) => ({
  current: null,
  alert: (message, confirmLabel = "OK") =>
    new Promise<void>((res) => {
      set({
        current: {
          message,
          confirmLabel,
          cancelLabel: null,
          danger: false,
          resolve: () => res(),
        },
      });
    }),
  confirm: (message, opts) =>
    new Promise<boolean>((res) => {
      set({
        current: {
          message,
          confirmLabel: opts?.confirmLabel ?? "Confirm",
          cancelLabel: opts?.cancelLabel ?? "Cancel",
          danger: opts?.danger ?? false,
          resolve: res,
        },
      });
    }),
  resolve: (ok) => get().current?.resolve(ok),
  clear: () => set({ current: null }),
}));
