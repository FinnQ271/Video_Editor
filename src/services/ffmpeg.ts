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
      const urls: string[] = []
      try {
        const coreURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript')
        urls.push(coreURL)
        const wasmURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm')
        urls.push(wasmURL)
        await ffmpeg.load({ coreURL, wasmURL })
        instance = ffmpeg
        return ffmpeg
      } catch (error) {
        ffmpeg.terminate()
        throw error
      } finally {
        urls.forEach(url => URL.revokeObjectURL(url))
      }
    })()
    loading.catch(() => { loading = null })
  }
  const ffmpeg = await loading
  if (onProgress) ffmpeg.on('progress', ({ progress }) => onProgress(Math.max(0, Math.min(1, progress))))
  return ffmpeg
}

export { fetchFile }
