import type { ReactNode } from "react";
import { INK } from "../lib/theme";

// 프레임 가장자리에서 트림(캘린더) 박스까지의 거리.
const PAD = 24;
// 크롭마크 브래킷 길이 / 두께.
const ARM = 10;
// 등록 마크(원+십자가) 한 변 크기.
const REG = 16;

// 출력물(인쇄 교정쇄) 느낌을 주는 프레임: 바깥 네 모서리에 등록 마크
// (원을 관통하는 십자가), 트림 박스 코너에 크롭마크(L자 브래킷).
export function PrintFrame({ children }: { children: ReactNode }) {
  // 등록 마크 — 원(r=5)에, 원 밖으로 더 뻗는 전폭 십자선. 출력 레퍼런스와
  // 동일한 형태이며, REG×REG 크기로 그린다.
  const reg = (pos: "tl" | "tr" | "bl" | "br") => {
    const corner: Record<typeof pos, React.CSSProperties> = {
      tl: { left: 0, top: 0 },
      tr: { right: 0, top: 0 },
      bl: { left: 0, bottom: 0 },
      br: { right: 0, bottom: 0 },
    };
    const style: React.CSSProperties = { position: "absolute", ...corner[pos] };
    return (
      <svg
        key={`reg-${pos}`}
        width={REG}
        height={REG}
        viewBox="0 0 20 20"
        style={style}
        data-export-skip="true"
      >
        <circle cx="10" cy="10" r="5" fill="none" stroke={INK} strokeWidth="1" />
        <line x1="10" y1="0" x2="10" y2="20" stroke={INK} strokeWidth="1" />
        <line x1="0" y1="10" x2="20" y2="10" stroke={INK} strokeWidth="1" />
      </svg>
    );
  };

  // 크롭마크 — 트림 코너에서 가로 + 세로 헤어라인이 L자를 이룬다.
  const crop = (h: React.CSSProperties, v: React.CSSProperties) => (
    <>
      <span data-export-skip="true" style={{ position: "absolute", background: INK, height: 1, width: ARM, ...h }} />
      <span data-export-skip="true" style={{ position: "absolute", background: INK, width: 1, height: ARM, ...v }} />
    </>
  );

  return (
    <div style={{ position: "relative", padding: PAD }}>
      {reg("tl")}
      {reg("tr")}
      {reg("bl")}
      {reg("br")}
      {crop({ top: PAD, left: ARM }, { left: PAD, top: ARM })}
      {crop({ top: PAD, right: ARM }, { right: PAD, top: ARM })}
      {crop({ bottom: PAD, left: ARM }, { left: PAD, bottom: ARM })}
      {crop({ bottom: PAD, right: ARM }, { right: PAD, bottom: ARM })}
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}
