import type { ReactNode } from "react";
import { useStore } from "../store";
import { RATIO_ORDER } from "../lib/theme";

// 캔버스 아래 스타일 컨트롤 패널 — 비율 / 테마 / 주 시작 요일을 "라벨 +
// 라디오탭" 형태로 통일한다. (도움말·전체삭제 같은 보조 액션은 App의 별도
// 줄에서 다룬다 — 여기는 스타일 토글만.)
export function StyleControls() {
  const ratio = useStore((s) => s.ratio);
  const setRatio = useStore((s) => s.setRatio);
  const theme = useStore((s) => s.calendarTheme);
  const setTheme = useStore((s) => s.setCalendarTheme);
  const weekStart = useStore((s) => s.weekStart);
  const setWeekStart = useStore((s) => s.setWeekStart);

  return (
    <div className="w-full space-y-2.5">
      <ControlRow label="Ratio">
        {RATIO_ORDER.map((r) => (
          <Pill key={r} selected={r === ratio} onClick={() => setRatio(r)}>
            {r}
          </Pill>
        ))}
      </ControlRow>

      <ControlRow label="Theme">
        <Pill selected={theme === "white"} onClick={() => setTheme("white")}>
          White
        </Pill>
        <Pill selected={theme === "black"} onClick={() => setTheme("black")}>
          Black
        </Pill>
      </ControlRow>

      <ControlRow label="Week">
        <Pill selected={weekStart === "sun"} onClick={() => setWeekStart("sun")}>
          Sun
        </Pill>
        <Pill selected={weekStart === "mon"} onClick={() => setWeekStart("mon")}>
          Mon
        </Pill>
      </ControlRow>
    </div>
  );
}

type ControlRowProps = {
  label: string;
  children: ReactNode;
};

// 라벨 칼럼 + 라디오탭 그룹. 라벨 폭을 고정해 세 줄의 탭 시작점을 정렬한다.
function ControlRow({ label, children }: ControlRowProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 shrink-0 text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

type PillProps = {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
};

// 세 그룹이 공유하는 단일 라디오탭 pill — 통일된 선택/비선택 스타일.
function Pill({ selected, onClick, children }: PillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-pill px-3 py-1.5 text-xs transition-colors ${
        selected
          ? "bg-ink font-extrabold text-white"
          : "border border-ink font-bold text-ink"
      }`}
    >
      {children}
    </button>
  );
}
