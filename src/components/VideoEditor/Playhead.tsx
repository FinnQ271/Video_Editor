import type { PointerEvent, RefObject } from 'react'
import { useEditor } from '../../hooks/useEditor'
import { formatTime } from '../../utils/formatTime'
import { timeToTimelineX, timelineXToTime } from '../../utils/timelineGeometry'

export default function Playhead({ timelineBodyRef }: { timelineBodyRef: RefObject<HTMLDivElement | null> }) {
  const { currentTime, duration, pixelsPerSecond, setCurrentTime } = useEditor()
  const seek = (event: PointerEvent<HTMLDivElement>) => {
    const timeline = timelineBodyRef.current
    if (!timeline) return
    const x = event.clientX - timeline.getBoundingClientRect().left + timeline.scrollLeft
    setCurrentTime(Math.min(duration, timelineXToTime(x, pixelsPerSecond)))
  }
  return <div className="timeline-playhead-container" style={{ left: timeToTimelineX(currentTime, pixelsPerSecond) }}>
    <div className="playhead-handle" role="slider" tabIndex={0}
      aria-label="Timeline playhead" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={currentTime} aria-valuetext={formatTime(currentTime)}
      onPointerDown={event => {
        if (event.button !== 0) return
        event.preventDefault(); event.stopPropagation()
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) seek(event) }}
      onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
      onKeyDown={event => {
        const step = event.shiftKey ? 1 : .1
        if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return
        event.preventDefault(); event.stopPropagation()
        setCurrentTime(event.key === 'Home' ? 0 : event.key === 'End' ? duration : Math.max(0, Math.min(duration, currentTime + (event.key === 'ArrowLeft' ? -step : step))))
      }}
      title={`Current time: ${formatTime(currentTime)} — drag or use arrow keys`}>
      <span className="playhead-time-tooltip">{formatTime(currentTime)}</span>
      <div className="playhead-head-shape" />
    </div>
    <div className="playhead-vertical-line" />
  </div>
}
