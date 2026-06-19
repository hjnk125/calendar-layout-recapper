import exifr from "exifr";
import type { UploadedPhoto } from "../types";

// 칸 하나는 export(긴 변 4096px)에서도 최대 ~600px라, 원본 사진(보통 3000~4000px+)을
// 그대로 들고 있으면 메모리만 잡아먹고 export 때 OOM으로 사진이 누락된다.
// 업로드 시 긴 변을 이 값으로 다운스케일해 메모리를 크게 줄인다(칸이 작아 화질
// 손실은 체감 없음). EXIF는 다운스케일 전 원본 파일에서 먼저 읽는다.
const MAX_DIM = 1280;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

// 긴 변이 MAX_DIM을 넘으면 캔버스로 축소해 새 blob(JPEG)을 만든다.
// 반환: 다운스케일했으면 {blobUrl, width, height}, 아니면 null(원본 유지).
async function downscale(
  img: HTMLImageElement,
): Promise<{ blobUrl: string; width: number; height: number } | null> {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const long = Math.max(w, h);
  if (!long || long <= MAX_DIM) return null;
  const scale = MAX_DIM / long;
  const dw = Math.round(w * scale);
  const dh = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, dw, dh);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  // 디코딩에 쓴 캔버스 버퍼를 즉시 0으로 줄여 메모리를 빨리 회수한다
  // (동시 처리 중 피크 메모리를 낮추는 데 도움).
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) return null;
  return { blobUrl: URL.createObjectURL(blob), width: dw, height: dh };
}

export async function loadUploadedPhoto(file: File): Promise<UploadedPhoto> {
  let blobUrl = URL.createObjectURL(file);
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  let exifDate: Date | undefined;
  try {
    // EXIF 블록 전체를 파싱한다(태그 필터 없이) — 세그먼트 배치에 따라
    // 기본 태그 선택 모드가 놓치는 필드에 촬영일이 묻혀 있는 이미지가 있다.
    // 그런 다음 여러 필드를 우선순위(가장 구체적 → 덜 구체적) 순으로 확인.
    const parsed = await exifr.parse(file);
    const candidates: unknown[] = [
      parsed?.DateTimeOriginal,
      parsed?.CreateDate,
      parsed?.DateTimeDigitized,
      parsed?.DateTime,
      parsed?.ModifyDate,
    ];
    for (const c of candidates) {
      if (c instanceof Date && !Number.isNaN(c.getTime())) {
        exifDate = c;
        break;
      }
      if (typeof c === "string") {
        // EXIF 문자열은 보통 "YYYY:MM:DD HH:MM:SS" 형태다 — Date가 파싱할 수
        // 있도록 날짜 부분의 ":"를 바꿔준다.
        const normalized = c.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
        const d = new Date(normalized);
        if (!Number.isNaN(d.getTime())) {
          exifDate = d;
          break;
        }
      }
    }
  } catch {
    exifDate = undefined;
  }

  // 폴백: EXIF가 없으면(다운로드 이미지, 스크린샷, 메타데이터를 벗겨낸
  // 편집본) 파일의 lastModified 날짜를 쓴다. 촬영일만큼 정확하진 않지만,
  // 이런 사진도 조용히 버려지는 대신 벌크 업로드에 참여할 수 있게 한다.
  if (!exifDate && file.lastModified) {
    const d = new Date(file.lastModified);
    if (!Number.isNaN(d.getTime())) exifDate = d;
  }

  let naturalWidth = 0;
  let naturalHeight = 0;
  try {
    const img = await loadImage(blobUrl);
    naturalWidth = img.naturalWidth;
    naturalHeight = img.naturalHeight;
    // 큰 사진은 다운스케일해 메모리를 절약하고 원본 blob은 해제한다.
    // (종횡비는 보존되므로 드래그 패닝 계산엔 영향 없다.)
    const reduced = await downscale(img);
    if (reduced) {
      URL.revokeObjectURL(blobUrl);
      blobUrl = reduced.blobUrl;
      naturalWidth = reduced.width;
      naturalHeight = reduced.height;
    }
    // 디코딩한 원본 비트맵 해제 힌트(동시 처리 중 피크 메모리 절감).
    img.src = "";
  } catch {
    // 이미지를 못 읽음 — 0으로 둔다(드래그는 'none'으로 처리됨).
  }

  return {
    id,
    blobUrl,
    exifDate,
    naturalWidth,
    naturalHeight,
  };
}
