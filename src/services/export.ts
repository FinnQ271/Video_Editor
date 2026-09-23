import type { EditorProject, TimelineClip, VideoTransition, VisualElement } from '../types/editor'
import { fetchFile, getFFmpeg } from './ffmpeg'
import { hasSquareBounds } from '../utils/visualGeometry'

export type ExportResolution = '480p' | '720p' | '1080p' | '2K' | '4K'
export type ExportFPS = 24 | 30 | 60
export type ExportFormat = 'mp4' | 'webm'
export type ExportStage = 'Preparing...' | 'Rendering...' | 'Encoding...' | 'Finalizing...'

export interface ExportProjectSnapshot extends EditorProject {
  transitions: VideoTransition[]
  visualElements: VisualElement[]
}
export interface ExportOptions { resolution: ExportResolution; fps: ExportFPS; format: ExportFormat }
export interface ExportProgress { percent: number; stage: ExportStage }
export interface ExportResult { blob: Blob; fileName: string; limitations: string[] }

const HEIGHTS: Record<ExportResolution, number> = { '480p': 480, '720p': 720, '1080p': 1080, '2K': 1440, '4K': 2160 }

export function validateExportOptions(project: ExportProjectSnapshot, options: ExportOptions) {
  if (![24, 30, 60].includes(options.fps)) throw new Error('Invalid frame rate. Choose 24, 30 or 60 FPS.')
  if (!Object.hasOwn(HEIGHTS, options.resolution)) throw new Error('Invalid export resolution.')
  if (!['mp4', 'webm'].includes(options.format)) throw new Error('Invalid export format.')
  if (!Number.isFinite(project.duration) || project.duration < 0) throw new Error('Invalid project duration.')
  if (![project.canvas.width, project.canvas.height].every(n => Number.isFinite(n) && n > 0)) {
    throw new Error('Invalid canvas dimensions.')
  }
}

export function getExportDimensions(project: ExportProjectSnapshot, resolution: ExportResolution) {
  const h = HEIGHTS[resolution]
  const ratio = project.canvas.width / project.canvas.height
  const width = Math.max(2, Math.round((h * ratio) / 2) * 2)
  return { width, height: h }
}

export function estimateExportSize(project: ExportProjectSnapshot, options: ExportOptions) {
  try { validateExportOptions(project, options) } catch { return 0 }
  const { width, height } = getExportDimensions(project, options.resolution)
  const pixelRate = width * height * options.fps
  const videoMbps = Math.min(35, Math.max(1.2, pixelRate / (1920 * 1080 * 30) * 8))
  const audioMbps = 0.192
  return ((videoMbps + audioMbps) * Math.max(project.duration, 0) / 8) * 1_000_000
}

function extFromClip(clip: TimelineClip) {
  const nameExt = clip.name.split('.').pop()?.toLowerCase()
  return nameExt && /^[a-z0-9]{2,5}$/.test(nameExt) ? nameExt : 'mp4'
}

function limitationsFor(project: ExportProjectSnapshot) {
  const limitations: string[] = []
  if (project.tracks.some(t => t.clips.some(c => c.textProperties))) limitations.push('Text export is not rendered yet: browser preview text is preserved in the project, but this FFmpeg.wasm pipeline does not fake drawtext/font rendering.')
  if (project.visualElements.some(v => v.mimeType === 'image/gif')) limitations.push('GIF overlays are currently rasterized to a static frame during export; animated GIF frame export is not faked.')
  if (project.visualElements.some(v => v.kind === 'shape')) limitations.push('Editor-generated shape overlays are not exported yet; imported image/logo/sticker/overlay masks are exported.')
  if (project.tracks.some(t => t.clips.some(c => c.keyframeProperties?.length))) limitations.push('Keyframed transform/opacity export is not compiled to FFmpeg expressions yet. Realtime preview remains authoritative.')
  if (project.tracks.some(t => t.clips.some(c => c.chromaKey?.enabled))) limitations.push('Chroma Key export is not mapped to chromakey/colorkey yet.')
  // The current project model has no persisted filter/effect stack, so never pretend preview-only CSS is encoded.
  limitations.push('Filter/Effect export requires persisted filter/effect data in EditorProject; the current model has no exportable filter/effect stack, so none is fabricated.')
  return limitations
}


