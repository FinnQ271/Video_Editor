import { parseVideoUrl } from '../utils/videoUrl'

export const MAX_URL_VIDEO_BYTES = 256 * 1024 * 1024

export async function downloadVideoUrl(text: string, signal: AbortSignal, onProgress: (bytes: number, total?: number) => void): Promise<File> {
  const url = parseVideoUrl(text)
  const response = await fetch('/api/media/import', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url.href }), signal,
  })
  if (!response.ok) {
    const message = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(message?.error ?? 'Không tải được video. Hãy khởi động lại npm run dev rồi thử lại.')
  }
  const type = response.headers.get('content-type')?.split(';')[0] ?? ''
  if (!type.startsWith('video/')) throw new Error('Dịch vụ nhập URL chưa sẵn sàng. Hãy khởi động lại npm run dev.')
  const total = Number(response.headers.get('content-length')) || undefined
  if (total && total > MAX_URL_VIDEO_BYTES) throw new Error('Video vượt giới hạn 256 MB.')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Không đọc được dữ liệu video.')
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let received = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > MAX_URL_VIDEO_BYTES) throw new Error('Video vượt giới hạn 256 MB.')
      chunks.push(new Uint8Array(value))
      onProgress(received, total)
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally { reader.releaseLock() }
  if (!received) throw new Error('Liên kết trả về video rỗng.')
  const nameHeader = response.headers.get('x-video-name')
  let name = 'imported-video.mp4'
  try { if (nameHeader) name = decodeURIComponent(nameHeader) } catch { /* Use the fallback name. */ }
  return new File(chunks, name, { type })
}
