import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from '../../hooks/useEditor'
import Controls from './Controls'
import StudioIcon from './StudioIcon'
import type { TimelineClip, VideoTransition, VisualElement } from '../../types/editor'
import { evaluateProperties } from '../../utils/keyframeEngine'
import ChromaVideoLayer from './ChromaVideoLayer'
import { usePlaybackClock } from '../../hooks/usePlaybackClock'
import { syncPlaybackVideo } from '../../utils/playback'
import { getVisualSize, hasSquareBounds } from '../../utils/visualGeometry'

const clamp01 = (n:number) => Math.max(0, Math.min(1, n))
function transitionStyles(type: VideoTransition['type'], p: number) {
  const q=clamp01(p), out: React.CSSProperties={}, incoming: React.CSSProperties={}
  switch(type){
    case 'fade': out.opacity=1-q; incoming.opacity=q; break
    case 'dissolve': out.opacity=1-q; incoming.opacity=q; incoming.filter=`contrast(${.85+.15*q})`; break
    case 'slide': out.transform=`translateX(${-q*100}%)`; incoming.transform=`translateX(${(1-q)*100}%)`; break
    case 'zoom': out.opacity=1-q; out.transform=`scale(${1+.18*q})`; incoming.opacity=q; incoming.transform=`scale(${.72+.28*q})`; break
    case 'wipe': incoming.clipPath=`inset(0 ${100-q*100}% 0 0)`; break
    case 'blur': out.opacity=1-q; out.filter=`blur(${q*18}px)`; incoming.opacity=q; incoming.filter=`blur(${(1-q)*18}px)`; break
    case 'spin': out.opacity=1-q; out.transform=`rotate(${q*120}deg) scale(${1-q*.2})`; incoming.opacity=q; incoming.transform=`rotate(${(q-1)*120}deg) scale(${.8+q*.2})`; break
    case 'flash': { const flash=Math.sin(q*Math.PI); out.opacity=1-q; incoming.opacity=q; incoming.filter=`brightness(${1+flash*3})`; break }
  }
  return {out,incoming}
}


function VisualOverlayLayer({ element, selected, currentTime, onSelect, onUpdate, onInteractionStart }:{ element:VisualElement; selected:boolean; currentTime:number; onSelect:()=>void; onUpdate:(u:Partial<VisualElement>)=>void; onInteractionStart:()=>void }) {
  const { canvas } = useEditor()
  const size = getVisualSize(element, canvas)
  const progress=Math.max(0,Math.min(1,(currentTime-element.startTime)/Math.max(.1,element.animation.duration)))
  let animationTransform='', animationOpacity=1
  if(element.animation.type==='fade-in') animationOpacity=progress
  if(element.animation.type==='pop') animationTransform=` scale(${.3+.7*progress})`
  if(element.animation.type==='slide-up') animationTransform=` translateY(${(1-progress)*40}px)`
  const pointer=(mode:'move'|'resize'|'rotate')=>(e:React.PointerEvent)=>{
    e.preventDefault();e.stopPropagation();onSelect();onInteractionStart()
    const host=e.currentTarget.closest('.visual-overlays-container')?.getBoundingClientRect(); if(!host)return
    const sx=e.clientX,sy=e.clientY,start={...element}
    const move=(ev:PointerEvent)=>{
      const dx=(ev.clientX-sx)/host.width*100,dy=(ev.clientY-sy)/host.height*100
      if(mode==='move') onUpdate({x:Math.max(0,Math.min(100,start.x+dx)),y:Math.max(0,Math.min(100,start.y+dy))})
      if(mode==='resize'){const lock=hasSquareBounds(element);const w=Math.max(2,start.width+dx*2);onUpdate(lock?getVisualSize({...start,width:w},canvas):{width:w,height:Math.max(2,start.height+dy*2)})}
      if(mode==='rotate'){const cx=host.left+host.width*start.x/100,cy=host.top+host.height*start.y/100;const a0=Math.atan2(sy-cy,sx-cx),a1=Math.atan2(ev.clientY-cy,ev.clientX-cx);onUpdate({rotation:start.rotation+(a1-a0)*180/Math.PI})}
    }
    const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)}
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up)
  }
  const localTime=Math.max(0,currentTime-element.startTime)
  const animated=evaluateProperties(element.keyframeProperties,localTime,{x:element.x,y:element.y,scale:element.scale,rotation:element.rotation,opacity:element.opacity})
  const x=animated.x??element.x,y=animated.y??element.y,scale=animated.scale??element.scale,rotation=animated.rotation??element.rotation,opacity=animated.opacity??element.opacity
  const style:React.CSSProperties={position:'absolute',left:`${x}%`,top:`${y}%`,width:`${size.width}%`,height:`${size.height}%`,opacity:opacity*animationOpacity,transform:`translate(-50%,-50%) rotate(${rotation}deg) scale(${element.flipX?-scale:scale},${element.flipY?-scale:scale})${animationTransform}`,transformOrigin:'center',cursor:'move',zIndex:20}
  return <div className={`visual-preview-element ${selected?'selected':''}`} style={style} onPointerDown={pointer('move')} onClick={e=>{e.stopPropagation();onSelect()}}>
    {element.kind==='shape'?<div style={{width:'100%',height:'100%',background:element.color||'#7c5cff',borderRadius:element.shape==='circle'?'50%':'4px'}}/>:<div className={`visual-image-mask mask-${element.mask?.shape??'original'}`}><img src={element.src} alt={element.name} draggable={false}/></div>}
    {selected&&<><button className="visual-handle resize" onPointerDown={pointer('resize')} title="Resize" aria-label="Resize overlay"/><button className="visual-handle rotate" onPointerDown={pointer('rotate')} title="Rotate" aria-label="Rotate overlay">↻</button></>}
  </div>
}

