import { useEditor } from '../../hooks/useEditor'
import type { TransitionType } from '../../types/editor'
import StudioIcon from './StudioIcon'

const transitionTypes: TransitionType[] = ['fade', 'dissolve', 'slide', 'zoom', 'wipe', 'blur', 'spin', 'flash']
export default function LibraryTools({ tab }: { tab: 'audio' | 'effects' | 'transitions' }) {
  const editor = useEditor()
  const clip = editor.tracks.flatMap(track => track.clips).find(item => item.id === editor.selectedClipId)
  const track = editor.tracks.find(item => item.clips.some(item => item.id === clip?.id))
  const selectedTransition = editor.transitions.find(item => item.id === editor.selectedTransitionId)
  const videoTrack = editor.tracks.find(item => item.type === 'video' && item.clips.some(item => item.id === clip?.id))
  const sorted = [...(videoTrack?.clips ?? [])].sort((a, b) => a.timelineStart - b.timelineStart)
  const index = sorted.findIndex(item => item.id === clip?.id)
  const next = index >= 0 ? sorted[index + 1] : undefined
  const adjacent = clip && next && Math.abs(next.timelineStart - clip.timelineStart - clip.duration) < .05
  const existing = adjacent ? editor.transitions.find(item => item.fromClipId === clip.id && item.toClipId === next.id) : undefined
  const transition = selectedTransition ?? existing
  const canApply = !!transition || !!adjacent
  const title = tab === 'audio' ? 'Clip audio' : tab === 'effects' ? 'Effects' : 'Transitions'
  return <div className="library-tools">
    <div className="panel-section-header"><h3>{title}</h3><StudioIcon name={tab === 'transitions' ? 'transition' : tab} /></div>
    {tab === 'audio' ? clip && track && !clip.textProperties ? <>
      <p className="panel-description">Adjust the sound of <strong>{clip.name}</strong>.</p>
      <label className="tool-field">Volume <output>{Math.round((clip.volume ?? 1) * 100)}%</output><input aria-label="Clip audio volume" type="range" min="0" max="100" value={(clip.volume ?? 1) * 100} onChange={e => editor.updateClipProperties(clip.id, { volume: +e.target.value / 100 })} /></label>
      <label className="checkbox-label"><input type="checkbox" checked={track.muted} onChange={e => editor.updateTrackProperties(track.id, { muted: e.target.checked })} /> Mute track</label>
      <label className="tool-field">Speed <select value={clip.speed ?? 1} onChange={e => editor.updateClipSpeed(clip.id, +e.target.value)}>{[.25, .5, 1, 1.5, 2, 4].map(speed => <option value={speed} key={speed}>{speed}x</option>)}</select></label>
    </> : <div className="tool-empty"><StudioIcon name="audio" size={32} /><h4>Select a video clip</h4><p>Control its volume and track mute here. Audio file import is not available in this editor yet.</p></div>
    : tab === 'effects' ? <>
      <p className="panel-description">Select a video clip to apply an effect. Fine-tune it in the Inspector.</p>
      <div className="effect-grid"><button className="effect-card" disabled={!clip || !!clip.textProperties} aria-pressed={clip?.chromaKey?.enabled ?? false} onClick={() => { if (clip) editor.updateClipProperties(clip.id, { chromaKey: { enabled: !clip.chromaKey?.enabled, color: clip.chromaKey?.color ?? '#00ff00', tolerance: clip.chromaKey?.tolerance ?? .28, softness: clip.chromaKey?.softness ?? .12, spill: clip.chromaKey?.spill ?? .35 } }) }}><span className="effect-sample chroma-sample"><StudioIcon name="image" size={32} /></span><strong>Chroma Key</strong><small>{clip?.chromaKey?.enabled ? 'Applied ? click to disable' : 'Remove a color background'}</small></button></div>
    </> : <>
      <p className="panel-description">{transition ? 'Choose a style for the selected transition.' : 'Select a video clip followed by an adjacent clip, then choose a transition.'}</p>
      <div className="effect-grid">{transitionTypes.map(type => <button key={type} className="effect-card" disabled={!canApply} aria-pressed={transition?.type === type} onClick={() => { if (transition) editor.updateTransition(transition.id, { type }); else if (adjacent) editor.addTransition(clip.id, next.id, type) }}><span className={'effect-sample sample-' + type}><StudioIcon name="transition" size={28} /></span><strong>{type[0].toUpperCase() + type.slice(1)}</strong></button>)}</div>
      {transition && <><label className="tool-field">Duration <output>{transition.duration.toFixed(1)}s</output><input aria-label="Transition duration" type="range" min=".1" max="5" step=".1" value={transition.duration} onChange={e => editor.updateTransition(transition.id, { duration: +e.target.value })} /></label><button className="btn-danger" onClick={() => editor.removeTransition(transition.id)}>Remove transition</button></>}
    </>}
  </div>
}
