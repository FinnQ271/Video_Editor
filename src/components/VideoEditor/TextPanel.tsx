import type { ChangeEvent } from 'react'
import { useEditor } from '../../hooks/useEditor'
import type { TextOverlayProperties } from '../../types/editor'

const FONT_OPTIONS = [
  'Inter',
  'Roboto',
  'Montserrat',
  'Outfit',
  'Impact',
  'Georgia',
  'Courier New',
  'Arial',
  'Verdana',
  'Comic Sans MS',
]

export default function TextPanel({ mode = 'library' }: { mode?: 'library' | 'inspector' }) {
  const {
    tracks,
    selectedClipId,
    addTextClip,
    updateTextOverlayProperties,
    removeClip,
    duplicateClip,
  } = useEditor()

  // Find currently selected text clip
  let selectedTextClip = undefined
  for (const track of tracks) {
    const found = track.clips.find((c) => c.id === selectedClipId && (c.type === 'text' || c.textProperties))
    if (found) {
      selectedTextClip = found
      break
    }
  }

  const textProps = selectedTextClip?.textProperties

  const textInput = textProps?.text || ''

  const handleAddPreset = (text: string, presetProps: Partial<TextOverlayProperties>) => {
    addTextClip(text, presetProps)
  }

  const handleTextChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.value
    if (selectedTextClip) {
      updateTextOverlayProperties(selectedTextClip.id, { text: val })
    }
  }

  return (
    <div className="text-panel-container">
      {mode === 'library' && <><div className="panel-section-header">
        <h3>Add Text Overlay</h3>
      </div>

      {/* Preset Quick Add Buttons */}
      <div className="text-presets-grid">
        <button
          type="button"
          className="preset-card preset-heading"
          onClick={() =>
            handleAddPreset('Heading Text', {
              fontSize: 48,
              fontWeight: 'bold',
              color: '#ffffff',
              background: 'rgba(0,0,0,0.4)',
            })
          }
        >
          <span className="preset-sample font-heading">Heading</span>
          <span className="preset-label">Big Title</span>
        </button>

        <button
          type="button"
          className="preset-card preset-subheading"
          onClick={() =>
            handleAddPreset('Subheading Text', {
              fontSize: 32,
              fontWeight: '600',
              color: '#00d2ff',
              background: 'transparent',
            })
          }
        >
          <span className="preset-sample font-sub">Subheading</span>
          <span className="preset-label">Subtitle</span>
        </button>

        <button
          type="button"
          className="preset-card preset-neon"
          onClick={() =>
            handleAddPreset('NEON GLOW', {
              fontSize: 44,
              fontWeight: 'bold',
              fontFamily: 'Montserrat',
              color: '#ff007f',
              stroke: '#ffffff',
              strokeWidth: 2,
              shadow: '0 0 12px #ff007f, 0 0 24px #ff007f',
              background: 'rgba(0,0,0,0.6)',
            })
          }
        >
          <span className="preset-sample font-neon">NEON</span>
          <span className="preset-label">Glow Banner</span>
        </button>

        <button
          type="button"
          className="preset-card preset-banner"
          onClick={() =>
            handleAddPreset('CAPTION TEXT', {
              fontSize: 28,
              fontWeight: 'bold',
              color: '#ffffff',
              background: '#7c5cff',
              y: 80,
            })
          }
        >
          <span className="preset-sample font-banner">CAPTION</span>
          <span className="preset-label">Lower Third</span>
        </button>
      </div>

      </>}
      {mode === 'inspector' && (selectedTextClip && textProps ? (
        <div className="text-inspector-box">
          <div className="panel-section-header">
            <h3>Text Style & Properties</h3>
          </div>

          {/* Text Content */}
          <div className="property-group">
            <label htmlFor="text-content-input">Text Content</label>
            <textarea
              id="text-content-input"
              className="form-control text-area-control"
              value={textInput}
              onChange={handleTextChange}
              rows={2}
            />
          </div>

          {/* Font Family & Size */}
          <div className="property-row-split">
            <div className="property-group">
              <label htmlFor="font-family-select">Font Family</label>
              <select
                id="font-family-select"
                className="form-control"
                value={textProps.fontFamily}
                onChange={(e) =>
                  updateTextOverlayProperties(selectedTextClip.id, { fontFamily: e.target.value })
                }
              >
                {FONT_OPTIONS.map((font) => (
                  <option key={font} value={font} style={{ fontFamily: font }}>
                    {font}
                  </option>
                ))}
              </select>
            </div>

            <div className="property-group">
              <label htmlFor="font-size-input">Size ({textProps.fontSize}px)</label>
              <input
                id="font-size-input"
                type="range"
                min="12"
                max="120"
                value={textProps.fontSize}
                onChange={(e) =>
                  updateTextOverlayProperties(selectedTextClip.id, {
                    fontSize: parseInt(e.target.value, 10),
                  })
                }
              />
            </div>
          </div>

          {/* Style Toggles (Bold, Italic) */}
          <div className="property-group">
            <label>Text Style</label>
            <div className="btn-toggle-group">
              <button
                type="button"
                className={`btn-toggle ${textProps.fontWeight === 'bold' ? 'active' : ''}`}
                onClick={() =>
                  updateTextOverlayProperties(selectedTextClip.id, {
                    fontWeight: textProps.fontWeight === 'bold' ? 'normal' : 'bold',
                  })
                }
              >
                <strong>B</strong> Bold
              </button>
              <button
                type="button"
                className={`btn-toggle ${textProps.italic ? 'active' : ''}`}
                onClick={() =>
                  updateTextOverlayProperties(selectedTextClip.id, { italic: !textProps.italic })
                }
              >
                <em>I</em> Italic
              </button>
            </div>
          </div>

          {/* Colors: Text, Stroke, Background */}
          <div className="property-row-split">
            <div className="property-group">
              <label htmlFor="text-color-picker">Color</label>
              <input
                id="text-color-picker"
                type="color"
                className="color-picker-input"
                value={textProps.color.startsWith('#') ? textProps.color : '#ffffff'}
                onChange={(e) =>
                  updateTextOverlayProperties(selectedTextClip.id, { color: e.target.value })
                }
              />
            </div>

            <div className="property-group">
              <label htmlFor="text-bg-picker">Background</label>
              <input
                id="text-bg-picker"
                type="color"
                className="color-picker-input"
                value={textProps.background?.startsWith('#') ? textProps.background : '#000000'}
                onChange={(e) =>
                  updateTextOverlayProperties(selectedTextClip.id, { background: e.target.value })
                }
              />
            </div>
          </div>

          {/* Stroke Color & Width */}
          <div className="property-row-split">
            <div className="property-group">
              <label htmlFor="text-stroke-picker">Stroke Color</label>
              <input
                id="text-stroke-picker"
                type="color"
                className="color-picker-input"
                value={textProps.stroke?.startsWith('#') ? textProps.stroke : '#000000'}
                onChange={(e) =>
                  updateTextOverlayProperties(selectedTextClip.id, { stroke: e.target.value })
                }
              />
            </div>

            <div className="property-group">
              <label htmlFor="stroke-width-input">Stroke ({textProps.strokeWidth || 0}px)</label>
              <input
                id="stroke-width-input"
                type="range"
                min="0"
                max="10"
                value={textProps.strokeWidth || 0}
                onChange={(e) =>
                  updateTextOverlayProperties(selectedTextClip.id, {
                    strokeWidth: parseInt(e.target.value, 10),
                  })
                }
              />
            </div>
          </div>

          {/* Opacity & Rotation */}
          <div className="property-row-split">
            <div className="property-group">
              <label htmlFor="text-opacity-input">Opacity ({Math.round((textProps.opacity ?? 1) * 100)}%)</label>
              <input
                id="text-opacity-input"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={textProps.opacity ?? 1}
                onChange={(e) =>
                  updateTextOverlayProperties(selectedTextClip.id, {
                    opacity: parseFloat(e.target.value),
                  })
                }
              />
            </div>

            <div className="property-group">
              <label htmlFor="text-rotation-input">Rotation ({textProps.rotation || 0}°)</label>
              <input
                id="text-rotation-input"
                type="range"
                min="-180"
                max="180"
                value={textProps.rotation || 0}
                onChange={(e) =>
                  updateTextOverlayProperties(selectedTextClip.id, {
                    rotation: parseInt(e.target.value, 10),
                  })
                }
              />
            </div>
          </div>

          {/* Position X & Y Sliders */}
          <div className="property-row-split">
            <div className="property-group">
              <label htmlFor="pos-x-input">Position X ({Math.round(textProps.x)}%)</label>
              <input
                id="pos-x-input"
                type="range"
                min="0"
                max="100"
                value={textProps.x}
                onChange={(e) =>
                  updateTextOverlayProperties(selectedTextClip.id, {
                    x: parseFloat(e.target.value),
                  })
                }
              />
            </div>

            <div className="property-group">
              <label htmlFor="pos-y-input">Position Y ({Math.round(textProps.y)}%)</label>
              <input
                id="pos-y-input"
                type="range"
                min="0"
                max="100"
                value={textProps.y}
                onChange={(e) =>
                  updateTextOverlayProperties(selectedTextClip.id, {
                    y: parseFloat(e.target.value),
                  })
                }
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="property-group" style={{ marginTop: '8px' }}>
            <div className="clip-actions-grid">
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => duplicateClip(selectedTextClip.id)}
              >
                Duplicate
              </button>
              <button
                type="button"
                className="btn-danger btn-sm"
                onClick={() => removeClip(selectedTextClip.id)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-panel-tip">
          <p>💡 Click a preset above to add text, or select a text clip on the timeline to edit its style.</p>
        </div>
      ))}
    </div>
  )
}
