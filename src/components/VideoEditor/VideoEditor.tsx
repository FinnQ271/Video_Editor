import { useEffect, useState } from 'react'
import { useEditor } from '../../hooks/useEditor'
import MediaPanel from './MediaPanel'
import StudioIcon from './StudioIcon'
import VideoPreview from './VideoPreview'
import Timeline from './Timeline'
import HistoryTester from './HistoryTester'
import ExportModal from './ExportModal'
import PropertiesPanel from './PropertiesPanel'
import TextPanel from './TextPanel'
import VisualPanel from './VisualPanel'
import EditorDialog from './EditorDialog'
import type { CanvasAspectRatio } from '../../types/editor'

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLTextAreaElement ||
  el instanceof HTMLSelectElement ||
  (el instanceof HTMLElement && el.isContentEditable)

export default function VideoEditor() {
  const { togglePlay, cutSelectedClip, duplicateClip, splitClip, undo, redo, clearAssets, canUndo, canRedo, tracks, selectedClipId, selectedVisualElementId, assets, visualElements, canvas, setCanvasAspectRatio } = useEditor()
  const [isTestModalOpen, setIsTestModalOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isNewOpen, setIsNewOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const selectedClip = tracks.flatMap(track => track.clips).find(clip => clip.id === selectedClipId)
  const hasContent = assets.length > 0 || visualElements.length > 0 || tracks.some(track => track.clips.length > 0)

  // Keyboard Shortcuts Listener for History & Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Never trigger clip shortcuts if user is typing inside an input/textarea/editable element
      if (isTyping(e.target) || (e.target instanceof Element && e.target.closest('[role="dialog"]')) || isNewOpen || isExportOpen || isTestModalOpen) return
      if (e.target instanceof HTMLButtonElement && e.code === 'Space') return

      const isCtrlOrCmd = e.ctrlKey || e.metaKey
      const keyLower = e.key.toLowerCase()

      // Ctrl + Z -> Undo, Ctrl + Shift + Z -> Redo
      if (isCtrlOrCmd && (keyLower === 'z' || e.code === 'KeyZ')) {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      } else if (isCtrlOrCmd && (keyLower === 'y' || e.code === 'KeyY')) {
        e.preventDefault()
        redo()
      } else if (isCtrlOrCmd && (keyLower === 'd' || e.code === 'KeyD')) {
        e.preventDefault()
        duplicateClip()
      } else if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        cutSelectedClip()
      } else if (keyLower === 's' && !isCtrlOrCmd) {
        e.preventDefault()
        splitClip()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, cutSelectedClip, duplicateClip, splitClip, undo, redo, isNewOpen, isExportOpen, isTestModalOpen])

  return (
    <div className="video-editor-app">
      <header className="editor-topbar">
        <div className="editor-brand">
          <span className="brand-icon"><StudioIcon name="film" size={21} /></span>
          <div className="brand-lockup"><span className="brand-name">Video Editor<span className="brand-studio">STUDIO</span></span><span className="brand-caption">Dự án chưa đặt tên</span></div>
        </div>
        <div className="header-history">
          <button className="btn-toolbar" onClick={undo} disabled={!canUndo} title="Undo (Ctrl + Z)" aria-label="Undo"><StudioIcon name="undo" /></button>
          <button className="btn-toolbar" onClick={redo} disabled={!canRedo} title="Redo (Ctrl + Shift + Z)" aria-label="Redo"><StudioIcon name="redo" /></button>
          <span className="workspace-label"><span className="workspace-dot" />{hasContent ? 'Đang chỉnh sửa · Chưa lưu ra tệp' : 'Sẵn sàng sáng tạo'}</span>
        </div>
        <div className="editor-header-actions">
          <button type="button" className="btn-secondary" aria-label="New project" onClick={() => setIsNewOpen(true)}><StudioIcon name="plus" size={16} /><span>Dự án mới</span></button>
          <select className="header-aspect-ratio" aria-label="Tỷ lệ khung hình" value={canvas.aspectRatio} onChange={event => setCanvasAspectRatio(event.target.value as CanvasAspectRatio)}>{(['original', '16:9', '9:16', '1:1', '4:5'] as const).map(ratio => <option key={ratio} value={ratio}>{ratio === 'original' ? 'Gốc' : ratio}</option>)}</select>
          <button type="button" className="btn-primary" aria-label="Export video" onClick={() => setIsExportOpen(true)}><StudioIcon name="upload" size={16} />Xuất video<StudioIcon name="arrow" size={16} /></button>
        </div>
      </header>

      {/* Main Workspace (Media Library / Properties Inspector + Video Preview) */}
      <main className={inspectorOpen ? 'editor-workspace' : 'editor-workspace inspector-collapsed'}>
        <MediaPanel />
        <section className="preview-section">
          <VideoPreview />
        </section>
        <aside className="inspector-panel" aria-label="Inspector">
          <div className="inspector-heading"><span><StudioIcon name="sliders" /> Inspector</span><button className="btn-toolbar" title={inspectorOpen ? 'Collapse inspector' : 'Expand inspector'} aria-label={inspectorOpen ? 'Collapse inspector' : 'Expand inspector'} aria-expanded={inspectorOpen} onClick={() => setInspectorOpen(!inspectorOpen)}><StudioIcon name="chevron" /></button></div>
          {inspectorOpen && <div className="inspector-scroll">
            <PropertiesPanel canvasOnly={!!selectedClip?.textProperties || (!!selectedVisualElementId && !selectedClip)} />
            {selectedClip?.textProperties ? <><TextPanel mode="inspector" /><details className="clip-details"><summary>Clip timing and track settings</summary><PropertiesPanel hideCanvas /></details></> : !selectedClip && selectedVisualElementId ? <VisualPanel mode="inspector" /> : null}
          </div>}
        </aside>
      </main>

      {/* Bottom Timeline Engine */}
      <Timeline />
      <footer className="studio-statusbar">
        <span><span className="workspace-dot" /> Your creative workspace</span>
        <div className="shortcut-hints"><span><kbd>Space</kbd> Play / pause</span><span><kbd>S</kbd> Split</span><span><kbd>Ctrl Z</kbd> Undo</span></div>
        <button type="button" className="diagnostics-button" onClick={() => setIsTestModalOpen(true)}>History diagnostics</button>
      </footer>

      {/* Automated History Test Suite Modal */}
      <HistoryTester isOpen={isTestModalOpen} onClose={() => setIsTestModalOpen(false)} />
      {isNewOpen && <EditorDialog title="New project" onClose={() => setIsNewOpen(false)}>
        <div className="export-modal-head"><div><span className="export-kicker">WORKSPACE</span><h2>Start a new project?</h2><p>The current media and edits will be cleared. Export your video first if you want to keep it.</p></div></div>
        <div className="export-actions"><button className="btn-secondary" onClick={() => setIsNewOpen(false)}>Cancel</button><button className="btn-primary" onClick={() => { clearAssets(); setIsNewOpen(false) }}>New project</button></div>
      </EditorDialog>}
      {isExportOpen && <ExportModal onClose={() => setIsExportOpen(false)} />}
    </div>
  )
}

