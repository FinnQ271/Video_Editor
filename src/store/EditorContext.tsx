/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PropsWithChildren } from 'react'
import type {
  CanvasConfig,
  CanvasAspectRatio,
  MediaAsset,
  TextOverlayProperties,
  TimelineClip,
  TimelineTrack,
  TransformProperties,
  VideoTransition,
  TransitionType,
  VisualElement,
  VisualElementKind,
} from '../types/editor'
import { CANVAS_PRESETS } from '../types/editor'
import { getOriginalCanvasSource } from '../utils/canvasSource'
import { useHistory } from '../hooks/useHistory'

export const ZOOM_PRESETS = [10, 20, 50, 100, 200] as const

export interface TimelineSnapshot {
  tracks: TimelineTrack[]
  selectedClipId?: string
  transitions: VideoTransition[]
  visualElements: VisualElement[]
  selectedVisualElementId?: string
}

export const DEFAULT_CANVAS: CanvasConfig = {
  aspectRatio: '16:9',
  width: 1920,
  height: 1080,
  background: '#000000',
}

export interface EditorState {
  assets: MediaAsset[]
  selectedAssetId?: string
  selectedClipId?: string
  tracks: TimelineTrack[]
  transitions: VideoTransition[]
  selectedTransitionId?: string
  visualElements: VisualElement[]
  selectedVisualElementId?: string
  canvas: CanvasConfig
  currentTime: number
  duration: number
  isPlaying: boolean
  volume: number
  isMuted: boolean
  pixelsPerSecond: number
  canUndo: boolean
  canRedo: boolean
  past: TimelineSnapshot[]
  present: TimelineSnapshot
  future: TimelineSnapshot[]
}

export interface EditorActions {
  addAssets: (newAssets: MediaAsset[]) => void
  removeAsset: (assetId: string) => void
  clearAssets: () => void
  selectAsset: (assetId?: string) => void
  addClipToTimeline: (asset: MediaAsset) => void
  addTextClip: (initialText?: string, presetProps?: Partial<TextOverlayProperties>) => void
  updateTextOverlayProperties: (clipId: string, updates: Partial<TextOverlayProperties>, recordHistory?: boolean) => void
  selectClip: (clipId?: string) => void
  removeClip: (clipId: string) => void
  cutSelectedClip: () => void
  duplicateClip: (clipId?: string) => void
  moveClip: (clipId: string, newTimelineStart: number, recordHistory?: boolean) => void
  splitClip: (clipId?: string, atTime?: number) => void
  trimClipLeft: (clipId: string, deltaSeconds: number, recordHistory?: boolean) => void
  trimClipRight: (clipId: string, deltaSeconds: number, recordHistory?: boolean) => void
  updateClipProperties: (clipId: string, updates: Partial<TimelineClip>) => void
  updateClipTransform: (clipId: string, transform: Partial<TransformProperties>, recordHistory?: boolean) => void
  updateClipSpeed: (clipId: string, speed: number) => void
  updateTrackProperties: (trackId: string, updates: Partial<TimelineTrack>) => void
  setCanvasAspectRatio: (ratio: CanvasAspectRatio) => void
  undo: () => void
  redo: () => void
  setCurrentTime: (time: number) => void
  setPlaying: (isPlaying: boolean) => void
  togglePlay: () => void
  setVolume: (volume: number) => void
  setMuted: (isMuted: boolean) => void
  toggleMute: () => void
  setPixelsPerSecond: (pps: number) => void
  zoomIn: () => void
  zoomOut: () => void
  fitTimeline: (containerWidth: number) => void
  addTransition: (fromClipId: string, toClipId: string, type?: TransitionType) => void
  updateTransition: (id: string, updates: Partial<Pick<VideoTransition, 'type' | 'duration' | 'parameters'>>) => void
  removeTransition: (id: string) => void
  selectTransition: (id?: string) => void
  addVisualElement: (element: Omit<VisualElement, 'id'>) => void
  updateVisualElement: (id: string, updates: Partial<VisualElement>, commit?: boolean) => void
  beginVisualInteraction: () => void
  removeVisualElement: (id: string) => void
  duplicateVisualElement: (id: string) => void
  selectVisualElement: (id?: string) => void
  addVisualFromFile: (file: File, kind?: VisualElementKind) => Promise<void>
}

