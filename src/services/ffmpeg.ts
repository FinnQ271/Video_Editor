import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

const CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm'
let instance: FFmpeg | null = null
let loading: Promise<FFmpeg> | null = null

export type FFmpegProgressListener = (progress: number) => void

export async function getFFmpeg(onProgress?: FFmpegProgressListener): Promise<FFmpeg> {
  if (instance?.loaded) {
    if (onProgress) instance.on('progress', ({ progress }) => onProgress(Math.max(0, Math.min(1, progress))))
    return instance
  }
  if (!loading) {
    loading = (async () => {
      const ffmpeg = new FFmpeg()
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      instance = ffmpeg
      return ffmpeg
    })()
  }
  const ffmpeg = await loading
  if (onProgress) ffmpeg.on('progress', ({ progress }) => onProgress(Math.max(0, Math.min(1, progress))))
  return ffmpeg
}

export { fetchFile }
