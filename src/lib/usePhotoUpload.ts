import { useRef, useState } from "react";
import { format } from "date-fns";
import { useStore, suggestMostRecentMonth } from "../store";
import { loadUploadedPhoto } from "./photos";
import { useDialog } from "./dialog";
import { useToast } from "./toast";
import type { UploadedPhoto } from "../types";

// 한 번에 디코딩하는 원본 사진 수. 각 사진은 다운스케일 전에 원본을 통째로
// 디코딩하므로(고화소 사진 = 수십 MB/장), 전부 병렬로 돌리면 모바일이 메모리로
// 죽는다. 소수만 동시에 처리해 피크 메모리를 억제한다.
const LOAD_CONCURRENCY = 3;

// 벌크 로드의 settled 결과: 성공적으로 로드된 사진 + 실패한 개수. 파일 하나가
// 잘못됐다고 배치 전체를 중단하지 않고, 부분 실패 피드백을 호출자에게 제공한다.
// 동시성을 LOAD_CONCURRENCY로 제한하고 onProgress로 완료 개수를 통지한다.
async function loadAllSettled(
  files: File[],
  onProgress: (done: number) => void,
): Promise<{
  photos: UploadedPhoto[];
  failedCount: number;
}> {
  const photos: UploadedPhoto[] = [];
  let failedCount = 0;
  let done = 0;
  let next = 0;

  const worker = async () => {
    while (next < files.length) {
      const file = files[next++];
      try {
        photos.push(await loadUploadedPhoto(file));
      } catch {
        failedCount += 1;
      } finally {
        done += 1;
        onProgress(done);
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(LOAD_CONCURRENCY, files.length) },
    worker,
  );
  await Promise.all(workers);
  return { photos, failedCount };
}

type UsePhotoUploadResult = {
  isLoading: boolean;
  // 벌크 로딩 진행률(done/total). 단일 업로드나 비로딩 시 null.
  bulkProgress: { done: number; total: number } | null;
  bulkInputRef: React.RefObject<HTMLInputElement | null>;
  singleInputRef: React.RefObject<HTMLInputElement | null>;
  onBulkSelected: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onSingleSelected: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  openBulkPicker: () => void;
  openDumpMore: () => void;
  openSinglePickerFor: (date: string) => void;
};

export function usePhotoUpload(): UsePhotoUploadResult {
  const year = useStore((s) => s.year);
  const month = useStore((s) => s.month);
  const setMonth = useStore((s) => s.setMonth);
  const addPhotos = useStore((s) => s.addPhotos);
  const addPhotoAndAssign = useStore((s) => s.addPhotoAndAssign);

  const [isLoading, setIsLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const bulkInputRef = useRef<HTMLInputElement | null>(null);
  const singleInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSingleDateRef = useRef<string | null>(null);
  // true면 이번 벌크 업로드(Dump more)는 자동 월 전환을 하지 않고 현재 달 유지.
  const keepMonthRef = useRef(false);

  // 첫 화면 벌크 업로드 — 현재 달에 매칭이 없으면 최근 달로 자동 전환 가능.
  const openBulkPicker = () => {
    keepMonthRef.current = false;
    bulkInputRef.current?.click();
  };

  // 에디터에서 사진 더 추가(Dump more) — 보고 있는 달을 고정(전환 안 함).
  const openDumpMore = () => {
    keepMonthRef.current = true;
    bulkInputRef.current?.click();
  };

  const openSinglePickerFor = (date: string) => {
    pendingSingleDateRef.current = date;
    singleInputRef.current?.click();
  };

  const onBulkSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    if (files.length === 0) return;

    setIsLoading(true);
    setBulkProgress({ done: 0, total: files.length });
    try {
      const { photos, failedCount } = await loadAllSettled(files, (done) =>
        setBulkProgress({ done, total: files.length }),
      );
      const result = addPhotos(photos);

      if (failedCount > 0) {
        useDialog.getState().alert(`Couldn't load ${failedCount} photo(s).`);
      }

      // 현재 달에 배치된 사진이 하나도 없으면, 묻지 않고 풀에서 사진이 있는
      // 가장 최근 달로 곧바로 전환한다(전환 사실은 토스트로 알린다).
      const state = useStore.getState();
      const stillEmpty =
        Object.keys(state.entries).length === 0 &&
        Object.keys(state.pendingConflicts).length === 0;
      // Dump more(keepMonth)에선 달을 고정한다. 첫 화면 업로드에서만 자동 전환.
      if (
        !keepMonthRef.current &&
        stillEmpty &&
        result.placedCount === 0 &&
        result.conflictCount === 0
      ) {
        const suggestion = suggestMostRecentMonth(
          state.uploadedPhotos,
          year,
          month,
        );
        if (suggestion) {
          setMonth(suggestion.year, suggestion.month);
          const label = format(
            new Date(suggestion.year, suggestion.month, 1),
            "MMM yyyy",
          );
          useToast
            .getState()
            .show(`Showing ${label}\nmoved to your most recent month with photos`);
        } else if (photos.length > 0) {
          useDialog
            .getState()
            .alert(`None of the ${photos.length} photo(s) have a usable date.`);
        }
      }
    } finally {
      setIsLoading(false);
      setBulkProgress(null);
      keepMonthRef.current = false;
    }
  };

  const onSingleSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const date = pendingSingleDateRef.current;
    pendingSingleDateRef.current = null;
    if (!file || !date) return;

    setIsLoading(true);
    try {
      const photo = await loadUploadedPhoto(file);
      addPhotoAndAssign(date, photo);
    } catch {
      useDialog.getState().alert("Couldn't load that photo.");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    bulkProgress,
    bulkInputRef,
    singleInputRef,
    onBulkSelected,
    onSingleSelected,
    openBulkPicker,
    openDumpMore,
    openSinglePickerFor,
  };
}
