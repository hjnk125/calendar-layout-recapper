export type Ratio = "1:1" | "4:5" | "9:16" | "3:4" | "4:3";
export type WeekStart = "sun" | "mon";

export const RATIO_VALUES: Record<Ratio, number> = {
  "1:1": 1 / 1,
  "4:5": 4 / 5,
  "9:16": 9 / 16,
  "3:4": 3 / 4,
  "4:3": 4 / 3,
};

export type Position = {
  x: number;
  y: number;
};

export type PhotoEntry = {
  date: string;
  photoId: string;
  position: Position;
};

export type UploadedPhoto = {
  id: string;
  // 업로드 시 다운스케일된(긴 변 ≤ MAX_DIM) JPEG의 blob URL. 원본은 메모리
  // 절약을 위해 보관하지 않는다(EXIF는 로드 시 원본에서 미리 추출).
  blobUrl: string;
  exifDate?: Date;
  naturalWidth: number;
  naturalHeight: number;
};

export const DEFAULT_POSITION: Position = { x: 50, y: 50 };