export default function VideoPreview(){
  const containerRef=useRef<HTMLDivElement>(null), viewportRef=useRef<HTMLDivElement>(null)
  const mainRef=useRef<HTMLVideoElement>(null), outRef=useRef<HTMLVideoElement>(null), inRef=useRef<HTMLVideoElement>(null)
  const {assets,selectedAssetId,tracks,transitions,visualElements,selectedVisualElementId,selectVisualElement,updateVisualElement,beginVisualInteraction,canvas,currentTime,duration,isPlaying,volume,isMuted,setCurrentTime,setPlaying}=useEditor()
  const [isFullscreen,setIsFullscreen]=useState(false), [cvDims,setCvDims]=useState({width:0,height:0})
  const clips=useMemo(()=>tracks.filter(t=>t.type==='video').flatMap(t=>t.clips).sort((a,b)=>a.timelineStart-b.timelineStart),[tracks])
  const activeClip=clips.find(c=>currentTime>=c.timelineStart && currentTime<c.timelineStart+c.duration)
  const selectedAsset=assets.find(a=>a.id===selectedAssetId)
  const transitionState=useMemo(()=>{
    for(const t of transitions){ const from=clips.find(c=>c.id===t.fromClipId), to=clips.find(c=>c.id===t.toClipId); if(!from||!to) continue
      const start=to.timelineStart, end=start+t.duration
      if(currentTime>=start && currentTime<=end) return {transition:t,from,to,progress:clamp01((currentTime-start)/t.duration)}
    } return undefined
  },[transitions,clips,currentTime])
  const activeTextClips=tracks.flatMap(t=>t.clips).filter(c=>c.textProperties&&currentTime>=c.timelineStart&&currentTime<=c.timelineStart+c.duration)

  const recalc=useCallback(()=>{const el=viewportRef.current;if(!el)return;const vw=el.clientWidth,vh=el.clientHeight;if(!vw||!vh)return;const r=canvas.width/canvas.height;let w=vw,h=w/r;if(h>vh){h=vh;w=h*r}setCvDims({width:Math.floor(w),height:Math.floor(h)})},[canvas.width,canvas.height])
  useEffect(()=>{const el=viewportRef.current;if(!el)return;const ro=new ResizeObserver(recalc);ro.observe(el);recalc();return()=>ro.disconnect()},[recalc])

  usePlaybackClock(currentTime, duration, isPlaying, setCurrentTime, setPlaying)

  useEffect(() => {
    const synchronize = () => {
      if (transitionState) {
        const { from, to, progress } = transitionState
        // The outgoing clip holds its last frame; do not repeatedly play/seek its ending.
        syncPlaybackVideo(outRef.current, from, from.sourceEnd - .02, isPlaying, volume, isMuted, true)
        syncPlaybackVideo(inRef.current, to, to.sourceStart + progress * transitionState.transition.duration * (to.speed || 1), isPlaying, volume, isMuted)
      } else if (activeClip) {
        syncPlaybackVideo(mainRef.current, activeClip, activeClip.sourceStart + (currentTime - activeClip.timelineStart) * (activeClip.speed || 1), isPlaying, volume, isMuted)
      } else {
        mainRef.current?.pause()
      }
    }
    synchronize()
    const videos = [mainRef.current, outRef.current, inRef.current].filter((v): v is HTMLVideoElement => v !== null)
    // Initial seek/play must also run when a new source finishes loading while paused.
    videos.forEach(video => video.addEventListener('loadedmetadata', synchronize))
    return () => videos.forEach(video => video.removeEventListener('loadedmetadata', synchronize))
  }, [currentTime, isPlaying, volume, isMuted, activeClip, transitionState])

  const transformStyle=(clip?:TimelineClip):React.CSSProperties=>{const t=clip?.transform;return {opacity:t?.opacity??1,transform:t?`scale(${t.scaleX??1},${t.scaleY??1}) rotate(${t.rotation??0}deg)`:undefined}}
  const fx=transitionState?transitionStyles(transitionState.transition.type,transitionState.progress):undefined
  const toggleFullscreen=()=>{if(!containerRef.current)return;if(!document.fullscreenElement)containerRef.current.requestFullscreen().catch(()=>{});else document.exitFullscreen().catch(()=>{})}
  useEffect(()=>{const h=()=>setIsFullscreen(!!document.fullscreenElement);document.addEventListener('fullscreenchange',h);return()=>document.removeEventListener('fullscreenchange',h)},[])
  const fallbackSrc=activeClip?.src??selectedAsset?.url

  return <div className={`video-preview-stage ${isFullscreen?'fullscreen-stage':''}`} ref={containerRef}>
    <div className="preview-heading"><div><StudioIcon name="monitor" size={16} /><span>Xem trước</span><span className="preview-live">Chất lượng đầy đủ</span></div><span className="canvas-size">{canvas.width} × {canvas.height}</span></div>
    <div className="preview-viewport" ref={viewportRef}>{cvDims.width>0&&<div className="canvas-viewport" style={{width:cvDims.width,height:cvDims.height,backgroundColor:canvas.background}}>
      {transitionState ? <>
        <ChromaVideoLayer ref={outRef} src={transitionState.from.src} settings={transitionState.from.chromaKey} className="transition-video-layer" style={{...transformStyle(transitionState.from),...fx?.out}}/>
        <ChromaVideoLayer ref={inRef} src={transitionState.to.src} settings={transitionState.to.chromaKey} className="transition-video-layer" style={{...transformStyle(transitionState.to),...fx?.incoming}}/>
      </> : fallbackSrc ? <ChromaVideoLayer ref={mainRef} src={fallbackSrc} settings={activeClip?.chromaKey} className="canvas-media-video" style={{width:'100%',height:'100%',objectFit:'contain',display:'block',...transformStyle(activeClip)}}/> : <div className="empty-preview-placeholder"><div className="preview-art" aria-hidden="true"><span className="preview-art-back" /><span className="preview-art-front"><StudioIcon name="film" size={38} /></span><span className="preview-art-spark">+</span></div><span className="panel-eyebrow">THE STAGE IS YOURS</span><h2>Bring your story to life.</h2><p>Import a video, then add it to your timeline.<br />Your next great edit starts with a single clip.</p><div className="preview-steps"><span>01 &nbsp; Import</span><span>02 &nbsp; Create</span><span>03 &nbsp; Export</span></div></div>}
      <div className="text-overlays-container">{activeTextClips.map(c=>{const p=c.textProperties!;return <div key={c.id} style={{position:'absolute',left:`${p.x}%`,top:`${p.y}%`,transform:`translate(-50%,-50%) rotate(${p.rotation||0}deg)`,fontFamily:p.fontFamily,fontSize:p.fontSize,fontWeight:p.fontWeight,fontStyle:p.italic?'italic':'normal',color:p.color,opacity:p.opacity,backgroundColor:p.background,padding:p.background?'4px 8px':0,textShadow:p.shadow,WebkitTextStroke:p.strokeWidth?`${p.strokeWidth}px ${p.stroke}`:undefined,whiteSpace:'pre-wrap'}}>{p.text}</div>})}</div>
      <div className="visual-overlays-container">{visualElements.filter(v=>currentTime>=v.startTime&&currentTime<v.endTime).map(v=><VisualOverlayLayer key={v.id} element={v} selected={selectedVisualElementId===v.id} currentTime={currentTime} onSelect={()=>selectVisualElement(v.id)} onUpdate={u=>updateVisualElement(v.id,u,false)} onInteractionStart={beginVisualInteraction}/>)}</div>
      {transitionState&&<div style={{position:'absolute',right:8,top:8,padding:'4px 7px',borderRadius:4,background:'#0009',color:'#fff',fontSize:10}}>⚡ {transitionState.transition.type} {Math.round(transitionState.progress*100)}%</div>}
    </div>}</div>
    <Controls onToggleFullscreen={toggleFullscreen} isFullscreen={isFullscreen}/>
  </div>
}
