import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  Group,
  Mesh,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import { useReducedMotion } from './useReducedMotion'
import { BloomController, sortByDistance, type SortItem } from './BloomController'
import { createClayMaterial, createCoreGlowMaterial, createGlassMaterial } from './RoseMaterials'
import { createRoseParams } from './RoseParameters'
import type { SceneState } from '../experience/ExperienceState'
import type { TierSettings } from '../utils/qualityManager'
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

// Thêm thuộc tính màu RGBA cho hình phụ (đài hoa, cuống) theo hàm màu.
function paint(geo: BufferGeometry, fn: (x: number, y: number, z: number) => [Color, number]): BufferGeometry {
  const p = geo.getAttribute('position')
  const out = new Float32Array(p.count * 4)
  for (let i = 0; i < p.count; i++) {
    const [c, a] = fn(p.getX(i), p.getY(i), p.getZ(i))
    out.set([c.r, c.g, c.b, a], i * 4)
  }
  geo.setAttribute('color', new BufferAttribute(out, 4))
  return geo
}

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
    const receptacle = paint(new SphereGeometry(1, 28, 18), (x, y) => [pearl.clone().lerp(lav, 0.3 + y * 0.2), 0.85])
    const curve = new CatmullRomCurve3([new Vector3(0, -0.12, 0), new Vector3(0.03, -0.9, 0.04), new Vector3(-0.04, -1.8, -0.03), new Vector3(0, -2.9, 0)])
    const stem = paint(new TubeGeometry(curve, 48, 0.032, 10), (_x, y) => [lav.clone().lerp(pearl, 0.4), Math.max(0, 0.75 * Math.max(0, 1 + y / 2.4) ** 3)])
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
    const b = debugBloom ?? state.bloom
    const changed = bloom.setBloom(b)

    // chuyển động nhẹ khi nghỉ: xoay chậm + lơ lửng
    if (!reduced) {
      g.rotation.y += dt * 0.07 * state.idle
      g.position.y = Math.sin(s.clock.elapsedTime * 0.6) * 0.04 * state.idle
    }

    // uniform vật liệu
    glass.uniforms.uReveal.value = debugBloom !== null ? 1 : state.reveal
    glass.uniforms.uGlow.value = 0.35 + state.light * 0.9 + state.warm * 0.4
    coreMat.opacity = state.light * 0.5 * (1 - 0.8 * b)
    if (glowRef.current) glowRef.current.scale.setScalar(0.7 + b * 0.5 + state.light * 0.3)

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
