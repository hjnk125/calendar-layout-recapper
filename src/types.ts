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
  file: File;
  blobUrl: string;
  exifDate?: Date;
  naturalWidth: number;
  naturalHeight: number;
};

export const DEFAULT_POSITION: Position = { x: 50, y: 50 };
