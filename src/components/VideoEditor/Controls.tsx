import { useEditor } from '../../hooks/useEditor'
import { formatTime } from '../../utils/formatTime'
import StudioIcon from './StudioIcon'

interface ControlsProps { onToggleFullscreen: () => void; isFullscreen?: boolean }
export default function Controls({ onToggleFullscreen, isFullscreen }: ControlsProps) {
  const { currentTime, duration, isPlaying, volume, isMuted, togglePlay, setCurrentTime, setVolume, toggleMute } = useEditor()
  return <div className="playback-controls-bar">
    <div className="controls-left">
      <button type="button" className="btn-control btn-play-pause" onClick={togglePlay} title={isPlaying ? 'Pause (Space)' : 'Play (Space)'} aria-label={isPlaying ? 'Pause' : 'Play'}><StudioIcon name={isPlaying ? 'pause' : 'play'} size={20} /></button>
      <div className="time-display"><span className="current-time-text">{formatTime(currentTime)}</span><span className="time-separator">/</span><span className="duration-text">{formatTime(duration)}</span></div>
    </div>
    <div className="controls-center"><input type="range" className="seek-slider" min={0} max={duration > 0 ? duration : 100} step={.01} value={currentTime} onChange={e => setCurrentTime(parseFloat(e.target.value))} title="Seek time" aria-label="Seek time" /></div>
    <div className="controls-right">
      <button type="button" className="btn-control btn-mute" onClick={toggleMute} title={isMuted || volume === 0 ? 'Unmute' : 'Mute'} aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}><StudioIcon name={isMuted || volume === 0 ? 'mute' : 'volume'} /></button>
      <input type="range" className="volume-slider" min={0} max={1} step={.01} value={isMuted ? 0 : volume} onChange={e => setVolume(parseFloat(e.target.value))} title="Adjust volume" aria-label="Playback volume" />
      <button type="button" className="btn-control btn-fullscreen" onClick={onToggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}><StudioIcon name="fullscreen" /></button>
    </div>
  </div>
}
