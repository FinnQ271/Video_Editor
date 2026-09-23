import StudioIcon from './StudioIcon'
import VideoClip from './VideoClip'
import TextClip from './TextClip'
import type { TimelineTrack } from '../../types/editor'
import TransitionClip from './TransitionClip'
import { useEditor } from '../../hooks/useEditor'

interface TrackProps {
  track: TimelineTrack
  totalWidth: number
}

export default function Track({ track, totalWidth }: TrackProps) {
  const { transitions, pixelsPerSecond, addTransition } = useEditor()
  const sortedVideoClips = track.type === 'video' ? [...track.clips].sort((a,b) => a.timelineStart-b.timelineStart) : []
  const trackIcon = track.type === 'video' ? 'film' : track.type === 'text' ? 'text' : 'audio'

  return (
    <div className={`timeline-track-row track-type-${track.type}`}>
      <div className="track-header">
        <span className="track-type-icon"><StudioIcon name={trackIcon} size={16} /></span>
        <span className="track-name">{track.name}</span>
      </div>

      <div className="track-body" style={{ width: totalWidth }}>
        {track.clips.map((clip) => {
          if (track.type === 'text' || clip.type === 'text') return <TextClip key={clip.id} clip={clip} />
          return <VideoClip key={clip.id} clip={clip} />
        })}
        {track.type === 'video' && sortedVideoClips.slice(0, -1).map((fromClip, index) => {
          const toClip = sortedVideoClips[index + 1]
          const gap = toClip.timelineStart - (fromClip.timelineStart + fromClip.duration)
          if (Math.abs(gap) > 0.05) return null
          const transition = transitions.find(t => t.fromClipId === fromClip.id && t.toClipId === toClip.id)
          if (transition) return <TransitionClip key={transition.id} transition={transition} fromClip={fromClip} toClip={toClip} />
          return <button key={`${fromClip.id}-${toClip.id}`} type="button" className="add-transition-button"
            style={{ left: toClip.timelineStart * pixelsPerSecond - 11 }} title="Add transition" aria-label="Add transition"
            onClick={(e) => { e.stopPropagation(); addTransition(fromClip.id, toClip.id, 'fade') }}>+</button>
        })}
      </div>
    </div>
  )
}