async function rasterizeVisual(element: VisualElement): Promise<Uint8Array> {
  if (!element.src) throw new Error(`Visual ${element.name} has no source.`)
  const image = await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error(`Could not decode ${element.name}`));img.src=element.src!})
  const shape=element.mask?.shape??'original'
  const square=shape==='square'||shape==='circle'
  const w=Math.max(2,image.naturalWidth||512),h=Math.max(2,image.naturalHeight||512)
  const canvas=document.createElement('canvas'); canvas.width=square?Math.min(w,h):w; canvas.height=square?canvas.width:h
  const ctx=canvas.getContext('2d'); if(!ctx)throw new Error('Canvas 2D is unavailable for image export.')
  if(shape==='circle'){ctx.beginPath();ctx.arc(canvas.width/2,canvas.height/2,canvas.width/2,0,Math.PI*2);ctx.clip()}
  if(shape==='triangle'){ctx.beginPath();ctx.moveTo(canvas.width/2,0);ctx.lineTo(0,canvas.height);ctx.lineTo(canvas.width,canvas.height);ctx.closePath();ctx.clip()}
  if(shape==='original') ctx.drawImage(image,0,0,canvas.width,canvas.height)
  else { const scale=Math.max(canvas.width/w,canvas.height/h),dw=w*scale,dh=h*scale;ctx.drawImage(image,(canvas.width-dw)/2,(canvas.height-dh)/2,dw,dh) }
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not rasterize image mask.')),'image/png'))
  return new Uint8Array(await blob.arrayBuffer())
}

