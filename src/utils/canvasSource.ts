import type { MediaAsset, TimelineTrack } from '../types/editor'

// Prefer the selected video, then the first timeline video, then the library.
export function getOriginalCanvasSource(assets: MediaAsset[], tracks: TimelineTrack[], selectedClipId?: string, selectedAssetId?: string) {
  const valid = assets.filter(a => a.mimeType.startsWith('video/') && Number.isFinite(a.width) && Number.isFinite(a.height) && a.width > 0 && a.height > 0)
  const clips = tracks.filter(t => t.type === 'video').flatMap(t => t.clips).sort((a,b) => a.timelineStart-b.timelineStart)
  const sourceFor = (clip: typeof clips[number] | undefined) => clip && valid.find(a => a.id === clip.assetId || a.url === clip.src)
  return sourceFor(clips.find(c => c.id === selectedClipId))
    ?? valid.find(a => a.id === selectedAssetId)
    ?? clips.map(sourceFor).find(a => a !== undefined)
    ?? valid[0]
}
