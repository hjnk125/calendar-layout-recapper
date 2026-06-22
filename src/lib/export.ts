import { format } from "date-fns";
import { getMonthGrid, getWeekdayLabels } from "./calendar";
import { CARD_THEMES, type CalendarTheme } from "./theme";
import {
  RATIO_VALUES,
  type PhotoEntry,
  type Ratio,
  type UploadedPhoto,
  type WeekStart,
} from "../types";

type ExportSize = { width: number; height: number };

// 긴 변 4096px(고해상도). 소스 사진은 업로드 시 ~1280px로 다운스케일돼 있고,
// 합성은 캔버스에 한 장씩 그리므로 모바일에서도 메모리 부담이 작다.
const EXPORT_SIZES: Record<Ratio, ExportSize> = {
  "1:1": { width: 4096, height: 4096 },
  "4:5": { width: 3276, height: 4095 },
  "9:16": { width: 2304, height: 4096 },
  "3:4": { width: 3072, height: 4096 },
  "4:3": { width: 4096, height: 3072 },
};

export type ExportArgs = {
  year: number;
  month: number;
  weekStart: WeekStart;
  ratio: Ratio;
  theme: CalendarTheme;
  entries: Record<string, PhotoEntry>;
  uploadedPhotos: Record<string, UploadedPhoto>;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("load failed"));
    img.src = src;
  });
}

