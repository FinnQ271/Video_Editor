import StudioIcon from './StudioIcon'
import { useRef } from 'react'
import { TRACK_HEADER_WIDTH } from '../../utils/timelineGeometry'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useEditor } from '../../hooks/useEditor'
import TimelineRuler from './TimelineRuler'
import Track from './Track'
import Playhead from './Playhead'
import VisualTimelineTrack from './VisualTimelineTrack'

export default function Timeline() {
  const {
    tracks,
    selectedClipId,
    duration,
    pixelsPerSecond,
    canUndo,
    canRedo,
    undo,
    redo,
    splitClip,
    cutSelectedClip,
    duplicateClip,
    selectClip,
    zoomIn,
    zoomOut,
    fitTimeline,
  } = useEditor()

  const timelineBodyRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Calculate total canvas width required for timeline scroll
  const minSeconds = Math.max(30, Math.ceil(duration + 15))
  const totalWidth = minSeconds * pixelsPerSecond

  const handleFitTimelineClick = () => {
    if (containerRef.current) {
      fitTimeline((timelineBodyRef.current?.clientWidth ?? containerRef.current.clientWidth) - TRACK_HEADER_WIDTH)
      if (timelineBodyRef.current) timelineBodyRef.current.scrollLeft = 0
    }
  }

  const handleBackgroundClick = (e: ReactMouseEvent) => {
    // Deselect clip when clicking on timeline background
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('tracks-container')) {
      selectClip(undefined)
    }
  }

  return (
    <section className="timeline-section" ref={containerRef}>
      {/* Timeline Toolbar */}
      <div className="timeline-toolbar">
        <div className="toolbar-group">
          <button
            type="button"
            className="btn-toolbar"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl + Z)"
          >
            <StudioIcon name="undo" size={16} /> Undo
          </button>

          <button
            type="button"
            className="btn-toolbar"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl + Shift + Z / Ctrl + Y)"
          >
            <StudioIcon name="redo" size={16} /> Redo
          </button>

          <div className="toolbar-divider" />

          <button
            type="button"
            className="btn-toolbar"
            onClick={() => splitClip()}
            disabled={!selectedClipId}
            title="Split selected clip at current playhead position (S)"
          >
            <StudioIcon name="split" size={16} /> Split
          </button>

          <button
            type="button"
            className="btn-toolbar"
            onClick={() => duplicateClip()}
            disabled={!selectedClipId}
            title="Duplicate selected clip (Ctrl + D)"
          >
            <StudioIcon name="duplicate" size={16} /> Duplicate
          </button>

          <button
            type="button"
            className="btn-toolbar btn-toolbar-danger"
            onClick={cutSelectedClip}
            disabled={!selectedClipId}
            title="Cut / Remove selected clip from timeline (Delete)"
          >
            <StudioIcon name="trash" size={16} /> Delete
          </button>
        </div>

        <div className="toolbar-spacer" />

        {/* Zoom Controls */}
        <div className="toolbar-group zoom-controls">
          <span className="zoom-label">Zoom</span>
          <button
            type="button"
            className="btn-toolbar btn-icon-sm"
            onClick={zoomOut}
            disabled={pixelsPerSecond <= 10}
            title="Zoom Out (-)" aria-label="Zoom out timeline"
          >
            -
          </button>

          <span className="zoom-value-badge">{Math.round(pixelsPerSecond)} px/s</span>

          <button
            type="button"
            className="btn-toolbar btn-icon-sm"
            onClick={zoomIn}
            disabled={pixelsPerSecond >= 200}
            title="Zoom In (+)" aria-label="Zoom in timeline"
          >
            +
          </button>

          <button
            type="button"
            className="btn-toolbar"
            onClick={handleFitTimelineClick}
            title="Fit entire project duration to timeline screen"
          >
            Fit Timeline
          </button>
        </div>
      </div>

      {/* Scrollable Timeline Area */}
      <div className="timeline-body-scroll" ref={timelineBodyRef} onClick={handleBackgroundClick}>
        <div className="timeline-content-wrapper" style={{ width: totalWidth + TRACK_HEADER_WIDTH, minWidth: '100%', '--track-header-width': `${TRACK_HEADER_WIDTH}px` } as React.CSSProperties}>
          <TimelineRuler totalWidth={totalWidth} />

          <div className="tracks-container" onClick={handleBackgroundClick}>
            {tracks.map((track) => (
              <Track key={track.id} track={track} totalWidth={totalWidth} />
            ))}
            <VisualTimelineTrack totalWidth={totalWidth} />
          </div>

          <Playhead timelineBodyRef={timelineBodyRef} />
        </div>
      </div>
    </section>
  )
}
