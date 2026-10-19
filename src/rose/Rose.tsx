import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CatmullRomCurve3, Color, Group, Mesh, TubeGeometry, Vector3 } from 'three'
import { useReducedMotion } from './useReducedMotion'
import { sortByDistance } from './BloomController'
import { smootherstep } from './RoseGeometry'
import { createClayMaterial, createCoreGlowMaterial, createGlassMaterial } from './RoseMaterials'
import { createRoseParams } from './RoseParameters'
import RoseBloom, { type Sorter } from './RoseBloom'
import Foliage from './Foliage'
import { BRANCHES, branchFlowerPose } from './foliageConfig'
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
const ORIGIN = new Vector3(0, 0, 0)

// Một bó ba bông nở cùng nhau: bông chính ở giữa, hai bông nhỏ hơn trên hai nhánh phụ.
export default function Rose({ state, tier, clay, debugBloom, groupRef, onTap }: Props) {
  const reduced = useReducedMotion()
  const params = useMemo(() => createRoseParams(NICK), [])
  const sideParams = useMemo(() => BRANCHES.map((b) => createRoseParams(`${NICK}-${b.salt}`, b.petals)), [])
  const poses = useMemo(() => BRANCHES.map(branchFlowerPose), [])
  const glass = useMemo(() => createGlassMaterial(), [])
  const clayMat = useMemo(() => createClayMaterial(), [])
  const coreMat = useMemo(() => createCoreGlowMaterial(), [])
  const sorter = useMemo<Sorter>(() => ({ items: [], dirty: true }), [])

  // thân hoa kéo dài xuống tận mặt nước, hơi uốn, đậm dần về phía đáy
  const stemGeo = useMemo(() => {
    const pearl = new Color(palette.pearlPink)
    const lav = new Color(palette.lavender)
    const mint = new Color(palette.mint)
    const curve = new CatmullRomCurve3([
      new Vector3(0, -0.12, 0),
      new Vector3(0.04, -0.7, 0.05),
      new Vector3(-0.05, -1.35, -0.03),
      new Vector3(0.03, -1.8, 0.02),
      new Vector3(0, POOL_Y - 0.05, 0),
    ])
    return paint(new TubeGeometry(curve, 64, 0.034, 10), (_x, y) => {
      const k = Math.min(1, Math.max(0, (-y - 0.2) / 1.8))
      const a = 0.9 * Math.min(1, Math.max(0, (y - (POOL_Y - 0.08)) / 0.28 + 0.1))
      return [lav.clone().lerp(mint, 0.15 + 0.5 * k).lerp(pearl, 0.25 * (1 - k)), a]
    })
  }, [])
  const stemRef = useRef<Mesh>(null)
  const frame = useRef(0)

  useEffect(() => {
    const g = groupRef.current
    if (!g) return
    const item = { group: g, centroid: new Vector3(0, -1.4, 0), dist: 0, apply: (r: number) => stemRef.current && (stemRef.current.renderOrder = r) }
    sorter.items.push(item)
    return () => {
      sorter.items = sorter.items.filter((it) => it !== item)
      stemGeo.dispose()
    }
  }, [sorter, groupRef, stemGeo])

  useFrame((s, dt) => {
    const g = groupRef.current
    if (!g) return
    const t = s.clock.elapsedTime
    // chuyển động nhẹ khi nghỉ: xoay chậm + lơ lửng
    if (!reduced) {
      g.rotation.y += dt * 0.07 * state.idle
      g.position.y = Math.sin(t * 0.6) * 0.04 * state.idle
    }
    glass.uniforms.uReveal.value = debugBloom !== null ? 1 : state.reveal
    glass.uniforms.uGlow.value = 0.35 + state.light * 0.9 + state.warm * 0.4
    glass.uniforms.uTime.value = t

    // sắp xếp thứ tự vẽ (xa → gần) cho toàn bộ cánh của cả bó
    frame.current++
    if (sorter.dirty || frame.current % 6 === 0) {
      g.updateMatrixWorld(true)
      sortByDistance(sorter.items, s.camera)
      sorter.dirty = false
    }
  })

  const mat = clay ? clayMat : glass.material
  return (
    <group ref={groupRef}>
      <RoseBloom
        params={params}
        nu={tier.nu}
        nv={tier.nv}
        position={ORIGIN}
        scale={1}
        material={mat}
        bloomMap={(b) => b}
        state={state}
        sorter={sorter}
        debugBloom={debugBloom}
        coreMat={coreMat}
      />
      {BRANCHES.map((b, i) => (
        <RoseBloom
          key={b.salt}
          params={sideParams[i]}
          nu={Math.max(14, Math.round(tier.nu * 0.7))}
          nv={Math.max(10, Math.round(tier.nv * 0.7))}
          position={poses[i].position}
          quaternion={poses[i].quaternion}
          scale={b.scale}
          material={mat}
          bloomMap={(x) => smootherstep((x - b.bloomFrom) / (1 - b.bloomFrom))}
          state={state}
          sorter={sorter}
          debugBloom={debugBloom}
        />
      ))}
      <mesh ref={stemRef} geometry={stemGeo} material={mat} frustumCulled={false} />
      <Foliage material={mat} nu={tier.nu} nv={tier.nv} />
      {/* vùng chạm hào phóng quanh bó hoa */}
      <mesh
        position={[0, 0.2, 0]}
        onClick={(e) => {
          if (e.delta > 8) return // đang kéo, không phải chạm
          onTap()
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <sphereGeometry args={[1.3, 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
    </group>
  )
}
