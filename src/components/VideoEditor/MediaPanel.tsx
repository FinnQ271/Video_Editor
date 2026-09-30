import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { useEditor } from '../../hooks/useEditor'
import { extractVideoMetadata, formatBytes } from '../../utils/mediaUtils'
import { formatTime } from '../../utils/formatTime'
import type { MediaAsset } from '../../types/editor'
import LibraryTools from './LibraryTools'
import TextPanel from './TextPanel'
import VisualPanel from './VisualPanel'
import StudioIcon from './StudioIcon'
import UrlImport from './UrlImport'
import EditorDialog from './EditorDialog'

export default function MediaPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { assets, selectedAssetId, tracks, addAssets, removeAsset, selectAsset, addClipToTimeline, setCurrentTime, setPlaying } = useEditor()
  
  const [activeTab, setActiveTab] = useState<'media' | 'audio' | 'text' | 'visual' | 'effects' | 'transitions'>('media')
  const [isUrlOpen, setIsUrlOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [isHovered, setIsHovered] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')

  const handleProcessFiles = async (filesList: FileList | File[]) => {
    const fileArray = Array.from(filesList)
    if (fileArray.length === 0) return

    setIsProcessing(true)
    setErrorMessage('')

    const extractedAssets: MediaAsset[] = []
    const errors: string[] = []

    for (const file of fileArray) {
      try {
        const asset = await extractVideoMetadata(file)
        extractedAssets.push(asset)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : `Failed to process ${file.name}`
        errors.push(msg)
      }
    }

    if (extractedAssets.length > 0) {
      addAssets(extractedAssets)
    }

    if (errors.length > 0) {
      setErrorMessage(errors.join(' | '))
    }

    setIsProcessing(false)
  }

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessFiles(e.target.files)
      e.target.value = ''
    }
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsHovered(true)
  }

  const onDragLeave = () => {
    setIsHovered(false)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsHovered(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFiles(e.dataTransfer.files)
    }
  }

  const selectedAsset = assets.find((a) => a.id === selectedAssetId)

  return (
    <aside className="media-panel-container">
      <div className="media-panel-tabs" aria-label="Creative tools">
        {(['media', 'audio', 'text', 'visual', 'effects', 'transitions'] as const).map(tab =>
          <button key={tab} type="button" className={'panel-tab-btn ' + (activeTab === tab ? 'tab-active' : '')} aria-pressed={activeTab === tab} onClick={() => setActiveTab(tab)}>
            <StudioIcon name={tab === 'media' ? 'film' : tab === 'visual' ? 'image' : tab === 'transitions' ? 'transition' : tab} />
            {{ media: 'Media', audio: 'Audio', text: 'Text', visual: 'Elements', effects: 'Hiệu ứng', transitions: 'Chuyển cảnh' }[tab]}
          </button>)}
      </div>
      {activeTab === 'visual' ? <div className="panel-tab-content"><VisualPanel mode="library" /></div>
        : activeTab === 'text' ? <div className="panel-tab-content"><TextPanel mode="library" /></div>
        : activeTab !== 'media' ? <div className="panel-tab-content"><LibraryTools tab={activeTab} /></div>
        : <div className="panel-tab-content">
          <div className="media-import-actions">
            <button type="button" className="btn-primary" aria-label="Import video" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}><StudioIcon name="upload" size={16} />Tải lên</button>
            <button type="button" className="btn-secondary" aria-label="Import from link" onClick={() => setIsUrlOpen(true)}><StudioIcon name="arrow" size={16} />Nhập URL</button>
          </div>
          {isUrlOpen && <EditorDialog title="Import video from link" onClose={() => setIsUrlOpen(false)}><div className="export-modal-head"><div><span className="export-kicker">MEDIA LIBRARY</span><h2>Import from link</h2><p>Paste a video URL to add it to your project.</p></div><button type="button" title="Close import" aria-label="Close import" onClick={() => setIsUrlOpen(false)}>×</button></div>
          <UrlImport onImport={(asset, addToTimeline) => {
            addAssets([asset])
            if (addToTimeline) {
              const videoTrack = tracks.find(track => track.type === 'video')
              const start = videoTrack?.clips.reduce((end, clip) => Math.max(end, clip.timelineStart + clip.duration), 0) ?? 0
              addClipToTimeline(asset)
              setPlaying(false)
              setCurrentTime(start)
            }
          }} /><div className="export-actions"><button type="button" className="btn-secondary" onClick={() => setIsUrlOpen(false)}>Close</button></div></EditorDialog>}

          {errorMessage && (
            <div className="media-error-alert" role="alert">
              <span>{errorMessage}</span>
              <button aria-label="Dismiss import error" title="Dismiss import error" onClick={() => setErrorMessage('')}>×</button>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            hidden
            multiple
            accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
            onChange={onFileInputChange}
          />

      {assets.length === 0 ? (
        <>
        <div
          className={`dropzone-empty ${isHovered ? 'dropzone-active' : ''}`}
          role="button" tabIndex={0} aria-label="Chọn video để nhập"
          onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ') && !isProcessing) { event.preventDefault(); fileInputRef.current?.click() } }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => { if (!isProcessing) fileInputRef.current?.click() }}
        >
          <div className="dropzone-icon"><StudioIcon name="upload" size={28} /></div>
          <h3>{isHovered ? 'Thả video để nhập' : 'Kéo thả file vào đây'}</h3>
          <p>hoặc nhấn để chọn file</p>
          <button type="button" className="btn-primary" disabled={isProcessing}>
            {isProcessing ? 'Đang xử lý…' : 'Chọn video'}
          </button>
          <small>Hỗ trợ: MP4, WEBM, MOV, M4V</small>
        </div>
        <div className="media-empty-collection"><span>THƯ VIỆN MEDIA</span><p>Video bạn tải lên sẽ xuất hiện tại đây.</p><small>Thêm video vào timeline để bắt đầu chỉnh sửa.</small></div>
        </>
      ) : (
        <div className="media-library-body">
          <div
            role="button" tabIndex={0} aria-label="Import more videos" onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !isProcessing) { e.preventDefault(); fileInputRef.current?.click() } }}
            className={`dropzone-mini ${isHovered ? 'dropzone-active' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => { if (!isProcessing) fileInputRef.current?.click() }}
          >
            <StudioIcon name="upload" size={28} /><strong>Kéo thả file vào đây</strong><span>hoặc nhấn để chọn file</span>
          </div>
          <div className="media-collection-heading"><span>Video</span><small>{assets.length} tài nguyên</small></div>
          <label className="media-search"><StudioIcon name="search" size={17} /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm kiếm media..." aria-label="Tìm kiếm media" /></label>
          <div className="media-grid">
            {assets.filter(asset => asset.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map((asset) => {
              const isSelected = selectedAssetId === asset.id
              const formatExt = asset.name.split('.').pop()?.toUpperCase() || 'VIDEO'

              return (
                <div
                  key={asset.id}
                  className={`media-card ${isSelected ? 'media-card-selected' : ''}`}
                  onClick={() => selectAsset(asset.id)}
                >
                  <div className="card-thumb-wrapper">
                    {asset.thumbnail ? (
                      <img src={asset.thumbnail} alt={asset.name} className="card-thumb" />
                    ) : (
                      <div className="card-thumb-fallback">VIDEO</div>
                    )}
                    <span className="card-badge-format">{formatExt}</span>
                    <span className="card-duration-badge">{formatTime(asset.duration)}</span>
                  </div>

                  <div className="card-info">
                    <h4 className="card-title" title={asset.name}>
                      {asset.name}
                    </h4>
                    <div className="card-meta">
                      <span>{asset.width}x{asset.height}</span>
                      <span>•</span>
                      <span>{formatBytes(asset.size)}</span>
                    </div>
                  </div>

                  <div className="card-actions">
                    <button
                      type="button"
                      className="btn-primary btn-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        addClipToTimeline(asset)
                      }}
                      title="Add to Timeline"
                    >
                      + Add
                    </button>
                    <button
                      type="button"
                      className="btn-danger btn-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeAsset(asset.id)
                      }}
                      title="Delete asset"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          {search && !assets.some(asset => asset.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())) && <p className="media-search-empty">Không tìm thấy video phù hợp.</p>}

          {selectedAsset && (
            <div className="asset-details-box">
              <h4>Asset Details</h4>
              <ul>
                <li><strong>Name:</strong> {selectedAsset.name}</li>
                <li><strong>Duration:</strong> {formatTime(selectedAsset.duration)}</li>
                <li><strong>Resolution:</strong> {selectedAsset.width} × {selectedAsset.height}</li>
                <li><strong>Size:</strong> {formatBytes(selectedAsset.size)}</li>
                <li><strong>MIME:</strong> {selectedAsset.mimeType}</li>
              </ul>
            </div>
          )}
        </div>
      )}
        </div>
      }
    </aside>
  )
}
