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
  msaa: number // số mẫu khử răng cưa trong đường hậu kỳ
  morphKeys: number // số tư thế nở tính sẵn cho mỗi cánh (nhiều hơn = chuyển động nở mịn hơn)
}

// Trang trí (cánh bay, hạt, bokeh, chùm sáng, mặt nước) rất nhẹ so với lớp cánh thủy tinh nên được giữ
// ở mọi bậc; các bậc thấp chỉ giảm độ mịn hình học, độ phân giải, khử răng cưa và hậu kỳ.
const DECOR_FULL = { particles: 300, petals: 24, streams: 90, bokeh: 20, rays: true, sparkles: 60 }
const DECOR_LEAN = { particles: 200, petals: 16, streams: 64, bokeh: 14, rays: true, sparkles: 40 }

export const TIERS: Record<Tier, TierSettings> = {
  high: { nu: 36, nv: 34, dpr: 2.5, ...DECOR_FULL, post: true, bloomRes: 0.5, msaa: 4, morphKeys: 13 },
  medium: { nu: 28, nv: 24, dpr: 2, ...DECOR_FULL, post: true, bloomRes: 0.5, msaa: 2, morphKeys: 11 },
  low: { nu: 22, nv: 18, dpr: 1.75, ...DECOR_LEAN, post: true, bloomRes: 0.35, msaa: 0, morphKeys: 9 },
  lite: { nu: 16, nv: 12, dpr: 1.25, ...DECOR_LEAN, post: false, bloomRes: 0.25, msaa: 0, morphKeys: 7 },
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
