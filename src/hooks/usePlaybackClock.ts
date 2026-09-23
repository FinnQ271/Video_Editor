import { useEffect, useLayoutEffect, useRef } from 'react'
import { PlaybackClock } from '../utils/playback'

export function usePlaybackClock(currentTime: number, duration: number, isPlaying: boolean, setCurrentTime: (time: number) => void, setPlaying: (playing: boolean) => void) {
  const clock = useRef(new PlaybackClock())
  const published = useRef<number | null>(null)
  const current = useRef(currentTime)

  useLayoutEffect(() => {
    current.current = currentTime
    // A timeline/ruler seek reanchors the running clock immediately.
    if (published.current === null || Math.abs(currentTime - published.current) > .000001) {
      clock.current.reset(currentTime, performance.now())
    }
  }, [currentTime])

  useEffect(() => {
    if (!isPlaying) return
    clock.current.reset(current.current, performance.now())
    let frame = 0
    let lastPublishedAt = -Infinity
    const tick = (now: number) => {
      const time = clock.current.read(now, duration)
      // Video uses native playback; share timeline/overlay state at at most 30 Hz.
      if (now - lastPublishedAt >= 1000 / 30 || time >= duration) {
        published.current = time
        lastPublishedAt = now
        setCurrentTime(time)
      }
      if (time >= duration) { setPlaying(false); return }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying, duration, setCurrentTime, setPlaying])
}
