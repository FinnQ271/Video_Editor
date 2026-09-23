import { useRef } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useEditor } from '../../hooks/useEditor'
import { formatTime } from '../../utils/formatTime'
import type { TimelineClip } from '../../types/editor'

interface VideoClipProps {
  clip: TimelineClip
}

export default function VideoClip({ clip }: VideoClipProps) {
  const {
    selectedClipId,
    pixelsPerSecond,
    currentTime,
    tracks,
    selectClip,
    trimClipLeft,
    trimClipRight,
    moveClip,
  } = useEditor()
  
  const clipRef = useRef<HTMLDivElement>(null)

  const isSelected = selectedClipId === clip.id
  const leftPx = clip.timelineStart * pixelsPerSecond
  const widthPx = clip.duration * pixelsPerSecond

  const handleSelect = (e: ReactMouseEvent) => {
    e.stopPropagation()
    selectClip(clip.id)
  }

  // Handle Drag Clip Body (Move Clip with Magnet Snapping)
  const handleMoveStart = (e: ReactMouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    selectClip(clip.id)

    const startX = e.clientX
    const initialStart = clip.timelineStart
    let lastProposedStart = initialStart

    // Collect all snapping targets
    const snapPoints: number[] = [0, currentTime]
    tracks.forEach((track) => {
      track.clips.forEach((other) => {
        if (other.id !== clip.id) {
          snapPoints.push(other.timelineStart)
          snapPoints.push(other.timelineStart + other.duration)
        }
      })
    })

    const snapThresholdSeconds = 0.2 // Snap sensitivity in seconds

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX
      const deltaSeconds = dx / pixelsPerSecond
      let proposedStart = Math.max(0, initialStart + deltaSeconds)

      // Snap start edge or end edge to snap points
      const proposedEnd = proposedStart + clip.duration

      for (const target of snapPoints) {
        // Snap left edge to target
        if (Math.abs(proposedStart - target) <= snapThresholdSeconds) {
          proposedStart = target
          break
        }
        // Snap right edge to target
        if (Math.abs(proposedEnd - target) <= snapThresholdSeconds) {
          proposedStart = target - clip.duration
          break
        }
      }

      lastProposedStart = Math.max(0, proposedStart)
      // Live preview during drag without recording history snapshot on every pixel move
      moveClip(clip.id, lastProposedStart, false)
    }

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)

      // Record snapshot to history on drag complete if clip actually moved
      if (Math.abs(lastProposedStart - initialStart) > 0.001) {
        moveClip(clip.id, lastProposedStart, true)
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  // Handle Drag Left Handle (Trim Left)
  const handleTrimLeftStart = (e: ReactMouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    selectClip(clip.id)

    const startX = e.clientX
    let totalDeltaSeconds = 0

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX
      totalDeltaSeconds = dx / pixelsPerSecond
      if (Math.abs(totalDeltaSeconds) > 0.001) {
        // Live preview during drag without recording history snapshot
        trimClipLeft(clip.id, totalDeltaSeconds, false)
      }
    }

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)

      // Record snapshot to history on trim complete
      if (Math.abs(totalDeltaSeconds) > 0.001) {
        trimClipLeft(clip.id, totalDeltaSeconds, true)
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  // Handle Drag Right Handle (Trim Right)
  const handleTrimRightStart = (e: ReactMouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    selectClip(clip.id)

    const startX = e.clientX
    let totalDeltaSeconds = 0

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX
      totalDeltaSeconds = dx / pixelsPerSecond
      if (Math.abs(totalDeltaSeconds) > 0.001) {
        // Live preview during drag without recording history snapshot
        trimClipRight(clip.id, totalDeltaSeconds, false)
      }
    }

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)

      // Record snapshot to history on trim complete
      if (Math.abs(totalDeltaSeconds) > 0.001) {
        trimClipRight(clip.id, totalDeltaSeconds, true)
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div
      ref={clipRef}
      className={`timeline-clip-item ${isSelected ? 'clip-selected' : ''}`}
      style={{
        left: leftPx,
        width: Math.max(15, widthPx),
      }}
      onClick={handleSelect}
      onMouseDown={handleMoveStart}
      title={`${clip.name} (${formatTime(clip.duration)}) - Drag to move`}
    >
      {/* Left Trim Handle */}
      <div
        className="trim-handle trim-handle-left"
        onMouseDown={handleTrimLeftStart}
        title="Trim Left (Drag to shorten/lengthen start)"
      >
        <span className="handle-bar" />
      </div>

      <div className="clip-content">
        {clip.thumbnail && <img src={clip.thumbnail} alt="" className="clip-thumbnail-img" />}
        <span className="clip-title">{clip.name}</span>
        <span className="clip-duration-tag">{formatTime(clip.duration)}</span>
      </div>

      {/* Right Trim Handle */}
      <div
        className="trim-handle trim-handle-right"
        onMouseDown={handleTrimRightStart}
        title="Trim Right (Drag to shorten/lengthen end)"
      >
        <span className="handle-bar" />
      </div>
    </div>
  )
}
