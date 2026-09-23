import { useCallback } from 'react'
import { useEditor } from './useEditor'
export function usePlayback() { const { currentTime, duration, isPlaying, setCurrentTime, setPlaying } = useEditor(); const togglePlayback = useCallback(() => setPlaying(!isPlaying), [isPlaying, setPlaying]); const stopPlayback = useCallback(() => { setPlaying(false); setCurrentTime(0) }, [setCurrentTime, setPlaying]); return { currentTime, duration, isPlaying, setCurrentTime, setPlaying, togglePlayback, stopPlayback } }
