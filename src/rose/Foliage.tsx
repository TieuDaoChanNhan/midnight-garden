import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CatmullRomCurve3, Color, Group, Material, Mesh, Quaternion, SphereGeometry, TubeGeometry, Vector3 } from 'three'
import { PetalSurface } from './RoseGeometry'
import type { PetalSpec } from './RoseParameters'
import { paint } from '../utils/paint'
import { palette } from '../config/theme'
import { useReducedMotion } from './useReducedMotion'

// Phần "dưới đáy": lá thủy tinh màu bạc hà/xanh băng dọc thân, hai nhánh phụ cong ra hai bên
// mang búp hoa nhỏ màu hồng ruby. Tất cả dùng chung vật liệu kính với bông hoa chính.

const LEAF: PetalSpec = {
  kind: 'sepal',
  index: 0,
  depth: 1,
  azimuth: 0,
  baseRadius: 0,
  baseHeight: 0,
  length: 0.8,
  width: 0.36,
  tilt: [1.0, 1.0],
  bend: [0.55, 0.55],
  wrap: [0.1, 0.1],
  roll: [0.15, 0.15],
  cup: [0.55, 0.55],
  rippleAmp: 0.01,
  rippleFreq: 2.4,
  ripplePhase: 0,
  delay: 0,
  span: 1,
  tone: 0.5,
  alphaBias: 0,
}

const LEAVES = [
  { y: -0.6, az: 0.5, s: 0.78 },
  { y: -0.98, az: 3.6, s: 0.98 },
  { y: -1.42, az: 2.05, s: 1.08 },
  { y: -1.78, az: 5.3, s: 0.88 },
]

const BRANCHES = [
  { az: 2.45, y0: -1.12, reach: 1.15, rise: 1.25, budScale: 1 },
  { az: 5.55, y0: -1.5, reach: 0.95, rise: 0.95, budScale: 0.85 },
]

export default function Foliage({ material, nu, nv }: { material: Material; nu: number; nv: number }) {
  const reduced = useReducedMotion()
  const leafRefs = useRef<(Mesh | null)[]>([])
  const branchRefs = useRef<(Group | null)[]>([])

  const data = useMemo(() => {
    const mint = new Color(palette.mint)
    const ice = new Color(palette.iceBlue)
    const lav = new Color(palette.lavender)
    const pearl = new Color(palette.pearlWhite)
    const rose = new Color(palette.roseDeep)
    const pink = new Color(palette.pearlPink)

    const leaf = new PetalSurface(LEAF, Math.max(12, nu - 8), Math.max(8, nv - 8))
    leaf.update(1, true)
    paint(leaf.geometry, (x, y, z) => {
      const d = Math.min(1, Math.hypot(x, y, z) / 0.95)
      return [mint.clone().lerp(ice, d * 0.7).lerp(pearl, d * d * 0.5), 0.88 - 0.42 * d]
    })

    const branches = BRANCHES.map((b) => {
      const cx = Math.cos(b.az)
      const cz = Math.sin(b.az)
      const pts = [
        new Vector3(0, 0, 0),
        new Vector3(0.35 * b.reach * cx, 0.25 * b.rise, 0.35 * b.reach * cz),
        new Vector3(0.8 * b.reach * cx, 0.7 * b.rise, 0.8 * b.reach * cz),
        new Vector3(b.reach * cx, b.rise, b.reach * cz),
      ]
      const curve = new CatmullRomCurve3(pts)
      const stem = paint(new TubeGeometry(curve, 40, 0.017, 8), (_x, y) => [lav.clone().lerp(mint, 0.5 + y * 0.1), 0.8])
      const tangent = curve.getTangent(1).normalize()
      const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), tangent)
      const bud = paint(new SphereGeometry(1, 22, 14), (_x, y) => [pink.clone().lerp(rose, Math.min(1, Math.max(0, 0.5 + y * 0.6))), 0.92])
      const midLeafPos = curve.getPoint(0.55)
      return { ...b, stem, bud, tip: pts[3], q, midLeafPos }
    })
    return { leaf: leaf.geometry, branches }
  }, [nu, nv])

  useEffect(
    () => () => {
      data.leaf.dispose()
      data.branches.forEach((b) => {
        b.stem.dispose()
        b.bud.dispose()
      })
    },
    [data],
  )

  // gió nhẹ: lá và nhánh khẽ đung đưa
  useFrame((s) => {
    if (reduced) return
    const t = s.clock.elapsedTime
    leafRefs.current.forEach((m, i) => {
      if (m) m.rotation.z = Math.sin(t * 0.7 + i * 1.7) * 0.05
    })
    branchRefs.current.forEach((g, i) => {
      if (g) g.rotation.z = Math.sin(t * 0.55 + i * 2.1) * 0.035
    })
  })

  return (
    <group>
      {LEAVES.map((l, i) => (
        <mesh
          key={i}
          ref={(m) => {
            leafRefs.current[i] = m
          }}
          geometry={data.leaf}
          material={material}
          position={[0, l.y, 0]}
          rotation={[0, l.az, 0]}
          scale={l.s}
          frustumCulled={false}
        />
      ))}
      {data.branches.map((b, i) => (
        <group
          key={i}
          ref={(g) => {
            branchRefs.current[i] = g
          }}
          position={[0, b.y0, 0]}
        >
          <mesh geometry={b.stem} material={material} frustumCulled={false} />
          <mesh geometry={b.bud} material={material} position={b.tip} quaternion={b.q} scale={[0.12 * b.budScale, 0.19 * b.budScale, 0.12 * b.budScale]} frustumCulled={false} />
          <mesh geometry={data.leaf} material={material} position={b.midLeafPos} rotation={[0, b.az + 1.2, 0]} scale={0.42} frustumCulled={false} />
        </group>
      ))}
    </group>
  )
}
