import { BufferAttribute, BufferGeometry, Color, Vector3, type Mesh } from 'three'
import type { PetalSpec } from './RoseParameters'
import { palette } from '../config/theme'

// Mỗi cánh hoa là một mặt tham số P(u,v):
//   u ∈ [0,1] đi dọc gân giữa từ gốc đến đỉnh, v ∈ [-1,1] đi ngang cánh.
// Gân giữa là một đường cong có góc α(u) = tilt + bend·u^1.6 (tích phân thành x(u), y(u)).
// Từ gân giữa, cánh được "bọc" quanh trục hoa (wrap) hoặc trải phẳng, rồi thêm
// độ lõm (cup), mép cuộn (roll) và gợn sóng ở đỉnh (ripple).

const mix = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const smootherstep = (t: number) => {
  const x = clamp01(t)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

function widthProfile(kind: PetalSpec['kind'], u: number): number {
  if (kind === 'sepal') return Math.pow(u, 0.55) * Math.pow(1 - u, 0.75) * 2.6
  // gốc hẹp, phình rộng ở khoảng 2/3 rồi tròn đỉnh
  return (0.16 + 0.84 * Math.pow(u, 0.55)) * Math.pow(Math.max(0, 1 - Math.pow(u, 4.2)), 0.52)
}

const cD = new Color(palette.roseDeep)
const cA = new Color(palette.softRose)
const cB = new Color(palette.pearlPink)
const cC = new Color(palette.pearlWhite)
const cL = new Color(palette.lavender)
const cI = new Color(palette.iceBlue)
const cP = new Color(palette.peach)
const cG = new Color(palette.gold)
const tmp = new Color()

export class PetalSurface {
  readonly geometry = new BufferGeometry()
  readonly centroid = new Vector3()
  private readonly nu: number
  private readonly nv: number
  private readonly pos: Float32Array
  private readonly rowW: Float32Array
  private readonly rowA: Float32Array
  private readonly rowX: Float32Array
  private readonly rowY: Float32Array
  private readonly vArr: Float32Array
  private readonly uArr: Float32Array
  private readonly cosA: number
  private readonly sinA: number
  private lastLocal = -1
  private morphK = 0
  private keyCentroids: Vector3[] = []

  constructor(
    readonly spec: PetalSpec,
    nu: number,
    nv: number,
  ) {
    this.nu = nu
    this.nv = nv
    const count = nu * nv
    this.pos = new Float32Array(count * 3)
    this.rowW = new Float32Array(nu)
    this.rowA = new Float32Array(nu)
    this.rowX = new Float32Array(nu)
    this.rowY = new Float32Array(nu)
    this.vArr = new Float32Array(nv)
    // lưới dày hơn về phía đỉnh cánh để mép tròn mượt
    this.uArr = new Float32Array(nu)
    for (let j = 0; j < nu; j++) this.uArr[j] = 1 - Math.pow(1 - j / (nu - 1), 1.5)
    this.cosA = Math.cos(spec.azimuth)
    this.sinA = Math.sin(spec.azimuth)

    for (let j = 0; j < nu; j++) this.rowW[j] = spec.width * widthProfile(spec.kind, this.uArr[j])
    for (let i = 0; i < nv; i++) this.vArr[i] = (i / (nv - 1)) * 2 - 1

    // chỉ số tam giác (cố định)
    const idx = new Uint32Array((nu - 1) * (nv - 1) * 6)
    let k = 0
    for (let j = 0; j < nu - 1; j++) {
      for (let i = 0; i < nv - 1; i++) {
        const a = j * nv + i
        const b = (j + 1) * nv + i
        const c = j * nv + i + 1
        const d = (j + 1) * nv + i + 1
        idx[k++] = a
        idx[k++] = b
        idx[k++] = c
        idx[k++] = c
        idx[k++] = b
        idx[k++] = d
      }
    }
    this.geometry.setIndex(new BufferAttribute(idx, 1))
    this.geometry.setAttribute('position', new BufferAttribute(this.pos, 3))
    this.geometry.setAttribute('normal', new BufferAttribute(new Float32Array(count * 3), 3))
    this.geometry.setAttribute('color', new BufferAttribute(this.buildColors(), 4))
    this.update(0, true)
  }

  // Màu + độ trong suốt cố định theo (u,v). Cánh trong đậm màu hồng ruby và gần như đặc,
  // cánh ngoài nhạt dần về ngọc trai, đỉnh trắng ngà ánh xanh băng ở mép và trong hơn một chút.
  private buildColors(): Float32Array {
    const { nu, nv, spec } = this
    const d = spec.depth
    const out = new Float32Array(nu * nv * 4)
    const lav = 0.12 + spec.tone * 0.22
    for (let j = 0; j < nu; j++) {
      const u = this.uArr[j]
      for (let i = 0; i < nv; i++) {
        const av = Math.abs(this.vArr[i])
        const o = (j * nv + i) * 4
        if (spec.kind === 'sepal') tmp.copy(cL).lerp(cB, 0.3 + 0.3 * u)
        else {
          tmp.copy(cD).lerp(cA, Math.min(1, 0.18 + d * 1.15))
          tmp.lerp(cB, Math.min(1, u * (0.55 + 0.45 * d)))
          tmp.lerp(cC, Math.pow(u, 2.4) * (0.2 + 0.5 * d))
        }
        // dải màu theo độ sâu: hồng ruby (tâm) → đào / vàng nhạt (giữa) → tím nhạt & xanh băng (ngoài)
        const bell = Math.exp(-Math.pow((d - 0.42) / 0.2, 2))
        const rim = Math.min(1, Math.max(0, (d - 0.5) / 0.4))
        if (spec.kind !== 'sepal') {
          tmp.lerp(cP, 0.42 * bell * Math.pow(u, 1.2))
          tmp.lerp(cG, 0.3 * bell * Math.pow(u, 2.5))
          tmp.lerp(cL, 0.5 * rim * Math.pow(u, 1.6) * (0.5 + spec.tone * 0.5))
          tmp.lerp(cI, 0.5 * rim * Math.pow(u, 3))
        }
        tmp.lerp(cL, lav * av * av * (0.3 + u * 0.7) * (0.4 + 0.6 * d))
        tmp.lerp(cI, 0.3 * Math.pow(u, 3) * Math.pow(av, 1.5) * (0.4 + 0.6 * d))
        out[o] = tmp.r
        out[o + 1] = tmp.g
        out[o + 2] = tmp.b
        let a = 0.97 - 0.34 * Math.pow(u, 1.3) * (0.35 + 0.65 * d) - 0.12 * Math.pow(av, 3) * u + spec.alphaBias
        if (spec.kind === 'sepal') a = 0.85 - 0.3 * u
        out[o + 3] = Math.max(0.3, Math.min(1, a))
      }
    }
    return out
  }

  /** pb: tiến độ nở cục bộ của cánh này, 0..1 (đã easing). */
  update(pb: number, force = false) {
    if (!force && Math.abs(pb - this.lastLocal) < 1e-5) return
    this.lastLocal = pb
    const { spec, nu, nv, pos, rowW, rowA, rowX, rowY, vArr, cosA, sinA } = this

    const tilt = mix(spec.tilt[0], spec.tilt[1], pb)
    const bend = mix(spec.bend[0], spec.bend[1], pb)
    const wrap = mix(spec.wrap[0], spec.wrap[1], pb)
    const roll = mix(spec.roll[0], spec.roll[1], pb)
    const cup = mix(spec.cup[0], spec.cup[1], pb)
    const L = spec.length

    // gân giữa (tích phân góc)
    let x = spec.baseRadius
    let y = spec.baseHeight
    for (let j = 0; j < nu; j++) {
      const u = this.uArr[j]
      const a = tilt + bend * Math.pow(u, 1.6)
      rowA[j] = a
      if (j > 0) {
        const am = (rowA[j - 1] + a) * 0.5
        const dU = u - this.uArr[j - 1]
        x += L * Math.sin(am) * dU
        y += L * Math.cos(am) * dU
      }
      rowX[j] = x
      rowY[j] = y
    }

    let cx = 0
    let cy = 0
    let cz = 0
    const mj = Math.round((nu - 1) * 0.6)
    const rippleK = spec.rippleAmp * (0.3 + 0.7 * pb)

    for (let j = 0; j < nu; j++) {
      const u = this.uArr[j]
      const a = rowA[j]
      const sa = Math.sin(a)
      const ca = Math.cos(a)
      const w = rowW[j] * 0.5
      const rho = rowX[j]
      const rho0 = Math.max(rho, 0.07)
      const u2 = u * u
      for (let i = 0; i < nv; i++) {
        const v = vArr[i]
        const av = Math.abs(v)
        const l = v * w

        // dịch chuyển theo pháp tuyến của gân giữa n = (cos α, -sin α)
        const ripple = rippleK * Math.pow(u, 2.5) * Math.sin(v * Math.PI * spec.rippleFreq + spec.ripplePhase)
        const d = -cup * 0.22 * v * v * Math.pow(u, 0.8) + roll * 0.36 * Math.pow(av, 4) * u2 + ripple
        const r = rho + d * ca
        const yy = rowY[j] - d * sa

        // bọc quanh trục (wrap) hoặc trải phẳng theo tiếp tuyến
        const dw = 1.7 * Math.tanh(l / (1.7 * rho0))
        const rWrap = r * Math.cos(dw)
        const tWrap = r * Math.sin(dw)
        const rad = mix(r, rWrap, wrap)
        const tan = mix(l, tWrap, wrap)

        const px = rad * cosA - tan * sinA
        const pz = rad * sinA + tan * cosA
        const o = (j * nv + i) * 3
        pos[o] = px
        pos[o + 1] = yy
        pos[o + 2] = pz
        if (j === mj && i === nv >> 1) {
          cx = px
          cy = yy
          cz = pz
        }
      }
    }
    this.centroid.set(cx, cy, cz)
    const attr = this.geometry.getAttribute('position') as BufferAttribute
    attr.needsUpdate = true
    this.geometry.computeVertexNormals()
  }

  /**
   * Tính sẵn K tư thế nở (0 → 1) và gắn thành morph target. Từ đó trở đi việc nở chỉ là pha trộn
   * hai tư thế gần nhất ngay trên GPU, CPU không phải dựng lại hình học mỗi khung hình.
   */
  bake(K: number) {
    const posT: BufferAttribute[] = []
    const nrmT: BufferAttribute[] = []
    this.keyCentroids = []
    const nrm = this.geometry.getAttribute('normal') as BufferAttribute
    for (let k = 0; k < K; k++) {
      this.update(k / (K - 1), true)
      posT.push(new BufferAttribute(Float32Array.from(this.pos), 3))
      nrmT.push(new BufferAttribute(Float32Array.from(nrm.array as Float32Array), 3))
      this.keyCentroids.push(this.centroid.clone())
    }
    this.geometry.morphAttributes.position = posT
    this.geometry.morphAttributes.normal = nrmT
    this.geometry.morphTargetsRelative = false
    this.update(0, true)
    this.morphK = K
  }

  get baked() {
    return this.morphK > 0
  }

  /** pb: tiến độ nở cục bộ 0..1. Đặt trọng số cho hai morph target gần nhất. */
  setMorph(pb: number, mesh: Mesh) {
    const inf = mesh.morphTargetInfluences
    if (!inf || !this.morphK) return
    const K = this.morphK
    const x = Math.min(1, Math.max(0, pb)) * (K - 1)
    const i = Math.min(K - 2, Math.floor(x))
    const f = x - i
    inf.fill(0)
    inf[i] = 1 - f
    inf[i + 1] = f
    this.centroid.lerpVectors(this.keyCentroids[i], this.keyCentroids[i + 1], f)
  }

  dispose() {
    this.geometry.dispose()
  }
}
