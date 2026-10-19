import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Group, Material, Mesh, MeshBasicMaterial, Quaternion, SphereGeometry, Vector3 } from 'three'
import { BloomController, type SortItem } from './BloomController'
import { smootherstep } from './RoseGeometry'
import type { RoseParams } from './RoseParameters'
import type { SceneState } from '../experience/ExperienceState'
import { useReducedMotion } from './useReducedMotion'
import { paint } from '../utils/paint'
import { palette } from '../config/theme'

// Một bông hồng hoàn chỉnh (các cánh xoắn ốc + đài hoa + lõi sáng tuỳ chọn).
// Dùng cho bông chính và hai bông phụ trong bó; danh sách vẽ được gom chung ở `sorter`.

export interface Sorter {
  items: SortItem[]
  dirty: boolean
}

interface Props {
  params: RoseParams
  nu: number
  nv: number
  position: Vector3
  quaternion?: Quaternion
  scale: number
  material: Material
  /** đổi mức nở chung của cả bó thành mức nở riêng của bông này (để nở so le) */
  bloomMap: (b: number) => number
  state: SceneState
  sorter: Sorter
  debugBloom: number | null
  coreMat?: MeshBasicMaterial
}

const Y_AXIS = new Vector3(0, 1, 0)
const tmpQ = new Quaternion()
const tmpAxis = new Vector3()

export default function RoseBloom({ params, nu, nv, position, quaternion, scale, material, bloomMap, state, sorter, debugBloom, coreMat }: Props) {
  const reduced = useReducedMotion()
  const group = useRef<Group>(null)
  const meshes = useRef<Mesh[]>([])
  const receptacle = useRef<Mesh>(null)
  const glow = useRef<Mesh>(null)
  const ctl = useMemo(() => new BloomController(params, nu, nv), [params, nu, nv])

  const geo = useMemo(() => {
    const pearl = new Color(palette.pearlPink)
    const lav = new Color(palette.lavender)
    return {
      receptacle: paint(new SphereGeometry(1, 24, 16), (_x, y) => [pearl.clone().lerp(lav, 0.3 + y * 0.2), 0.85]),
      glow: new SphereGeometry(0.16, 20, 14),
    }
  }, [])

  useEffect(() => {
    const g = group.current
    if (!g) return
    const own: SortItem[] = ctl.surfaces.map((s, i) => ({
      group: g,
      centroid: s.centroid,
      dist: 0,
      apply: (rank) => {
        const m = meshes.current[i]
        if (m) m.renderOrder = rank
      },
    }))
    own.push({ group: g, centroid: new Vector3(0, -0.1, 0), dist: 0, apply: (r) => receptacle.current && (receptacle.current.renderOrder = r) })
    if (coreMat) own.push({ group: g, centroid: new Vector3(0, 0.32, 0), dist: 0, apply: (r) => glow.current && (glow.current.renderOrder = r) })
    sorter.items.push(...own)
    sorter.dirty = true
    return () => {
      sorter.items = sorter.items.filter((it) => !own.includes(it))
      ctl.dispose()
      geo.receptacle.dispose()
      geo.glow.dispose()
    }
  }, [ctl, sorter, coreMat, geo])

  useFrame((s) => {
    const t = s.clock.elapsedTime
    const b = bloomMap(debugBloom ?? state.bloom)
    if (ctl.setBloom(b)) sorter.dirty = true

    // Sau khi nở xong, mỗi cánh khẽ đập nhẹ quanh gốc (xoay cả mesh, không dựng lại hình học)
    const flutter = reduced ? 0 : smootherstep((b - 0.88) / 0.12) * state.idle
    if (flutter > 0.001) {
      for (let i = 0; i < ctl.surfaces.length; i++) {
        const sp = ctl.surfaces[i].spec
        const m = meshes.current[i]
        if (!m || sp.kind === 'sepal') continue
        const amp = flutter * (0.006 + 0.022 * sp.depth)
        const ang = amp * Math.sin(t * (0.8 + 0.25 * sp.tone) + i * 0.83)
        tmpAxis.set(-Math.sin(sp.azimuth), 0, Math.cos(sp.azimuth))
        tmpQ.setFromAxisAngle(tmpAxis, ang)
        m.quaternion.copy(tmpQ)
        m.quaternion.multiply(tmpQ.setFromAxisAngle(Y_AXIS, ang * 0.6))
      }
    }

    if (coreMat) {
      const pulse = reduced ? 1 : 1 + 0.16 * Math.sin(t * 1.3)
      coreMat.opacity = state.light * 0.5 * (1 - 0.8 * b) * pulse
      if (glow.current) glow.current.scale.setScalar((0.7 + b * 0.5 + state.light * 0.3) * (reduced ? 1 : 1 + 0.05 * Math.sin(t * 1.3)))
    }
  })

  return (
    <group ref={group} position={position} quaternion={quaternion} scale={scale}>
      {ctl.surfaces.map((s, i) => (
        <mesh
          key={i}
          ref={(m) => {
            if (m) meshes.current[i] = m
          }}
          geometry={s.geometry}
          material={material}
          frustumCulled={false}
        />
      ))}
      <mesh ref={receptacle} geometry={geo.receptacle} material={material} position={[0, -0.1, 0]} scale={[0.17, 0.22, 0.17]} frustumCulled={false} />
      {coreMat && <mesh ref={glow} geometry={geo.glow} material={coreMat} position={[0, 0.32, 0]} frustumCulled={false} />}
    </group>
  )
}
