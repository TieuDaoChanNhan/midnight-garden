export type Tier = 'high' | 'medium' | 'low' | 'lite'

export interface TierSettings {
  nu: number // số hàng lưới dọc cánh
  nv: number // số cột lưới ngang cánh
  dpr: number // trần device pixel ratio
  particles: number
  petals: number // số cánh hoa trang trí bay quanh
  streams: number // số hạt mỗi dòng sáng xoắn
  bokeh: number
  rays: boolean // chùm sáng giả
  sparkles: number // đốm lấp lánh trên mặt nước
  post: boolean
  bloomRes: number
}

export const TIERS: Record<Tier, TierSettings> = {
  high: { nu: 28, nv: 26, dpr: 2, particles: 240, petals: 18, streams: 70, bokeh: 16, rays: true, sparkles: 48, post: true, bloomRes: 1 },
  medium: { nu: 20, nv: 16, dpr: 1.6, particles: 140, petals: 12, streams: 46, bokeh: 10, rays: true, sparkles: 28, post: true, bloomRes: 0.5 },
  lite: { nu: 12, nv: 8, dpr: 1, particles: 36, petals: 0, streams: 0, bokeh: 0, rays: false, sparkles: 0, post: false, bloomRes: 0.25 },
  low: { nu: 14, nv: 10, dpr: 1.25, particles: 70, petals: 6, streams: 28, bokeh: 6, rays: false, sparkles: 14, post: false, bloomRes: 0.25 },
}

// Đoán ban đầu một cách thận trọng; sau đó PerformanceMonitor sẽ hạ bậc nếu khung hình tụt.
export function detectInitialTier(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number }
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const mem = nav.deviceMemory ?? 4
  const cores = navigator.hardwareConcurrency ?? 4
  if (mem <= 2 || cores <= 3) return 'low'
  if (coarse || mem <= 4 || cores <= 6) return 'medium'
  return 'high'
}

export const lowerTier = (t: Tier): Tier => (t === 'high' ? 'medium' : t === 'medium' ? 'low' : 'lite')

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2')) || !!c.getContext('webgl')
  } catch {
    return false
  }
}
