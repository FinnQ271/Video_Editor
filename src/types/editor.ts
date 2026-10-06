export type TrackType = 'video' | 'audio' | 'text' | 'overlay'
export type ClipType = 'video' | 'audio' | 'text' | 'image'


export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
export type AnimatableProperty = 'x' | 'y' | 'scale' | 'rotation' | 'opacity' | 'volume' | (string & {})

export interface Keyframe { id: string; time: number; value: number; easing: EasingType }
export interface KeyframedProperty { property: AnimatableProperty; keyframes: Keyframe[] }

export type VisualElementKind = 'image' | 'logo' | 'sticker' | 'shape' | 'overlay'
export type VisualAnimationType = 'none' | 'fade-in' | 'pop' | 'slide-up'
export type ImageMaskShape = 'original' | 'square' | 'circle' | 'triangle'

/** A single extensible abstraction for every non-text visual overlay. */
export interface VisualElement {
  id: string
  kind: VisualElementKind
  name: string
  src?: string
  mimeType?: string
  shape?: 'rectangle' | 'circle'
  /** Non-destructive image mask. Never changes src. */
  mask?: { shape: ImageMaskShape }
  color?: string
  x: number
  y: number
  width: number
  height: number
  scale: number
  rotation: number
  opacity: number
  flipX: boolean
  flipY: boolean
  startTime: number
  endTime: number
  keyframeProperties: KeyframedProperty[]
  animation: {
    type: VisualAnimationType
    duration: number
    parameters: Record<string, number | string | boolean>
  }
}

export type TransitionType = 'fade' | 'dissolve' | 'slide' | 'zoom' | 'wipe' | 'blur' | 'spin' | 'flash'

export interface VideoTransition {
  id: string
  type: TransitionType
  fromClipId: string
  toClipId: string
  duration: number
  parameters: Record<string, number | string | boolean>
}


export interface MediaAsset {
  id: string
  file?: File
  url: string // Object URL created via URL.createObjectURL(file)
  name: string
  duration: number // in seconds
  width: number
  height: number
  mimeType: string
  size: number // bytes
  thumbnail?: string // base64 / data URL
  createdAt: number
}

export interface TextOverlayProperties {
  id: string
  text: string
  startTime: number // seconds on timeline
  endTime: number // seconds on timeline
  x: number // percentage position (0 - 100)
  y: number // percentage position (0 - 100)
  width?: number
  height?: number
  fontFamily: string
  fontSize: number // px
  fontWeight: 'normal' | 'bold' | '500' | '600' | '700' | '800' | '900'
  italic: boolean
  color: string // hex / rgba
  stroke?: string // stroke color
  strokeWidth?: number // px
  shadow?: string // box / text shadow string
  background?: string // background color
  opacity: number // 0.0 - 1.0
  rotation: number // degrees (-180 to 180)
}

export interface TransformProperties {
  x: number // default 0
  y: number // default 0
  width: number // default 100
  height: number // default 100
  scaleX: number // default 1 (use -1 for horizontal flip)
  scaleY: number // default 1 (use -1 for vertical flip)
  rotation: number // default 0
  opacity: number // default 1
}


export interface ChromaKeySettings {
  enabled: boolean
  color: string
  tolerance: number
  softness: number
  spill: number
}

export interface TimelineClip {
  id: string
  assetId?: string
  type?: ClipType
  name: string
  src?: string
  mediaDuration?: number // total duration of source video asset
  sourceStart: number // in-point in the source media (seconds)
  sourceEnd: number // out-point in the source media (seconds)
  timelineStart: number // start position on timeline (seconds)
  duration: number // sourceEnd - sourceStart
  thumbnail?: string
  volume?: number
  muted?: boolean
  fadeIn?: number // seconds in local timeline time
  fadeOut?: number // seconds in local timeline time
  keyframeProperties?: KeyframedProperty[]
  chromaKey?: ChromaKeySettings
  textProperties?: TextOverlayProperties
  transform?: TransformProperties
  speed?: number // default 1
}

export interface TimelineTrack {
  id: string
  type: TrackType
  name: string
  locked: boolean
  muted: boolean
  clips: TimelineClip[]
}

export type CanvasAspectRatio = 'original' | '16:9' | '9:16' | '1:1' | '4:5'

export const CANVAS_PRESETS: Record<Exclude<CanvasAspectRatio, 'original'>, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
}

export interface CanvasConfig {
  width: number
  height: number
  aspectRatio: CanvasAspectRatio
  background: string
}

/**
 * Computes where to render the media inside the canvas so it:
 * - Fits entirely within the canvas bounds (no cropping)
 * - Preserves the media's original aspect ratio (no distortion)
 * - Is centered (letterbox / pillarbox black bars fill the rest)
 *
 * All values are in canvas-coordinate pixels.
 */
export interface FitTransform {
  x: number      // left offset in canvas pixels
  y: number      // top offset in canvas pixels
  width: number  // rendered media width in canvas pixels
  height: number // rendered media height in canvas pixels
}

export function calculateFitTransform(
  sourceWidth: number,
  sourceHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): FitTransform {
  const scale = Math.min(canvasWidth / sourceWidth, canvasHeight / sourceHeight)
  const width = sourceWidth * scale
  const height = sourceHeight * scale
  const x = (canvasWidth - width) / 2
  const y = (canvasHeight - height) / 2
  return { x, y, width, height }
}

export interface EditorProject {
  id: string
  name: string
  duration: number
  canvas: CanvasConfig
  fps: number
  tracks: TimelineTrack[]
}
