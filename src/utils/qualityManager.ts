export type Tier = 'high' | 'medium' | 'low'

export interface TierSettings {
  nu: number // số hàng lưới dọc cánh
  nv: number // số cột lưới ngang cánh
  dpr: number // trần device pixel ratio
  particles: number
  petals: number // số cánh hoa trang trí bay quanh
  post: boolean
  bloomRes: number
}

export const TIERS: Record<Tier, TierSettings> = {
  high: { nu: 24, nv: 20, dpr: 1.5, particles: 240, petals: 18, post: true, bloomRes: 1 },
  medium: { nu: 18, nv: 14, dpr: 1.25, particles: 140, petals: 12, post: true, bloomRes: 0.35 },
  low: { nu: 12, nv: 9, dpr: 1, particles: 70, petals: 6, post: false, bloomRes: 0.25 },
}

// Đoán ban đầu một cách thận trọng; sau đó PerformanceMonitor sẽ hạ bậc nếu khung hình tụt.
export function detectInitialTier(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number }
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const mem = nav.deviceMemory ?? 4
  const cores = navigator.hardwareConcurrency ?? 4
  if (mem <= 2 || cores <= 3) return 'low'
  if (coarse || mem <= 4 || cores <= 6) return 'medium'
  return 'medium' // bắt đầu thận trọng; PerformanceMonitor sẽ điều chỉnh độ phân giải
}

export const lowerTier = (t: Tier): Tier => (t === 'high' ? 'medium' : 'low')

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2')) || !!c.getContext('webgl')
  } catch {
    return false
  }
}
