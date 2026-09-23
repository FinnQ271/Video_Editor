import type { ChromaKeySettings } from '../types/editor'

export interface BackgroundRemovalInput { source: CanvasImageSource; width: number; height: number }
export interface BackgroundRemovalResult { canvas: HTMLCanvasElement }
/** Contract for a future AI/model-backed background remover. Chroma key does not pretend to be AI. */
export interface BackgroundRemovalProvider {
  readonly id: string
  readonly name: string
  isAvailable(): boolean | Promise<boolean>
  removeBackground(input: BackgroundRemovalInput): Promise<BackgroundRemovalResult>
}

export const DEFAULT_CHROMA_KEY: ChromaKeySettings = {
  enabled: false, color: '#00ff00', tolerance: 0.28, softness: 0.12, spill: 0.35,
}

const clamp01=(v:number)=>Math.max(0,Math.min(1,v))
export function hexToRgb(hex:string){const h=hex.replace('#','');const n=parseInt(h.length===3?h.split('').map(x=>x+x).join(''):h,16);return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}}

/** Pure pixel processor; independent from React/UI. Mutates ImageData for performance. */
export function applyChromaKey(image:ImageData, settings:ChromaKeySettings):ImageData {
  if(!settings.enabled) return image
  const key=hexToRgb(settings.color), d=image.data
  const kr=key.r/255,kg=key.g/255,kb=key.b/255
  const tolerance=Math.max(.001,settings.tolerance), soft=Math.max(.001,settings.softness)
  for(let i=0;i<d.length;i+=4){
    const r=d[i]/255,g=d[i+1]/255,b=d[i+2]/255
    const dist=Math.sqrt((r-kr)**2+(g-kg)**2+(b-kb)**2)/Math.sqrt(3)
    // 0 near key => transparent; feather edge over softness range.
    const alpha=clamp01((dist-tolerance)/soft)
    d[i+3]=Math.round(d[i+3]*alpha)
    if(alpha<1 && settings.spill>0){
      const spill=clamp01(settings.spill)*(1-alpha)
      // Suppress the key-color channel toward the average of the other channels.
      if(kg>=kr&&kg>=kb) d[i+1]=Math.round((g*(1-spill)+((r+b)/2)*spill)*255)
      else if(kr>=kg&&kr>=kb) d[i]=Math.round((r*(1-spill)+((g+b)/2)*spill)*255)
      else d[i+2]=Math.round((b*(1-spill)+((r+g)/2)*spill)*255)
    }
  }
  return image
}

export class ChromaKeyEngine {
  render(ctx:CanvasRenderingContext2D, source:CanvasImageSource, width:number, height:number, settings:ChromaKeySettings){
    ctx.clearRect(0,0,width,height);ctx.drawImage(source,0,0,width,height)
    if(!settings.enabled)return
    const frame=ctx.getImageData(0,0,width,height);ctx.putImageData(applyChromaKey(frame,settings),0,0)
  }
}
