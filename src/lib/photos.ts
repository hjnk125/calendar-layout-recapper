import exifr from "exifr";
import type { UploadedPhoto } from "../types";

async function getNaturalSize(
  blobUrl: string,
): Promise<{ naturalWidth: number; naturalHeight: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      });
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = blobUrl;
  });
}

export async function loadUploadedPhoto(file: File): Promise<UploadedPhoto> {
  const blobUrl = URL.createObjectURL(file);
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
        const normalized = c.replace(
          /^(\d{4}):(\d{2}):(\d{2})/,
          "$1-$2-$3",
        );
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
    const size = await getNaturalSize(blobUrl);
    naturalWidth = size.naturalWidth;
    naturalHeight = size.naturalHeight;
  } catch {
    // 0으로 둔다
  }

  return {
    id,
    file,
    blobUrl,
    exifDate,
    naturalWidth,
    naturalHeight,
  };
}
