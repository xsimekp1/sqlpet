// Utilities for kennel map layout and collision detection

export type Rect = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function hasCollision(moved: Rect, all: Rect[]): boolean {
  for (const r of all) {
    if (r.id === moved.id) continue;
    if (intersects(moved, r)) return true;
  }
  return false;
}

export function snap(n: number, grid = 20): number {
  return Math.round(n / grid) * grid;
}

export function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(Math.max(value, min), max);
}

export function constrainRect(
  rect: Partial<Rect>,
  container: { width: number; height: number }
): Rect {
  return {
    id: rect.id || '',
    x: clamp(rect.x || 0, 0, container.width - (rect.w || 0)),
    y: clamp(rect.y || 0, 0, container.height - (rect.h || 0)),
    w: rect.w || 0,
    h: rect.h || 0,
  };
}