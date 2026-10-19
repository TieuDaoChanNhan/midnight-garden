import { hashString, jitter, mulberry32, range } from '../utils/seededRandom'

// Tham số hình học của bông hồng. Mọi thứ "nghệ thuật" đều sinh từ seed của nickname,
// nên cùng một nickname luôn cho cùng một bông hoa.
//
// Hoa hồng thật không có "các lớp" rời rạc: các cánh mọc theo một đường xoắn ốc liên tục,
// nhỏ và cuộn chặt ở tâm, to dần và mở dần ra ngoài. Ở đây mỗi cánh có độ sâu t ∈ [0,1]
// (0 = cánh trong cùng, 1 = cánh ngoài cùng), mọi tham số là hàm trơn của t.

export type PetalKind = 'core' | 'mid' | 'outer' | 'sepal'

export interface PetalSpec {
  kind: PetalKind
  index: number
  depth: number // 0 = trong cùng, 1 = ngoài cùng
  azimuth: number // rad quanh trục hoa
  baseRadius: number
  baseHeight: number
  length: number
  width: number
  // [lúc búp, lúc nở]
  tilt: [number, number] // góc của gân giữa so với trục đứng
  bend: [number, number] // độ uốn thêm dọc theo cánh (âm = cụp vào trong)
  wrap: [number, number] // 0 = cánh phẳng, 1 = ôm tròn quanh trục
  roll: [number, number] // mép cánh cuộn ra ngoài
  cup: [number, number] // độ lõm của lòng cánh
  rippleAmp: number
  rippleFreq: number
  ripplePhase: number
  delay: number // thời điểm bắt đầu nở (0..1 của timeline)
  span: number // thời lượng nở (0..1)
  tone: number // 0..1: lệch màu riêng của từng cánh
  alphaBias: number
}

export interface RoseParams {
  seed: number
  petals: PetalSpec[]
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

export function createRoseParams(nickname: string, count?: number): RoseParams {
  const seed = hashString(nickname)
  const rng = mulberry32(seed)

  const N = count ?? 40 + Math.floor(rng() * 5) // 40..44 cánh xoắn ốc (hoặc số cánh chỉ định cho bông phụ)
  const phase = rng() * Math.PI * 2
  const petals: PetalSpec[] = []

  for (let i = 0; i < N; i++) {
    const t = i / (N - 1)
    const ts = Math.pow(t, 0.85)
    const kind: PetalKind = t < 0.26 ? 'core' : t < 0.62 ? 'mid' : 'outer'
    const j = (a: number) => jitter(rng, a)

    petals.push({
      kind,
      index: i,
      depth: t,
      // đường xoắn ốc góc vàng: mỗi cánh lệch 137.5° so với cánh trước
      azimuth: phase + i * GOLDEN_ANGLE + j(0.06),
      baseRadius: 0.045 + 0.215 * t + range(rng, 0, 0.015),
      baseHeight: 0.1 - 0.1 * t + j(0.01),
      length: 0.5 + 0.66 * ts + j(0.035),
      width: 0.4 + 0.62 * ts + j(0.03),
      tilt: [0.05 + 0.12 * t + j(0.01), 0.1 + 0.6 * Math.pow(t, 1.1) + j(0.04)],
      bend: [-0.56 - 0.18 * t, -0.5 + 0.8 * Math.pow(t, 1.3) + j(0.05)],
      wrap: [1, 1 - 0.22 * Math.pow(t, 1.5) + j(0.03)],
      roll: [0.05 + 0.1 * t, 0.12 + 0.82 * t + j(0.06)],
      cup: [0.28, 0.3 + 0.32 * t],
      rippleAmp: 0.006 + 0.018 * t,
      rippleFreq: 2.2 + 0.8 * t,
      ripplePhase: rng() * 6.28,
      // cánh ngoài mở trước, cánh trong mở sau
      delay: (1 - t) * 0.42 + j(0.008),
      span: 0.58,
      tone: rng(),
      alphaBias: j(0.05),
    })
  }

  // đài hoa: 5 lá nhỏ, thon, gập xuống khi nở
  const sepalPhase = rng() * 6.28
  for (let i = 0; i < 5; i++) {
    petals.unshift({
      kind: 'sepal',
      index: i,
      depth: 1,
      azimuth: sepalPhase + (i / 5) * Math.PI * 2 + jitter(rng, 0.1),
      baseRadius: 0.12,
      baseHeight: -0.07,
      length: 0.5 + jitter(rng, 0.04),
      width: 0.15,
      tilt: [0.25, 1.95 + jitter(rng, 0.15)],
      bend: [-0.3, 0.45],
      wrap: [0.6, 0.2],
      roll: [0, 0.1],
      cup: [0.1, 0.1],
      rippleAmp: 0.004,
      rippleFreq: 2,
      ripplePhase: rng() * 6.28,
      delay: 0.05 + i * 0.01,
      span: 0.6,
      tone: rng(),
      alphaBias: 0,
    })
  }

  return { seed, petals }
}
