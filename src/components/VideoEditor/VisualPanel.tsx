import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useEditor } from '../../hooks/useEditor'
import type { ImageMaskShape, VisualElementKind, VisualElement } from '../../types/editor'
import KeyframeEditor from './KeyframeEditor'
import { getVisualSize, hasSquareBounds } from '../../utils/visualGeometry'

export default function VisualPanel({ mode = 'library' }: { mode?: 'library' | 'inspector' }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { canvas, visualElements, selectedVisualElementId, currentTime, addVisualFromFile, addVisualElement, updateVisualElement, removeVisualElement, duplicateVisualElement, selectVisualElement } = useEditor()
  const [importKind, setImportKind] = useState<VisualElementKind>('image')
  const [error, setError] = useState('')
  const selected = visualElements.find(v => v.id === selectedVisualElementId)

  const chooseFile = (kind: VisualElementKind) => { setImportKind(kind); inputRef.current?.click() }
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    setError('')
    for (const file of files) try { await addVisualFromFile(file, importKind) } catch (err) { setError(err instanceof Error ? err.message : 'Import failed') }
  }
  const addShape = (shape: 'rectangle'|'circle') => addVisualElement({ kind:'shape', name: shape === 'circle' ? 'Circle' : 'Rectangle', shape, color:'#7c5cff', x:50,y:50,width:25,height:shape==='circle'?25*canvas.width/canvas.height:25,scale:1,rotation:0,opacity:1,flipX:false,flipY:false,startTime:currentTime,endTime:currentTime+5,keyframeProperties:[],animation:{type:'none',duration:.4,parameters:{}} })
  const selectedSize = selected ? getVisualSize(selected, canvas) : undefined
  const n = (key: 'x' | 'y' | 'width' | 'height' | 'scale' | 'rotation' | 'opacity' | 'startTime' | 'endTime', value: number) => {
    if (!selected) return
    const updates: Partial<VisualElement> = { [key]: value }
    if (hasSquareBounds(selected)) {
      if (key === 'width') updates.height = value * canvas.width / canvas.height
      if (key === 'height') updates.width = value * canvas.height / canvas.width
    }
    updateVisualElement(selected.id, updates)
  }

  return <div className="visual-panel">
    <input ref={inputRef} hidden multiple type="file" accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif" onChange={onFile}/>
    {mode === 'library' && <><div className="panel-section-header"><h3>Visual Overlay</h3><span className="badge-track">{visualElements.length}</span></div>
    <p className="visual-help">Add images, logos and shapes. Select an overlay to edit it in the Inspector.</p>
    {error && <div className="media-error-alert">⚠️ {error}</div>}
    <div className="visual-add-grid">
      <button onClick={()=>chooseFile('image')}>+ Image</button><button onClick={()=>chooseFile('logo')}>+ Logo</button>
      <button onClick={()=>chooseFile('sticker')}>+ Sticker</button><button onClick={()=>chooseFile('overlay')}>+ Overlay</button>
      <button onClick={()=>addShape('rectangle')}>▰ Rectangle</button><button onClick={()=>addShape('circle')}>● Circle</button>
    </div>
    </>}
    {mode === 'inspector' && (selected ? <>
      <div className="panel-section-header"><h3>Transform</h3><span className="badge-track">{selected.kind}</span></div>
      <div className="property-row-split"><label>X %<input type="number" value={selected.x} onChange={e=>n('x',+e.target.value)}/></label><label>Y %<input type="number" value={selected.y} onChange={e=>n('y',+e.target.value)}/></label></div>
      <div className="property-row-split"><label>Width %<input type="number" min="1" value={selected.width} onChange={e=>n('width',Math.max(1,+e.target.value))}/></label><label>Height %<input type="number" min="1" value={selectedSize?.height ?? selected.height} onChange={e=>n('height',Math.max(1,+e.target.value))}/></label></div>
      <label>Scale <input type="range" min="0.1" max="3" step="0.05" value={selected.scale} onChange={e=>n('scale',+e.target.value)}/><span>{selected.scale.toFixed(2)}x</span></label>
      <label>Rotation <input type="range" min="-180" max="180" value={selected.rotation} onChange={e=>n('rotation',+e.target.value)}/><span>{selected.rotation}°</span></label>
      <label>Opacity <input type="range" min="0" max="1" step="0.01" value={selected.opacity} onChange={e=>n('opacity',+e.target.value)}/><span>{Math.round(selected.opacity*100)}%</span></label>
      <div className="property-row-split"><label>Start (trim)<input type="number" min="0" step=".1" value={selected.startTime} onChange={e=>n('startTime',Math.min(+e.target.value,selected.endTime-.1))}/></label><label>End (trim)<input type="number" min={selected.startTime+.1} step=".1" value={selected.endTime} onChange={e=>n('endTime',Math.max(+e.target.value,selected.startTime+.1))}/></label></div>
      {selected.kind!=='shape' && <><div className="panel-section-header"><h3>Image Shape</h3></div><div className="image-shape-grid">{(['original','square','circle','triangle'] as ImageMaskShape[]).map(shape=><button key={shape} aria-pressed={(selected.mask?.shape??'original')===shape} className={(selected.mask?.shape??'original')===shape?'active':''} onClick={()=>{updateVisualElement(selected.id,{mask:{shape},...getVisualSize({...selected,mask:{shape}},canvas)})}}>{shape[0].toUpperCase()+shape.slice(1)}</button>)}</div></>}
      <div className="visual-actions"><button onClick={()=>updateVisualElement(selected.id,{flipX:!selected.flipX})}>↔ Flip H</button><button onClick={()=>updateVisualElement(selected.id,{flipY:!selected.flipY})}>↕ Flip V</button><button onClick={()=>duplicateVisualElement(selected.id)}>Duplicate</button><button className="danger" onClick={()=>removeVisualElement(selected.id)}>Delete</button></div>
      <KeyframeEditor element={selected} />
      <div className="panel-section-header"><h3>Animation</h3></div>
      <select value={selected.animation.type} onChange={e=>updateVisualElement(selected.id,{animation:{...selected.animation,type:e.target.value as typeof selected.animation.type}})}><option value="none">None</option><option value="fade-in">Fade In</option><option value="pop">Pop</option><option value="slide-up">Slide Up</option></select>
      <label>Animation duration <input type="number" min=".1" max="3" step=".1" value={selected.animation.duration} onChange={e=>updateVisualElement(selected.id,{animation:{...selected.animation,duration:Math.max(.1,+e.target.value)}})}/></label>
    </> : <div className="properties-panel-empty"><p>Add or select a visual element to edit it.</p></div>)}
    {mode === 'library' && visualElements.length>0 && <div className="visual-list">{visualElements.map(v=><button key={v.id} className={v.id===selectedVisualElementId?'active':''} onClick={()=>selectVisualElement(v.id)}>{v.kind}: {v.name}</button>)}</div>}
  </div>
}
