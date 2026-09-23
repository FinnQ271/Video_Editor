import type { MediaAsset } from '../types/editor'

const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']
const ALLOWED_EXTENSIONS = /\.(mp4|webm|mov|m4v)$/i

export function validateVideoFile(file: File): { valid: boolean; error?: string } {
  const isTypeValid = ALLOWED_TYPES.includes(file.type)
  const isExtValid = ALLOWED_EXTENSIONS.test(file.name)

  if (!isTypeValid && !isExtValid) {
    return {
      valid: false,
      error: `File "${file.name}" is not supported. Please select MP4, WebM, or MOV video files.`,
    }
  }

  return { valid: true }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function captureVideoThumbnail(video: HTMLVideoElement): string | undefined {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 180
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.8)
  } catch {
    return undefined
  }
}

export function extractVideoMetadata(file: File): Promise<MediaAsset> {
  return new Promise((resolve, reject) => {
    const validation = validateVideoFile(file)
    if (!validation.valid) {
      return reject(new Error(validation.error))
    }

    const objectUrl = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'

    const timeoutTimer = window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error(`Timeout loading metadata for file "${file.name}"`))
    }, 15000)

    video.onloadedmetadata = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        window.clearTimeout(timeoutTimer)
        URL.revokeObjectURL(objectUrl)
        return reject(new Error(`Invalid duration for video "${file.name}"`))
      }

      // Seek to small time position to capture clean frame snapshot
      video.currentTime = Math.min(0.2, video.duration / 4)

      const handleSeeked = () => {
        window.clearTimeout(timeoutTimer)
        const thumbnail = captureVideoThumbnail(video)
        
        const asset: MediaAsset = {
          id: crypto.randomUUID(),
          file,
          url: objectUrl,
          name: file.name,
          duration: video.duration,
          width: video.videoWidth || 1920,
          height: video.videoHeight || 1080,
          mimeType: file.type || 'video/mp4',
          size: file.size,
          thumbnail,
          createdAt: Date.now(),
        }

        resolve(asset)
      }

      video.onseeked = handleSeeked

      // Fallback if seeked doesn't fire fast
      window.setTimeout(() => {
        if (video.readyState >= 2) {
          handleSeeked()
        }
      }, 500)
    }

    video.onerror = () => {
      window.clearTimeout(timeoutTimer)
      URL.revokeObjectURL(objectUrl)
      reject(new Error(`Failed to load video file "${file.name}"`))
    }

    video.src = objectUrl
    video.load()
  })
}
