import { useEffect, useRef, useState, type ReactNode } from "react";

type ModalShellProps = {
  // 닫기 애니메이션이 끝난 뒤 호출 — 부모가 실제로 언마운트(상태 false)한다.
  onClose: () => void;
  // 백드롭 탭으로 닫기 허용 여부(필수 선택 모달은 false).
  dismissable?: boolean;
  // 패널 박스의 폭/패딩/보더 등(애니메이션·relative·정렬은 셸이 담당).
  panelClassName?: string;
  // close 함수를 받아 내부 버튼에서 닫기 애니메이션을 트리거할 수 있게 한다.
  children: ReactNode | ((close: () => void) => ReactNode);
};

// 모든 오버레이가 공유하는 모달 셸 — 정렬(모바일 하단 고정 items-end /
// 데스크탑 중앙 sm:items-center)과 트랜지션을 한곳에서 처리한다:
//   · 하단 고정(모바일): 아래에서 slide-up
//   · 중앙(데스크탑): fade-in
//   · 백드롭: 항상 fade
// 진입은 rAF로 open=true, 종료는 open=false 후 200ms 뒤 onClose로 언마운트.
export function ModalShell({
  onClose,
  dismissable = true,
  panelClassName,
  children,
}: ModalShellProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    window.setTimeout(onClose, 200);
  };

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    // 열릴 때 포커스를 패널로 이동하고, 닫힐 때 이전 포커스로 복원.
    const prevFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    // Esc로 닫기(닫기 가능한 모달만).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
      prevFocus?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={() => dismissable && close()}
    >
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        // 닫힘 상태: 모바일은 화면 아래로(slide), 데스크탑은 그 자리서 투명(fade).
        // 열림 상태: 둘 다 제자리 + 불투명.
        className={`relative outline-none transition duration-200 ease-out ${
          open
            ? "translate-y-0 opacity-100"
            : "translate-y-full opacity-100 sm:translate-y-0 sm:opacity-0"
        } ${panelClassName ?? ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {typeof children === "function" ? children(close) : children}
      </div>
    </div>
  );
}
