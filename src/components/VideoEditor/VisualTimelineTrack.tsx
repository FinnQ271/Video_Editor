import StudioIcon from './StudioIcon'
import { useEditor } from '../../hooks/useEditor'

const MIN_IMAGE_DURATION=.1
export default function VisualTimelineTrack({totalWidth}:{totalWidth:number}){
 const {visualElements,selectedVisualElementId,selectVisualElement,pixelsPerSecond,updateVisualElement,beginVisualInteraction}=useEditor()
 const drag=(id:string,mode:'move'|'left'|'right')=>(e:React.PointerEvent)=>{
  e.preventDefault();e.stopPropagation();selectVisualElement(id)
  const el=visualElements.find(v=>v.id===id); if(!el)return
  beginVisualInteraction()
  const sx=e.clientX,start=el.startTime,end=el.endTime,duration=end-start
  const move=(ev:PointerEvent)=>{
   const dt=(ev.clientX-sx)/pixelsPerSecond
   if(!Number.isFinite(dt))return
   if(mode==='move'){const ns=Math.max(0,start+dt);updateVisualElement(id,{startTime:ns,endTime:ns+duration},false)}
   if(mode==='left'){const ns=Math.max(0,Math.min(end-MIN_IMAGE_DURATION,start+dt));updateVisualElement(id,{startTime:ns},false)}
   if(mode==='right'){const ne=Math.max(start+MIN_IMAGE_DURATION,end+dt);updateVisualElement(id,{endTime:ne},false)}
  }
  const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)}
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up)
 }
 return <div className="timeline-track-row track-type-overlay"><div className="track-header"><span className="track-type-icon"><StudioIcon name="image" size={16} /></span><span className="track-name">Visual Overlay</span></div><div className="track-body" style={{width:totalWidth}}>{visualElements.map(v=><div key={v.id} className={`visual-timeline-item ${selectedVisualElementId===v.id?'selected':''}`} style={{left:v.startTime*pixelsPerSecond,width:Math.max(24,(v.endTime-v.startTime)*pixelsPerSecond)}} onPointerDown={drag(v.id,'move')} onClick={e=>{e.stopPropagation();selectVisualElement(v.id)}}><span className="visual-trim-handle left" onPointerDown={drag(v.id,'left')}/><StudioIcon name="image" size={14} /><span className="visual-timeline-label">{v.name}</span><span className="visual-trim-handle right" onPointerDown={drag(v.id,'right')}/></div>)}</div></div>
}
