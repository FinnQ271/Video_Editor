import { useMemo, useState } from 'react'
import { useEditor } from '../../hooks/useEditor'
import type { AnimatableProperty, EasingType, Keyframe, KeyframedProperty, VisualElement } from '../../types/editor'

const PROPERTIES: {key: AnimatableProperty; label: string}[] = [
  {key:'x',label:'Position X'}, {key:'y',label:'Position Y'}, {key:'scale',label:'Scale'}, {key:'rotation',label:'Rotation'}, {key:'opacity',label:'Opacity'},
]
const getBase = (element: VisualElement, property: AnimatableProperty) => Number(element[property as keyof VisualElement] ?? 0)

export default function KeyframeEditor({ element }: { element: VisualElement }) {
  const { currentTime, updateVisualElement, setCurrentTime } = useEditor()
  const [property, setProperty] = useState<AnimatableProperty>('x')
  const localTime = Math.max(0, Math.min(element.endTime-element.startTime, currentTime-element.startTime))
  const duration = Math.max(.1, element.endTime-element.startTime)
  const track = useMemo(()=>element.keyframeProperties.find(p=>p.property===property),[element.keyframeProperties,property])
  const frames = track?.keyframes ?? []
  const commit=(next:Keyframe[])=>{
    const props:KeyframedProperty[]=[...element.keyframeProperties.filter(p=>p.property!==property),{property,keyframes:[...next].sort((a,b)=>a.time-b.time)}]
    updateVisualElement(element.id,{keyframeProperties:props})
  }
  const add=()=>commit([...frames,{id:crypto.randomUUID(),time:localTime,value:getBase(element,property),easing:'linear'}])
  const update=(id:string,patch:Partial<Keyframe>)=>commit(frames.map(f=>f.id===id?{...f,...patch}:f))
  const remove=(id:string)=>commit(frames.filter(f=>f.id!==id))
  return <div className="keyframe-editor">
    <div className="panel-section-header"><h3>Keyframes</h3><button onClick={add}>+ Add at {localTime.toFixed(2)}s</button></div>
    <select aria-label="Keyframe property" value={property} onChange={e=>setProperty(e.target.value as AnimatableProperty)}>{PROPERTIES.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}</select>
    <div className="keyframe-lane">{frames.map(f=><button key={f.id} className="keyframe-dot" aria-label={`Keyframe at ${f.time.toFixed(2)} seconds`} style={{left:`${f.time/duration*100}%`}} title={`${f.time.toFixed(2)}s = ${f.value}`} onClick={()=>setCurrentTime(element.startTime+f.time)}>◆</button>)}</div>
    {frames.length===0?<p className="visual-help">Add keyframes, then change their time, value or easing. Preview interpolation is realtime.</p>:<div className="keyframe-list">{frames.map(f=><div className="keyframe-row" key={f.id}>
      <input title="Time" type="number" min="0" max={duration} step=".05" value={f.time} onChange={e=>update(f.id,{time:Math.max(0,Math.min(duration,+e.target.value))})}/>
      <input title="Value" type="number" step=".05" value={f.value} onChange={e=>update(f.id,{value:+e.target.value})}/>
      <select aria-label="Keyframe easing" value={f.easing} onChange={e=>update(f.id,{easing:e.target.value as EasingType})}><option value="linear">Linear</option><option value="ease-in">Ease In</option><option value="ease-out">Ease Out</option><option value="ease-in-out">Ease In Out</option></select>
      <button className="danger" title="Delete keyframe" aria-label="Delete keyframe" onClick={()=>remove(f.id)}>×</button>
    </div>)}</div>}
  </div>
}
