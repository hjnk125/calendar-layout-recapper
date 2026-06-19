import { toJpeg } from "html-to-image";
import type { Ratio } from "../types";

type ExportSize = { width: number; height: number };

// 긴 변을 4096px로 — 모바일 Safari 캔버스 한계(한 변 ~4096px, 면적 ~16.7M px²)
// 안에서 뽑을 수 있는 가장 큰 사이즈. 이걸 넘으면 빈 이미지가 나올 수 있다.
// 비율은 그대로 유지(아래 값은 모두 해당 비율에 정확히 맞는 정수).
const EXPORT_SIZES: Record<Ratio, ExportSize> = {
  "1:1": { width: 4096, height: 4096 },
  "4:5": { width: 3276, height: 4095 },
  "9:16": { width: 2304, height: 4096 },
  "3:4": { width: 3072, height: 4096 },
  "4:3": { width: 4096, height: 3072 },
};

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export type ExportArgs = {
  node: HTMLElement;
  ratio: Ratio;
  // 캘린더 종이 색(White/Black 테마) — 레터박스 여백을 채운다.
  backgroundColor: string;
  year: number;
  month: number;
};

export async function exportCalendarJpg({
  node,
  ratio,
  backgroundColor,
  year,
  month,
}: ExportArgs): Promise<void> {
  const target = EXPORT_SIZES[ratio];
  const offsetW = node.offsetWidth || target.width;
  const pixelRatio = target.width / offsetW;

  const dataUrl = await toJpeg(node, {
    quality: 0.92,
    pixelRatio,
    backgroundColor,
    // cacheBust는 모든 리소스 URL에 `?timestamp`를 붙이는데, 이게 blob: URL을
    // 깨뜨린다(blob은 일반 URL이 아니라 불투명 식별자다) — 끈다.
    cacheBust: false,
    // Akt는 /fonts/akt.woff2(가변폰트)로 자체 호스팅돼 있어, html-to-image가
    // (동일 출처) 스타일시트를 읽어 @font-face를 SVG에 임베드할 수 있다.
    skipFonts: false,
    width: offsetW,
    height: node.offsetHeight,
    // data-export-skip이 붙은 DOM은 제외한다(빈 칸의 `+` 글리프와 인라인
    // "Add Photos" CTA는 저장 이미지에 나오면 안 된다).
    filter: (n) => {
      if (!(n instanceof HTMLElement)) return true;
      return n.dataset?.exportSkip !== "true";
    },
  });

  const blob = dataUrlToBlob(dataUrl);
  const filename = `recap-${year}-${String(month + 1).padStart(2, "0")}.jpg`;
  const file = new File([blob], filename, { type: "image/jpeg" });

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };

  // 모바일(iOS/Android) → Web Share를 써서 사용자가 인스타그램 / 사진 저장을
  // 고를 수 있게 한다. 데스크탑 → 그냥 다운로드(macOS의 공유 시트는 이 흐름엔
  // 어색하고, Windows/Linux는 아예 없는 경우가 많다).
  const isMobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 && /Macintosh/.test(navigator.userAgent));

  if (isMobile && nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file] });
      return;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      // 그 외 공유 에러는 다운로드로 폴백
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
