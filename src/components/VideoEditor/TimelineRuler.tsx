import type { PointerEvent } from 'react'
import { useEditor } from '../../hooks/useEditor'
import { formatTime } from '../../utils/formatTime'
import { TRACK_HEADER_WIDTH, timeToTimelineX, timelineXToTime } from '../../utils/timelineGeometry'

export default function TimelineRuler({ totalWidth }: { totalWidth: number }) {
  const { pixelsPerSecond, setCurrentTime } = useEditor()
  const stepSeconds = pixelsPerSecond < 20 ? 5 : pixelsPerSecond < 50 ? 2 : 1
  const totalSeconds = totalWidth / pixelsPerSecond
  const ticks: number[] = []
  for (let second = 0; second <= totalSeconds; second += stepSeconds) ticks.push(second)

  const seek = (event: PointerEvent<HTMLDivElement>) => {
    const x = event.clientX - event.currentTarget.getBoundingClientRect().left
    setCurrentTime(timelineXToTime(x, pixelsPerSecond))
  }

  return <div className="timeline-ruler" style={{ width: totalWidth + TRACK_HEADER_WIDTH }}
    onPointerDown={event => {
      if (event.button !== 0) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      seek(event)
    }}
    onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) seek(event) }}
    onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}>
    <div className="timeline-ruler-label" onPointerDown={event => event.stopPropagation()}>TRACKS</div>
    {ticks.map(second => <div key={second} className="ruler-tick-mark" style={{ left: timeToTimelineX(second, pixelsPerSecond) }}>
      <span className="tick-label">{formatTime(second)}</span><div className="tick-line" />
    </div>)}
  </div>
}
