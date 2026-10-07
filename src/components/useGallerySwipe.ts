"use client";

import { useRef, type MouseEvent, type PointerEvent } from "react";
import { swipeAxis, swipeDirection, type SwipeAxis } from "@/lib/gallery-swipe";

type Gesture = { id: number; x: number; y: number; axis: SwipeAxis };

export function useGallerySwipe(move: (direction: number) => void, enabled = true) {
  const gesture = useRef<Gesture | null>(null);
  const suppressClickUntil = useRef(0);

  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      suppressClickUntil.current = 0;
      if (!enabled || !event.isPrimary || event.pointerType === "mouse") {
        gesture.current = null;
        return;
      }
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: "pending" };
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const start = gesture.current;
      if (!start || start.id !== event.pointerId) return;
      start.axis = swipeAxis(start.axis, event.clientX - start.x, event.clientY - start.y);
      // Capturing at pointer-down would retarget an ordinary tap away from a
      // nested slide link. Capture only an established horizontal gesture.
      if (start.axis === "horizontal" && !event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const start = gesture.current;
      if (!start || start.id !== event.pointerId) return;
      gesture.current = null;
      const dx = event.clientX - start.x;
      const axis = swipeAxis(start.axis, dx, event.clientY - start.y);
      if (axis === "horizontal") suppressClickUntil.current = Date.now() + 500;
      const direction = swipeDirection(axis, dx, event.currentTarget.clientWidth);
      if (direction) move(direction * (getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1));
    },
    onPointerCancel() {
      gesture.current = null;
    },
    onClickCapture(event: MouseEvent<HTMLElement>) {
      if (event.detail > 0 && Date.now() < suppressClickUntil.current) {
        event.preventDefault();
        event.stopPropagation();
        suppressClickUntil.current = 0;
      }
    },
  };
}
