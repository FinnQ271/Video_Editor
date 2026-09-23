import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { MediaAsset } from '../../types/editor'
import { downloadVideoUrl } from '../../services/importVideoUrl'
import { extractVideoMetadata, formatBytes } from '../../utils/mediaUtils'

export default function UrlImport({ onImport }: { onImport: (asset: MediaAsset, addToTimeline: boolean) => void }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [addToTimeline, setAddToTimeline] = useState(true)
  const controller = useRef<AbortController | null>(null)
  const onImportRef = useRef(onImport)
  useLayoutEffect(() => { onImportRef.current = onImport }, [onImport])
  useEffect(() => () => { controller.current?.abort() }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (controller.current || !url.trim()) return
    const request = new AbortController()
    controller.current = request
    setBusy(true); setError(''); setStatus('Đang tìm và tải video…')
    const timeout = window.setTimeout(() => request.abort(new Error('Quá thời gian tải. Hãy thử lại hoặc chọn video ngắn hơn.')), 180000)
    let asset: MediaAsset | undefined
    try {
      const file = await downloadVideoUrl(url, request.signal, (bytes, total) => {
        setStatus(total ? `Đang tải ${Math.min(100, Math.round(bytes / total * 100))}% · ${formatBytes(bytes)}` : `Đang tải · ${formatBytes(bytes)}`)
      })
      setStatus('Đang chuẩn bị video để chỉnh sửa…')
      asset = await extractVideoMetadata(file)
      if (request.signal.aborted) { URL.revokeObjectURL(asset.url); return }
      onImportRef.current(asset, addToTimeline)
      setUrl(''); setStatus('Đã nhập video vào thư viện.')
    } catch (err) {
      if (asset) URL.revokeObjectURL(asset.url)
      if (!request.signal.aborted) setError(err instanceof Error ? err.message : 'Không tải được video.')
      else if (request.signal.reason instanceof Error && request.signal.reason.name !== 'AbortError') setError(request.signal.reason.message)
      setStatus('')
    } finally {
      window.clearTimeout(timeout)
      if (controller.current === request) { controller.current = null; setBusy(false) }
    }
  }

  return <form className="url-import" onSubmit={submit}>
    <div className="url-import-heading"><span className="panel-eyebrow">IMPORT FROM LINK</span><span className="url-import-badge">URL / TikTok</span></div>
    <label htmlFor="video-url-input">Dán liên kết video</label>
    <input id="video-url-input" type="text" inputMode="url" value={url} disabled={busy}
      onChange={event => { setUrl(event.target.value); setError('') }}
      placeholder="https://… hoặc đoạn chia sẻ TikTok" autoComplete="off" spellCheck={false} />
    <label className="url-import-check"><input type="checkbox" checked={addToTimeline} disabled={busy} onChange={event => setAddToTimeline(event.target.checked)} />Thêm vào timeline để chỉnh sửa</label>
    <div className="url-import-actions"><button className="btn-primary" type="submit" disabled={busy || !url.trim()}>{busy ? 'Đang tải…' : '↓ Nhập video từ link'}</button>
      {busy && <button type="button" className="btn-secondary" onClick={() => controller.current?.abort()}>Hủy</button>}</div>
    <p className="url-import-help">Link video MP4, WebM, MOV hoặc TikTok công khai. Tối đa 256 MB.</p>
    {status && <p className="url-import-status" role="status" aria-live="polite">{status}</p>}
    {error && <p className="url-import-error" role="alert">{error}</p>}
  </form>
}
