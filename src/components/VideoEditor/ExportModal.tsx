import { useEffect, useMemo, useRef, useState } from 'react'
import EditorDialog from './EditorDialog'
import { useEditor } from '../../hooks/useEditor'
import { estimateExportSize, exportProject, type ExportFPS, type ExportFormat, type ExportProgress, type ExportResolution } from '../../services/export'

const formatBytes = (bytes:number) => bytes >= 1e9 ? `${(bytes/1e9).toFixed(1)} GB` : `${(bytes/1e6).toFixed(1)} MB`

export default function ExportModal({ onClose }:{ onClose:()=>void }) {
  const editor = useEditor()
  const [resolution,setResolution]=useState<ExportResolution>('1080p')
  const [fps,setFps]=useState<ExportFPS>(30)
  const [format,setFormat]=useState<ExportFormat>('mp4')
  const [progress,setProgress]=useState<ExportProgress>({percent:0,stage:'Preparing...'})
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [limitations,setLimitations]=useState<string[]>([])
  const [download,setDownload]=useState<{url:string;fileName:string;size:number}|null>(null)
  const downloadUrlRef=useRef<string|null>(null)

  const project = useMemo(() => ({
    id:'browser-project', name:'video-editor-export', duration:editor.duration, canvas:editor.canvas, fps,
    tracks:editor.tracks, transitions:editor.transitions, visualElements:editor.visualElements,
  }), [editor.duration,editor.canvas,editor.tracks,editor.transitions,editor.visualElements,fps])
  const estimated = estimateExportSize(project,{resolution,fps,format})

  useEffect(()=>()=>{ if(downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current) },[])

  const saveToComputer=(url:string,fileName:string)=>{
    const a=document.createElement('a')
    a.href=url
    a.download=fileName
    a.style.display='none'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const startExport=async()=>{
    setBusy(true); setError(''); setLimitations([]); setProgress({percent:0,stage:'Preparing...'})
    if(downloadUrlRef.current){ URL.revokeObjectURL(downloadUrlRef.current); downloadUrlRef.current=null; setDownload(null) }
    try {
      const result=await exportProject(project,{resolution,fps,format},setProgress)
      setLimitations(result.limitations)
      const url=URL.createObjectURL(result.blob)
      downloadUrlRef.current=url
      setDownload({url,fileName:result.fileName,size:result.blob.size})
      saveToComputer(url,result.fileName)
    } catch (e) { setError(e instanceof Error?e.message:String(e)); setProgress({percent:0,stage:'Preparing...'}) }
    finally { setBusy(false) }
  }

  return <EditorDialog title="Export video" onClose={onClose} busy={busy}>
      <div className="export-modal-head"><div><span className="export-kicker">EXPORT STUDIO</span><h2>Export your video</h2><p>Choose the quality and format for your finished video.</p></div><button disabled={busy} onClick={onClose} aria-label="Close" title="Close export">×</button></div>
      <div className="export-grid">
        <label><span>Resolution</span><select aria-label="Resolution" value={resolution} disabled={busy} onChange={e=>setResolution(e.target.value as ExportResolution)}>{['480p','720p','1080p','2K','4K'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label><span>Frame rate</span><select aria-label="Frame rate" value={fps} disabled={busy} onChange={e=>setFps(Number(e.target.value) as ExportFPS)}>{[24,30,60].map(x=><option key={x} value={x}>{x} FPS</option>)}</select></label>
        <label><span>Format</span><select aria-label="Format" value={format} disabled={busy} onChange={e=>setFormat(e.target.value as ExportFormat)}><option value="mp4">MP4</option><option value="webm">WebM</option></select></label>
      </div>
      <div className="export-estimate"><span>Estimated file size</span><strong>~ {formatBytes(estimated)}</strong><small>Final size depends on codec, motion and project content.</small></div>
      {(busy||progress.percent>0)&&<div className="export-progress" role="status" aria-live="polite"><div className="export-progress-row"><strong>{progress.stage}</strong><span>{progress.percent}%</span></div><progress max="100" value={progress.percent}/><small>Progress is reported by the real FFmpeg render process.</small></div>}
      {download&&!busy&&<div className="export-success"><div><strong>✓ Video is ready</strong><span>{download.fileName} · {formatBytes(download.size)}</span></div><button className="btn-download" onClick={()=>saveToComputer(download.url,download.fileName)}>↓ Download video</button></div>}
      {error&&<div className="export-error" role="alert">{error}</div>}
      {limitations.length>0&&<div className="export-limitations"><strong>Current export limitations</strong><ul>{limitations.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
      <div className="export-actions"><button className="btn-secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="btn-accent" disabled={busy||editor.duration<=0} onClick={startExport}>{busy?`Rendering ${progress.percent}%`:(download?'Export again':'Export & Download')}</button></div>
  </EditorDialog>
}
