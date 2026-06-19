import type { ReactNode } from "react";

type TextActionProps = {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean; // 누를 때 red (파괴적 액션 — Clear all 등)
  disabled?: boolean;
};

// 보조 텍스트 액션 — 밑줄 + muted 대문자. 앱 전역에서 동일 스타일로 통일
// (How it works · Dump more · Clear all · Replace · Center · Remove).
export function TextAction({
  children,
  onClick,
  danger,
  disabled,
}: TextActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`border-b border-ink/30 pb-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted disabled:opacity-30 ${
        danger ? "active:text-red-600" : "active:opacity-60"
      }`}
    >
      {children}
    </button>
  );
}
