import { useEffect, useRef } from 'react'

interface PreviewCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  width?: number
  height?: number
  showFrameStats?: boolean
}

export default function PreviewCanvas({ videoRef, width = 1920, height = 1080 }: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    let animationFrameId: number

    const render = () => {
      if (video.readyState >= 2 && !video.paused) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        }
      }
      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [videoRef])

  return (
    <canvas
      ref={canvasRef}
      className="preview-canvas-overlay"
      width={width}
      height={height}
      style={{ display: 'none' }} // Hidden by default, available for canvas processing
    />
  )
}
