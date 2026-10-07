export type SwipeAxis = "pending" | "horizontal" | "vertical";

// Resolve intent once. A vertical scroll must never turn into image navigation.
export function swipeAxis(axis: SwipeAxis, dx: number, dy: number): SwipeAxis {
  if (axis !== "pending" || Math.max(Math.abs(dx), Math.abs(dy)) < 10) return axis;
  return Math.abs(dx) > Math.abs(dy) * 1.2 ? "horizontal" : "vertical";
}

export function swipeDirection(axis: SwipeAxis, dx: number, width: number): -1 | 0 | 1 {
  const threshold = Math.min(80, Math.max(32, width * 0.1));
  return axis === "horizontal" && Math.abs(dx) >= threshold ? (dx < 0 ? 1 : -1) : 0;
}

export async function decodeGalleryImage(image: HTMLImageElement): Promise<boolean> {
  const source = image.currentSrc;
  try {
    await image.decode?.();
  } catch {
    // Some browsers reject decode for an otherwise complete cached image.
  }
  return image.isConnected && source === image.currentSrc && image.complete && image.naturalWidth > 0;
}
