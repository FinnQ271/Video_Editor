import type { VisualElement } from '../types/editor'

type VisualGeometry = Pick<VisualElement, 'kind' | 'shape' | 'mask' | 'width' | 'height'>

export function hasSquareBounds(element: Pick<VisualElement, 'kind' | 'shape' | 'mask'>) {
  return element.kind === 'shape'
    ? element.shape === 'circle'
    : element.mask?.shape === 'circle' || element.mask?.shape === 'square'
}

// Percentages use different canvas axes. Equal pixel sides need different percentages.
export function getVisualSize(element: VisualGeometry, canvas: { width: number; height: number }) {
  return {
    width: element.width,
    height: hasSquareBounds(element) ? element.width * canvas.width / canvas.height : element.height,
  }
}
