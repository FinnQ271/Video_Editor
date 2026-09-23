import type { TimelineClip } from '../types/editor'
import { evaluateProperties } from './keyframeEngine'

// Advance from an absolute anchor, independent of React render frequency.
export class PlaybackClock {
  private time = 0
  private startedAt = 0
  reset(time: number, now: number) { this.time = time; this.startedAt = now }
  read(now: number, duration: number) {
    return Math.min(duration, Math.max(0, this.time + (now - this.startedAt) / 1000))
  }
}

const states = new WeakMap<HTMLVideoElement, { key: string; playing: boolean; pending: boolean }>()
export function syncPlaybackVideo(video: HTMLVideoElement | null, clip: TimelineClip, time: number, playing: boolean, volume: number, muted: boolean, freeze = false) {
  if (!video || video.readyState < 1) return
  const key = clip.id + ':' + clip.src
  let state = states.get(video)
  const changed = !state || state.key !== key
  if (!state) { state = { key, playing: false, pending: false }; states.set(video, state) }
  const starting = playing && !state.playing
  const target = Math.max(0, Math.min(clip.sourceEnd - .01, time))
  const tolerance = !playing || freeze || changed || starting ? .015 : .3
  // Native playback decodes continuously; seek only for a new clip, scrubbing or real drift.
  if (!video.seeking && Math.abs(video.currentTime - target) > tolerance) video.currentTime = target
  state.key = key
  state.playing = playing
  const rate = clip.speed || 1
  if (video.playbackRate !== rate) video.playbackRate = rate
  const localTime = Math.max(0, (target - clip.sourceStart) / rate)
  const animatedVolume = evaluateProperties(clip.keyframeProperties, localTime, { volume: clip.volume ?? 1 }).volume ?? (clip.volume ?? 1)
  video.volume = Math.max(0, Math.min(1, volume * animatedVolume))
  video.muted = muted
  if (!playing || freeze) {
    if (!video.paused) video.pause()
  } else if (video.paused && !state.pending) {
    state.pending = true
    const captured = state
    void video.play().catch(() => { /* Browsers may interrupt play during a source change. */ }).finally(() => {
      captured.pending = false
      if (!captured.playing && !video.paused) video.pause()
    })
  }
}