export async function exportProject(
  project: ExportProjectSnapshot,
  options: ExportOptions,
  onProgress?: (progress: ExportProgress) => void,
): Promise<ExportResult> {
  validateExportOptions(project, options)
  const videoClips = project.tracks.filter(t => t.type === 'video' && !t.muted).flatMap(t => t.clips).filter(c => c.src).sort((a,b) => a.timelineStart-b.timelineStart)
  if (!videoClips.length) throw new Error('Project has no exportable video clip.')

  onProgress?.({ percent: 0, stage: 'Preparing...' })
  const ffmpeg = await getFFmpeg()
  const logs: string[] = []
  const handleLog = ({ message }: { message: string }) => {
    logs.push(message)
    if (logs.length > 20) logs.shift()
  }
  const handleProgress = ({ progress }: { progress: number }) => {
    if (!Number.isFinite(progress)) return
    const percent = Math.max(0, Math.min(99, Math.round(progress * 100)))
    onProgress?.({ percent, stage: percent < 70 ? 'Rendering...' : 'Encoding...' })
  }
  ffmpeg.on('log', handleLog)
  ffmpeg.on('progress', handleProgress)
  const inputNames: string[] = []
  const audioNames: string[] = []
  const visualNames: string[] = []
  const outName = `export.${options.format}`
  try {
  const { width, height } = getExportDimensions(project, options.resolution)

  for (let i=0; i<videoClips.length; i++) {
    const clip = videoClips[i]
    const name = `video_${i}.${extFromClip(clip)}`
    inputNames.push(name)
    await ffmpeg.writeFile(name, await fetchFile(clip.src!))
  }

  const audioClips = project.tracks.filter(t => t.type === 'audio' && !t.muted).flatMap(t => t.clips).filter(c => c.src)
  for (let i=0; i<audioClips.length; i++) {
    const clip = audioClips[i]
    const name = `audio_${i}.${extFromClip(clip)}`
    audioNames.push(name)
    await ffmpeg.writeFile(name, await fetchFile(clip.src!))
  }

  const exportVisuals = project.visualElements.filter(v => v.kind !== 'shape' && v.src && v.endTime > v.startTime)
  for (let i=0;i<exportVisuals.length;i++) { const name=`visual_${i}.png`; visualNames.push(name); await ffmpeg.writeFile(name, await rasterizeVisual(exportVisuals[i])) }

  const args: string[] = []
  videoClips.forEach((clip, i) => args.push('-ss', String(clip.sourceStart), '-t', String(clip.duration), '-i', inputNames[i]))
  audioClips.forEach((clip, i) => args.push('-ss', String(clip.sourceStart), '-t', String(clip.duration), '-i', audioNames[i]))
  visualNames.forEach(name => args.push('-loop','1','-i',name))

  const filters: string[] = []
  videoClips.forEach((clip, i) => {
    const speed = Math.max(0.1, clip.speed ?? 1)
    const tr = clip.transform
    const transform = tr ? `,scale=iw*${Math.abs(tr.scaleX || 1)}:ih*${Math.abs(tr.scaleY || 1)}${tr.scaleX < 0 ? ',hflip' : ''}${tr.scaleY < 0 ? ',vflip' : ''}` : ''
    filters.push(`[${i}:v]setpts=PTS/${speed},scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black${transform},fps=${options.fps},format=yuv420p[v${i}]`)
  })

  let videoOut = 'v0'
  if (videoClips.length > 1) {
    let acc = 0
    for (let i=1; i<videoClips.length; i++) {
      const previous = videoClips[i-1]
      const transition = project.transitions.find(t => t.fromClipId === previous.id && t.toClipId === videoClips[i].id)
      const left = i === 1 ? '[v0]' : `[vx${i-1}]`
      const right = `[v${i}]`
      if (transition && ['fade','dissolve','slide','wipe'].includes(transition.type)) {
        const d = Math.max(0.05, Math.min(transition.duration, previous.duration, videoClips[i].duration))
        acc += previous.duration - (i > 1 ? (project.transitions.find(t => t.toClipId === previous.id)?.duration ?? 0) : 0)
        const xfadeName = transition.type === 'slide' ? 'slideleft' : transition.type === 'wipe' ? 'wipeleft' : 'fade'
        filters.push(`${left}${right}xfade=transition=${xfadeName}:duration=${d}:offset=${Math.max(0, acc-d)}[vx${i}]`)
      } else {
        filters.push(`${left}${right}concat=n=2:v=1:a=0[vx${i}]`)
      }
      videoOut = `vx${i}`
    }
  }

  // Composite imported visuals after the video/transition graph. Mask pixels come from the same non-destructive mask model as Preview.
  exportVisuals.forEach((visual,i)=>{
    const inputIndex=videoClips.length+audioClips.length+i
    const targetW=Math.max(2,Math.round(width*(visual.width/100)*visual.scale/2)*2)
    const targetH=hasSquareBounds(visual)?targetW:Math.max(2,Math.round(height*(visual.height/100)*visual.scale/2)*2)
    const alpha=Math.max(0,Math.min(1,visual.opacity))
    const flip=`${visual.flipX?',hflip':''}${visual.flipY?',vflip':''}`
    const rotate=Math.abs(visual.rotation)>0.001?`,rotate=${visual.rotation}*PI/180:ow=rotw(iw):oh=roth(ih):c=none`:''
    filters.push(`[${inputIndex}:v]scale=${targetW}:${targetH}${flip}${rotate},format=rgba,colorchannelmixer=aa=${alpha}[ov${i}]`)
    const previous=i===0?`[${videoOut}]`:`[vo${i-1}]`
    const x=`W*${visual.x/100}-w/2`, y=`H*${visual.y/100}-h/2`
    filters.push(`${previous}[ov${i}]overlay=x='${x}':y='${y}':enable='between(t,${visual.startTime},${visual.endTime})'[vo${i}]`)
  })
  if(exportVisuals.length) videoOut=`vo${exportVisuals.length-1}`

  let audioOut: string | undefined
  if (audioClips.length) {
    audioClips.forEach((clip, i) => {
      const inputIndex = videoClips.length + i
      const delay = Math.max(0, Math.round(clip.timelineStart * 1000))
      filters.push(`[${inputIndex}:a]volume=${clip.volume ?? 1},adelay=${delay}|${delay}[a${i}]`)
    })
    if (audioClips.length === 1) audioOut = 'a0'
    else { filters.push(`${audioClips.map((_,i)=>`[a${i}]`).join('')}amix=inputs=${audioClips.length}:duration=longest:normalize=0[aout]`); audioOut='aout' }
  }

  args.push('-filter_complex', filters.join(';'), '-map', `[${videoOut}]`)
  if (audioOut) args.push('-map', `[${audioOut}]`)
  if (options.format === 'mp4') args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-movflags', '+faststart', ...(audioOut ? ['-c:a','aac','-b:a','192k'] : []))
  else args.push('-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', ...(audioOut ? ['-c:a','libopus','-b:a','160k'] : []))
  args.push('-r', String(options.fps), '-t', String(project.duration), '-y', outName)

  const exitCode = await ffmpeg.exec(args)
  if (exitCode !== 0) {
    const detail = logs.slice(-8).join('\n')
    throw new Error(`Video export failed (FFmpeg code ${exitCode}).${detail ? '\n' + detail : ' Try a lower resolution or check your source videos.'}`)
  }
  onProgress?.({ percent: 99, stage: 'Finalizing...' })
  const data = await ffmpeg.readFile(outName)
  if (!(data instanceof Uint8Array) || data.byteLength === 0) throw new Error('FFmpeg produced an empty video. Check your source clips and try again.')
  const bytes = new Uint8Array(data)
  const blob = new Blob([bytes], { type: options.format === 'mp4' ? 'video/mp4' : 'video/webm' })

  onProgress?.({ percent: 100, stage: 'Finalizing...' })
  return { blob, fileName: `${project.name || 'video'}.${options.format}`, limitations: limitationsFor(project) }
  } finally {
    ffmpeg.off('log', handleLog)
    ffmpeg.off('progress', handleProgress)
    for (const name of [...inputNames, ...audioNames, ...visualNames, outName]) {
      try { await ffmpeg.deleteFile(name) } catch { /* A failed encode may not create every file. */ }
    }
  }
}
