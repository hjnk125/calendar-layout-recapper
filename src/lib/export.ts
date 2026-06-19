import { toJpeg } from "html-to-image";
import type { Ratio } from "../types";

type ExportSize = { width: number; height: number };

// 긴 변 4096px(고해상도). 소스 사진을 업로드 시 ~1280px로 다운스케일(photos.ts)해
// 두므로, 모바일에서도 이 크기로 메모리 문제 없이 추출된다. 비율은 유지(아래 값은
// 해당 비율에 정확히 맞는 정수).
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
  // 모바일(iOS/Android) 판별 — 공유 방식 선택에 쓰인다.
  const isMobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 && /Macintosh/.test(navigator.userAgent));

  // 소스 사진을 업로드 시 다운스케일(photos.ts)해 두므로 모바일에서도 긴 변
  // 4096 export가 메모리 문제 없이 동작한다.
  const target = EXPORT_SIZES[ratio];
  const offsetW = node.offsetWidth || target.width;
  const pixelRatio = target.width / offsetW;

  // 캡처 전에 모든 사진 디코딩을 보장한다(미디코딩 상태면 빈 칸으로 찍힌다).
  await Promise.all(
    Array.from(node.querySelectorAll("img")).map((img) =>
      img.decode().catch(() => undefined),
    ),
  );

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

  // 모바일 → Web Share(인스타그램/사진 저장 선택). 데스크탑 → 다운로드.
  // (isMobile은 위에서 이미 판별)
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
