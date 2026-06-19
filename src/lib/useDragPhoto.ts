import { useMemo, useRef, useState } from "react";
import type React from "react";
import { DEFAULT_POSITION, type Position } from "../types";

// 드래그 축은 이미지 비율과 칸 비율을 비교해 결정한다:
// 더 넓은 이미지 → 가로 패닝, 더 긴 이미지 → 세로 패닝.
type DragAxis = "x" | "y" | "none";

type PhotoDims = {
  naturalWidth: number;
  naturalHeight: number;
};

type DragOrigin = {
  startX: number;
  startY: number;
  startPos: Position;
  cellW: number;
  cellH: number;
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

type UseDragPhotoArgs = {
  photo: PhotoDims | undefined;
  cellAspect: number;
  basePosition: Position | undefined;
  onCommit: (position: Position) => void;
};

type UseDragPhotoResult = {
  livePos: Position;
  draggable: DragAxis;
  resetLocal: () => void;
  bind: {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
  };
};

export function useDragPhoto({
  photo,
  cellAspect,
  basePosition,
  onCommit,
}: UseDragPhotoArgs): UseDragPhotoResult {
  const [dragPos, setDragPos] = useState<Position | null>(null);
  const originRef = useRef<DragOrigin | null>(null);

  const livePos: Position = dragPos ?? basePosition ?? DEFAULT_POSITION;

  const draggable: DragAxis = useMemo(() => {
    if (!photo || photo.naturalWidth === 0 || photo.naturalHeight === 0) {
      return "none";
    }
    const imgRatio = photo.naturalWidth / photo.naturalHeight;
    if (Math.abs(imgRatio - cellAspect) < 0.001) return "none";
    return imgRatio > cellAspect ? "x" : "y";
  }, [photo, cellAspect]);

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (draggable === "none") return;
    const rect = e.currentTarget.getBoundingClientRect();
    originRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPos: { ...livePos },
      cellW: rect.width,
      cellH: rect.height,
    };
    setDragPos({ ...livePos });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const origin = originRef.current;
    if (!origin || !photo) return;
    const imgRatio = photo.naturalWidth / photo.naturalHeight;

    let nextX = origin.startPos.x;
    let nextY = origin.startPos.y;

    if (draggable === "x") {
      // cover로 스케일된 이미지: height = cellH, width = cellH * imgRatio
      const imgScaledW = origin.cellH * imgRatio;
      const overhang = imgScaledW - origin.cellW;
      if (overhang > 0) {
        const dx = e.clientX - origin.startX;
        const deltaPct = (-dx / overhang) * 100;
        nextX = clamp(origin.startPos.x + deltaPct, 0, 100);
      }
    } else if (draggable === "y") {
      const imgScaledH = origin.cellW / imgRatio;
      const overhang = imgScaledH - origin.cellH;
      if (overhang > 0) {
        const dy = e.clientY - origin.startY;
        const deltaPct = (-dy / overhang) * 100;
        nextY = clamp(origin.startPos.y + deltaPct, 0, 100);
      }
    }

    setDragPos({ x: nextX, y: nextY });
  };

  const finishDrag = (e: React.PointerEvent<HTMLElement>) => {
    const origin = originRef.current;
    if (!origin) return;
    originRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    onCommit(livePos);
    setDragPos(null);
  };

  return {
    livePos,
    draggable,
    resetLocal: () => setDragPos(null),
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
    },
  };
}
