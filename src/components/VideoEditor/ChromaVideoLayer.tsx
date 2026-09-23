import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ChromaKeySettings } from '../../types/editor'
import { ChromaKeyEngine, DEFAULT_CHROMA_KEY } from '../../utils/chromaKeyEngine'

type Props = { src?: string; settings?: ChromaKeySettings; className?: string; style?: CSSProperties }
const ChromaVideoLayer = forwardRef<HTMLVideoElement, Props>(({ src, settings = DEFAULT_CHROMA_KEY, className, style }, ref) => {
  const local = useRef<HTMLVideoElement | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const engine = useRef(new ChromaKeyEngine())
  const [failed, setFailed] = useState(false)
  const setRef = useCallback((node: HTMLVideoElement | null) => {
    local.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }, [ref])

  useEffect(() => {
    if (!settings.enabled || failed) return
    const video = local.current, output = canvas.current
    if (!video || !output) return
    const ctx = output.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    let frame = 0, lastTime = -1, stopped = false
    const nativeFrames = typeof video.requestVideoFrameCallback === 'function'
    const draw = () => {
      if (stopped || video.readyState < 2) return
      // Avoid processing the same paused or undecoded frame repeatedly.
      if (video.currentTime === lastTime) return
      const scale = Math.min(1, 1280 / video.videoWidth, 720 / video.videoHeight)
      const width = Math.max(2, Math.round(video.videoWidth * scale))
      const height = Math.max(2, Math.round(video.videoHeight * scale))
      if (output.width !== width) output.width = width
      if (output.height !== height) output.height = height
      try {
        engine.current.render(ctx, video, width, height, settings)
        lastTime = video.currentTime
      } catch { stopped = true; setFailed(true) }
    }
    const tick = () => {
      draw()
      if (!stopped) frame = nativeFrames ? video.requestVideoFrameCallback(tick) : requestAnimationFrame(tick)
    }
    const refresh = () => { lastTime = -1; draw() }
    video.addEventListener('loadeddata', refresh)
    video.addEventListener('seeked', refresh)
    tick()
    return () => {
      stopped = true
      if (nativeFrames) video.cancelVideoFrameCallback(frame)
      else cancelAnimationFrame(frame)
      video.removeEventListener('loadeddata', refresh)
      video.removeEventListener('seeked', refresh)
    }
  }, [src, settings, failed])

  if (!settings.enabled || failed) return <video ref={setRef} src={src} className={className} style={style} playsInline preload="auto" />
  return <div className={className} style={{ ...style, overflow: 'hidden' }}>
    <video ref={setRef} src={src} style={{ display: 'none' }} playsInline preload="auto" />
    <canvas ref={canvas} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
  </div>
})
export default ChromaVideoLayer
