import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, Color, DoubleSide, Group, InstancedMesh, MeshBasicMaterial, Object3D, TorusGeometry } from 'three'
import { PetalSurface } from '../rose/RoseGeometry'
import { createGlassMaterial } from '../rose/RoseMaterials'
import type { PetalSpec } from '../rose/RoseParameters'
import type { SceneState } from '../experience/ExperienceState'
import { useReducedMotion } from '../rose/useReducedMotion'
import { palette } from '../config/theme'
import { mulberry32 } from '../utils/seededRandom'

// Trang trí quanh bông hoa, nhiều màu để cân bằng với màu hồng của hoa:
//   - cánh hoa thủy tinh nhiều màu bay lượn theo quỹ đạo
//   - hai vòng sáng mảnh nghiêng, xoay rất chậm
// Mọi thứ xuất hiện dần khi hoa nở.

const COLORS = [palette.lavender, palette.iceBlue, palette.gold, palette.pearlPink, palette.peach, palette.pearlWhite]

const SMALL_PETAL: PetalSpec = {
  kind: 'outer',
  index: 0,
  depth: 0.7,
  azimuth: 0,
  baseRadius: 0,
  baseHeight: 0,
  length: 0.5,
  width: 0.4,
  tilt: [0.5, 0.5],
  bend: [0.45, 0.45],
  wrap: [0.55, 0.55],
  roll: [0.3, 0.3],
  cup: [0.4, 0.4],
  rippleAmp: 0.01,
  rippleFreq: 2.4,
  ripplePhase: 1,
  delay: 0,
  span: 1,
  tone: 0.5,
  alphaBias: 0,
}

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

export default function Ornaments({ state, count }: { state: SceneState; count: number }) {
  const reduced = useReducedMotion()
  const mesh = useRef<InstancedMesh>(null)
  const rings = useRef<Group>(null)
  const dummy = useMemo(() => new Object3D(), [])

  const { geometry, material, uniforms, items } = useMemo(() => {
    const petal = new PetalSurface(SMALL_PETAL, 12, 10)
    petal.update(1, true)
    // màu đỉnh trắng để màu từng cánh (instanceColor) quyết định, giữ độ trong theo đỉnh
    const col = petal.geometry.getAttribute('color') as BufferAttribute
    for (let i = 0; i < col.count; i++) col.setXYZ(i, 1, 1, 1)
    petal.geometry.translate(0, -0.2, 0)
    const g = createGlassMaterial()
    const rnd = mulberry32(99)
    const items = Array.from({ length: count }, (_, i) => ({
      radius: 1.9 + rnd() * 1.7,
      angle: rnd() * Math.PI * 2,
      speed: (0.07 + rnd() * 0.12) * (rnd() < 0.5 ? -1 : 1),
      height: (rnd() - 0.35) * 2.6,
      bob: rnd() * 6.28,
      tumble: [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28] as [number, number, number],
      spin: [0.2 + rnd() * 0.5, 0.15 + rnd() * 0.4, 0.1 + rnd() * 0.3] as [number, number, number],
      scale: 0.38 + rnd() * 0.5,
      color: new Color(COLORS[i % COLORS.length]),
      delay: rnd() * 0.5,
      // một nửa số cánh rơi chậm từ trên xuống rồi hiện lại ở trên (như cánh hoa rụng nhưng không bao giờ hết)
      fall: i % 2 === 1,
      fallSpeed: 0.1 + rnd() * 0.14,
      fallOff: rnd() * 4.6,
      sway: 0.2 + rnd() * 0.35,
    }))
    return { geometry: petal.geometry, material: g.material, uniforms: g.uniforms, items }
  }, [count])

  const ringMat = useMemo(
    () => new MeshBasicMaterial({ color: palette.lavender, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
    [],
  )
  const ringMat2 = useMemo(
    () => new MeshBasicMaterial({ color: palette.iceBlue, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
    [],
  )
  const ringGeo = useMemo(() => new TorusGeometry(1, 0.0028, 8, 220), [])

  useEffect(() => {
    const m = mesh.current
    if (!m) return
    items.forEach((it, i) => m.setColorAt(i, it.color))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [items])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
      ringGeo.dispose()
      ringMat.dispose()
      ringMat2.dispose()
    },
    [geometry, material, ringGeo, ringMat, ringMat2],
  )

  useFrame((s) => {
    const t = s.clock.elapsedTime
    const m = mesh.current
    uniforms.uReveal.value = state.reveal
    uniforms.uGlow.value = 0.3 + state.warm * 0.4
    uniforms.uTime.value = t
    const show = smooth((state.bloom - 0.1) / 0.6) // hiện dần khi hoa nở
    const calm = reduced ? 0 : 1
    if (m) {
      items.forEach((it, i) => {
        const a = it.angle + t * it.speed * calm
        const k = smooth((show - it.delay) / (1 - it.delay + 0.001))
        let y = 0.3 + it.height + Math.sin(t * 0.5 + it.bob) * 0.08 * calm
        let fade = 1
        let rad = it.radius
        if (it.fall) {
          const h = 2.5 - ((t * it.fallSpeed * calm + it.fallOff) % 4.6)
          y = h
          fade = smooth(Math.min(h + 2.0, 2.5 - h) / 0.6)
          rad = it.radius + Math.sin(t * 0.6 + it.bob) * it.sway * calm
        }
        dummy.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad)
        dummy.rotation.set(it.tumble[0] + t * it.spin[0] * calm, it.tumble[1] + t * it.spin[1] * calm, it.tumble[2] + t * it.spin[2] * calm)
        dummy.scale.setScalar(it.scale * k * fade * (0.6 + 0.4 * state.reveal))
        dummy.updateMatrix()
        m.setMatrixAt(i, dummy.matrix)
      })
      m.instanceMatrix.needsUpdate = true
    }
    if (rings.current) {
      rings.current.rotation.y = t * 0.11 * calm
      ringMat.opacity = 0.13 * show
      ringMat2.opacity = 0.09 * show
    }
  })

  return (
    <>
      <instancedMesh ref={mesh} args={[geometry, material, count]} frustumCulled={false} renderOrder={1500} />
      <group ref={rings} position={[0, 0.4, 0]}>
        <mesh geometry={ringGeo} material={ringMat} scale={1.95} rotation={[1.22, 0.1, 0.32]} frustumCulled={false} renderOrder={1400} />
        <mesh geometry={ringGeo} material={ringMat2} scale={2.4} rotation={[1.42, -0.2, -0.45]} frustumCulled={false} renderOrder={1400} />
      </group>
    </>
  )
}
