import { useEditor } from '../../hooks/useEditor'
import type { TimelineClip, VideoTransition, TransitionType } from '../../types/editor'

const TYPES: TransitionType[] = ['fade','dissolve','slide','zoom','wipe','blur','spin','flash']

export default function TransitionClip({ transition, fromClip, toClip }: { transition: VideoTransition; fromClip: TimelineClip; toClip: TimelineClip }) {
  const { pixelsPerSecond, selectedTransitionId, selectTransition, updateTransition, removeTransition } = useEditor()
  const boundary = toClip.timelineStart
  const width = Math.max(30, transition.duration * pixelsPerSecond)
  return <div className={`transition-item ${selectedTransitionId === transition.id ? 'transition-selected' : ''}`}
    style={{ left: boundary * pixelsPerSecond - width / 2, width }} onClick={(e) => { e.stopPropagation(); selectTransition(transition.id) }}>
    <span className="transition-diamond">◆</span><span>{transition.type}</span>
    {selectedTransitionId === transition.id && <div className="transition-popover" onClick={(e) => e.stopPropagation()}>
      <strong>Transition</strong>
      <select value={transition.type} onChange={(e) => updateTransition(transition.id, { type: e.target.value as TransitionType })}>
        {TYPES.map(t => <option key={t} value={t}>{t[0].toUpperCase()+t.slice(1)}</option>)}
      </select>
      <label>Duration {transition.duration.toFixed(1)}s</label>
      <input type="range" min="0.1" max={Math.max(.1, Math.min(5, fromClip.duration, toClip.duration))} step="0.1" value={transition.duration}
        onChange={(e) => updateTransition(transition.id, { duration: Number(e.target.value) })}/>
      <button type="button" className="transition-delete" onClick={() => removeTransition(transition.id)}>Delete</button>
    </div>}
  </div>
}
