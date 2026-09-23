export const TRACK_HEADER_WIDTH = 120

export function timeToTimelineX(time: number, pixelsPerSecond: number) {
  return TRACK_HEADER_WIDTH + time * pixelsPerSecond
}

export function timelineXToTime(x: number, pixelsPerSecond: number) {
  return Math.max(0, (x - TRACK_HEADER_WIDTH) / pixelsPerSecond)
}
