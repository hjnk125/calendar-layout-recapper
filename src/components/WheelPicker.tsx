import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, listPhotoMonths } from "../store";
import { ModalShell } from "./ModalShell";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const ITEM_HEIGHT = 44;
const VISIBLE_COUNT = 5;
const PAD_COUNT = Math.floor(VISIBLE_COUNT / 2);

type WheelColumnProps = {
  values: number[];
  selectedIndex: number;
  onChange: (idx: number) => void;
  formatLabel: (value: number) => string;
};

function WheelColumn({
  values,
  selectedIndex,
  onChange,
  formatLabel,
}: WheelColumnProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const settleTimer = useRef<number | null>(null);
  const [activeIdx, setActiveIdx] = useState<number>(selectedIndex);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = selectedIndex * ITEM_HEIGHT;
    setActiveIdx(selectedIndex);
  }, [selectedIndex]);

  const handleScroll = () => {
    const el = ref.current;
    if (!el) return;
    if (settleTimer.current !== null) {
      window.clearTimeout(settleTimer.current);
    }
    settleTimer.current = window.setTimeout(() => {
      if (!ref.current) return;
      const raw = ref.current.scrollTop / ITEM_HEIGHT;
      const idx = Math.max(0, Math.min(values.length - 1, Math.round(raw)));
      ref.current.scrollTo({ top: idx * ITEM_HEIGHT, behavior: "smooth" });
      // setState 업데이터는 순수해야 하므로 부모 콜백을 그 안에서 부르지 않는다.
      // 여기는 타이머 콜백(렌더 밖)이라 직접 호출해도 안전하다. 같은 값이면
      // React가 부모 setState를 알아서 bail-out 한다.
      setActiveIdx(idx);
      onChange(idx);
    }, 80);
  };

  return (
    <div className="relative flex-1">
      <div
        ref={ref}
        onScroll={handleScroll}
        className="relative h-[220px] overflow-y-scroll scrollbar-none"
        style={{
          scrollSnapType: "y mandatory",
          scrollbarWidth: "none",
        }}
      >
        <div style={{ height: PAD_COUNT * ITEM_HEIGHT }} />
        {values.map((value, idx) => {
          const isActive = idx === activeIdx;
          return (
            <div
              key={value}
              className={`flex items-center justify-center text-base transition-colors ${
                isActive ? "font-extrabold text-ink" : "text-muted"
              }`}
              style={{
                height: ITEM_HEIGHT,
                scrollSnapAlign: "center",
              }}
            >
              {formatLabel(value)}
            </div>
          );
        })}
        <div style={{ height: PAD_COUNT * ITEM_HEIGHT }} />
      </div>
      {/* 가운데 선택 영역 강조선 */}
      <div
        className="pointer-events-none absolute left-0 right-0 border-y border-ink"
        style={{
          top: PAD_COUNT * ITEM_HEIGHT,
          height: ITEM_HEIGHT,
        }}
      />
    </div>
  );
}

type WheelPickerProps = {
  initialYear: number;
  initialMonth: number; // 0~11
  // 적용은 내부에서 setMonth로 직접 한다 — 부모는 언마운트만 담당.
  onClose: () => void;
};

export function WheelPicker({
  initialYear,
  initialMonth,
  onClose,
}: WheelPickerProps) {
  const setMonth = useStore((s) => s.setMonth);
  const years = Array.from(
    { length: 11 },
    (_, i) => initialYear - 5 + i,
  );
  const months = Array.from({ length: 12 }, (_, i) => i);

  const [yearIdx, setYearIdx] = useState<number>(
    years.indexOf(initialYear) >= 0 ? years.indexOf(initialYear) : 5,
  );
  const [monthIdx, setMonthIdx] = useState<number>(initialMonth);

  // 사진이 들어간 달 목록(최신→과거). 2개 달 이상일 때만 점프 목록을 띄운다.
  const uploadedPhotos = useStore((s) => s.uploadedPhotos);
  const photoMonths = useMemo(
    () => listPhotoMonths(uploadedPhotos),
    [uploadedPhotos],
  );

  return (
    <ModalShell
      onClose={onClose}
      panelClassName="w-full max-w-[420px] border border-ink bg-paper p-5"
    >
      {(close) => {
        // 달을 적용하고 닫기 애니메이션 시작.
        const jump = (y: number, m: number) => {
          setMonth(y, m);
          close();
        };
        return (
          <>
            <h2 className="mb-4 text-center text-xs font-extrabold uppercase tracking-[0.14em] text-ink">
              Month & Year
            </h2>

            {photoMonths.length >= 2 && (
              <div className="mb-4">
                <p className="mb-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-muted">
                  With photos
                </p>
                <div
                  className="max-h-[160px] overflow-y-auto border border-ink"
                  style={{ scrollbarWidth: "none" }}
                >
                  {photoMonths.map(({ year, month, count }) => {
                    const isCurrent =
                      year === initialYear && month === initialMonth;
                    return (
                      <button
                        key={`${year}-${month}`}
                        type="button"
                        onClick={() => jump(year, month)}
                        className={`flex w-full items-center justify-between border-b border-ink/15 px-3 py-2.5 text-left text-sm last:border-b-0 active:bg-ink/5 ${
                          isCurrent ? "font-extrabold" : "font-semibold"
                        }`}
                      >
                        <span className="flex items-center gap-2 text-ink">
                          {isCurrent && (
                            <span className="h-1.5 w-1.5 rounded-full bg-ink" />
                          )}
                          {MONTH_LABELS[month]} {year}
                        </span>
                        <span className="text-muted">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <WheelColumn
                values={months}
                selectedIndex={monthIdx}
                onChange={setMonthIdx}
                formatLabel={(v) => MONTH_LABELS[v]}
              />
              <WheelColumn
                values={years}
                selectedIndex={yearIdx}
                onChange={setYearIdx}
                formatLabel={(v) => `${v}`}
              />
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={close}
                className="flex-1 rounded-pill border border-ink py-3 text-sm font-bold uppercase tracking-[0.04em] text-ink active:opacity-70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => jump(years[yearIdx], months[monthIdx])}
                className="flex-1 rounded-pill bg-ink py-3 text-sm font-extrabold uppercase tracking-[0.04em] text-white active:opacity-80"
              >
                Confirm
              </button>
            </div>
          </>
        );
      }}
    </ModalShell>
  );
}
