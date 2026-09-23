import StudioIcon from './StudioIcon'
import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { useEditor } from '../../hooks/useEditor'
import { formatTime } from '../../utils/formatTime'
import type { CanvasAspectRatio } from '../../types/editor'
import { getOriginalCanvasSource } from '../../utils/canvasSource'

export default function PropertiesPanel({ canvasOnly = false, hideCanvas = false }: { canvasOnly?: boolean; hideCanvas?: boolean }) {
  const {
    tracks,
    assets,
    selectedAssetId,
    canvas,
    selectedClipId,
    updateClipProperties,
    updateClipTransform,
    updateClipSpeed,
    updateTrackProperties,
    setCanvasAspectRatio,
    removeClip,
    splitClip,
    duplicateClip,
  } = useEditor()

  // Find currently selected clip and its parent track
  let selectedClip = undefined
  let parentTrack = undefined

  for (const track of tracks) {
    const found = track.clips.find((c) => c.id === selectedClipId)
    if (found) {
      selectedClip = found
      parentTrack = track
      break
    }
  }

  // Local state for smooth typing inside text/numeric inputs before committing to history
  const [nameInput, setNameInput] = useState(selectedClip?.name || '')
  const [startTimeInput, setStartTimeInput] = useState(selectedClip?.timelineStart.toString() || '0')
  const [volumeInput, setVolumeInput] = useState((selectedClip?.volume ?? 1).toString())

  const [previousClip, setPreviousClip] = useState(selectedClip)
  if (previousClip !== selectedClip) {
    setPreviousClip(selectedClip)
    if (selectedClip) {
      setNameInput(selectedClip.name)
      setStartTimeInput(selectedClip.timelineStart.toFixed(2))
      setVolumeInput(((selectedClip.volume ?? 1) * 100).toFixed(0))
    }
  }

  const handleNameBlur = () => {
    if (!selectedClip) return
    if (nameInput.trim() && nameInput !== selectedClip.name) {
      updateClipProperties(selectedClip.id, { name: nameInput.trim() })
    }
  }

  const handleStartTimeBlur = () => {
    if (!selectedClip) return
    const parsed = parseFloat(startTimeInput)
    if (!isNaN(parsed) && Math.abs(parsed - selectedClip.timelineStart) > 0.01) {
      updateClipProperties(selectedClip.id, { timelineStart: Math.max(0, parsed) })
    }
  }

  const handleVolumeChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!selectedClip) return
    const val = parseFloat(e.target.value) / 100
    setVolumeInput(e.target.value)
    updateClipProperties(selectedClip.id, { volume: val })
  }

  const originalSource = getOriginalCanvasSource(assets, tracks, selectedClipId, selectedAssetId)
  const originalDescription = originalSource ? `${originalSource.width}×${originalSource.height} — ${originalSource.name}` : 'Nhập video để dùng khung nguyên bản'

  const CANVAS_RATIO_OPTIONS: { label: string; value: CanvasAspectRatio; desc: string }[] = [
    { label: 'Nguyên bản', value: 'original', desc: originalDescription },
    { label: '16:9', value: '16:9', desc: '1920×1080 — Landscape / YouTube' },
    { label: '9:16', value: '9:16', desc: '1080×1920 — Portrait / TikTok / Reels' },
    { label: '1:1', value: '1:1', desc: '1080×1080 — Square / Instagram' },
    { label: '4:5', value: '4:5', desc: '1080×1350 — Instagram Portrait' },
  ]

  return (
    <div className="properties-panel-content">

      {/* ─── Canvas Settings ─────────────────────────────────────────── */}
      {!hideCanvas && <><div className="panel-section-header">
        <h3>Canvas</h3>
        <span className="badge-track">{canvas.width}×{canvas.height}</span>
      </div>

      <div className="property-group">
        <label>Aspect Ratio</label>
        <div className="canvas-ratio-grid">
          {CANVAS_RATIO_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`btn-ratio ${canvas.aspectRatio === opt.value ? 'btn-ratio-active' : ''}`}
              onClick={() => setCanvasAspectRatio(opt.value)}
              title={opt.desc}
              aria-pressed={canvas.aspectRatio === opt.value}
              disabled={opt.value === 'original' && !originalSource}
              style={opt.value === 'original' ? { gridColumn: '1 / -1' } : undefined}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="ratio-description">
          {canvas.aspectRatio === 'original' ? `${canvas.width}×${canvas.height} — Khung nguyên bản` : CANVAS_RATIO_OPTIONS.find((o) => o.value === canvas.aspectRatio)?.desc}
        </p>
        <p className="ratio-hint">
          Nguyên bản lấy kích thước video đang chọn; nếu chưa chọn, dùng video đầu tiên. Video được căn giữa, giữ đúng tỉ lệ.
        </p>
      </div>

      </>}
      {/* ─── Clip Properties (only when a clip is selected) ────────── */}
      {canvasOnly ? null : selectedClip && parentTrack ? (
        <>
          <div className="panel-section-header" style={{ marginTop: '0.5rem' }}>
            <h3>Clip Properties</h3>
            <span className="badge-track">{parentTrack.name}</span>
          </div>

          <div className="property-group">
            <label htmlFor="prop-clip-name">Clip Name</label>
            <input
              id="prop-clip-name"
              type="text"
              className="form-control"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleNameBlur()}
            />
          </div>

          <div className="property-row-split">
            <div className="property-group">
              <label htmlFor="prop-timeline-start">Start Time (s)</label>
              <input
                id="prop-timeline-start"
                type="number"
                step="0.1"
                min="0"
                className="form-control"
                value={startTimeInput}
                onChange={(e) => setStartTimeInput(e.target.value)}
                onBlur={handleStartTimeBlur}
                onKeyDown={(e) => e.key === 'Enter' && handleStartTimeBlur()}
              />
            </div>

            <div className="property-group">
              <label>Duration</label>
              <div className="read-only-badge">{formatTime(selectedClip.duration)}</div>
            </div>
          </div>

          <div className="property-group">
            <div className="property-label-between">
              <label htmlFor="prop-clip-volume">Audio Volume</label>
              <span className="value-tag">{volumeInput}%</span>
            </div>
            <input
              id="prop-clip-volume"
              type="range"
              min="0"
              max="100"
              value={volumeInput}
              onChange={handleVolumeChange}
              className="volume-slider-prop"
            />
          </div>

          <div className="property-group media-info-box">
            <label>Media Source Range</label>
            <div className="info-sub-details">
              <span>In: {formatTime(selectedClip.sourceStart)}</span>
              <span>Out: {formatTime(selectedClip.sourceEnd)}</span>
              <span>Total: {formatTime(selectedClip.mediaDuration || 0)}</span>
            </div>
          </div>

          <div className="panel-section-header" style={{ marginTop: '1rem' }}>
            <h3>Transform & Speed</h3>
          </div>

          <div className="property-row-split">
            <div className="property-group">
              <label htmlFor="prop-speed">Speed</label>
              <select
                id="prop-speed"
                className="form-control"
                value={selectedClip.speed || 1}
                onChange={(e) => updateClipSpeed(selectedClip!.id, parseFloat(e.target.value))}
              >
                <option value="0.25">0.25x</option>
                <option value="0.5">0.5x</option>
                <option value="1">1x (Normal)</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
              </select>
            </div>
          </div>

          <div className="property-group">
            <div className="property-label-between">
              <label>Opacity</label>
              <span className="value-tag">{Math.round((selectedClip.transform?.opacity ?? 1) * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={(selectedClip.transform?.opacity ?? 1) * 100}
              onChange={(e) =>
                updateClipTransform(selectedClip!.id, { opacity: parseFloat(e.target.value) / 100 })
              }
              className="volume-slider-prop"
            />
          </div>

          <div className="property-row-split">
            <div className="property-group">
              <label>Rotate</label>
              <div className="clip-actions-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() =>
                    updateClipTransform(selectedClip!.id, {
                      rotation: ((selectedClip!.transform?.rotation || 0) + 90) % 360,
                    })
                  }
                >
                  ⟳ 90°
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => updateClipTransform(selectedClip!.id, { rotation: 0 })}
                >
                  0°
                </button>
              </div>
            </div>

            <div className="property-group">
              <label>Flip</label>
              <div className="clip-actions-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <button
                  type="button"
                  className={`btn-secondary btn-sm ${(selectedClip.transform?.scaleX || 1) < 0 ? 'active' : ''}`}
                  onClick={() =>
                    updateClipTransform(selectedClip!.id, {
                      scaleX: (selectedClip!.transform?.scaleX || 1) * -1,
                    })
                  }
                >
                  ↔ H
                </button>
                <button
                  type="button"
                  className={`btn-secondary btn-sm ${(selectedClip.transform?.scaleY || 1) < 0 ? 'active' : ''}`}
                  onClick={() =>
                    updateClipTransform(selectedClip!.id, {
                      scaleY: (selectedClip!.transform?.scaleY || 1) * -1,
                    })
                  }
                >
                  ↕ V
                </button>
              </div>
            </div>
          </div>

          <div className="panel-section-header" style={{ marginTop: '1rem' }}><h3>Chroma Key</h3><span className="badge-track">Green Screen</span></div>
          <div className="property-group">
            <label className="checkbox-label"><input type="checkbox" checked={selectedClip.chromaKey?.enabled ?? false} onChange={(e)=>updateClipProperties(selectedClip!.id,{chromaKey:{enabled:e.target.checked,color:selectedClip!.chromaKey?.color??'#00ff00',tolerance:selectedClip!.chromaKey?.tolerance??.28,softness:selectedClip!.chromaKey?.softness??.12,spill:selectedClip!.chromaKey?.spill??.35}})}/> Enable Chroma Key</label>
          </div>
          <div className="property-row-split"><div className="property-group"><label>Key Color</label><input type="color" value={selectedClip.chromaKey?.color??'#00ff00'} onChange={(e)=>updateClipProperties(selectedClip!.id,{chromaKey:{enabled:selectedClip!.chromaKey?.enabled??true,color:e.target.value,tolerance:selectedClip!.chromaKey?.tolerance??.28,softness:selectedClip!.chromaKey?.softness??.12,spill:selectedClip!.chromaKey?.spill??.35}})}/></div><div className="property-group"><label>Preset</label><button type="button" className="btn-secondary btn-sm" onClick={()=>updateClipProperties(selectedClip!.id,{chromaKey:{enabled:true,color:'#00ff00',tolerance:.28,softness:.12,spill:.35}})}>Green Screen</button></div></div>
          {(['tolerance','softness','spill'] as const).map(prop=><div className="property-group" key={prop}><div className="property-label-between"><label>{prop[0].toUpperCase()+prop.slice(1)}</label><span className="value-tag">{Math.round((selectedClip!.chromaKey?.[prop]??({tolerance:.28,softness:.12,spill:.35}[prop]))*100)}%</span></div><input type="range" min="0" max="100" value={(selectedClip!.chromaKey?.[prop]??({tolerance:.28,softness:.12,spill:.35}[prop]))*100} onChange={(e)=>updateClipProperties(selectedClip!.id,{chromaKey:{enabled:selectedClip!.chromaKey?.enabled??true,color:selectedClip!.chromaKey?.color??'#00ff00',tolerance:selectedClip!.chromaKey?.tolerance??.28,softness:selectedClip!.chromaKey?.softness??.12,spill:selectedClip!.chromaKey?.spill??.35,[prop]:Number(e.target.value)/100}})} className="volume-slider-prop"/></div>)}
          <p className="ratio-hint">Adjust the key color, tolerance and edge softness to remove a solid background.</p>

          {/* Quick Actions */}
          <div className="property-group">
            <label>Actions</label>
            <div className="clip-actions-grid">
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => splitClip(selectedClip!.id)}
                title="Split clip at playhead"
              >
                Split
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => duplicateClip(selectedClip!.id)}
                title="Duplicate clip"
              >
                Duplicate
              </button>
              <button
                type="button"
                className="btn-danger btn-sm"
                onClick={() => removeClip(selectedClip!.id)}
                title="Delete clip"
              >
                Delete
              </button>
            </div>
          </div>

          <div className="panel-section-header" style={{ marginTop: '1rem' }}>
            <h3>Track Settings</h3>
          </div>

          <div className="track-settings-toggle">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={parentTrack.muted}
                onChange={(e) => updateTrackProperties(parentTrack!.id, { muted: e.target.checked })}
              />
              Mute Track
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={parentTrack.locked}
                onChange={(e) => updateTrackProperties(parentTrack!.id, { locked: e.target.checked })}
              />
              Lock Track
            </label>
          </div>
        </>
      ) : (
        <div className="properties-panel-empty" style={{ paddingTop: 16 }}>
          <div className="empty-icon"><StudioIcon name="sliders" size={28} /></div>
          <p>Select a clip on the timeline to edit its properties.</p>
        </div>
      )}
    </div>
  )
}
