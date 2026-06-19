import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Calendar } from "./components/Calendar";
import { PrintFrame } from "./components/PrintFrame";
import { StyleControls } from "./components/StyleControls";
import { WheelPicker } from "./components/WheelPicker";
import { ConflictModal } from "./components/ConflictModal";
import { EditSheet } from "./components/EditSheet";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { HowItWorksList, HowItWorksSheet } from "./components/HowItWorks";
import { DialogHost } from "./components/DialogHost";
import { ToastHost } from "./components/ToastHost";
import { TextAction } from "./components/TextAction";
import { useDialog } from "./lib/dialog";
import { useStore } from "./store";
import { exportCalendarJpg } from "./lib/export";
import { usePhotoUpload } from "./lib/usePhotoUpload";

function App() {
  const year = useStore((s) => s.year);
  const month = useStore((s) => s.month);
  const weekStart = useStore((s) => s.weekStart);
  const entries = useStore((s) => s.entries);
  const uploadedPhotos = useStore((s) => s.uploadedPhotos);
  const ratio = useStore((s) => s.ratio);
  const calendarTheme = useStore((s) => s.calendarTheme);
  const setMonth = useStore((s) => s.setMonth);
  const clearAllPhotos = useStore((s) => s.clearAllPhotos);

  const {
    isLoading,
    bulkProgress,
    bulkInputRef,
    singleInputRef,
    onBulkSelected,
    onSingleSelected,
    openBulkPicker,
    openDumpMore,
    openSinglePickerFor,
  } = usePhotoUpload();

  const [showWheel, setShowWheel] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // 에디터에서 "How it works" 안내 오버레이 표시 여부.
  const [showHelp, setShowHelp] = useState(false);
  // 사진을 한 장도 안 올렸어도 "직접 하나씩" 경로로 에디터에 진입한 상태.
  const [manualMode, setManualMode] = useState(false);

  const hasPhotos = Object.keys(uploadedPhotos).length > 0;
  // 온보딩(샘플) 대신 실제 에디터 화면을 보여줄지 — 업로드했거나 수동 진입했거나.
  const inEditor = hasPhotos || manualMode;
  const navLabel = `${format(new Date(year, month, 1), "MMM").toUpperCase()} ${year}`;

  // "직접 하나씩 올리기"로 진입: 빈 에디터를 연다(달은 이미 기본값이 지난달).
  const enterManual = () => setManualMode(true);

  // 영속성이 없어 새로고침/닫기 시 사진·배치가 전부 사라진다. 사진이 하나라도
  // 있으면 beforeunload로 실수 이탈을 막는다(문구는 브라우저 기본, 커스텀 불가).
  useEffect(() => {
    if (!hasPhotos) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasPhotos]);

  const stepMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setMonth(next.getFullYear(), next.getMonth());
  };

  const onClearAll = async () => {
    if (!hasPhotos) return;
    const ok = await useDialog.getState().confirm(
      "Remove all uploaded photos? This can't be undone.",
      { confirmLabel: "Clear all", danger: true },
    );
    if (ok) clearAllPhotos();
  };

  const onCellClick = (iso: string, hasEntry: boolean) => {
    if (hasEntry) setEditingDate(iso);
    else openSinglePickerFor(iso);
  };

  const onSaveClick = async () => {
    setIsSaving(true);
    try {
      await exportCalendarJpg({
        year,
        month,
        weekStart,
        ratio,
        theme: calendarTheme,
        entries,
        uploadedPhotos,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // 공유 취소 — 아무것도 하지 않음
      } else {
        console.error("export failed", err);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col items-center px-5 pb-28 pt-8">
      <div className="w-full max-w-[460px]">
        {/* 마스트헤드 */}
        <header className="mb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-[12px] font-extrabold uppercase leading-[24px] tracking-[0.16em] text-ink">
              Recapper
            </h1>
            {inEditor && (
              <div className="flex items-center gap-1 text-sm font-extrabold text-ink">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => stepMonth(-1)}
                  className="opacity-35 active:opacity-70"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height="24px"
                    viewBox="0 -960 960 960"
                    width="24px"
                    fill="currentColor"
                  >
                    <path d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setShowWheel(true)}
                  className="tracking-[0.02em] active:opacity-70"
                >
                  {navLabel}
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => stepMonth(1)}
                  className="opacity-35 active:opacity-70"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height="24px"
                    viewBox="0 -960 960 960"
                    width="24px"
                    fill="currentColor"
                    className="-scale-x-100"
                  >
                    <path d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {!inEditor && (
            <h2 className="mt-3 text-[32px] font-black uppercase leading-[1.05] tracking-[-0.035em] text-ink">
              Last month,
              <br />
              in one frame.
            </h2>
          )}
        </header>

        {/* 출력 프레임 안의 캘린더 */}
        <PrintFrame>
          <div className="relative">
            <div style={{ opacity: inEditor ? 1 : 0.42 }}>
              <Calendar
                year={year}
                month={month}
                ratio={ratio}
                weekStart={weekStart}
                entries={entries}
                uploadedPhotos={uploadedPhotos}
                theme={calendarTheme}
                sample={!inEditor}
                onCellClick={onCellClick}
              />
            </div>

            {!inEditor && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                data-export-skip="true"
                style={{
                  background:
                    "radial-gradient(circle at center, rgba(234,234,234,0.82) 40%, rgba(234,234,234,0.5))",
                }}
              >
                <button
                  type="button"
                  onClick={openBulkPicker}
                  className="flex items-center gap-2 rounded-pill bg-ink px-5 py-3 active:opacity-80"
                  style={{ boxShadow: "0 8px 18px -6px rgba(20,18,12,0.5)" }}
                >
                  <span className="text-[17px] font-light leading-none text-white">
                    +
                  </span>
                  <span className="text-[13px] font-extrabold uppercase tracking-[0.04em] text-white">
                    Dump your photos
                  </span>
                </button>
                <TextAction onClick={enterManual}>
                  Or add them one by one
                </TextAction>
                <p className="mt-1 max-w-[220px] text-center text-[10px] font-medium leading-snug text-ink/55">
                  Picking lots of photos may take a moment on mobile before they
                  load.
                </p>
              </div>
            )}
          </div>
        </PrintFrame>

        {/* 캔버스 아래: 캡션 + 컨트롤 (사진이 있을 때만) */}
        {inEditor ? (
          <div className="mt-8 px-1">
            <StyleControls />
            {/* 보조 액션 줄 — 스타일 토글과 분리. 좌: 도움말 / 우: 추가(Dump
                more, 현재 달 고정) · 파괴적 전체삭제(누를 때 red + 확인). */}
            <div className="mt-6 flex items-center justify-between">
              <TextAction onClick={() => setShowHelp(true)}>
                How it works
              </TextAction>
              <div className="flex items-center gap-4">
                <TextAction onClick={openDumpMore}>Dump more</TextAction>
                <TextAction onClick={onClearAll} danger disabled={!hasPhotos}>
                  Clear all
                </TextAction>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <HowItWorksList />
          </div>
        )}
      </div>

      {/* Save · Share — 스크롤과 무관하게 뷰포트 하단에 고정되는 바.
          종이색 페이드 배경으로 스크롤되는 콘텐츠가 비쳐도 깔끔하게 덮는다. */}
      {inEditor && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-6"
          style={{
            background:
              "linear-gradient(to top, #EAEAEA 62%, rgba(234,234,234,0))",
          }}
        >
          <button
            type="button"
            onClick={onSaveClick}
            disabled={isSaving}
            className="pointer-events-auto w-full max-w-[460px] rounded-pill bg-ink py-3.5 text-sm font-extrabold uppercase tracking-[0.08em] text-white active:opacity-80 disabled:opacity-60"
          >
            Save · Share
          </button>
        </div>
      )}

      {/* 숨김 파일 입력 */}
      <input
        ref={bulkInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={onBulkSelected}
      />
      <input
        ref={singleInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onSingleSelected}
      />

      {editingDate && (
        <EditSheet date={editingDate} onClose={() => setEditingDate(null)} />
      )}

      {showWheel && (
        <WheelPicker
          initialYear={year}
          initialMonth={month}
          onClose={() => setShowWheel(false)}
        />
      )}

      <ConflictModal />

      {showHelp && <HowItWorksSheet onClose={() => setShowHelp(false)} />}

      {isLoading && (
        <LoadingOverlay
          message={
            bulkProgress
              ? `Reading photos ${bulkProgress.done} / ${bulkProgress.total}`
              : "Reading photos…"
          }
        />
      )}
      {isSaving && <LoadingOverlay message="Saving…" />}

      <DialogHost />
      <ToastHost />
    </div>
  );
}

export default App;
