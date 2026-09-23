import { useCallback, useMemo } from 'react'
import { useEditor } from './useEditor'
export function useTimeline() { const editor = useEditor(); const selectedClip = useMemo(() => editor.tracks.flatMap((track) => track.clips).find((clip) => clip.id === editor.selectedClipId), [editor.selectedClipId, editor.tracks]); const seek = useCallback((time: number) => editor.setCurrentTime(Math.min(Math.max(0, time), editor.duration)), [editor]); return { ...editor, selectedClip, seek } }
