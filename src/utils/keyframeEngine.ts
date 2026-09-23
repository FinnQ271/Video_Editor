import type { AnimatableProperty, EasingType, Keyframe, KeyframedProperty } from '../types/editor'

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export function applyEasing(progress: number, easing: EasingType = 'linear'): number {
  const t = clamp01(progress)
  switch (easing) {
    case 'ease-in': return t * t
    case 'ease-out': return 1 - (1 - t) * (1 - t)
    case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    default: return t
  }
}

/** Generic numeric keyframe interpolation. Times are seconds in the element/clip's local timeline. */
export function interpolateKeyframes(keyframes: Keyframe[], time: number, fallback = 0): number {
  if (!keyframes.length) return fallback
  const frames = [...keyframes].sort((a, b) => a.time - b.time)
  if (time <= frames[0].time) return frames[0].value
  if (time >= frames[frames.length - 1].time) return frames[frames.length - 1].value
  const rightIndex = frames.findIndex(frame => frame.time >= time)
  const right = frames[rightIndex]
  const left = frames[rightIndex - 1]
  const span = Math.max(0.000001, right.time - left.time)
  const progress = applyEasing((time - left.time) / span, right.easing)
  return left.value + (right.value - left.value) * progress
}

export function evaluateProperty(property: KeyframedProperty | undefined, time: number, fallback: number): number {
  return property ? interpolateKeyframes(property.keyframes, time, fallback) : fallback
}

export function evaluateProperties(
  properties: KeyframedProperty[] | undefined,
  time: number,
  fallbacks: Partial<Record<AnimatableProperty, number>>,
): Partial<Record<AnimatableProperty, number>> {
  const result = { ...fallbacks }
  for (const property of properties ?? []) result[property.property] = evaluateProperty(property, time, fallbacks[property.property] ?? 0)
  return result
}
