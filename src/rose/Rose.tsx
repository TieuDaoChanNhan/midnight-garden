import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CatmullRomCurve3, Color, Group, Mesh, Quaternion, SphereGeometry, TubeGeometry, Vector3 } from 'three'
import { useReducedMotion } from './useReducedMotion'
import { BloomController, sortByDistance, type SortItem } from './BloomController'
import { smootherstep } from './RoseGeometry'
import { createClayMaterial, createCoreGlowMaterial, createGlassMaterial } from './RoseMaterials'
import { createRoseParams } from './RoseParameters'
import Foliage from './Foliage'
import type { SceneState } from '../experience/ExperienceState'
import type { TierSettings } from '../utils/qualityManager'
import { paint } from '../utils/paint'
import { palette } from '../config/theme'
import { NICK } from '../config/content'

interface Props {
  state: SceneState
  tier: TierSettings
  clay: boolean
  debugBloom: number | null
  groupRef: React.RefObject<Group | null>
  onTap: () => void
}

export const POOL_Y = -2.0 // mặt nước phát sáng dưới chân hoa

const Y_AXIS = new Vector3(0, 1, 0)
const tmpQ = new Quaternion()
const tmpAxis = new Vector3()

export default function Rose({ state, tier, clay, debugBloom, groupRef, onTap }: Props) {
  const reduced = useReducedMotion()
  const params = useMemo(() => createRoseParams(NICK), [])
  const glass = useMemo(() => createGlassMaterial(), [])
  const clayMat = useMemo(() => createClayMaterial(), [])
  const coreMat = useMemo(() => createCoreGlowMaterial(), [])
  const bloom = useMemo(() => new BloomController(params, tier.nu, tier.nv), [params, tier.nu, tier.nv])

  const extras = useMemo(() => {
    const pearl = new Color(palette.pearlPink)
    const lav = new Color(palette.lavender)
    const mint = new Color(palette.mint)
    const receptacle = paint(new SphereGeometry(1, 28, 18), (x, y) => [pearl.clone().lerp(lav, 0.3 + y * 0.2), 0.85])
    // thân hoa kéo dài xuống tận mặt nước, hơi uốn, đậm dần về phía đáy
    const curve = new CatmullRomCurve3([
      new Vector3(0, -0.12, 0),
      new Vector3(0.04, -0.7, 0.05),
      new Vector3(-0.05, -1.35, -0.03),
      new Vector3(0.03, -1.8, 0.02),
      new Vector3(0, POOL_Y - 0.05, 0),
    ])
    const stem = paint(new TubeGeometry(curve, 64, 0.034, 10), (_x, y) => {
      const k = Math.min(1, Math.max(0, (-y - 0.2) / 1.8))
      const a = 0.9 * Math.min(1, Math.max(0, (y - (POOL_Y - 0.08)) / 0.28 + 0.1))
      return [lav.clone().lerp(mint, 0.15 + 0.5 * k).lerp(pearl, 0.25 * (1 - k)), a]
    })
    const glow = new SphereGeometry(0.16, 20, 14)
    return { receptacle, stem, glow }
  }, [])

  const meshes = useRef<Mesh[]>([])
  const receptacleRef = useRef<Mesh>(null)
  const stemRef = useRef<Mesh>(null)
  const glowRef = useRef<Mesh>(null)
  const items = useRef<SortItem[]>([])
  const frame = useRef(0)

  useEffect(() => {
    // danh sách sắp xếp: cánh + đài hoa + cuống + lõi sáng
    const list: SortItem[] = bloom.surfaces.map((s, i) => ({
      centroid: s.centroid,
      dist: 0,
      apply: (rank) => {
        const m = meshes.current[i]
        if (m) m.renderOrder = rank
      },
    }))
    const fixed = (ref: React.RefObject<Mesh | null>, c: Vector3, bias: number): SortItem => ({
      centroid: c,
      dist: 0,
      apply: (rank) => {
        if (ref.current) ref.current.renderOrder = rank + bias
      },
    })
    list.push(fixed(receptacleRef, new Vector3(0, -0.1, 0), 0))
    list.push(fixed(stemRef, new Vector3(0, -1.4, 0), 0))
    list.push(fixed(glowRef, new Vector3(0, 0.32, 0), 0))
    items.current = list
    return () => bloom.dispose()
  }, [bloom])

  useFrame((s, dt) => {
    const g = groupRef.current
    if (!g) return
    const t = s.clock.elapsedTime
    const b = debugBloom ?? state.bloom
    const changed = bloom.setBloom(b)

    // chuyển động nhẹ khi nghỉ: xoay chậm + lơ lửng
    if (!reduced) {
      g.rotation.y += dt * 0.07 * state.idle
      g.position.y = Math.sin(t * 0.6) * 0.04 * state.idle
    }

    // Sau khi nở xong hoa vẫn "thở": mỗi cánh khẽ đập nhẹ quanh gốc, không cần dựng lại hình học
    const flutter = reduced ? 0 : smootherstep((b - 0.88) / 0.12) * state.idle
    if (flutter > 0.001) {
      for (let i = 0; i < bloom.surfaces.length; i++) {
        const sp = bloom.surfaces[i].spec
        const m = meshes.current[i]
        if (!m || sp.kind === 'sepal') continue
        const amp = flutter * (0.006 + 0.022 * sp.depth)
        const ang = amp * Math.sin(t * (0.8 + 0.25 * sp.tone) + i * 0.83)
        tmpAxis.set(-Math.sin(sp.azimuth), 0, Math.cos(sp.azimuth)) // trục tiếp tuyến
        tmpQ.setFromAxisAngle(tmpAxis, ang)
        m.quaternion.copy(tmpQ)
        m.quaternion.multiply(tmpQ.setFromAxisAngle(Y_AXIS, ang * 0.6))
      }
    }

    // uniform vật liệu
    glass.uniforms.uReveal.value = debugBloom !== null ? 1 : state.reveal
    glass.uniforms.uGlow.value = 0.35 + state.light * 0.9 + state.warm * 0.4
    glass.uniforms.uTime.value = t
    const pulse = reduced ? 1 : 1 + 0.16 * Math.sin(t * 1.3)
    coreMat.opacity = state.light * 0.5 * (1 - 0.8 * b) * pulse
    if (glowRef.current) glowRef.current.scale.setScalar((0.7 + b * 0.5 + state.light * 0.3) * (reduced ? 1 : 1 + 0.05 * Math.sin(t * 1.3)))

    // sắp xếp thứ tự vẽ (không cần mỗi frame)
    frame.current++
    if (changed || frame.current % 6 === 0) {
      g.updateMatrixWorld()
      sortByDistance(items.current, s.camera, (v) => g.localToWorld(v))
    }
  })

  const mat = clay ? clayMat : glass.material
  return (
    <group ref={groupRef}>
      {bloom.surfaces.map((s, i) => (
        <mesh
          key={i}
          ref={(m) => {
            if (m) meshes.current[i] = m
          }}
          geometry={s.geometry}
          material={mat}
          frustumCulled={false}
        />
      ))}
      <mesh ref={receptacleRef} geometry={extras.receptacle} material={mat} position={[0, -0.1, 0]} scale={[0.17, 0.22, 0.17]} frustumCulled={false} />
      <mesh ref={stemRef} geometry={extras.stem} material={mat} frustumCulled={false} />
      <mesh ref={glowRef} geometry={extras.glow} material={coreMat} position={[0, 0.32, 0]} frustumCulled={false} />
      <Foliage material={mat} nu={tier.nu} nv={tier.nv} />
      {/* vùng chạm hào phóng quanh bông hoa */}
      <mesh
        position={[0, 0.5, 0]}
        onClick={(e) => {
          if (e.delta > 8) return // đang kéo, không phải chạm
          onTap()
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <sphereGeometry args={[0.85, 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
    </group>
  )
}