export type EditorContextValue = EditorState & EditorActions

export const EditorContext = createContext<EditorContextValue | null>(null)

const DEFAULT_TRACK_ID = 'primary-video-track'

const initialSnapshot: TimelineSnapshot = {
  tracks: [
    {
      id: DEFAULT_TRACK_ID,
      type: 'video',
      name: 'Video Track 1',
      locked: false,
      muted: false,
      clips: [],
    },
  ],
  selectedClipId: undefined,
  transitions: [],
  visualElements: [],
  selectedVisualElementId: undefined,
}

export function EditorProvider({ children }: PropsWithChildren) {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [selectedAssetId, selectAsset] = useState<string>()
  const [canvas, setCanvas] = useState<CanvasConfig>(DEFAULT_CANVAS)

  // History system managing timeline snapshots (tracks & selectedClipId)
  const history = useHistory<TimelineSnapshot>(initialSnapshot)

  const tracks = history.state.tracks
  const selectedClipId = history.state.selectedClipId
  const transitions = history.state.transitions ?? []
  const visualElements = history.state.visualElements ?? []
  const selectedVisualElementId = history.state.selectedVisualElementId
  const [selectedTransitionId, selectTransition] = useState<string>()

  const [currentTime, setCurrentTimeState] = useState(0)
  const [isPlaying, setPlaying] = useState(false)
  const [volume, setVolumeState] = useState(1)
  const [isMuted, setMutedState] = useState(false)
  const [pixelsPerSecond, setPixelsPerSecondState] = useState(50)

  // Keep track of active object URLs for cleanup on unmount
  const activeObjectUrls = useRef<Set<string>>(new Set())

  // Calculate total duration based on maximum clip end time across all tracks
  const duration = useMemo(() => {
    let maxTime = 0
    tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        const clipEnd = clip.timelineStart + clip.duration
        if (clipEnd > maxTime) maxTime = clipEnd
      })
    })
    visualElements.forEach((element) => { if (element.endTime > maxTime) maxTime = element.endTime })
    return maxTime
  }, [tracks, visualElements])

  // Cleanup object URLs on unmount
  useEffect(() => {
    const urls = activeObjectUrls.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  const setCurrentTime = useCallback((time: number) => {
    setCurrentTimeState((prev) => {
      const clamped = Math.max(0, time)
      return prev !== clamped ? clamped : prev
    })
  }, [])

  const togglePlay = useCallback(() => setPlaying((prev) => !prev), [])

  const setVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val))
    setVolumeState(clamped)
    if (clamped > 0 && isMuted) {
      setMutedState(false)
    }
  }, [isMuted])

  const setMuted = useCallback((muted: boolean) => setMutedState(muted), [])
  const toggleMute = useCallback(() => setMutedState((prev) => !prev), [])

  const addAssets = useCallback((newAssets: MediaAsset[]) => {
    newAssets.forEach((asset) => activeObjectUrls.current.add(asset.url))
    setAssets((prev) => [...prev, ...newAssets])
    if (newAssets.length > 0) {
      selectAsset(newAssets[0].id)
    }
  }, [])

  const removeAsset = useCallback((assetId: string) => {
    setAssets((prevAssets) => {
      const target = prevAssets.find((a) => a.id === assetId)
      if (target) {
        URL.revokeObjectURL(target.url)
        activeObjectUrls.current.delete(target.url)
      }
      return prevAssets.filter((a) => a.id !== assetId)
    })

    // Remove any timeline clips referencing this asset and record history
    const nextTracks = tracks.map((track) => ({
      ...track,
      clips: track.clips.filter((clip) => clip.assetId !== assetId),
    }))

    const nextSelectedClipId = selectedClipId && nextTracks.some((t) => t.clips.some((c) => c.id === selectedClipId))
      ? selectedClipId
      : undefined

    history.record({ ...history.state, tracks: nextTracks, transitions, selectedClipId: nextSelectedClipId })
    selectAsset((curr) => (curr === assetId ? undefined : curr))
  }, [tracks, selectedClipId, history])

  const clearAssets = useCallback(() => {
    activeObjectUrls.current.forEach((url) => URL.revokeObjectURL(url))
    activeObjectUrls.current.clear()
    setAssets([])
    history.resetHistory(initialSnapshot)
    selectAsset(undefined)
    setCurrentTimeState(0)
    setPlaying(false)
    selectTransition(undefined)
  }, [history])

  const selectClip = useCallback((clipId?: string) => {
    history.setPresent({
      ...history.state,
      selectedClipId: clipId,
    })
  }, [history])

  const addClipToTimeline = useCallback((asset: MediaAsset) => {
    const clipId = crypto.randomUUID()
    const targetTrackIndex = tracks.findIndex((t) => t.type === 'video')
    const targetTrack = targetTrackIndex >= 0 ? tracks[targetTrackIndex] : { id: DEFAULT_TRACK_ID, type: 'video' as const, name: 'Video Track 1', locked: false, muted: false, clips: [] }

    // Calculate timelineStart at end of existing clips on that track
    const timelineStart = targetTrack.clips.reduce(
      (end, clip) => Math.max(end, clip.timelineStart + clip.duration),
      0
    )

    const newClip: TimelineClip = {
      id: clipId,
      assetId: asset.id,
      name: asset.name,
      src: asset.url,
      mediaDuration: asset.duration,
      sourceStart: 0,
      sourceEnd: asset.duration,
      timelineStart,
      duration: asset.duration,
      thumbnail: asset.thumbnail,
      volume: 1,
      speed: 1,
      transform: { x: 0, y: 0, width: 100, height: 100, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    }

    const updatedTrack = {
      ...targetTrack,
      clips: [...targetTrack.clips, newClip],
    }

    const nextTracks = targetTrackIndex >= 0
      ? tracks.map((t, idx) => (idx === targetTrackIndex ? updatedTrack : t))
      : [...tracks, updatedTrack]

    history.record({ ...history.state, tracks: nextTracks, transitions, selectedClipId: clipId })
  }, [tracks, history])

  const addTextClip = useCallback(
    (initialText = 'Default Text', presetProps?: Partial<TextOverlayProperties>) => {
      const clipId = crypto.randomUUID()
      const duration = 5
      const startTime = currentTime
      const endTime = startTime + duration

      // Find or create Text Track
      let textTrackIndex = tracks.findIndex((t) => t.type === 'text')
      const updatedTracks = [...tracks]

      if (textTrackIndex === -1) {
        const newTrack: TimelineTrack = {
          id: `text-track-${Date.now()}`,
          type: 'text',
          name: 'Text Track 1',
          locked: false,
          muted: false,
          clips: [],
        }
        updatedTracks.push(newTrack)
        textTrackIndex = updatedTracks.length - 1
      }

      const textProperties: TextOverlayProperties = {
        id: clipId,
        text: initialText,
        startTime,
        endTime,
        x: 50,
        y: 50,
        fontFamily: 'Inter',
        fontSize: 36,
        fontWeight: 'bold',
        italic: false,
        color: '#ffffff',
        stroke: '#000000',
        strokeWidth: 2,
        shadow: '2px 2px 8px rgba(0,0,0,0.8)',
        background: 'rgba(0,0,0,0.3)',
        opacity: 1,
        rotation: 0,
        ...presetProps,
      }

      const newClip: TimelineClip = {
        id: clipId,
        type: 'text',
        name: `Text: ${initialText}`,
        sourceStart: 0,
        sourceEnd: duration,
        timelineStart: startTime,
        duration,
        textProperties,
      }

      const nextTracks = updatedTracks.map((t, idx) =>
        idx === textTrackIndex ? { ...t, clips: [...t.clips, newClip] } : t
      )

      history.record({ ...history.state, tracks: nextTracks, transitions, selectedClipId: clipId })
    },
    [currentTime, tracks, history]
  )

  const updateTextOverlayProperties = useCallback(
    (clipId: string, updates: Partial<TextOverlayProperties>, recordHistory = true) => {
      const nextTracks = tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId) return clip
          const currentTextProps = clip.textProperties || {
            id: clipId,
            text: clip.name,
            startTime: clip.timelineStart,
            endTime: clip.timelineStart + clip.duration,
            x: 50,
            y: 50,
            fontFamily: 'Inter',
            fontSize: 36,
            fontWeight: 'bold',
            italic: false,
            color: '#ffffff',
            opacity: 1,
            rotation: 0,
          }

          const updatedProps: TextOverlayProperties = {
            ...currentTextProps,
            ...updates,
          }

          const newName = updates.text !== undefined ? `Text: ${updates.text}` : clip.name

          return {
            ...clip,
            name: newName,
            textProperties: updatedProps,
          }
        }),
      }))

      if (recordHistory) {
        history.record({ ...history.state, tracks: nextTracks, transitions, selectedClipId: clipId })
      } else {
        history.setPresent({ ...history.state, tracks: nextTracks, transitions, selectedClipId: clipId })
      }
    },
    [tracks, history]
  )

  const removeClip = useCallback((clipId: string) => {
    const nextTracks = tracks.map((track) => ({
      ...track,
      clips: track.clips.filter((clip) => clip.id !== clipId),
    }))
    const nextSelectedClipId = selectedClipId === clipId ? undefined : selectedClipId
    const nextTransitions = transitions.filter((t) => t.fromClipId !== clipId && t.toClipId !== clipId)

    history.record({ ...history.state, tracks: nextTracks, transitions: nextTransitions, selectedClipId: nextSelectedClipId })
  }, [tracks, selectedClipId, history])

  const cutSelectedClip = useCallback(() => {
    if (selectedClipId) {
      removeClip(selectedClipId)
    }
  }, [removeClip, selectedClipId])

  const duplicateClip = useCallback((targetClipId?: string) => {
    const clipToDuplicateId = targetClipId ?? selectedClipId
    if (!clipToDuplicateId) return

    let duplicatedClipId: string | undefined

    const nextTracks = tracks.map((track) => {
      const original = track.clips.find((c) => c.id === clipToDuplicateId)
      if (!original) return track

      duplicatedClipId = crypto.randomUUID()
      const newTimelineStart = original.timelineStart + original.duration + 0.2

      const newTextProps = original.textProperties
        ? {
            ...original.textProperties,
            id: duplicatedClipId,
            startTime: newTimelineStart,
            endTime: newTimelineStart + original.duration,
          }
        : undefined

      const newClip: TimelineClip = {
        ...original,
        id: duplicatedClipId,
        timelineStart: newTimelineStart,
        textProperties: newTextProps,
      }

      return {
        ...track,
        clips: [...track.clips, newClip],
      }
    })

    if (duplicatedClipId) {
      history.record({ ...history.state, tracks: nextTracks, transitions, selectedClipId: duplicatedClipId })
    }
  }, [selectedClipId, tracks, history])

  const moveClip = useCallback((clipId: string, newTimelineStart: number, recordHistory = true) => {
    const nextTracks = tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        if (clip.id !== clipId) return clip
        const clampedStart = Math.max(0, newTimelineStart)
        const updatedTextProps = clip.textProperties
          ? {
              ...clip.textProperties,
              startTime: clampedStart,
              endTime: clampedStart + clip.duration,
            }
          : undefined

        return {
          ...clip,
          timelineStart: clampedStart,
          textProperties: updatedTextProps,
        }
      }),
    }))

    if (recordHistory) {
      history.record({ ...history.state, tracks: nextTracks, transitions, selectedClipId: clipId })
    } else {
      history.setPresent({ ...history.state, tracks: nextTracks, transitions, selectedClipId: clipId })
    }
  }, [tracks, history])

  const splitClip = useCallback((targetClipId?: string, atTime?: number) => {
    const splitTime = atTime ?? currentTime
    const clipToSplitId = targetClipId ?? selectedClipId

    let newlySelectedId: string | undefined

    const nextTracks = tracks.map((track) => {
      let clipFound: TimelineClip | undefined
      if (clipToSplitId) {
        clipFound = track.clips.find((c) => c.id === clipToSplitId)
      } else {
        clipFound = track.clips.find(
          (c) => splitTime > c.timelineStart && splitTime < c.timelineStart + c.duration
        )
      }

      if (!clipFound) return track

      if (splitTime <= clipFound.timelineStart || splitTime >= clipFound.timelineStart + clipFound.duration) {
        return track
      }

      const splitOffset = splitTime - clipFound.timelineStart
      const clipA: TimelineClip = {
        ...clipFound,
        id: crypto.randomUUID(),
        sourceEnd: clipFound.sourceStart + splitOffset,
        duration: splitOffset,
        textProperties: clipFound.textProperties
          ? {
              ...clipFound.textProperties,
              id: crypto.randomUUID(),
              startTime: clipFound.timelineStart,
              endTime: splitTime,
            }
          : undefined,
      }

      const clipB: TimelineClip = {
        ...clipFound,
        id: crypto.randomUUID(),
        sourceStart: clipFound.sourceStart + splitOffset,
        timelineStart: splitTime,
        duration: clipFound.duration - splitOffset,
        textProperties: clipFound.textProperties
          ? {
              ...clipFound.textProperties,
              id: crypto.randomUUID(),
              startTime: splitTime,
              endTime: clipFound.timelineStart + clipFound.duration,
            }
          : undefined,
      }

      newlySelectedId = clipB.id

      return {
        ...track,
        clips: track.clips.flatMap((c) => (c.id === clipFound!.id ? [clipA, clipB] : [c])),
      }
    })

    if (newlySelectedId) {
      history.record({ ...history.state, tracks: nextTracks, transitions, selectedClipId: newlySelectedId })
    }
  }, [currentTime, selectedClipId, tracks, history])

  const trimClipLeft = useCallback((clipId: string, deltaSeconds: number, recordHistory = true) => {
    const nextTracks = tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        if (clip.id !== clipId) return clip

        const currentSpeed = clip.speed || 1
        const deltaSourceSeconds = deltaSeconds * currentSpeed
        const proposedSourceStart = clip.sourceStart + deltaSourceSeconds
        const maxLimit = clip.mediaDuration ? clip.sourceEnd - 0.2 : (clip.duration * currentSpeed) + clip.sourceStart - 0.2
        const clampedSourceStart = Math.max(0, Math.min(maxLimit, proposedSourceStart))
        const actualSourceDelta = clampedSourceStart - clip.sourceStart
        const actualTimelineDelta = actualSourceDelta / currentSpeed

        const newTimelineStart = clip.timelineStart + actualTimelineDelta
        const newSourceDuration = (clip.mediaDuration ? clip.sourceEnd : (clip.duration * currentSpeed) + clip.sourceStart) - clampedSourceStart
        const newDuration = newSourceDuration / currentSpeed

        const updatedTextProps = clip.textProperties
          ? {
              ...clip.textProperties,
              startTime: newTimelineStart,
              endTime: newTimelineStart + newDuration,
            }
          : undefined

        return {
          ...clip,
          sourceStart: clampedSourceStart,
          timelineStart: newTimelineStart,
          duration: newDuration,
          textProperties: updatedTextProps,
        }
      }),
    }))

    if (recordHistory) {
      history.record({ ...history.state, tracks: nextTracks, transitions, selectedClipId: clipId })
    } else {
      history.setPresent({ ...history.state, tracks: nextTracks, transitions, selectedClipId: clipId })
    }
  }, [tracks, history])

  const trimClipRight = useCallback((clipId: string, deltaSeconds: number, recordHistory = true) => {
    const nextTracks = tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        if (clip.id !== clipId) return clip

        const currentSpeed = clip.speed || 1
        const maxLimit = clip.mediaDuration || 300
        const deltaSourceSeconds = deltaSeconds * currentSpeed
        const proposedSourceEnd = clip.sourceEnd + deltaSourceSeconds
        const clampedSourceEnd = Math.max(clip.sourceStart + 0.2, Math.min(maxLimit, proposedSourceEnd))
        const newSourceDuration = clampedSourceEnd - clip.sourceStart
        const newDuration = newSourceDuration / currentSpeed

        const updatedTextProps = clip.textProperties
          ? {
              ...clip.textProperties,
              startTime: clip.timelineStart,
              endTime: clip.timelineStart + newDuration,
            }
          : undefined

        return {
          ...clip,
          sourceEnd: clampedSourceEnd,
          duration: newDuration,
          textProperties: updatedTextProps,
        }
      }),
    }))

    if (recordHistory) {
      history.record({ ...history.state, tracks: nextTracks, transitions, selectedClipId: clipId })
    } else {
      history.setPresent({ ...history.state, tracks: nextTracks, transitions, selectedClipId: clipId })
    }
  }, [tracks, history])

  const updateClipProperties = useCallback((clipId: string, updates: Partial<TimelineClip>) => {
    const nextTracks = tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        if (clip.id !== clipId) return clip
        const updated = { ...clip, ...updates }
        // Ensure duration consistency if sourceStart / sourceEnd changed
        if (updates.sourceStart !== undefined || updates.sourceEnd !== undefined) {
          updated.duration = (updated.sourceEnd - updated.sourceStart) / (updated.speed || 1)
        }
        return updated
      }),
    }))

    history.record({ ...history.state, tracks: nextTracks, transitions, selectedClipId: clipId })
  }, [tracks, history])

  const updateClipTransform = useCallback((clipId: string, transform: Partial<TransformProperties>, recordHistory = true) => {
    const nextTracks = tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        if (clip.id !== clipId) return clip

        const currentTransform = clip.transform || { x: 0, y: 0, width: 100, height: 100, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 }
        return {
          ...clip,
          transform: {
            ...currentTransform,
            ...transform,
          },
        }
      }),
    }))

    if (recordHistory) {
      history.record({ ...history.state, tracks: nextTracks, transitions, selectedClipId: clipId })
    } else {
      history.setPresent({ ...history.state, tracks: nextTracks, transitions, selectedClipId: clipId })
    }
  }, [tracks, history])

  const updateClipSpeed = useCallback((clipId: string, speed: number) => {
    const nextTracks = tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        if (clip.id !== clipId) return clip

        const newDuration = (clip.sourceEnd - clip.sourceStart) / speed
        return {
          ...clip,
          speed,
          duration: newDuration,
        }
      }),
    }))
    history.record({ ...history.state, tracks: nextTracks, transitions, selectedClipId: clipId })
  }, [tracks, history])

  const updateTrackProperties = useCallback((trackId: string, updates: Partial<TimelineTrack>) => {
    const nextTracks = tracks.map((track) => {
      if (track.id !== trackId) return track
      return { ...track, ...updates }
    })

    history.record({ ...history.state, tracks: nextTracks, transitions, selectedClipId })
  }, [tracks, selectedClipId, history])

  const addTransition = useCallback((fromClipId: string, toClipId: string, type: TransitionType = 'fade') => {
    if (fromClipId === toClipId || transitions.some((t) => t.fromClipId === fromClipId && t.toClipId === toClipId)) return
    const from = tracks.flatMap((t) => t.clips).find((c) => c.id === fromClipId)
    const to = tracks.flatMap((t) => t.clips).find((c) => c.id === toClipId)
    if (!from || !to) return
    const maxDuration = Math.max(0.1, Math.min(2, from.duration, to.duration))
    const transition: VideoTransition = { id: crypto.randomUUID(), type, fromClipId, toClipId, duration: Math.min(1, maxDuration), parameters: {} }
    history.record({ ...history.state, tracks, transitions: [...transitions, transition], selectedClipId })
    selectTransition(transition.id)
  }, [tracks, transitions, selectedClipId, history])

  const updateTransition = useCallback((id: string, updates: Partial<Pick<VideoTransition, 'type' | 'duration' | 'parameters'>>) => {
    const next = transitions.map((t) => t.id === id ? { ...t, ...updates, duration: updates.duration !== undefined ? Math.max(0.1, Math.min(5, updates.duration)) : t.duration } : t)
    history.record({ ...history.state, tracks, transitions: next, selectedClipId })
  }, [tracks, transitions, selectedClipId, history])

  const removeTransition = useCallback((id: string) => {
    history.record({ ...history.state, tracks, transitions: transitions.filter((t) => t.id !== id), selectedClipId })
    selectTransition((current) => current === id ? undefined : current)
  }, [tracks, transitions, selectedClipId, history])

  const selectVisualElement = useCallback((id?: string) => {
    history.setPresent({ ...history.state, selectedVisualElementId: id, selectedClipId: id ? undefined : history.state.selectedClipId })
  }, [history])

  const addVisualElement = useCallback((element: Omit<VisualElement, 'id'>) => {
    const next: VisualElement = { ...element, mask: element.mask ?? { shape: 'original' }, id: crypto.randomUUID() }
    history.record({ ...history.state, visualElements: [...visualElements, next], selectedVisualElementId: next.id, selectedClipId: undefined })
  }, [history, visualElements])

  /** Live update by default; pass commit=true for one undoable inspector action. */
  const updateVisualElement = useCallback((id: string, updates: Partial<VisualElement>, commit = true) => {
    const next = visualElements.map((item) => item.id === id ? { ...item, ...updates } : item)
    const snapshot = { ...history.state, visualElements: next, selectedVisualElementId: id }
    if (commit) history.record(snapshot); else history.setPresent(snapshot)
  }, [history, visualElements])

  /** Call once at pointerdown, then use transient updates until pointerup. */
  const beginVisualInteraction = useCallback(() => { history.record({ ...history.state }) }, [history])

  const removeVisualElement = useCallback((id: string) => {
    history.record({ ...history.state, visualElements: visualElements.filter((item) => item.id !== id), selectedVisualElementId: selectedVisualElementId === id ? undefined : selectedVisualElementId })
  }, [history, visualElements, selectedVisualElementId])

  const duplicateVisualElement = useCallback((id: string) => {
    const source = visualElements.find((item) => item.id === id)
    if (!source) return
    const copy: VisualElement = { ...source, mask: source.mask ? { ...source.mask } : { shape:'original' }, id: crypto.randomUUID(), name: `${source.name} copy`, x: Math.min(95, source.x + 3), y: Math.min(95, source.y + 3) }
    history.record({ ...history.state, visualElements: [...visualElements, copy], selectedVisualElementId: copy.id, selectedClipId: undefined })
  }, [history, visualElements])

  const addVisualFromFile = useCallback(async (file: File, kind: VisualElementKind = 'image') => {
    if (!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)) throw new Error('Only PNG, JPG, WEBP and GIF are supported.')
    const url = URL.createObjectURL(file)
    activeObjectUrls.current.add(url)
    const dimensions = await new Promise<{width:number;height:number}>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.naturalWidth || 512, height: img.naturalHeight || 512 })
      img.onerror = () => reject(new Error(`Could not read ${file.name}`))
      img.src = url
    })
    const maxW = 35
    const aspect = dimensions.width / Math.max(1, dimensions.height)
    const width = maxW
    const height = Math.min(70, maxW / aspect * (canvas.width / canvas.height))
    addVisualElement({ kind, name: file.name, src: url, mimeType: file.type, mask:{shape:'original'}, x: 50, y: 50, width, height, scale: 1, rotation: 0, opacity: 1, flipX: false, flipY: false, startTime: currentTime, endTime: currentTime + 5, keyframeProperties: [], animation: { type: 'none', duration: .4, parameters: {} } })
  }, [addVisualElement, canvas.width, canvas.height, currentTime])

  /** Change the canvas output aspect ratio. Does NOT modify any clip source data. */
  const setCanvasAspectRatio = useCallback((ratio: CanvasAspectRatio) => {
    const preset = ratio === 'original'
      ? getOriginalCanvasSource(assets, tracks, selectedClipId, selectedAssetId)
      : CANVAS_PRESETS[ratio]
    if (!preset) return
    setCanvas(previous => ({ ...previous, aspectRatio: ratio, width: preset.width, height: preset.height }))
  }, [assets, tracks, selectedClipId, selectedAssetId])

  const undo = useCallback(() => {
    history.undo()
  }, [history])

  const redo = useCallback(() => {
    history.redo()
  }, [history])

  const setPixelsPerSecond = useCallback((pps: number) => {
    const clamped = Math.max(10, Math.min(200, pps))
    setPixelsPerSecondState(clamped)
  }, [])

  const zoomIn = useCallback(() => {
    setPixelsPerSecondState((curr) => {
      const next = ZOOM_PRESETS.find((p) => p > curr)
      return next ?? 200
    })
  }, [])

  const zoomOut = useCallback(() => {
    setPixelsPerSecondState((curr) => {
      const reversed = [...ZOOM_PRESETS].reverse()
      const prev = reversed.find((p) => p < curr)
      return prev ?? 10
    })
  }, [])

  const fitTimeline = useCallback((containerWidth: number) => {
    if (containerWidth <= 0 || duration <= 0) return
    const calculatedPps = Math.max(10, Math.min(200, (containerWidth - 100) / duration))
    setPixelsPerSecondState(calculatedPps)
  }, [duration])

  const value = useMemo<EditorContextValue>(
    () => ({
      assets,
      selectedAssetId,
      selectedClipId,
      tracks,
      transitions,
      selectedTransitionId,
      visualElements,
      selectedVisualElementId,
      canvas,
      currentTime,
      duration,
      isPlaying,
      volume,
      isMuted,
      pixelsPerSecond,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      past: history.past,
      present: history.present,
      future: history.future,
      addAssets,
      removeAsset,
      clearAssets,
      selectAsset,
      addClipToTimeline,
      addTextClip,
      updateTextOverlayProperties,
      selectClip,
      removeClip,
      cutSelectedClip,
      duplicateClip,
      moveClip,
      splitClip,
      trimClipLeft,
      trimClipRight,
      updateClipProperties,
      updateClipTransform,
      updateClipSpeed,
      updateTrackProperties,
      setCanvasAspectRatio,
      undo,
      redo,
      setCurrentTime,
      setPlaying,
      togglePlay,
      setVolume,
      setMuted,
      toggleMute,
      setPixelsPerSecond,
      zoomIn,
      zoomOut,
      fitTimeline,
      addTransition,
      updateTransition,
      removeTransition,
      selectTransition,
      addVisualElement,
      updateVisualElement,
      beginVisualInteraction,
      removeVisualElement,
      duplicateVisualElement,
      selectVisualElement,
      addVisualFromFile,
    }),
    [
      assets,
      selectedAssetId,
      selectedClipId,
      tracks,
      transitions,
      selectedTransitionId,
      visualElements,
      selectedVisualElementId,
      canvas,
      currentTime,
      duration,
      isPlaying,
      volume,
      isMuted,
      pixelsPerSecond,
      history.canUndo,
      history.canRedo,
      history.past,
      history.present,
      history.future,
      addAssets,
      removeAsset,
      clearAssets,
      selectAsset,
      addClipToTimeline,
      addTextClip,
      updateTextOverlayProperties,
      selectClip,
      removeClip,
      cutSelectedClip,
      duplicateClip,
      moveClip,
      splitClip,
      trimClipLeft,
      trimClipRight,
      updateClipProperties,
      updateClipTransform,
      updateClipSpeed,
      updateTrackProperties,
      setCanvasAspectRatio,
      undo,
      redo,
      setCurrentTime,
      setPlaying,
      togglePlay,
      setVolume,
      setMuted,
      toggleMute,
      setPixelsPerSecond,
      zoomIn,
      zoomOut,
      fitTimeline,
      addTransition,
      updateTransition,
      removeTransition,
      selectTransition,
      visualElements,
      selectedVisualElementId,
      addVisualElement,
      updateVisualElement,
      beginVisualInteraction,
      removeVisualElement,
      duplicateVisualElement,
      selectVisualElement,
      addVisualFromFile,
    ]
  )

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}
