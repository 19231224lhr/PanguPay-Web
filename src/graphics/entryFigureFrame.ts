// One camera frame for the entire desktop entry flow. These are the existing
// landing hero's column proportions, spacing and illustration size; no route input.
export function desktopEntryFrame(width: number, height: number, rem = 16) {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
  const padding = clamp(width * 0.04, rem, rem * 4)
  const gap = clamp(width * 0.05, rem * 2, rem * 6)
  const offset = clamp(width * 0.024, rem * 1.5, rem * 2.2)
  const size = Math.min(width * 0.38, 540)
  const centerX = width * 0.72 - padding * 0.44 + gap * 0.28 + offset
  const centerY = height * 0.5 + rem * 0.4
  return { left: centerX - size / 2, top: centerY - size / 2, size }
}