// 캘린더를 캔버스에 직접 합성한다(html-to-image 미사용 — iOS의 SVG <img> 렌더
// 버그를 피하고, DOM 복제/2-pass 없이 빨라 navigator.share의 user activation도
// 유지된다). 사진은 한 장씩 로드→drawImage→해제해 피크 메모리를 최소화한다.
async function renderCalendar(args: ExportArgs): Promise<HTMLCanvasElement> {
  const { year, month, weekStart, ratio, theme, entries, uploadedPhotos } =
    args;
  const { width: W, height: H } = EXPORT_SIZES[ratio];
  const t = CARD_THEMES[theme];
  const cqw = W / 100; // Calendar.tsx의 cqw 단위를 픽셀로
  const landscape = RATIO_VALUES[ratio] > 1; // 4:3 등 — 풋터 생략 + 밴드 압축
  const showFooter = !landscape;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");

  // 폰트(Akt) 로드 보장 — 안 그러면 폴백 폰트로 그려진다.
  try {
    await Promise.all([
      document.fonts.load(`700 ${7.2 * cqw}px Akt`),
      document.fonts.load(`600 ${3.2 * cqw}px Akt`),
    ]);
  } catch {
    // 폰트 로드 실패해도 폴백으로 진행
  }

  const hair = Math.max(1, cqw * 0.22); // 1px@~온스크린 카드에 대응하는 헤어라인

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.strokeStyle = t.line;
    ctx.lineWidth = hair;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  const setFont = (weight: number, sizeCqw: number, lsEm = 0) => {
    ctx.font = `${weight} ${sizeCqw * cqw}px Akt, -apple-system, BlinkMacSystemFont, sans-serif`;
    try {
      ctx.letterSpacing = `${lsEm * sizeCqw * cqw}px`;
    } catch {
      // letterSpacing 미지원 브라우저 — 자간 없이 진행
    }
  };

  // 배경(종이)
  ctx.fillStyle = t.paper;
  ctx.fillRect(0, 0, W, H);

  // ── 밴드 높이(cqw) — Calendar.tsx의 padding/폰트와 동일한 식 ──────────────
  const headerFont = landscape ? 5.4 : 7.2;
  const weekdayFont = landscape ? 2.4 : 2.9;
  const headerPadT = landscape ? 2.8 : 4.2;
  const headerPadB = landscape ? 2.2 : 3.2;
  const weekdayPadT = landscape ? 1.1 : 1.7;
  const weekdayPadB = landscape ? 0.9 : 1.5;
  const footerPad = 2.6;
  const sidePad = 5 * cqw;

  const headerH = (headerPadT + headerFont * 0.9 + headerPadB) * cqw;
  const weekdayH = (weekdayPadT + weekdayFont + weekdayPadB) * cqw;
  const footerH = showFooter ? (footerPad + 3.4 + footerPad) * cqw : 0;

  // ── 헤더 밴드: 월 이름(좌) + 2자리 숫자(우) ──────────────────────────────
  ctx.fillStyle = t.headerInk;
  ctx.textBaseline = "middle";
  const headerMid = (headerPadT * cqw + (headerH - headerPadB * cqw)) / 2;
  setFont(700, headerFont, -0.02);
  ctx.textAlign = "left";
  ctx.fillText(format(new Date(year, month, 1), "MMM").toUpperCase(), sidePad, headerMid);
  setFont(600, headerFont, -0.03);
  ctx.textAlign = "right";
  ctx.fillText(String(month + 1).padStart(2, "0"), W - sidePad, headerMid);
  drawLine(0, headerH, W, headerH);

  // ── 요일 밴드: 7칸 중앙 정렬 ──────────────────────────────────────────────
  const cellW = W / 7;
  const weekdayTop = headerH;
  const weekdayMid =
    weekdayTop + (weekdayPadT * cqw + (weekdayH - weekdayPadB * cqw)) / 2;
  setFont(600, weekdayFont, 0.04);
  ctx.textAlign = "center";
  ctx.fillStyle = t.headerInk;
  getWeekdayLabels(weekStart).forEach((label, c) => {
    ctx.fillText(label, c * cellW + cellW / 2, weekdayMid);
  });
  drawLine(0, weekdayTop + weekdayH, W, weekdayTop + weekdayH);

  // ── 그리드 ────────────────────────────────────────────────────────────────
  const gridTop = headerH + weekdayH;
  const gridBottom = H - footerH;
  const gridH = gridBottom - gridTop;
  const rows = getMonthGrid(year, month, weekStart);
  const cellH = gridH / rows.length;

  // 사진을 한 장씩 로드→그리고→해제(피크 메모리 ≈ 1장).
  for (let r = 0; r < rows.length; r += 1) {
    for (let c = 0; c < 7; c += 1) {
      const cell = rows[r][c];
      if (!cell.iso) continue;
      const entry = entries[cell.iso];
      const photo = entry ? uploadedPhotos[entry.photoId] : undefined;
      if (!entry || !photo) continue;
      const cellX = c * cellW;
      const cellY = gridTop + r * cellH;
      try {
        const img = await loadImage(photo.blobUrl);
        const iw = img.naturalWidth || 1;
        const ih = img.naturalHeight || 1;
        // object-cover + object-position 재현
        const scale = Math.max(cellW / iw, cellH / ih);
        const sw = cellW / scale;
        const sh = cellH / scale;
        const sx = (iw - sw) * (entry.position.x / 100);
        const sy = (ih - sh) * (entry.position.y / 100);
        ctx.drawImage(img, sx, sy, sw, sh, cellX, cellY, cellW, cellH);
        img.src = ""; // 디코딩 비트맵 해제 힌트
      } catch {
        // 사진 못 그림 — 빈 칸으로 둔다
      }
    }
  }

  // 내부 그리드 헤어라인(마지막 열/행은 외곽선과 겹치므로 생략)
  for (let c = 1; c < 7; c += 1) drawLine(c * cellW, gridTop, c * cellW, gridBottom);
  // r=0(요일/그리드 경계선)부터 다시 그린다. 첫 주 사진을 gridTop부터 그리면
  // 사진이 이 경계선의 아래 절반을 덮어 선이 얇아지고 사진이 위로 ~1px 삐져나와
  // 보인다. 사진 위에 경계선을 다시 얹어 온전한 두께로 덮는다.
  for (let r = 0; r < rows.length; r += 1)
    drawLine(0, gridTop + r * cellH, W, gridTop + r * cellH);

  // ── 날짜 숫자 ─────────────────────────────────────────────────────────────
  const [, strokeColor] = t.photoInkStroke.split(" ");
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  setFont(600, 3.2);
  ctx.letterSpacing = "0px";
  ctx.lineJoin = "round";
  for (let r = 0; r < rows.length; r += 1) {
    for (let c = 0; c < 7; c += 1) {
      const cell = rows[r][c];
      if (cell.dayNumber == null) continue;
      const entry = cell.iso ? entries[cell.iso] : undefined;
      const hasPhoto = Boolean(entry && uploadedPhotos[entry.photoId]);
      const x = c * cellW + 1.4 * cqw;
      const y = gridTop + r * cellH + 1.4 * cqw;
      const label = String(cell.dayNumber);
      if (hasPhoto) {
        // 반대색 외곽선 → 채움(paint-order: stroke 재현)
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 0.22 * cqw * 2;
        ctx.strokeText(label, x, y);
      }
      ctx.fillStyle = t.dayInk;
      ctx.fillText(label, x, y);
    }
  }

  // ── 풋터 밴드: RECAPPER(좌) + 연도(우) ───────────────────────────────────
  if (showFooter) {
    const footerMid = gridBottom + footerH / 2;
    ctx.fillStyle = t.headerInk;
    ctx.textBaseline = "middle";
    setFont(700, 3.4, 0.14);
    ctx.textAlign = "left";
    ctx.fillText("RECAPPER", sidePad, footerMid);
    setFont(600, 3.4, 0.04);
    ctx.textAlign = "right";
    ctx.fillText(String(year), W - sidePad, footerMid);
    drawLine(0, gridBottom, W, gridBottom);
  }

  // 카드 외곽선
  ctx.strokeStyle = t.line;
  ctx.lineWidth = hair;
  ctx.strokeRect(hair / 2, hair / 2, W - hair, H - hair);

  return canvas;
}

export async function exportCalendarJpg(args: ExportArgs): Promise<void> {
  const canvas = await renderCalendar(args);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92),
  );
  // 합성 캔버스 버퍼 즉시 회수
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) throw new Error("toBlob failed");

  const filename = `recap-${args.year}-${String(args.month + 1).padStart(2, "0")}.jpg`;
  const file = new File([blob], filename, { type: "image/jpeg" });

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  const isMobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 && /Macintosh/.test(navigator.userAgent));

  // 모바일 → Web Share(인스타그램/사진 저장 선택). 캔버스 합성은 빨라서
  // user activation이 유지돼 share가 거부되지 않는다. 데스크탑/실패 → 다운로드.
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
