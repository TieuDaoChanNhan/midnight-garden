import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, Mesh, MeshBasicMaterial, RingGeometry, SRGBColorSpace } from 'three'
import type { SceneState } from '../experience/ExperienceState'
import { POOL_Y } from '../rose/Rose'
import { createSparkMaterial, SPARK_COLORS, useSparkUniforms } from './sparkMaterial'
import { palette } from '../config/theme'
import { mulberry32 } from '../utils/seededRandom'
import { useReducedMotion } from '../rose/useReducedMotion'

// "Mặt nước" phát sáng dưới chân hoa: quầng sáng hồng-tím, những vòng gợn lan ra,
// và những đốm lấp lánh trên mặt. Rẻ: vài mesh cộng sáng, không có phản chiếu thật.

export default function Base({ state, sparkles }: { state: SceneState; sparkles: number }) {
  const reduced = useReducedMotion()
  const floor = useRef<Mesh>(null)
  const rippleRefs = useRef<(Mesh | null)[]>([])

  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    grad.addColorStop(0, 'rgba(242,183,213,0.75)')
    grad.addColorStop(0.3, 'rgba(184,164,238,0.34)')
    grad.addColorStop(0.65, 'rgba(157,218,232,0.1)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 256, 256)
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    return t
  }, [])

  const floorMat = useMemo(() => new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }), [tex])
  const ringGeo = useMemo(() => new RingGeometry(0.97, 1, 128), [])
  const ringMats = useMemo(
    () =>
      [palette.pearlPink, palette.lavender, palette.iceBlue].map(
        (c) => new MeshBasicMaterial({ color: c, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
      ),
    [],
  )

  const spark = useMemo(() => createSparkMaterial(), [])
  useSparkUniforms(spark, state)
  const sparkData = useMemo(() => {
    const rnd = mulberry32(31)
    const pos = new Float32Array(sparkles * 3)
    const size = new Float32Array(sparkles)
    const alpha = new Float32Array(sparkles)
    const color = new Float32Array(sparkles * 3)
    const ph = new Float32Array(sparkles)
    for (let i = 0; i < sparkles; i++) {
      const r = Math.sqrt(rnd()) * 3.4
      const a = rnd() * Math.PI * 2
      pos.set([Math.cos(a) * r, POOL_Y + 0.02 + rnd() * 0.05, Math.sin(a) * r], i * 3)
      size[i] = 0.025 + rnd() * 0.05
      ph[i] = rnd() * 6.28
      color.set(SPARK_COLORS[Math.floor(rnd() * SPARK_COLORS.length)], i * 3)
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(pos, 3))
    geo.setAttribute('aSize', new BufferAttribute(size, 1))
    geo.setAttribute('aAlpha', new BufferAttribute(alpha, 1))
    geo.setAttribute('aColor', new BufferAttribute(color, 3))
    return { geo, alpha, ph }
  }, [sparkles])

  useEffect(
    () => () => {
      tex.dispose()
      floorMat.dispose()
      ringGeo.dispose()
      ringMats.forEach((m) => m.dispose())
      spark.dispose()
      sparkData.geo.dispose()
    },
    [tex, floorMat, ringGeo, ringMats, spark, sparkData],
  )

  useFrame((s) => {
    const t = s.clock.elapsedTime
    const k = state.reveal
    const calm = reduced ? 0 : 1
    floorMat.opacity = (0.26 + 0.09 * Math.sin(t * 0.7) * calm + 0.14 * state.warm) * k
    rippleRefs.current.forEach((m, i) => {
      if (!m) return
      const p = (t * 0.17 * calm + i / 3) % 1
      m.scale.setScalar(0.25 + p * 2.7)
      ringMats[i].opacity = Math.pow(1 - p, 1.6) * 0.24 * k * (0.5 + 0.5 * Math.min(1, state.bloom * 2))
    })
    const { alpha, ph } = sparkData
    for (let i = 0; i < alpha.length; i++) alpha[i] = (0.2 + 0.8 * Math.pow(0.5 + 0.5 * Math.sin(t * 1.4 + ph[i]), 3)) * 0.8
    ;(sparkData.geo.getAttribute('aAlpha') as BufferAttribute).needsUpdate = true
  })

  return (
    <group position={[0, POOL_Y, 0]}>
      <mesh ref={floor} geometry={undefined} material={floorMat} rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false} renderOrder={-8}>
        <planeGeometry args={[9, 9]} />
      </mesh>
      {ringMats.map((m, i) => (
        <mesh
          key={i}
          ref={(r) => {
            rippleRefs.current[i] = r
          }}
          geometry={ringGeo}
          material={m}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.003, 0]}
          frustumCulled={false}
          renderOrder={-7}
        />
      ))}
      <group position={[0, -POOL_Y, 0]}>
        <points geometry={sparkData.geo} material={spark} frustumCulled={false} renderOrder={1800} />
      </group>
    </group>
  )
}
